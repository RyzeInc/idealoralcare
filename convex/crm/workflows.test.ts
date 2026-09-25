/**
 * WORKFLOW AUTOMATION — the two things that must never regress.
 *
 * 1. THE SEND GATE. A workflow can email unattended and at volume. If it ever
 *    becomes possible for an opted-out, hard-bounced or suppressed contact to
 *    receive an automated email, that is a CAN-SPAM violation shipped at scale
 *    before anyone notices. These tests assert the step is SKIPPED and logged.
 *
 * 2. OCCURRENCE SEMANTICS. Dedupe keyed on the record alone would stop a deal
 *    that legitimately re-enters a stage next quarter from re-firing; no dedupe
 *    at all would let one event fire a rule repeatedly. The occurrence key has
 *    to distinguish those two cases.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import { ensureDefaultPipeline } from "./pipelines";
import { fireWorkflowTrigger } from "./workflowTriggers";
import type { Id } from "../_generated/dataModel";

const tok = (id: string) => ({ tokenIdentifier: `https://test.clerk.dev|${id}` });

/**
 * Fully-typed test handles. `ReturnType<typeof convexTest>` without the schema
 * argument degrades to an index-less, `any`-shaped data model, which silently
 * switches OFF type checking inside every helper that takes one — table names,
 * index names and document shapes all stop being verified. Deriving the type
 * from an actual `convexTest(schema)` call keeps the helpers honest.
 */
type TestCtx = ReturnType<typeof convexTest<(typeof schema)["tables"]>>;
type IdentityCtx = ReturnType<TestCtx["withIdentity"]>;


async function seedStaff(t: TestCtx, clerkUserId = "staff_owner"): Promise<IdentityCtx> {
  await t.run(async (ctx) => {
    await ctx.db.insert("adminUsers", {
      clerkUserId, email: "o@t.dev", name: "Owner", role: "owner", createdAt: Date.now(),
    });
  });
  return t.withIdentity(tok(clerkUserId));
}

async function seedContact(
  t: TestCtx,
  overrides: Partial<{
    email: string;
    emailOptOut: boolean;
    emailStatus: "unknown" | "valid" | "bounced_soft" | "bounced_hard" | "complained" | "unsubscribed";
  }> = {},
): Promise<Id<"crmContacts">> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const email = overrides.email ?? "jamie@acme.test";
    return await ctx.db.insert("crmContacts", {
      firstName: "Jamie", lastName: "Example", fullName: "Jamie Example",
      email, emailLower: email.toLowerCase(),
      status: "new", statusChangedAt: now, tagIds: [],
      emailOptOut: overrides.emailOptOut ?? false,
      callOptOut: false,
      emailStatus: overrides.emailStatus ?? "unknown",
      phoneStatus: "unknown",
      source: "manual",
      emailsSentCount: 0, callsMadeCount: 0, callsConnectedCount: 0,
      isArchived: false, searchText: "jamie example",
      createdAt: now, updatedAt: now,
    });
  });
}

async function seedEmailWorkflow(
  t: TestCtx,
  asStaff: IdentityCtx,
): Promise<{ workflowId: Id<"crmWorkflows">; templateId: Id<"crmEmailTemplates"> }> {
  const templateId = await asStaff.mutation(api.crm.email.saveTemplate, {
    name: "Intro", subject: "Hello {{firstName}}", bodyHtml: "<p>Hi {{firstName}}</p>",
  });
  const workflowId = await asStaff.mutation(api.crm.workflows.createWorkflow, {
    name: "Welcome sequence",
    entity: "contact",
    triggerType: "contact_created",
    triggerConfig: {},
  });
  await asStaff.mutation(api.crm.workflows.addStep, {
    workflowId, actionType: "send_email_template", delayMinutes: 0, actionConfig: { templateId },
  });
  await asStaff.mutation(api.crm.workflows.setWorkflowActive, { workflowId, isActive: true });
  return { workflowId, templateId };
}

/**
 * Drain the scheduler's ready queue.
 *
 * fireWorkflowTrigger schedules the drain action, and convex-test executes
 * scheduled functions on a real microtask queue — left alone, that action
 * lands AFTER the test's database fake is torn down and surfaces as an
 * unhandled rejection. Flushing here keeps each test self-contained. The
 * no-op timer advance deliberately does not fire tick's own 1s
 * self-reschedule, which would otherwise loop.
 */
async function flushScheduler(t: TestCtx) {
  // Yield to the macrotask queue first. convex-test only waits on jobs already
  // in the `inProgress` state, and a runAfter(0) job is still `pending` until
  // its real setTimeout fires — without this yield the flush is a no-op and
  // the job lands after teardown as an unhandled rejection.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await t.finishAllScheduledFunctions(() => {});
}

/** Runs one step of the given run through the engine's mutation half. */
async function stepOnce(t: TestCtx, runId: Id<"crmWorkflowRuns">) {
  return await t.mutation(internal.crm.workflowEngine.prepareNextStep, { runId });
}

async function onlyRun(t: TestCtx): Promise<Id<"crmWorkflowRuns">> {
  const runs = await t.run(async (ctx) => await ctx.db.query("crmWorkflowRuns").collect());
  expect(runs).toHaveLength(1);
  return runs[0]._id;
}

/**
 * Enqueue a run WITHOUT going through fireWorkflowTrigger, so the engine's
 * step logic can be tested in isolation. fireWorkflowTrigger schedules the
 * drain action, and letting that run concurrently would make "did this step
 * produce a send payload?" a race rather than an assertion. The trigger and
 * dedupe layer has its own describe block below, which does exercise the real
 * scheduling path.
 */
async function enqueueRun(
  t: TestCtx,
  workflowId: Id<"crmWorkflows">,
  targetType: "contact" | "company" | "deal",
  targetId: string,
): Promise<Id<"crmWorkflowRuns">> {
  return await t.run(async (ctx) => {
    const steps = await ctx.db
      .query("crmWorkflowSteps")
      .withIndex("by_workflow_order", (q) => q.eq("workflowId", workflowId))
      .collect();
    const first = steps.sort((a, b) => a.order - b.order)[0];
    return await ctx.db.insert("crmWorkflowRuns", {
      workflowId, targetType, targetId,
      occurrenceKey: `test:${Date.now()}`,
      status: "pending_steps",
      currentStepOrder: first.order,
      nextStepAt: Date.now(),
      stepLog: [],
      firedAt: Date.now(),
    });
  });
}

describe("the send gate", () => {
  test("an opted-out contact is skipped, not emailed", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const { workflowId } = await seedEmailWorkflow(t, asStaff);
    const contactId = await seedContact(t, { emailOptOut: true });

    const runId = await enqueueRun(t, workflowId, "contact", contactId);
    const result = await stepOnce(t, runId);
    // "advanced" not "send" — the engine never hands a payload to Resend.
    expect(result.kind).toBe("advanced");

    const run = await t.run(async (ctx) => await ctx.db.get(runId));
    expect(run?.stepLog[0].outcome).toBe("skipped");
    expect(run?.stepLog[0].detail).toBe("opted_out");
  });

  test("a hard-bounced contact is skipped", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const { workflowId } = await seedEmailWorkflow(t, asStaff);
    const contactId = await seedContact(t, { emailStatus: "bounced_hard" });

    const runId = await enqueueRun(t, workflowId, "contact", contactId);
    const result = await stepOnce(t, runId);
    expect(result.kind).toBe("advanced");
    const run = await t.run(async (ctx) => await ctx.db.get(runId));
    expect(run?.stepLog[0].detail).toBe("email_bounced_hard");
  });

  test("a suppressed address is skipped", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const { workflowId } = await seedEmailWorkflow(t, asStaff);
    const contactId = await seedContact(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("crmSuppressions", {
        value: "jamie@acme.test", scope: "email", reason: "manual", createdAt: Date.now(),
      });
    });

    const runId = await enqueueRun(t, workflowId, "contact", contactId);
    const result = await stepOnce(t, runId);
    expect(result.kind).toBe("advanced");
    const run = await t.run(async (ctx) => await ctx.db.get(runId));
    expect(run?.stepLog[0].detail).toBe("suppressed");
  });

  test("a DOMAIN suppression blocks the send too", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const { workflowId } = await seedEmailWorkflow(t, asStaff);
    const contactId = await seedContact(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("crmSuppressions", {
        value: "acme.test", scope: "domain", reason: "unsubscribed", createdAt: Date.now(),
      });
    });

    const result = await stepOnce(t, await enqueueRun(t, workflowId, "contact", contactId));
    expect(result.kind).toBe("advanced");
  });

  test("an eligible contact DOES produce a send payload", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const { workflowId } = await seedEmailWorkflow(t, asStaff);
    const contactId = await seedContact(t);

    const result = await stepOnce(t, await enqueueRun(t, workflowId, "contact", contactId));
    expect(result.kind).toBe("send");
    if (result.kind !== "send") return;
    expect(result.to).toBe("jamie@acme.test");
    // Merge fields rendered, and a one-click unsubscribe target present.
    expect(result.subject).toBe("Hello Jamie");
    expect(result.unsubscribeApiUrl).toContain(contactId);
  });

  test("the shared daily cap is consumed, not bypassed", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const { workflowId } = await seedEmailWorkflow(t, asStaff);
    const contactId = await seedContact(t);

    await stepOnce(t, await enqueueRun(t, workflowId, "contact", contactId));

    const counter = await t.run(async (ctx) => await ctx.db.query("crmSendCounters").first());
    // A workflow send draws down the SAME budget a campaign does, rather than
    // running its own parallel quota.
    expect(counter?.sentCount).toBe(1);
  });
});

describe("occurrence keys", () => {
  test("the same occurrence does not fire twice", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const workflowId = await asStaff.mutation(api.crm.workflows.createWorkflow, {
      name: "Tag rule", entity: "contact", triggerType: "tag_applied", triggerConfig: {},
    });
    await asStaff.mutation(api.crm.workflows.addStep, {
      workflowId, actionType: "add_note", delayMinutes: 0, actionConfig: { message: "noted" },
    });
    await asStaff.mutation(api.crm.workflows.setWorkflowActive, { workflowId, isActive: true });
    const contactId = await seedContact(t);

    await t.run(async (ctx) => {
      for (let i = 0; i < 3; i++) {
        await fireWorkflowTrigger(ctx as any, {
          triggerType: "tag_applied", targetType: "contact", targetId: contactId,
          occurrenceKey: "tag:same-tag",
        });
      }
    });

    await flushScheduler(t);
    const runs = await t.run(async (ctx) => await ctx.db.query("crmWorkflowRuns").collect());
    expect(runs).toHaveLength(1);
  });

  test("re-entering a stage IS a new occurrence and fires again", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);

    const companyId = await t.run(async (ctx) => {
      const now = Date.now();
      return await ctx.db.insert("crmCompanies", {
        name: "Acme", nameKey: "acme", companyType: "employer", stage: "unqualified",
        stageChangedAt: now, tagIds: [], isArchived: false, searchText: "acme",
        createdAt: now, updatedAt: now,
      });
    });
    const proposalStageId = await t.run(async (ctx) => {
      const { stagesByCanonical } = await ensureDefaultPipeline(ctx as any);
      return stagesByCanonical.get("proposal")!;
    });
    const engagedStageId = await t.run(async (ctx) => {
      const { stagesByCanonical } = await ensureDefaultPipeline(ctx as any);
      return stagesByCanonical.get("engaged")!;
    });

    const workflowId = await asStaff.mutation(api.crm.workflows.createWorkflow, {
      name: "Proposal rule", entity: "deal", triggerType: "stage_entered",
      triggerConfig: { stageId: proposalStageId },
    });
    await asStaff.mutation(api.crm.workflows.addStep, {
      workflowId, actionType: "add_note", delayMinutes: 0, actionConfig: { message: "in proposal" },
    });
    await asStaff.mutation(api.crm.workflows.setWorkflowActive, { workflowId, isActive: true });

    const dealId = await asStaff.mutation(api.crm.deals.createDeal, { companyId });

    // In → out → back in. A deal genuinely re-entering Proposal should
    // re-trigger the rule; keying dedupe on the record alone would swallow it.
    await asStaff.mutation(api.crm.deals.moveDealStage, { dealId, stageId: proposalStageId });
    await asStaff.mutation(api.crm.deals.moveDealStage, { dealId, stageId: engagedStageId });
    await asStaff.mutation(api.crm.deals.moveDealStage, { dealId, stageId: proposalStageId });

    await flushScheduler(t);
    const runs = await t.run(async (ctx) => await ctx.db.query("crmWorkflowRuns").collect());
    expect(runs).toHaveLength(2);
  });

  test("a stage rule scoped to one stage ignores moves into other stages", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const companyId = await t.run(async (ctx) => {
      const now = Date.now();
      return await ctx.db.insert("crmCompanies", {
        name: "Acme", nameKey: "acme", companyType: "employer", stage: "unqualified",
        stageChangedAt: now, tagIds: [], isArchived: false, searchText: "acme",
        createdAt: now, updatedAt: now,
      });
    });
    const wonStageId = await t.run(async (ctx) => {
      const { stagesByCanonical } = await ensureDefaultPipeline(ctx as any);
      return stagesByCanonical.get("won")!;
    });
    const engagedStageId = await t.run(async (ctx) => {
      const { stagesByCanonical } = await ensureDefaultPipeline(ctx as any);
      return stagesByCanonical.get("engaged")!;
    });

    const workflowId = await asStaff.mutation(api.crm.workflows.createWorkflow, {
      name: "Won rule", entity: "deal", triggerType: "stage_entered",
      triggerConfig: { stageId: wonStageId },
    });
    await asStaff.mutation(api.crm.workflows.addStep, {
      workflowId, actionType: "add_note", delayMinutes: 0, actionConfig: { message: "won" },
    });
    await asStaff.mutation(api.crm.workflows.setWorkflowActive, { workflowId, isActive: true });

    const dealId = await asStaff.mutation(api.crm.deals.createDeal, { companyId });
    await asStaff.mutation(api.crm.deals.moveDealStage, { dealId, stageId: engagedStageId });

    const runs = await t.run(async (ctx) => await ctx.db.query("crmWorkflowRuns").collect());
    expect(runs).toHaveLength(0);
  });
});

describe("workflow guards and validation", () => {
  test("an inactive workflow never fires from an event", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const workflowId = await asStaff.mutation(api.crm.workflows.createWorkflow, {
      name: "Draft", entity: "contact", triggerType: "contact_created", triggerConfig: {},
    });
    await asStaff.mutation(api.crm.workflows.addStep, {
      workflowId, actionType: "add_note", delayMinutes: 0, actionConfig: { message: "hi" },
    });
    // deliberately NOT activated

    const contactId = await seedContact(t);
    await t.run(async (ctx) => {
      await fireWorkflowTrigger(ctx as any, {
        triggerType: "contact_created", targetType: "contact", targetId: contactId,
        occurrenceKey: `created:${contactId}`,
      });
    });

    const runs = await t.run(async (ctx) => await ctx.db.query("crmWorkflowRuns").collect());
    expect(runs).toHaveLength(0);
  });

  test("a workflow with no steps cannot be activated", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const workflowId = await asStaff.mutation(api.crm.workflows.createWorkflow, {
      name: "Empty", entity: "contact", triggerType: "contact_created", triggerConfig: {},
    });

    await expect(
      asStaff.mutation(api.crm.workflows.setWorkflowActive, { workflowId, isActive: true }),
    ).rejects.toThrow(/at least one step/i);
  });

  test("an email step without a template is rejected at write time", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const workflowId = await asStaff.mutation(api.crm.workflows.createWorkflow, {
      name: "Bad", entity: "contact", triggerType: "contact_created", triggerConfig: {},
    });

    await expect(
      asStaff.mutation(api.crm.workflows.addStep, {
        workflowId, actionType: "send_email_template", delayMinutes: 0, actionConfig: {},
      }),
    ).rejects.toThrow(/needs a template/i);
  });

  test("a no-activity trigger requires a day count", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);

    await expect(
      asStaff.mutation(api.crm.workflows.createWorkflow, {
        name: "Stale", entity: "contact", triggerType: "no_activity_days", triggerConfig: {},
      }),
    ).rejects.toThrow(/day count/i);
  });

  test("only a manager can activate a workflow", async () => {
    const t = convexTest(schema);
    const asOwner = await seedStaff(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("adminUsers", {
        clerkUserId: "staff_editor", email: "e@t.dev", name: "Editor",
        role: "editor", createdAt: Date.now(),
      });
    });
    const asEditor = t.withIdentity(tok("staff_editor"));

    const workflowId = await asOwner.mutation(api.crm.workflows.createWorkflow, {
      name: "Rule", entity: "contact", triggerType: "contact_created", triggerConfig: {},
    });
    await asOwner.mutation(api.crm.workflows.addStep, {
      workflowId, actionType: "add_note", delayMinutes: 0, actionConfig: { message: "hi" },
    });

    await expect(
      asEditor.mutation(api.crm.workflows.setWorkflowActive, { workflowId, isActive: true }),
    ).rejects.toThrow(/manager/i);
  });

  test("a distribution partner cannot list workflows", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("distributionPartners", {
        name: "Agency", type: "agency", contactName: "C", contactEmail: "c@t.dev",
        clerkUserId: "partner_crm", status: "active", createdAt: now, updatedAt: now,
      });
    });

    await expect(
      t.withIdentity(tok("partner_crm")).query(api.crm.workflows.listWorkflows, {}),
    ).rejects.toThrow(/Admin role required/);
  });
});

describe("step execution", () => {
  test("a create_task step produces a task assigned to the record owner", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const workflowId = await asStaff.mutation(api.crm.workflows.createWorkflow, {
      name: "Follow up", entity: "contact", triggerType: "contact_created", triggerConfig: {},
    });
    await asStaff.mutation(api.crm.workflows.addStep, {
      workflowId, actionType: "create_task", delayMinutes: 0,
      actionConfig: { taskTitle: "Call them", dueInDays: 3, assignTo: "owner", taskType: "call" },
    });
    await asStaff.mutation(api.crm.workflows.setWorkflowActive, { workflowId, isActive: true });

    const contactId = await asStaff.mutation(api.crm.contacts.createContact, {
      firstName: "Pat", lastName: "Doe",
    });
    await flushScheduler(t);
    await stepOnce(t, await onlyRun(t));

    const tasks = await t.run(async (ctx) => await ctx.db.query("crmTasks").collect());
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Call them");
    expect(tasks[0].contactId).toBe(contactId);
    expect(tasks[0].assigneeClerkUserId).toBe("staff_owner");
  });

  test("a run completes once its last step has executed", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const workflowId = await asStaff.mutation(api.crm.workflows.createWorkflow, {
      name: "One step", entity: "contact", triggerType: "contact_created", triggerConfig: {},
    });
    await asStaff.mutation(api.crm.workflows.addStep, {
      workflowId, actionType: "add_note", delayMinutes: 0, actionConfig: { message: "noted" },
    });
    await asStaff.mutation(api.crm.workflows.setWorkflowActive, { workflowId, isActive: true });

    await asStaff.mutation(api.crm.contacts.createContact, { firstName: "Pat", lastName: "Doe" });
    await flushScheduler(t);
    await stepOnce(t, await onlyRun(t));

    const run = await t.run(async (ctx) => await ctx.db.query("crmWorkflowRuns").first());
    expect(run?.status).toBe("completed");
    expect(run?.stepLog).toHaveLength(1);
  });

  test("a delayed second step is scheduled rather than run immediately", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const workflowId = await asStaff.mutation(api.crm.workflows.createWorkflow, {
      name: "Sequence", entity: "contact", triggerType: "contact_created", triggerConfig: {},
    });
    await asStaff.mutation(api.crm.workflows.addStep, {
      workflowId, actionType: "add_note", delayMinutes: 0, actionConfig: { message: "first" },
    });
    await asStaff.mutation(api.crm.workflows.addStep, {
      workflowId, actionType: "add_note", delayMinutes: 60 * 24 * 3, actionConfig: { message: "third day" },
    });
    await asStaff.mutation(api.crm.workflows.setWorkflowActive, { workflowId, isActive: true });

    await asStaff.mutation(api.crm.contacts.createContact, { firstName: "Pat", lastName: "Doe" });
    await flushScheduler(t);
    const runId = await onlyRun(t);
    await stepOnce(t, runId);

    const run = await t.run(async (ctx) => await ctx.db.get(runId));
    expect(run?.status).toBe("pending_steps");
    expect(run?.nextStepAt).toBeGreaterThan(Date.now() + 2 * 24 * 60 * 60 * 1000);

    // Not yet due — the engine must leave it alone.
    const result = await stepOnce(t, runId);
    expect(result.kind).toBe("idle");
  });

  test("a rule pointing at a DELETED tag degrades to a no-op, it does not throw", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);

    // A real tag, referenced by a step, then deleted underneath it — the
    // realistic way a live rule goes stale. (A bogus id string can't be used
    // here: the argument validator rejects it at addStep, which is correct.)
    const { categoryId, tagId } = await t.run(async (ctx) => {
      const now = Date.now();
      const categoryId = await ctx.db.insert("crmTagCategories", {
        name: "Temp", slug: "temp", color: "slate", isExclusive: false,
        isPrimaryFilter: false, order: 0, appliesTo: "both", createdAt: now, updatedAt: now,
      });
      const tagId = await ctx.db.insert("crmTags", {
        categoryId, name: "Doomed", slug: "doomed", contactCount: 0, companyCount: 0,
        isArchived: false, createdAt: now, updatedAt: now,
      });
      return { categoryId, tagId };
    });

    const workflowId = await asStaff.mutation(api.crm.workflows.createWorkflow, {
      name: "Tag rule", entity: "contact", triggerType: "contact_created", triggerConfig: {},
    });
    await asStaff.mutation(api.crm.workflows.addStep, {
      workflowId, actionType: "apply_tag", delayMinutes: 0, actionConfig: { tagId },
    });
    await asStaff.mutation(api.crm.workflows.setWorkflowActive, { workflowId, isActive: true });

    await t.run(async (ctx) => {
      await ctx.db.delete(tagId);
      await ctx.db.delete(categoryId);
    });

    const contactId = await seedContact(t);
    const runId = await enqueueRun(t, workflowId, "contact", contactId);
    const result = await stepOnce(t, runId);

    // applyOneTag returns early on a missing tag, so the run advances cleanly
    // rather than wedging the whole sequence.
    expect(result.kind).toBe("advanced");
    const run = await t.run(async (ctx) => await ctx.db.get(runId));
    expect(run?.status).toBe("completed");
  });

  test("a malformed rule cannot fail the business mutation that triggered it", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const workflowId = await asStaff.mutation(api.crm.workflows.createWorkflow, {
      name: "Note rule", entity: "contact", triggerType: "contact_created", triggerConfig: {},
    });
    await asStaff.mutation(api.crm.workflows.addStep, {
      workflowId, actionType: "add_note", delayMinutes: 0, actionConfig: { message: "hi" },
    });
    await asStaff.mutation(api.crm.workflows.setWorkflowActive, { workflowId, isActive: true });

    // Delete the steps out from under the active rule, then create a contact.
    // fireWorkflowTrigger swallows its own failures by design — a stage move or
    // a contact create must never fail because an automation rule is broken.
    await t.run(async (ctx) => {
      const steps = await ctx.db.query("crmWorkflowSteps").collect();
      for (const step of steps) await ctx.db.delete(step._id);
    });

    const contactId = await asStaff.mutation(api.crm.contacts.createContact, {
      firstName: "Pat", lastName: "Doe",
    });
    expect(contactId).toBeDefined();

    // A rule with no steps is a no-op, not a run.
    const runs = await t.run(async (ctx) => await ctx.db.query("crmWorkflowRuns").collect());
    expect(runs).toHaveLength(0);
  });
});
