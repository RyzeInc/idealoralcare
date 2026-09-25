"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CheckCircle2, Loader2, PlayCircle, XCircle } from "lucide-react";

/**
 * MAINTENANCE PANEL — the button for the Phase 0 backfills.
 *
 * These four mutations repair data that predates the insights feature:
 *
 *   1. backfillRepAttribution           re-key legacy broker/agency values
 *   2. backfillMemberAttributionStamps  populate the memberProfiles cache
 *   3. backfillTerminatedAt             reconstruct member exit dates
 *   4. quarantineLegacyPayables         flag commission rows written at the
 *                                       old hardcoded rate
 *
 * All four are already guarded by requireAdmin — clicking this button runs
 * them through the signed-in admin's own browser session, so the real Clerk
 * auth check applies exactly as it does for every other admin action. No
 * separate elevated access exists here.
 *
 * Steps 2 and 3 are cursor-paginated (schema.ts caps a batch at 200 members),
 * so this loops each one to completion rather than assuming a single call
 * finishes the job — correct on a 3-member dev deployment and a 300,000-member
 * production one alike.
 *
 * All four mutations are idempotent: re-running only touches rows that still
 * disagree with the source of truth. This panel is safe to click again if a
 * run is interrupted, and safe to leave in place as an ongoing maintenance
 * tool rather than a one-time migration script.
 */

type StepStatus = "pending" | "running" | "done" | "error";

interface StepResult {
  label: string;
  status: StepStatus;
  detail?: string;
}

const INITIAL_STEPS: StepResult[] = [
  { label: "Re-key rep & agency attribution", status: "pending" },
  { label: "Stamp member attribution cache", status: "pending" },
  { label: "Backfill member exit dates", status: "pending" },
  { label: "Quarantine legacy commission rows", status: "pending" },
  { label: "Rebuild daily rollups", status: "pending" },
];

/**
 * How far back to rebuild rollups. Rows written before billing-model support
 * understate revenue by the entire employer-billed book and cannot be fixed on
 * the read side — the split was never recorded.
 */
const ROLLUP_BACKFILL_DAYS = 120;

export function MaintenancePanel() {
  const [steps, setSteps] = useState<StepResult[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);

  const backfillRepAttribution = useMutation(
    api.admin.repAttributionBackfill.backfillRepAttribution,
  );
  const backfillMemberAttributionStamps = useMutation(
    api.admin.repAttributionBackfill.backfillMemberAttributionStamps,
  );
  const backfillTerminatedAt = useMutation(api.admin.lifecycleBackfill.backfillTerminatedAt);
  const quarantineLegacyPayables = useMutation(
    api.admin.repAttributionBackfill.quarantineLegacyPayables,
  );
  const backfillRollupDay = useMutation(api.insights.rollups.backfillRollupDay);

  const setStep = (index: number, patch: Partial<StepResult>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const runAll = async () => {
    setRunning(true);
    setSteps(INITIAL_STEPS);

    try {
      // 1. Re-key legacy broker/agency values on the source tables.
      setStep(0, { status: "running" });
      const r1 = await backfillRepAttribution({ dryRun: false });
      const r1Updated =
        r1.enrollmentSessions.updated +
        r1.commissionPayables.updated +
        r1.commissionRates.updated +
        r1.groups.updated;
      setStep(0, { status: "done", detail: `${r1Updated} row(s) re-keyed` });

      // 2. Stamp memberProfiles — loop until the cursor reports done.
      setStep(1, { status: "running" });
      let cursor: string | null = null;
      let totalUpdated = 0;
      let totalScanned = 0;
      for (;;) {
        const page: Awaited<ReturnType<typeof backfillMemberAttributionStamps>> =
          await backfillMemberAttributionStamps({ cursor, dryRun: false });
        totalUpdated += page.updated;
        totalScanned += page.scanned;
        setStep(1, {
          status: "running",
          detail: `${totalScanned} scanned, ${totalUpdated} stamped so far…`,
        });
        if (page.isDone) break;
        cursor = page.cursor;
      }
      setStep(1, {
        status: "done",
        detail: `${totalScanned} member(s) scanned, ${totalUpdated} stamped`,
      });

      // 3. Backfill terminatedAt — same pagination shape.
      setStep(2, { status: "running" });
      cursor = null;
      let exitUpdated = 0;
      let exitScanned = 0;
      for (;;) {
        const page: Awaited<ReturnType<typeof backfillTerminatedAt>> =
          await backfillTerminatedAt({ cursor, dryRun: false });
        exitUpdated += page.updated;
        exitScanned += page.scanned;
        setStep(2, {
          status: "running",
          detail: `${exitScanned} scanned, ${exitUpdated} dated so far…`,
        });
        if (page.isDone) break;
        cursor = page.cursor;
      }
      setStep(2, {
        status: "done",
        detail: `${exitScanned} member(s) scanned, ${exitUpdated} exit date(s) reconstructed`,
      });

      // 4. Quarantine legacy commission rows.
      setStep(3, { status: "running" });
      const r4 = await quarantineLegacyPayables({ dryRun: false });
      setStep(3, { status: "done", detail: `${r4.stamped} row(s) quarantined` });

      // 5. Rebuild daily rollups. One day per call — each pass reads the whole
      // member table, so batching them would exceed the transaction limit on
      // any real book.
      setStep(4, { status: "running" });
      let rebuilt = 0;
      for (let daysAgo = ROLLUP_BACKFILL_DAYS; daysAgo >= 0; daysAgo--) {
        await backfillRollupDay({ daysAgo });
        rebuilt++;
        if (rebuilt % 10 === 0 || daysAgo === 0) {
          setStep(4, {
            status: "running",
            detail: `${rebuilt} of ${ROLLUP_BACKFILL_DAYS + 1} days rebuilt…`,
          });
        }
      }
      setStep(4, { status: "done", detail: `${rebuilt} day(s) of history rebuilt` });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSteps((prev) => {
        const idx = prev.findIndex((s) => s.status === "running");
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], status: "error", detail: message };
        return next;
      });
    } finally {
      setRunning(false);
    }
  };

  const hasRun = steps.some((s) => s.status !== "pending");
  const hasError = steps.some((s) => s.status === "error");

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Run maintenance backfills</h3>
          <p className="text-xs text-slate-500 mt-1">
            Repairs the data the checks above depend on. Runs as you, through your own admin
            session — safe to re-run any time, since each step only touches rows that still
            disagree with the current source of truth.
          </p>
        </div>
        <button
          type="button"
          onClick={runAll}
          disabled={running}
          className="inline-flex items-center gap-2 shrink-0 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-4 py-2 transition-colors"
        >
          {running ? <Loader2 size={15} className="animate-spin" /> : <PlayCircle size={15} />}
          {running ? "Running…" : hasRun ? "Run again" : "Run backfills"}
        </button>
      </div>

      {hasRun && (
        <ol className="mt-4 space-y-2 border-t border-slate-100 pt-4">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              {step.status === "pending" && (
                <span className="w-4 h-4 rounded-full border-2 border-slate-200 shrink-0 mt-0.5" />
              )}
              {step.status === "running" && (
                <Loader2 size={16} className="text-blue-600 animate-spin shrink-0 mt-0.5" />
              )}
              {step.status === "done" && (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              )}
              {step.status === "error" && (
                <XCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <p
                  className={
                    step.status === "error" ? "text-red-700 font-medium" : "text-slate-800"
                  }
                >
                  {step.label}
                </p>
                {step.detail && <p className="text-xs text-slate-500">{step.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}

      {hasError && (
        <p className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          Stopped on error — the steps before it already committed and are safe to leave as-is.
          Fix the issue and click &ldquo;Run again&rdquo;; completed steps will simply find nothing
          left to do.
        </p>
      )}
    </div>
  );
}
