import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * CONVEX CRON JOBS
 * 
 * Scheduled automated operations:
 * - 1st of month: Generate & deliver vendor eligibility files
 * - 1st of month: Generate list-bill summaries
 * - 25th of month: Send eligibility reminder emails to group admins
 * - 1st of month: Calculate monthly commissions
 * - 1st of month 00:05 UTC: Close prior month's invoice period (Invoice Calculator)
 * - Hourly: Check for expired entitlements
 * - Daily: Monitor stale eligibility files
 * 
 * Note: Cron implementations are awaiting their respective agent deliverables.
 * Once Agent 1 completes admin functions and Agent 3 completes operations,
 * these will be wired to real mutations/actions.
 */

const crons = cronJobs();

// Cron implementations TODO:
// 1. Vendor file generation - awaits api.admin.vendorFiles
// 2. Billing summaries - awaits api.admin.billing
// 3. Reminder emails - awaits api.admin.notifications
// 4. Commission calculation - awaits api.admin.commissions
// 5. Entitlement expiration - awaits scheduled mutation
// 6. File monitoring - awaits scheduled action

// ---------------------------------------------------------------------------
// Invoice Calculator — monthly close (spec §12.1)
// Fires on the 1st of every UTC month at 00:05; idempotent if already closed.
// ---------------------------------------------------------------------------
crons.cron(
  "invoice-calculator-monthly-close",
  "5 0 1 * *",
  internal.admin.invoiceCalculator.closePreviousMonth,
);

// ---------------------------------------------------------------------------
// List-Bill Invoice Generator — monthly draft generation (spec §14.1)
// Fires on the 25th of every UTC month at 08:00; drafts invoices for all
// list-bill groups for the upcoming calendar month. Idempotent.
// ---------------------------------------------------------------------------
crons.cron(
  "list-bill-monthly-generate",
  "0 8 25 * *",
  internal.admin.listBillInvoices.generateMonthlyInvoices,
);

// ---------------------------------------------------------------------------
// List-Bill Invoice Generator — daily overdue check (spec §14.2)
// Fires every day at 08:00 UTC; flips past-due issued/partial → overdue.
// ---------------------------------------------------------------------------
crons.cron(
  "list-bill-daily-overdue",
  "0 8 * * *",
  internal.admin.listBillInvoices.markOverdueInvoices,
);

// ---------------------------------------------------------------------------
// Stripe ↔ Convex reconciliation — daily self-healing check
// Re-verifies every "live" (active/past_due/cancel_at_period_end) bundle
// against the real Stripe subscription status and corrects drift caused by
// missed/failed webhooks (e.g. a member who stopped paying but whose bundle
// never got cancelled on our side).
// ---------------------------------------------------------------------------
crons.cron(
  "stripe-subscription-reconcile-daily",
  "30 8 * * *",
  internal.subscriptions.reconcile.reconcileStripeSubscriptions,
);

// ---------------------------------------------------------------------------
// Insights daily rollup
// Fires at 09:00 UTC — after the 08:30 Stripe reconciliation, so it reads
// bundle statuses that have already been corrected against Stripe rather than
// rolling up drift. Rolls up YESTERDAY, which is complete by then.
// Idempotent per (scopeKind, scopeId, date).
// ---------------------------------------------------------------------------
crons.cron(
  "insights-daily-rollup",
  "0 9 * * *",
  internal.insights.rollups.rollupYesterday,
);

// ---------------------------------------------------------------------------
// CRM tag counter reconciliation — nightly self-heal
// contactCount/companyCount on crmTags are a display cache maintained
// incrementally on every tag write; this catches any drift.
// ---------------------------------------------------------------------------
crons.cron(
  "crm-reconcile-counters",
  "0 9 * * *",
  internal.crm.maintenance.reconcileCounters,
);

// ---------------------------------------------------------------------------
// CRM stale call-draft cleanup — hourly
// A dial URI can hand the browser to another app before a rep closes out
// the call-log composer; sweeps up anything left open >24h.
// ---------------------------------------------------------------------------
crons.cron(
  "crm-expire-call-drafts",
  "0 * * * *",
  internal.crm.maintenance.expireStaleCallDrafts,
);

// ---------------------------------------------------------------------------
// CRM primary-deal cache reconciliation — nightly self-heal
// crmCompanies' stage columns mirror the company's primary deal. This is the
// same role crm-reconcile-counters plays for tag counts: catch drift from a
// crashed mutation or a manual edit rather than trusting the cache forever.
// ---------------------------------------------------------------------------
crons.cron(
  "crm-reconcile-deal-cache",
  "30 9 * * *",
  internal.crm.maintenance.reconcilePrimaryDealCache,
  {},
);

// ---------------------------------------------------------------------------
// CRM workflow time triggers — every 15 minutes
// Drives the `no_activity_days` trigger only; event triggers fire inline from
// the mutations that cause them. 15 minutes is deliberate: the finest
// granularity any time-based rule here expresses is a day, so a tighter
// interval would just re-scan the same rows for nothing.
// ---------------------------------------------------------------------------
crons.interval(
  "crm-workflow-time-triggers",
  { minutes: 15 },
  internal.crm.workflowTriggers.sweepTimeTriggers,
);

// ---------------------------------------------------------------------------
// CRM workflow drain — every 5 minutes
// A safety net, not the primary path: enqueueing a run schedules the engine
// immediately. This catches delayed steps whose resume time has arrived and
// any run orphaned by a failed scheduler call.
// ---------------------------------------------------------------------------
crons.interval(
  "crm-workflow-drain",
  { minutes: 5 },
  internal.crm.workflowEngine.tick,
  {},
);

// ---------------------------------------------------------------------------
// CRM drip campaign drain — every 15 minutes
// Sends the next due phase of any running drip campaign. 15 minutes matches
// the workflow time-trigger sweep and is finer than any delay the UI can
// express (whole days), so a tighter interval would only re-scan the same
// rows. Starting a campaign also schedules this directly, so phase 1 does not
// wait for the next tick.
// ---------------------------------------------------------------------------
crons.interval(
  "crm-drip-drain",
  { minutes: 15 },
  internal.crm.dripEngine.tick,
  {},
);

export default crons;
