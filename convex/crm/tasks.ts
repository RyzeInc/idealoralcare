/**
 * CRM TASKS — lightweight follow-up reminders, not a full task management
 * system. "Call back Tuesday" and "send the proposal" are what this is for.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireCrmUser } from "./guards";
import { insertActivity } from "./activities";

const TASK_TYPE_VALIDATOR = v.union(v.literal("call"), v.literal("email"), v.literal("follow_up"), v.literal("meeting"), v.literal("other"));

export const listMyTasks = query({
  args: { includeDone: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const status = args.includeDone ? undefined : "open";
    const tasks = status
      ? await ctx.db.query("crmTasks").withIndex("by_assignee_status_due", (q) => q.eq("assigneeClerkUserId", identity.clerkUserId).eq("status", "open")).collect()
      : await ctx.db.query("crmTasks").withIndex("by_assignee_status_due", (q) => q.eq("assigneeClerkUserId", identity.clerkUserId)).collect();
    return tasks.sort((a, b) => a.dueAt - b.dueAt);
  },
});

export const listTasksForContact = query({
  args: { contactId: v.id("crmContacts") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    return await ctx.db.query("crmTasks").withIndex("by_contact_status", (q) => q.eq("contactId", args.contactId)).collect();
  },
});

export const createTask = mutation({
  args: {
    contactId: v.optional(v.id("crmContacts")),
    companyId: v.optional(v.id("crmCompanies")),
    title: v.string(),
    body: v.optional(v.string()),
    taskType: TASK_TYPE_VALIDATOR,
    dueAt: v.number(),
    assigneeClerkUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const now = Date.now();
    const taskId = await ctx.db.insert("crmTasks", {
      contactId: args.contactId,
      companyId: args.companyId,
      title: args.title,
      body: args.body,
      taskType: args.taskType,
      dueAt: args.dueAt,
      status: "open",
      assigneeClerkUserId: args.assigneeClerkUserId ?? identity.clerkUserId,
      createdBy: identity.clerkUserId,
      createdAt: now,
      updatedAt: now,
    });

    if (args.contactId) {
      await ctx.db.patch(args.contactId, { nextTaskAt: args.dueAt });
      await insertActivity(ctx, {
        contactId: args.contactId, activityType: "task_created", title: `Task: ${args.title}`,
        actorType: "staff", actorClerkUserId: identity.clerkUserId, actorName: identity.name ?? identity.email ?? "Staff",
      });
    }
    return taskId;
  },
});

export const completeTask = mutation({
  args: { taskId: v.id("crmTasks") },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    const now = Date.now();
    await ctx.db.patch(args.taskId, { status: "done", completedAt: now, updatedAt: now });

    if (task.contactId) {
      await insertActivity(ctx, {
        contactId: task.contactId, activityType: "task_completed", title: `Completed: ${task.title}`,
        actorType: "staff", actorClerkUserId: identity.clerkUserId, actorName: identity.name ?? identity.email ?? "Staff",
      });
    }
  },
});

export const snoozeTask = mutation({
  args: { taskId: v.id("crmTasks"), newDueAt: v.number() },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await ctx.db.patch(args.taskId, { dueAt: args.newDueAt, updatedAt: Date.now() });
    if (task.contactId) await ctx.db.patch(task.contactId, { nextTaskAt: args.newDueAt });
  },
});

export const cancelTask = mutation({
  args: { taskId: v.id("crmTasks") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    await ctx.db.patch(args.taskId, { status: "cancelled", updatedAt: Date.now() });
  },
});
