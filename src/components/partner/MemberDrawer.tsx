"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { X, Mail, Phone, Users, CreditCard, Clock, Building2 } from "lucide-react";
import { formatCurrency, formatDate, formatDateTime, humanize } from "@/lib/admin-format";
import { BillingBadge } from "@/components/insights";

const money = (cents: number) => formatCurrency(cents, { fromCents: true });

/**
 * Member detail.
 *
 * Everything shown here comes from `insights.roster.getMemberDetail`, which
 * re-checks scope before returning anything and projects the record through
 * the broker allow-list. A member outside the caller's book returns null and
 * renders as "not found" — deliberately indistinguishable from a bad id, so a
 * broker cannot probe for whose members exist.
 */
export function MemberDrawer({
  memberId,
  onClose,
}: {
  memberId: Id<"memberProfiles">;
  onClose: () => void;
}) {
  const data = useQuery(api.insights.roster.getMemberDetail, { memberId });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/20"
      />
      <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {data === undefined ? (
              <p className="text-slate-400">Loading…</p>
            ) : data === null ? (
              <p className="font-semibold text-slate-900">Member not found</p>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-slate-900 truncate">
                  {data.member.firstName} {data.member.lastName}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-slate-400 font-mono">{data.member.memberId}</p>
                  <BillingBadge source={data.billingSource} compact />
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-slate-100 shrink-0"
          >
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {data === null && (
          <p className="px-6 py-8 text-sm text-slate-500">
            This member is not in your book.
          </p>
        )}

        {data && (
          <div className="px-6 py-5 space-y-6">
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Mail size={14} className="text-slate-400" />
                {data.member.email ?? <span className="text-slate-400">No email on file</span>}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Phone size={14} className="text-slate-400" />
                {data.member.phone ?? <span className="text-slate-400">No phone on file</span>}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Users size={14} className="text-slate-400" />
                {data.member.dependentCount === 0
                  ? "No dependents"
                  : `${data.member.dependentCount} dependent${data.member.dependentCount === 1 ? "" : "s"}`}
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Status" value={humanize(data.member.memberType)} />
              <Field label="Group" value={data.member.groupName ?? "—"} />
              <Field label="Brand" value={data.member.siteName ?? "—"} />
              <Field label="Effective" value={data.member.effectiveDate ?? "—"} />
              <Field
                label="Enrolled"
                value={data.member.enrolledAt ? formatDate(data.member.enrolledAt) : "—"}
              />
              <Field
                label="Left"
                value={data.member.terminatedAt ? formatDate(data.member.terminatedAt) : "—"}
              />
              <Field label="Rep" value={data.member.attributedRepName ?? "Unattributed"} />
              <Field
                label="Attribution"
                value={
                  data.member.attributionSource === "enrollment"
                    ? "Direct sale"
                    : data.member.attributionSource === "group"
                      ? "Group deal"
                      : "None"
                }
              />
            </section>

            {/* Employer-billed members have no Stripe subscription, so this
                section used to render nothing at all for them — implying they
                had no coverage. Their billing story is the employer's invoice. */}
            {data.listBill && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
                  <Building2 size={12} /> Employer-billed coverage
                </h3>
                <div className="bg-violet-50 border border-violet-100 rounded-lg p-3 grid grid-cols-2 gap-3 text-sm">
                  <Field label="Monthly rate" value={money(data.listBill.rateCents)} />
                  <Field
                    label="Coverage tier"
                    value={data.listBill.tierLabel ?? data.listBill.tier ?? "—"}
                  />
                  <Field label="Plan" value={data.listBill.rateLabel ?? "—"} />
                  <Field
                    label="Dependents"
                    value={String(data.listBill.dependentCount)}
                  />
                  <Field
                    label="Employer pays by"
                    value={
                      data.listBill.employerPaymentMethod
                        ? humanize(data.listBill.employerPaymentMethod)
                        : "—"
                    }
                  />
                  <Field
                    label="Coverage period"
                    value={data.listBill.coveragePeriod ?? "—"}
                  />
                  <Field
                    label="Latest invoice"
                    value={
                      data.listBill.invoiceNumber
                        ? `#${data.listBill.invoiceNumber}`
                        : "Not yet generated"
                    }
                  />
                  <Field
                    label="Invoice status"
                    value={
                      data.listBill.invoiceStatus
                        ? humanize(data.listBill.invoiceStatus)
                        : "—"
                    }
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Coverage tier is derived from household composition at billing time, not
                  elected by the employee.
                </p>
              </section>
            )}

            {data.subscription && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
                  <CreditCard size={12} /> Subscription
                </h3>
                <div className="bg-slate-50 rounded-lg p-3 grid grid-cols-2 gap-3 text-sm">
                  <Field label="Status" value={humanize(data.subscription.status)} />
                  <Field label="Cadence" value={humanize(data.subscription.cadence)} />
                  <Field label="Charge" value={money(data.subscription.totalCents)} />
                  <Field label="Method" value={humanize(data.subscription.paymentMethod ?? "—")} />
                  {data.subscription.currentPeriodEnd && (
                    <Field
                      label="Renews"
                      value={formatDate(data.subscription.currentPeriodEnd)}
                    />
                  )}
                  {data.subscription.cancelledAt && (
                    <Field label="Cancelled" value={formatDate(data.subscription.cancelledAt)} />
                  )}
                </div>
              </section>
            )}

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
                <Clock size={12} /> Timeline
              </h3>
              {data.timeline.length === 0 ? (
                <p className="text-sm text-slate-400">No activity recorded.</p>
              ) : (
                <ol className="space-y-3">
                  {data.timeline.map((a) => (
                    <li key={String(a._id)} className="flex gap-3">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-sm text-slate-900">{a.title}</p>
                        {a.description && (
                          <p className="text-xs text-slate-500">{a.description}</p>
                        )}
                        <p className="text-xs text-slate-400 mt-0.5">
                          {formatDateTime(a.createdAt)}
                          {a.actorName ? ` · ${a.actorName}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-slate-800 truncate">{value}</p>
    </div>
  );
}
