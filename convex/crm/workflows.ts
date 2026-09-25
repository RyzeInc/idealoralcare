/**
 * WORKFLOW CRUD — the staff-facing surface over crmWorkflows/Steps/Runs.
 *
 * Validation lives here rather than in the schema because trigger and action
 * config are one shared object shape per table (Convex validators can't
 * discriminate a union of object shapes by a sibling field). `assertTrigger`
 * and `assertAction` are what make a stored rule trustworthy — the engine runs
 * unattended, so a rule that is malformed must be rejected at write time, not
 * discovered at 2am when it silently skips every step.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { requireCrmUser, requireCrmManager } from "./guards";
import { recordAdminAction } from "../admin/adminAudit";
import { fireWorkflowTrigger } from "./workflowTriggers";

const TRIGGER_VALIDATOR = v.union(
  v.literal("contact_created"), v.literal("company_created"), v.literal("deal_created"),
  v.literal("stage_entered"), v.literal("tag_applied"), v.literal("status_changed"),
  v.literal("no_activity_days"), v.literal("manual"),
);

const ACTION_VALIDATOR = v.union(
  v.literal("create_task"), v.literal("apply_tag"), v.literal("remove_tag"),
  v.literal("update_deal_stage"), v.literal("send_email_template"),
  v.literal("notify_owner"), v.literal("add_note"),
);

const TRIGGER_CONFIG_VALIDATOR = v.object({
  stageId: v.optional(v.id("crmPipelineStages")),
  tagId: v.optional(v.id("crmTags")),
  status: v.optional(v.string()),
  days: v.optional(v.number()),
});

const ACTION_CONFIG_VALIDATOR = v.object({
  taskType: v.optional(v.string()),
  taskTitle: v.optional(v.string()),
  dueInDays: v.optional(v.number()),
  assignTo: v.optional(v.string()),
  tagId: v.optional(v.id("crmTags")),
  stageId: v.optional(v.id("crmPipelineStages")),
  templateId: v.optional(v.id("crmEmailTemplates")),
  message: v.optional(v.string()),
});

type TriggerType = Doc<"crmWorkflows">["triggerType"];
type ActionType = Doc<"crmWorkflowSteps">["actionType"];

function assertTrigger(triggerType: TriggerType, config: Doc<"crmWorkflows">["triggerConfig"]) {
  if (triggerType === "no_activity_days") {
    if (!config.days || config.days < 1) throw new Error("A no-activity trigger needs a day count of at least 1");
    if (config.days > 365) throw new Error("A no-activity trigger cannot exceed 365 days");
  }
  if (triggerType === "status_changed" && !config.status) {
    throw new Error("A status-changed trigger needs a target status");
  }
}

function assertAction(actionType: ActionType, config: Doc<"crmWorkflowSteps">["actionConfig"]) {
  switch (actionType) {
    case "create_task":
      if (!config.taskTitle?.trim()) throw new Error("A task step needs a title");
      if (config.dueInDays !== undefined && config.dueInDays < 0) throw new Error("Task due-in-days cannot be negative");
      break;
    case "apply_tag":
    case "remove_tag":
      if (!config.tagId) throw new Error("A tag step needs a tag");
      break;
    case "update_deal_stage":
      if (!config.stageId) throw new Error("A stage step needs a target stage");
      break;
    case "send_email_template":
      if (!config.templateId) throw new Error("An email step needs a template");
      break;
    case "notify_owner":
    case "add_note":
      if (!config.message?.trim()) throw new Error("This step needs a message");
      break;
  }
}

// ---------------------------------------------------------------- queries

export const listWorkflows = query({
  args: {},
  handler: async (ctx) => {
    await requireCrmUser(ctx);
    const workflows = await ctx.db.query("crmWorkflows").withIndex("by_created").order("desc").take(200);
    return await Promise.all(
      workflows.map(async (workflow) => {
        const steps = await ctx.db
          .query("crmWorkflowSteps")
          .withIndex("by_workflow_order", (q) => q.eq("workflowId", workflow._id))
          .collect();
        return { workflow, stepCount: steps.length };
      })
    );
  },
});

export const getWorkflow = query({
  args: { workflowId: v.id("crmWorkflows") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const workflow = await ctx.db.get(args.workflowId);
    if (!workflow) return null;
    const steps = (
      await ctx.db.query("crmWorkflowSteps").withIndex("by_workflow_order", (q) => q.eq("workflowId", args.workflowId)).collect()
    ).sort((a, b) => a.order - b.order);
    return { workflow, steps };
  },
});

/** The "why did/didn't this fire" view — the reason the ledger exists. */
export const listRuns = query({
  args: { workflowId: v.id("crmWorkflows"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    return await ctx.db
      .query("crmWorkflowRuns")
      .withIndex("by_workflow_fired", (q) => q.eq("workflowId", args.workflowId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

// ---------------------------------------------------------------- mutations

export const createWorkflow = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    entity: v.union(v.literal("contact"), v.literal("company"), v.literal("deal")),
    triggerType: TRIGGER_VALIDATOR,
    triggerConfig: TRIGGER_CONFIG_VALIDATOR,
  },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    assertTrigger(args.triggerType, args.triggerConfig);
    const now = Date.now();
    return await ctx.db.insert("crmWorkflows", {
      name: args.name.trim(),
      description: args.description,
      // Always created inactive: a rule that starts firing the instant it is
      // saved, before any step exists, is never what the author meant.
      isActive: false,
      entity: args.entity,
      triggerType: args.triggerType,
      triggerConfig: args.triggerConfig,
      runCount: 0,
      createdBy: identity.clerkUserId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateWorkflow = mutation({
  args: {
    workflowId: v.id("crmWorkflows"),
    name: v.string(),
    description: v.optional(v.string()),
    triggerType: TRIGGER_VALIDATOR,
    triggerConfig: TRIGGER_CONFIG_VALIDATOR,
  },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    assertTrigger(args.triggerType, args.triggerConfig);
    await ctx.db.patch(args.workflowId, {
      name: args.name.trim(),
      description: args.description,
      triggerType: args.triggerType,
      triggerConfig: args.triggerConfig,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Activation is a manager action and is audited. An active workflow can email
 * unattended — that is a materially different privilege from editing a draft.
 */
export const setWorkflowActive = mutation({
  args: { workflowId: v.id("crmWorkflows"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await requireCrmManager(ctx);
    const workflow = await ctx.db.get(args.workflowId);
    if (!workflow) throw new Error("Workflow not found");

    if (args.isActive) {
      const steps = await ctx.db
        .query("crmWorkflowSteps")
        .withIndex("by_workflow_order", (q) => q.eq("workflowId", args.workflowId))
        .collect();
      if (steps.length === 0) throw new Error("Add at least one step before activating this workflow");
    }

    await ctx.db.patch(args.workflowId, { isActive: args.isActive, updatedAt: Date.now() });
    await recordAdminAction(ctx, identity, {
      action: args.isActive ? "crm.workflow.activate" : "crm.workflow.deactivate",
      targetType: "crmWorkflows",
      targetId: args.workflowId,
      summary: `${args.isActive ? "Activated" : "Deactivated"} workflow "${workflow.name}"`,
    });
  },
});

export const addStep = mutation({
  args: {
    workflowId: v.id("crmWorkflows"),
    actionType: ACTION_VALIDATOR,
    actionConfig: ACTION_CONFIG_VALIDATOR,
    delayMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    assertAction(args.actionType, args.actionConfig);
    if (args.delayMinutes < 0) throw new Error("Delay cannot be negative");

    const siblings = await ctx.db
      .query("crmWorkflowSteps")
      .withIndex("by_workflow_order", (q) => q.eq("workflowId", args.workflowId))
      .collect();
    const order = siblings.length > 0 ? Math.max(...siblings.map((s) => s.order)) + 10 : 0;

    const now = Date.now();
    return await ctx.db.insert("crmWorkflowSteps", {
      workflowId: args.workflowId,
      order,
      delayMinutes: args.delayMinutes,
      actionType: args.actionType,
      actionConfig: args.actionConfig,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateStep = mutation({
  args: {
    stepId: v.id("crmWorkflowSteps"),
    actionType: ACTION_VALIDATOR,
    actionConfig: ACTION_CONFIG_VALIDATOR,
    delayMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    assertAction(args.actionType, args.actionConfig);
    if (args.delayMinutes < 0) throw new Error("Delay cannot be negative");
    await ctx.db.patch(args.stepId, {
      actionType: args.actionType,
      actionConfig: args.actionConfig,
      delayMinutes: args.delayMinutes,
      updatedAt: Date.now(),
    });
  },
});

export const deleteStep = mutation({
  args: { stepId: v.id("crmWorkflowSteps") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    await ctx.db.delete(args.stepId);
  },
});

export const reorderSteps = mutation({
  args: { workflowId: v.id("crmWorkflows"), orderedStepIds: v.array(v.id("crmWorkflowSteps")) },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    for (const [index, stepId] of args.orderedStepIds.entries()) {
      const step = await ctx.db.get(stepId);
      if (!step || step.workflowId !== args.workflowId) continue;
      await ctx.db.patch(stepId, { order: index * 10, updatedAt: Date.now() });
    }
  },
});

export const deleteWorkflow = mutation({
  args: { workflowId: v.id("crmWorkflows") },
  handler: async (ctx, args) => {
    const identity = await requireCrmManager(ctx);
    const workflow = await ctx.db.get(args.workflowId);
    if (!workflow) return;

    const steps = await ctx.db.query("crmWorkflowSteps").withIndex("by_workflow_order", (q) => q.eq("workflowId", args.workflowId)).collect();
    for (const step of steps) await ctx.db.delete(step._id);
    const runs = await ctx.db.query("crmWorkflowRuns").withIndex("by_workflow_fired", (q) => q.eq("workflowId", args.workflowId)).collect();
    for (const run of runs) await ctx.db.delete(run._id);

    await ctx.db.delete(args.workflowId);
    await recordAdminAction(ctx, identity, {
      action: "crm.workflow.delete",
      targetType: "crmWorkflows",
      targetId: args.workflowId,
      summary: `Deleted workflow "${workflow.name}" and ${runs.length} run record(s)`,
    });
  },
});

/** Run a rule against one record on demand — the manual trigger, and the way to test a draft safely. */
export const runWorkflowNow = mutation({
  args: {
    workflowId: v.id("crmWorkflows"),
    targetType: v.union(v.literal("contact"), v.literal("company"), v.literal("deal")),
    targetId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const workflow = await ctx.db.get(args.workflowId);
    if (!workflow) throw new Error("Workflow not found");
    if (workflow.entity !== args.targetType) {
      throw new Error(`This workflow targets ${workflow.entity} records, not ${args.targetType}`);
    }
    const runIds = await fireWorkflowTrigger(ctx, {
      triggerType: workflow.triggerType,
      targetType: args.targetType,
      targetId: args.targetId,
      occurrenceKey: `manual:${Date.now()}`,
      onlyWorkflowId: args.workflowId,
    });
    return { enqueued: runIds.length };
  },
});
