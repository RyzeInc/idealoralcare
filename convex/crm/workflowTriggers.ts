/**
 * WORKFLOW TRIGGERS — the enqueue half of the automation engine.
 *
 * Kept separate from workflowEngine.ts so ordinary mutations (deals.ts,
 * tags.ts, contacts.ts) can fire a trigger without importing the executor's
 * action-only code. This is the single call site rule insertActivity follows:
 * one function decides whether a rule matches and whether it has already run,
 * so no caller can accidentally invent its own dedupe semantics.
 *
 * OCCURRENCE KEYS. Dedupe is (workflowId, targetId, occurrenceKey), never
 * (workflowId, targetId). A deal that genuinely re-enters a stage next quarter
 * SHOULD re-fire; a duplicate event for the same entry must not. So the key
 * encodes the occurrence — `stage:<stageId>:<stageChangedAt>` — rather than
 * just the record. Time-based triggers use a day bucket so they fire at most
 * once per record per day.
 */

import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";

type TriggerType = Doc<"crmWorkflows">["triggerType"];
type TargetType = Doc<"crmWorkflowRuns">["targetType"];

export interface FireTriggerArgs {
  triggerType: TriggerType;
  targetType: TargetType;
  targetId: string;
  occurrenceKey: string;
  /** Trigger-specific discriminators matched against triggerConfig. */
  stageId?: Id<"crmPipelineStages">;
  tagId?: Id<"crmTags">;
  status?: string;
  /**
   * Run exactly this workflow, bypassing the isActive and triggerType filters.
   * Used only by the "run now" button, which must be able to dry-run a DRAFT
   * rule against one record — the safe way to check a rule before arming it.
   * Dedupe still applies, so a manual run cannot double-fire.
   */
  onlyWorkflowId?: Id<"crmWorkflows">;
}

function matchesConfig(workflow: Doc<"crmWorkflows">, args: FireTriggerArgs): boolean {
  const config = workflow.triggerConfig;
  switch (workflow.triggerType) {
    case "stage_entered":
      // An unset stageId means "any stage" — a deliberate convenience for
      // "notify me whenever a deal moves at all".
      return !config.stageId || config.stageId === args.stageId;
    case "tag_applied":
      return !config.tagId || config.tagId === args.tagId;
    case "status_changed":
      return !config.status || config.status === args.status;
    default:
      return true;
  }
}

/**
 * Match active workflows, drop anything already run for this occurrence, and
 * enqueue a run. Returns the ids enqueued (empty is the common case).
 *
 * Never throws into its caller: a broken automation rule must not be able to
 * fail the business mutation that triggered it (a stage move must succeed even
 * if a workflow row is malformed).
 */
export async function fireWorkflowTrigger(
  ctx: MutationCtx,
  args: FireTriggerArgs,
): Promise<Id<"crmWorkflowRuns">[]> {
  try {
    let workflows: Doc<"crmWorkflows">[];
    if (args.onlyWorkflowId) {
      const one = await ctx.db.get(args.onlyWorkflowId);
      workflows = one ? [one] : [];
    } else {
      workflows = await ctx.db
        .query("crmWorkflows")
        .withIndex("by_active_trigger", (q) => q.eq("isActive", true).eq("triggerType", args.triggerType))
        .collect();
    }

    const enqueued: Id<"crmWorkflowRuns">[] = [];
    const now = Date.now();

    for (const workflow of workflows) {
      if (workflow.entity !== args.targetType) continue;
      // A targeted manual run has already chosen its rule — config matching
      // would just re-filter the very thing the operator asked for.
      if (!args.onlyWorkflowId && !matchesConfig(workflow, args)) continue;

      const already = await ctx.db
        .query("crmWorkflowRuns")
        .withIndex("by_dedupe", (q) =>
          q.eq("workflowId", workflow._id).eq("targetId", args.targetId).eq("occurrenceKey", args.occurrenceKey),
        )
        .first();
      if (already) continue;

      const steps = await ctx.db
        .query("crmWorkflowSteps")
        .withIndex("by_workflow_order", (q) => q.eq("workflowId", workflow._id))
        .collect();
      if (steps.length === 0) continue; // a rule with no steps is a no-op, not a run

      const firstStep = steps.sort((a, b) => a.order - b.order)[0];
      const runId = await ctx.db.insert("crmWorkflowRuns", {
        workflowId: workflow._id,
        targetType: args.targetType,
        targetId: args.targetId,
        occurrenceKey: args.occurrenceKey,
        status: "pending_steps",
        currentStepOrder: firstStep.order,
        nextStepAt: now + firstStep.delayMinutes * 60_000,
        stepLog: [],
        firedAt: now,
      });

      await ctx.db.patch(workflow._id, {
        runCount: workflow.runCount + 1,
        lastRunAt: now,
        updatedAt: now,
      });

      enqueued.push(runId);
    }

    if (enqueued.length > 0) {
      await ctx.scheduler.runAfter(0, internal.crm.workflowEngine.tick, {});
    }
    return enqueued;
  } catch (error) {
    console.error("fireWorkflowTrigger failed (business mutation unaffected)", {
      triggerType: args.triggerType,
      targetId: args.targetId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Time-based sweep for `no_activity_days`. Cron-driven (convex/crons.ts) —
 * the day bucket in the occurrence key is what stops a stale record from
 * re-firing on every single sweep.
 */
export const sweepTimeTriggers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const workflows = await ctx.db
      .query("crmWorkflows")
      .withIndex("by_active_trigger", (q) => q.eq("isActive", true).eq("triggerType", "no_activity_days"))
      .collect();
    if (workflows.length === 0) return { checked: 0, fired: 0 };

    const now = Date.now();
    const dayBucket = new Date(now).toISOString().slice(0, 10);
    const SCAN_CAP = 2000;
    let checked = 0;
    let fired = 0;

    for (const workflow of workflows) {
      const days = workflow.triggerConfig.days;
      if (!days || days <= 0) continue;
      const cutoff = now - days * 24 * 60 * 60 * 1000;

      if (workflow.entity === "contact") {
        const stale = (
          await ctx.db.query("crmContacts").withIndex("by_last_activity").order("asc").take(SCAN_CAP)
        ).filter((c) => !c.isArchived && (c.lastActivityAt ?? c.createdAt) < cutoff);
        checked += stale.length;
        for (const contact of stale) {
          const ids = await fireWorkflowTrigger(ctx, {
            triggerType: "no_activity_days",
            targetType: "contact",
            targetId: contact._id,
            occurrenceKey: `stale:${dayBucket}`,
          });
          fired += ids.length;
        }
      } else if (workflow.entity === "deal") {
        const stale = (
          await ctx.db.query("crmDeals").withIndex("by_updated").order("asc").take(SCAN_CAP)
        ).filter((d) => !d.isArchived && (d.lastActivityAt ?? d.updatedAt) < cutoff);
        checked += stale.length;
        for (const deal of stale) {
          const ids = await fireWorkflowTrigger(ctx, {
            triggerType: "no_activity_days",
            targetType: "deal",
            targetId: deal._id,
            occurrenceKey: `stale:${dayBucket}`,
          });
          fired += ids.length;
        }
      }
    }

    return { checked, fired };
  },
});

