/**
 * WORKFLOW EXECUTOR — the run half of the automation engine.
 *
 * Same shape as campaignEngine.ts, and for the same reasons: an internalAction
 * claims a bounded batch through an internalMutation, does the one thing that
 * needs the network (Resend), and self-reschedules rather than running one
 * long action. Convex actions have a wall-clock budget; a sequence with a
 * three-day delay step obviously cannot live inside one invocation.
 *
 * THE SEND GATE IS NOT OPTIONAL. `send_email_template` routes through
 * lib/emailGate.ts, the shared crmSendCounters daily budget, the CAN-SPAM
 * footer and the RFC 8058 one-click headers — the exact machinery a manual
 * campaign uses. This is the whole reason the gate was extracted: automation
 * sends unattended and at volume, so it must be held to a standard at least as
 * strict as a human clicking "send", never a laxer one.
 */

import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { insertActivity } from "./activities";
import { recordEmailSent } from "./lib/emailProgress";
import { applyOneTag } from "./tags";
import { applyStageMove } from "./deals";
import { checkEmailEligibility } from "./lib/emailGate";
import { renderMergeFields, appendComplianceFooter } from "./lib/merge";
import { sendViaResend } from "../lib/resend";
import { getBaseUrl } from "../lib/env";

const BATCH_SIZE = 20;
const SEND_INTERVAL_MS = 550; // ~2 req/sec, same ceiling campaignEngine respects
const CRM_DAILY_SEND_CAP = Number(process.env.CRM_DAILY_SEND_CAP ?? 500);
const CRM_POSTAL_ADDRESS = process.env.CRM_POSTAL_ADDRESS ?? "";
const CRM_FROM_NAME = process.env.CRM_FROM_NAME ?? "Ideal Oral Health";
const CRM_FROM_EMAIL = process.env.CRM_FROM_EMAIL;

type StepLogEntry = Doc<"crmWorkflowRuns">["stepLog"][number];

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function msUntilNextUtcMidnight(): number {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.getTime() - now.getTime();
}

/**
 * Move a run to its next step, or close it out. Every exit from a step goes
 * through here so `stepLog` is always complete — a skipped send that left no
 * trace would defeat the point of having a ledger.
 */
async function advanceRun(
  ctx: MutationCtx,
  run: Doc<"crmWorkflowRuns">,
  steps: Doc<"crmWorkflowSteps">[],
  entry: StepLogEntry,
): Promise<void> {
  const stepLog = [...run.stepLog, entry];
  const next = steps.filter((s) => s.order > run.currentStepOrder).sort((a, b) => a.order - b.order)[0];
  const now = Date.now();

  if (!next) {
    await ctx.db.patch(run._id, { status: "completed", stepLog, nextStepAt: undefined, completedAt: now });
    return;
  }
  await ctx.db.patch(run._id, {
    stepLog,
    currentStepOrder: next.order,
    nextStepAt: now + next.delayMinutes * 60_000,
  });
}

/** Resolve the contact a step should act on, whatever the run targets. */
async function resolveContact(
  ctx: MutationCtx,
  run: Doc<"crmWorkflowRuns">,
): Promise<Doc<"crmContacts"> | null> {
  if (run.targetType === "contact") {
    const id = ctx.db.normalizeId("crmContacts", run.targetId);
    return id ? await ctx.db.get(id) : null;
  }
  if (run.targetType === "deal") {
    const id = ctx.db.normalizeId("crmDeals", run.targetId);
    const deal = id ? await ctx.db.get(id) : null;
    if (deal?.primaryContactId) return await ctx.db.get(deal.primaryContactId);
    if (!deal) return null;
    return await ctx.db.query("crmContacts").withIndex("by_company", (q) => q.eq("companyId", deal.companyId)).first();
  }
  const id = ctx.db.normalizeId("crmCompanies", run.targetId);
  if (!id) return null;
  return await ctx.db.query("crmContacts").withIndex("by_company", (q) => q.eq("companyId", id)).first();
}

async function resolveCompanyId(
  ctx: MutationCtx,
  run: Doc<"crmWorkflowRuns">,
): Promise<Id<"crmCompanies"> | undefined> {
  if (run.targetType === "company") return ctx.db.normalizeId("crmCompanies", run.targetId) ?? undefined;
  if (run.targetType === "deal") {
    const id = ctx.db.normalizeId("crmDeals", run.targetId);
    const deal = id ? await ctx.db.get(id) : null;
    return deal?.companyId;
  }
  const id = ctx.db.normalizeId("crmContacts", run.targetId);
  const contact = id ? await ctx.db.get(id) : null;
  return contact?.companyId;
}

type PreparedSend = {
  kind: "send";
  runId: Id<"crmWorkflowRuns">;
  contactId: Id<"crmContacts">;
  to: string;
  subject: string;
  html: string;
  unsubscribeApiUrl: string;
};
type PrepareResult = { kind: "advanced" } | { kind: "idle" } | PreparedSend;

/**
 * Execute one step of one run. Everything that touches only the database is
 * finished here; only an outbound email escapes to the action layer.
 */
export const prepareNextStep = internalMutation({
  args: { runId: v.id("crmWorkflowRuns") },
  handler: async (ctx, args): Promise<PrepareResult> => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.status !== "pending_steps") return { kind: "idle" };
    if ((run.nextStepAt ?? 0) > Date.now()) return { kind: "idle" };

    const workflow = await ctx.db.get(run.workflowId);
    if (!workflow || !workflow.isActive) {
      await ctx.db.patch(run._id, { status: "cancelled", completedAt: Date.now() });
      return { kind: "idle" };
    }

    const steps = await ctx.db
      .query("crmWorkflowSteps")
      .withIndex("by_workflow_order", (q) => q.eq("workflowId", run.workflowId))
      .collect();
    const step = steps.find((s) => s.order === run.currentStepOrder);
    if (!step) {
      await ctx.db.patch(run._id, { status: "completed", completedAt: Date.now(), nextStepAt: undefined });
      return { kind: "idle" };
    }

    const now = Date.now();
    const base = { order: step.order, actionType: step.actionType, at: now };
    const config = step.actionConfig;

    try {
      switch (step.actionType) {
        case "create_task": {
          const contact = await resolveContact(ctx, run);
          const companyId = await resolveCompanyId(ctx, run);
          const dealId = run.targetType === "deal" ? ctx.db.normalizeId("crmDeals", run.targetId) ?? undefined : undefined;
          const owner =
            config.assignTo && config.assignTo !== "owner"
              ? config.assignTo
              : contact?.ownerClerkUserId ?? workflow.createdBy;

          await ctx.db.insert("crmTasks", {
            contactId: contact?._id,
            companyId,
            dealId,
            title: config.taskTitle ?? `${workflow.name} follow-up`,
            taskType: (config.taskType as Doc<"crmTasks">["taskType"]) ?? "follow_up",
            dueAt: now + (config.dueInDays ?? 1) * 24 * 60 * 60 * 1000,
            status: "open",
            assigneeClerkUserId: owner,
            createdBy: workflow.createdBy,
            createdAt: now,
            updatedAt: now,
          });
          await advanceRun(ctx, run, steps, { ...base, outcome: "done", detail: config.taskTitle });
          return { kind: "advanced" };
        }

        case "apply_tag":
        case "remove_tag": {
          if (!config.tagId) {
            await advanceRun(ctx, run, steps, { ...base, outcome: "skipped", detail: "no tag configured" });
            return { kind: "advanced" };
          }
          const contact = await resolveContact(ctx, run);
          const companyId = run.targetType === "company" ? await resolveCompanyId(ctx, run) : undefined;

          if (step.actionType === "apply_tag") {
            // Reuses tags.ts:applyOneTag so exclusive-category semantics and
            // the denormalised tagIds cache behave identically to a human
            // applying the tag by hand.
            await applyOneTag(ctx, { contactId: contact?._id, companyId }, config.tagId, workflow.createdBy);
          } else if (contact) {
            const link = await ctx.db
              .query("crmContactTags")
              .withIndex("by_tag_contact", (q) => q.eq("tagId", config.tagId!).eq("contactId", contact._id))
              .first();
            if (link) {
              await ctx.db.delete(link._id);
              const tag = await ctx.db.get(config.tagId);
              if (tag) await ctx.db.patch(config.tagId, { contactCount: Math.max(0, tag.contactCount - 1) });
              await ctx.db.patch(contact._id, { tagIds: contact.tagIds.filter((t) => t !== config.tagId) });
            }
          }
          await advanceRun(ctx, run, steps, { ...base, outcome: "done" });
          return { kind: "advanced" };
        }

        case "update_deal_stage": {
          const dealId = ctx.db.normalizeId("crmDeals", run.targetId);
          const deal = dealId ? await ctx.db.get(dealId) : null;
          if (!deal || !config.stageId) {
            await advanceRun(ctx, run, steps, { ...base, outcome: "skipped", detail: "no deal or stage configured" });
            return { kind: "advanced" };
          }
          // Same helper the Kanban drag uses — identical timeline history.
          await applyStageMove(ctx, {
            deal,
            stageId: config.stageId,
            actor: { name: `Workflow: ${workflow.name}`, actorType: "system" },
          });
          await advanceRun(ctx, run, steps, { ...base, outcome: "done" });
          return { kind: "advanced" };
        }

        case "add_note":
        case "notify_owner": {
          const contact = await resolveContact(ctx, run);
          const companyId = await resolveCompanyId(ctx, run);
          const dealId = run.targetType === "deal" ? ctx.db.normalizeId("crmDeals", run.targetId) ?? undefined : undefined;
          await insertActivity(ctx, {
            contactId: contact?._id,
            companyId,
            dealId,
            activityType: step.actionType === "add_note" ? "note" : "system",
            title: step.actionType === "add_note" ? "Workflow note" : `Workflow: ${workflow.name}`,
            body: config.message,
            isTouch: false,
            actorType: "system",
            actorName: `Workflow: ${workflow.name}`,
          });
          await advanceRun(ctx, run, steps, { ...base, outcome: "done" });
          return { kind: "advanced" };
        }

        case "send_email_template": {
          const contact = await resolveContact(ctx, run);
          if (!contact || !config.templateId) {
            await advanceRun(ctx, run, steps, { ...base, outcome: "skipped", detail: "no contact or template" });
            return { kind: "advanced" };
          }
          const template = await ctx.db.get(config.templateId);
          if (!template || template.isArchived) {
            await advanceRun(ctx, run, steps, { ...base, outcome: "skipped", detail: "template missing or archived" });
            return { kind: "advanced" };
          }

          // THE GATE. Identical ladder to a manual campaign build.
          const eligibility = await checkEmailEligibility(ctx, contact);
          if (!eligibility.emailable) {
            await advanceRun(ctx, run, steps, { ...base, outcome: "skipped", detail: eligibility.reason ?? "not emailable" });
            return { kind: "advanced" };
          }

          // Shared daily budget with campaigns — one CRM outbound quota, not
          // a second parallel one automation could quietly blow past.
          const day = todayUtc();
          const counter = await ctx.db.query("crmSendCounters").withIndex("by_day", (q) => q.eq("day", day)).first();
          if ((counter?.sentCount ?? 0) >= CRM_DAILY_SEND_CAP) {
            // Hold the step; retry after midnight rather than dropping it.
            await ctx.db.patch(run._id, { nextStepAt: Date.now() + msUntilNextUtcMidnight() });
            return { kind: "idle" };
          }
          if (counter) await ctx.db.patch(counter._id, { sentCount: counter.sentCount + 1, updatedAt: now });
          else await ctx.db.insert("crmSendCounters", { day, sentCount: 1, updatedAt: now });

          const mergeData: Record<string, string | undefined> = {
            firstName: contact.firstName,
            lastName: contact.lastName,
            fullName: contact.fullName,
            companyName: contact.companyName,
            jobTitle: contact.jobTitle,
          };
          // The contact's own id doubles as its unsubscribe token — the
          // established pattern for sends with no per-recipient row
          // (see suppressions.ts:resolveUnsubscribeTarget).
          const unsubscribePageUrl = `${getBaseUrl()}/unsubscribe/${contact._id}`;
          const renderedBody = renderMergeFields(template.bodyHtml, mergeData);
          const html = CRM_POSTAL_ADDRESS
            ? appendComplianceFooter(renderedBody, {
                postalAddress: CRM_POSTAL_ADDRESS,
                unsubscribeUrl: unsubscribePageUrl,
                companyName: CRM_FROM_NAME,
              })
            : renderedBody;

          return {
            kind: "send",
            runId: run._id,
            contactId: contact._id,
            to: eligibility.email!,
            subject: renderMergeFields(template.subject, mergeData),
            html,
            unsubscribeApiUrl: `${getBaseUrl()}/api/crm/unsubscribe?token=${contact._id}`,
          };
        }
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await advanceRun(ctx, run, steps, { ...base, outcome: "failed", detail });
      await ctx.db.patch(run._id, { lastError: detail });
      return { kind: "advanced" };
    }

    return { kind: "idle" };
  },
});

/** Close out a send step once the action knows whether Resend accepted it. */
export const recordSendOutcome = internalMutation({
  args: {
    runId: v.id("crmWorkflowRuns"),
    contactId: v.id("crmContacts"),
    subject: v.string(),
    resendEmailId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return;
    const [workflow, steps, contact] = await Promise.all([
      ctx.db.get(run.workflowId),
      ctx.db.query("crmWorkflowSteps").withIndex("by_workflow_order", (q) => q.eq("workflowId", run.workflowId)).collect(),
      ctx.db.get(args.contactId),
    ]);

    const entry: StepLogEntry = {
      order: run.currentStepOrder,
      actionType: "send_email_template",
      outcome: args.resendEmailId ? "done" : "failed",
      detail: args.error,
      at: Date.now(),
    };

    if (args.resendEmailId && contact) {
      // resendEmailId on the timeline row is what lets convex/emailEvents.ts
      // match delivery/open/bounce webhooks back to this send.
      await insertActivity(ctx, {
        contactId: args.contactId,
        companyId: contact.companyId,
        activityType: "email_outbound",
        title: `Email: ${args.subject}`,
        isTouch: true,
        direction: "outbound",
        resendEmailId: args.resendEmailId,
        emailSubject: args.subject,
        emailTo: contact.email,
        actorType: "system",
        actorName: workflow ? `Workflow: ${workflow.name}` : "Workflow",
      });
      // advanceSequence: true — an automated workflow send IS a drip step, the
      // same as a campaign send. Held to the same standard as the gate above.
      await recordEmailSent(ctx, args.contactId, { advanceSequence: true });
    }

    await advanceRun(ctx, run, steps, entry);
  },
});

export const claimDueRuns = internalQuery({
  args: {},
  handler: async (ctx) => {
    const due = await ctx.db
      .query("crmWorkflowRuns")
      .withIndex("by_due", (q) => q.eq("status", "pending_steps").lte("nextStepAt", Date.now()))
      .take(BATCH_SIZE);
    return due.map((r) => r._id);
  },
});

/**
 * The drain loop. Rescheduled by fireWorkflowTrigger on enqueue and by the
 * cron sweep.
 *
 * It drains batches in a loop rather than re-scheduling itself after every
 * batch, and only hands off to a fresh invocation when it stops because it hit
 * the per-invocation budget — NOT merely because it did some work. An
 * unconditional self-reschedule would keep the engine waking up on a timer
 * forever after any activity, and would leave a scheduled function dangling
 * behind every test.
 *
 * A run whose next step is not yet due is simply not claimed; the 5-minute
 * cron picks it up when its resume time arrives.
 */
const MAX_BATCHES_PER_TICK = 5;

export const tick = internalAction({
  args: {},
  handler: async (ctx): Promise<{ processed: number }> => {
    let processed = 0;
    let hitBudget = false;

    for (let batch = 0; batch < MAX_BATCHES_PER_TICK; batch++) {
      const runIds = await ctx.runQuery(internal.crm.workflowEngine.claimDueRuns, {});
      if (runIds.length === 0) break;

      for (const runId of runIds) {
        const result = await ctx.runMutation(internal.crm.workflowEngine.prepareNextStep, { runId });
        processed++;
        if (result.kind !== "send") continue;

        const sendResult = await sendViaResend({
          to: result.to,
          subject: result.subject,
          html: result.html,
          from: CRM_FROM_EMAIL ? `${CRM_FROM_NAME} <${CRM_FROM_EMAIL}>` : undefined,
          category: "crm-workflow",
          headers: {
            "List-Unsubscribe": `<${result.unsubscribeApiUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          idempotencyKey: `crm-workflow-${result.runId}-${result.contactId}`,
          useOutreachKey: true,
        });

        await ctx.runMutation(internal.crm.workflowEngine.recordSendOutcome, {
          runId: result.runId,
          contactId: result.contactId,
          subject: result.subject,
          resendEmailId: sendResult.messageId,
          error: sendResult.error,
        });

        await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS));
      }

      if (batch === MAX_BATCHES_PER_TICK - 1) hitBudget = true;
    }

    // Only continue in a new invocation if we ran out of budget, not work.
    if (hitBudget) await ctx.scheduler.runAfter(1000, internal.crm.workflowEngine.tick, {});
    return { processed };
  },
});
