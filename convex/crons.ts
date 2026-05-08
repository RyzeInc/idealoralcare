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

export default crons;
