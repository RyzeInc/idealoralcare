"use client";

import { useState, useEffect, type ReactNode, type FormEvent } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  ChevronRight,
  CreditCard,
  FileText,
  History,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  StickyNote,
  User,
  Users,
} from "lucide-react";
import { Modal, StatusBadge } from "@/components/admin/ui";
import { MemberCommunications } from "@/components/admin/MemberCommunications";
import {
  formatDate,
  formatDateTime,
  humanize,
  formatCurrency,
} from "@/lib/admin-format";

const Inspector = dynamic(() => import("./AdminMemberInspector"), {
  loading: () => <p>Loading account details…</p>,
});
type Workspace = NonNullable<
  FunctionReturnType<typeof api.insights.memberWorkspace.getWorkspace>
>;
type Tab =
  | "overview"
  | "personal"
  | "coverage"
  | "billing"
  | "invoices"
  | "notes"
  | "alerts"
  | "activity"
  | "documents"
  | "communications"
  | "account";
const tabs = [
  ["overview", "Overview", LayoutDashboard],
  ["personal", "Personal & household", User],
  ["coverage", "Coverage & agreements", ShieldCheck],
  ["billing", "Billing", CreditCard],
  ["invoices", "Invoices", FileText],
  ["notes", "Notes", StickyNote],
  ["alerts", "Alerts", Bell],
  ["activity", "Activity history", History],
  ["documents", "Documents", FileText],
  ["communications", "Communications", MessageSquare],
  ["account", "Account & diagnostics", ShieldCheck],
] as const;
const input =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20";
const button =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50";
const secondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";
const money = (n: number) => formatCurrency(n, { fromCents: true });
const date = (n?: number | null) =>
  n == null ? "Not recorded" : formatDate(n);
const billingLabel = {
  direct: "Member paid",
  list_bill: "Employer billed",
  comp: "Complimentary",
  none: "No billing",
};

export function MemberWorkspace({
  memberId,
  portal,
}: {
  memberId: Id<"memberProfiles">;
  portal: "admin" | "partner";
}) {
  const now = useNow();
  const data = useQuery(api.insights.memberWorkspace.getWorkspace, {
    memberId,
  });
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [dialog, setDialog] = useState<
    "note" | "alert" | "document" | "edit" | null
  >(null);
  const requestedTab = searchParams.get("tab") ?? "overview";
  const availableTabs = tabs.filter(
    ([key]) => data?.isAdmin || !["communications", "account"].includes(key),
  );
  const tab = (
    availableTabs.some(([key]) => key === requestedTab)
      ? requestedTab
      : "overview"
  ) as Tab;
  const navigate = (next: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.push(`${pathname}?${params}`, { scroll: false });
  };
  if (data === undefined)
    return (
      <div
        role="status"
        className="flex min-h-80 items-center justify-center gap-3 text-slate-500"
      >
        <Loader2 className="animate-spin" size={20} /> Loading member workspace…
      </div>
    );
  if (!data)
    return (
      <div className="space-y-4 p-8">
        <Link href={`/${portal}/members`} className={secondary}>
          <ArrowLeft size={16} /> Members
        </Link>
        <h1 className="text-xl font-semibold">Member not found</h1>
        <p className="text-slate-500">
          This member is unavailable or outside your book of business.
        </p>
      </div>
    );
  const m = data.member;
  const openAlerts = data.alerts.filter(
    (a) => !a.resolvedAt && (!a.expiresAt || a.expiresAt > now),
  );
  return (
    <div className="mx-auto max-w-[1600px] space-y-5 pb-12">
      <div className="flex items-center justify-between gap-3 text-sm">
        <Link
          href={`/${portal}/members`}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-teal-700"
        >
          <ArrowLeft size={16} /> Members <ChevronRight size={14} />
          <span className="text-slate-900">Member workspace</span>
        </Link>
        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500">
          {data.isAdmin ? "Admin workspace" : "Broker workspace"}
        </span>
      </div>
      <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="h-1.5 bg-teal-700" />
        <div className="flex flex-wrap items-start gap-5 p-6">
          <div
            aria-hidden
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-2xl font-semibold text-teal-800"
          >
            {m.firstName[0]}
            {m.lastName[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {m.firstName} {m.lastName}
              </h1>
              <StatusBadge status={m.memberType} />
            </div>
            <p className="mt-1 break-all text-sm text-slate-500">
              {m.memberId} <span className="px-2 text-slate-300">/</span>{" "}
              {m.groupName ?? "No group name"}
            </p>
            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <Field
                label="Plan"
                value={
                  m.planName ?? data.listBill?.rateLabel ?? "No plan recorded"
                }
              />
              <Field label="Billing" value={billingLabel[data.billingSource]} />
              <Field label="Effective" value={m.effectiveDate} />
              <Field
                label="Broker"
                value={
                  m.attributedRepName ?? m.attributedAgencyName ?? "Unassigned"
                }
              />
            </dl>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={secondary} onClick={() => setDialog("note")}>
              <Plus size={15} /> Add note
            </button>
            <button className={button} onClick={() => setDialog("alert")}>
              <Bell size={15} /> Create alert
            </button>
          </div>
        </div>
      </header>
      {openAlerts.length > 0 && (
        <button
          onClick={() => navigate("alerts")}
          className="flex w-full items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-left text-sm text-amber-900"
        >
          <Bell size={17} />
          <span className="flex-1">
            <strong>
              {openAlerts.length} active alert
              {openAlerts.length === 1 ? "" : "s"}
            </strong>{" "}
            · {openAlerts[0].title}
          </span>
          <ChevronRight size={16} />
        </button>
      )}
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav
          aria-label="Member sections"
          className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 lg:sticky lg:top-6 lg:block lg:self-start"
        >
          {availableTabs.map(([key, label, Icon]) => (
            <button
              key={key}
              aria-current={tab === key ? "page" : undefined}
              onClick={() => navigate(key)}
              className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors lg:w-full ${tab === key ? "bg-teal-50 font-semibold text-teal-800" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <Icon size={17} />
              <span className="flex-1 whitespace-nowrap">{label}</span>
              {key === "alerts" && openAlerts.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2 text-xs text-amber-800">
                  {openAlerts.length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <main
          className="min-w-0 space-y-5"
          aria-label={availableTabs.find(([key]) => key === tab)?.[1]}
        >
          {data.truncated && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Showing the latest 200 visible notes, alerts, and document links.
            </p>
          )}
          {tab === "overview" && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Metric
                  label="Monthly billing"
                  value={
                    data.billingSource === "none"
                      ? "Not set up"
                      : money(m.mrrCents)
                  }
                  detail={billingLabel[data.billingSource]}
                />
                <Metric
                  label="Household"
                  value={String(
                    m.dependentCount + (m.memberRole === "dependent" ? 0 : 1),
                  )}
                  detail={
                    m.memberRole === "dependent"
                      ? "Dependent profile"
                      : `Primary + ${m.dependentCount} dependents`
                  }
                />
                <Metric
                  label="Member since"
                  value={date(m.enrolledAt ?? m.createdAt)}
                  detail={m.siteName ?? "Ideal Oral Care"}
                />
              </div>
              <div className="grid gap-5 xl:grid-cols-2">
                <Panel
                  title="Personal"
                  action={<Jump onClick={() => navigate("personal")} />}
                >
                  <Fields>
                    <Field label="Email" value={m.email} />
                    <Field label="Phone" value={m.phone} />
                    <Field label="Group" value={m.groupName} />
                    <Field
                      label="Member role"
                      value={humanize(m.memberRole ?? "primary")}
                    />
                  </Fields>
                </Panel>
                <Panel
                  title="Coverage & billing"
                  action={<Jump onClick={() => navigate("coverage")} />}
                >
                  <Fields>
                    <Field
                      label="Plan"
                      value={m.planName ?? data.listBill?.rateLabel}
                    />
                    <Field label="Coverage tier" value={m.tierLabel} />
                    <Field
                      label="Subscription"
                      value={
                        data.subscription
                          ? humanize(data.subscription.status)
                          : billingLabel[data.billingSource]
                      }
                    />
                    <Field
                      label="Next period end"
                      value={date(data.subscription?.currentPeriodEnd)}
                    />
                  </Fields>
                </Panel>
                <Panel
                  title="Recent notes"
                  action={<Jump onClick={() => navigate("notes")} />}
                >
                  {data.notes.length ? (
                    <div className="space-y-4">
                      {[...data.notes]
                        .sort((a, b) => Number(b.isPinned) - Number(a.isPinned))
                        .slice(0, 2)
                        .map((n) => (
                          <div key={n._id}>
                            <p className="line-clamp-3 whitespace-pre-wrap text-sm text-slate-700">
                              {n.content}
                            </p>
                            <p className="mt-2 text-xs text-slate-400">
                              {n.authorName} · {date(n.createdAt)}
                              {n.isPinned ? " · Pinned" : ""}
                            </p>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <Empty>No notes recorded for this member.</Empty>
                  )}
                </Panel>
                <Panel
                  title="Recent activity"
                  action={<Jump onClick={() => navigate("activity")} />}
                >
                  <Timeline rows={data.timeline.slice(0, 4)} />
                </Panel>
              </div>
            </>
          )}
          {tab === "personal" && (
            <Personal
              data={data}
              onEdit={() => setDialog("edit")}
              portal={portal}
            />
          )}
          {tab === "coverage" && (
            <>
              <Panel title="Membership">
                <Fields>
                  <Field label="Status" value={humanize(m.memberType)} />
                  <Field label="Effective date" value={m.effectiveDate} />
                  <Field label="Enrollment date" value={date(m.enrolledAt)} />
                  <Field
                    label="Termination date"
                    value={date(m.terminatedAt)}
                  />
                  <Field
                    label="Plan"
                    value={m.planName ?? data.listBill?.rateLabel}
                  />
                  <Field
                    label="Attribution"
                    value={humanize(m.attributionSource ?? "none")}
                  />
                </Fields>
              </Panel>
              <Panel title="Services & benefits">
                {data.services.length ? (
                  <div className="divide-y divide-slate-100">
                    {data.services.map((s) => (
                      <div
                        key={s.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {s.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {date(s.startsAt)} – {date(s.endsAt)}
                          </p>
                        </div>
                        <StatusBadge status={s.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty>
                    {data.listBill
                      ? `Employer-billed coverage: ${data.listBill.rateLabel ?? "Group plan"}. No separate benefit records are available.`
                      : "No benefit records available."}
                  </Empty>
                )}
              </Panel>
              <Agreements data={data} />
            </>
          )}
          {tab === "billing" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Metric
                  label="Billing responsibility"
                  value={billingLabel[data.billingSource]}
                  detail={
                    data.employerPays
                      ? "Coverage billed to the employer"
                      : "Member billing arrangement"
                  }
                />
                <Metric
                  label="Monthly amount"
                  value={
                    data.billingSource === "none"
                      ? "Not set up"
                      : money(m.mrrCents)
                  }
                  detail="Based on recorded billing data"
                />
              </div>
              {data.listBill && (
                <Panel title="Employer billing">
                  <Fields>
                    <Field label="Plan" value={data.listBill.rateLabel} />
                    <Field label="Tier" value={data.listBill.tierLabel} />
                    <Field
                      label="Payment method"
                      value={humanize(
                        data.listBill.employerPaymentMethod ?? "Not recorded",
                      )}
                    />
                    <Field
                      label="List-bill status"
                      value={humanize(data.listBill.listBillStatus)}
                    />
                    <Field
                      label="Latest group invoice"
                      value={
                        data.listBill.invoiceNumber
                          ? `#${data.listBill.invoiceNumber}`
                          : "Not generated"
                      }
                    />
                    <Field
                      label="Group invoice status"
                      value={humanize(
                        data.listBill.invoiceStatus ?? "Not recorded",
                      )}
                    />
                  </Fields>
                  <p className="mt-4 text-xs text-slate-500">
                    The employer settles the group invoice. Its status is not a
                    member balance due.
                  </p>
                </Panel>
              )}
              {data.subscription && (
                <Panel title="Subscription">
                  <Fields>
                    <Field
                      label="Status"
                      value={humanize(data.subscription.status)}
                    />
                    <Field
                      label="Frequency"
                      value={humanize(data.subscription.cadence)}
                    />
                    <Field
                      label="Periodic charge"
                      value={money(data.subscription.totalCents)}
                    />
                    <Field
                      label="Payment method"
                      value={humanize(
                        data.subscription.paymentMethod ?? "Not recorded",
                      )}
                    />
                    <Field
                      label="Period starts"
                      value={date(data.subscription.currentPeriodStart)}
                    />
                    <Field
                      label="Period ends"
                      value={date(data.subscription.currentPeriodEnd)}
                    />
                    <Field
                      label="Cancelled"
                      value={date(data.subscription.cancelledAt)}
                    />
                    <Field
                      label="Past due since"
                      value={date(data.subscription.pastDueAt)}
                    />
                  </Fields>
                </Panel>
              )}
              {!data.listBill && !data.subscription && (
                <Panel title="Billing details">
                  <Empty>
                    {data.billingSource === "comp"
                      ? "This member has complimentary coverage."
                      : "No subscription or employer billing arrangement is recorded."}
                  </Empty>
                </Panel>
              )}
            </>
          )}
          {tab === "invoices" && (
            <Panel title="Member invoice lines">
              <p className="mb-4 text-sm text-slate-500">
                This member’s coverage charges from the latest 100 employer
                invoices. Status applies to the employer invoice.
              </p>
              {data.invoices.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b text-xs text-slate-500">
                        {[
                          "Invoice",
                          "Coverage",
                          "Plan",
                          "Due",
                          "Charge",
                          "Status",
                        ].map((h) => (
                          <th className="px-3 py-3 font-medium" key={h}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.invoices.map((i) => (
                        <tr key={i.id} className="border-b border-slate-100">
                          <td className="px-3 py-4">#{i.number}</td>
                          <td className="px-3 py-4">{i.period}</td>
                          <td className="px-3 py-4">
                            {i.product} · {i.tier}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4">
                            {date(i.dueAt)}
                          </td>
                          <td className="px-3 py-4">{money(i.rateCents)}</td>
                          <td className="px-3 py-4">
                            <StatusBadge status={i.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty>
                  {data.billingSource === "direct"
                    ? "Individual payment events are available in Activity history. Individual invoice documents are not synced to this workspace."
                    : "No employer invoice lines recorded for this member."}
                </Empty>
              )}
            </Panel>
          )}
          {tab === "notes" && (
            <Notes data={data} onAdd={() => setDialog("note")} />
          )}
          {tab === "alerts" && (
            <Alerts data={data} now={now} onAdd={() => setDialog("alert")} />
          )}
          {tab === "activity" && <Activity data={data} />}
          {tab === "documents" && (
            <>
              <Panel
                title="Document library"
                action={
                  <button
                    className={button}
                    onClick={() => setDialog("document")}
                  >
                    <Plus size={15} /> Add document link
                  </button>
                }
              >
                <p className="mb-4 text-sm text-slate-500">
                  Linked enrollment records, agreements, and correspondence.
                  Access to the original document is managed by its host.
                </p>
                {data.documents.length ? (
                  <div className="divide-y divide-slate-100">
                    {data.documents.map((d) => (
                      <div
                        key={d._id}
                        className="flex items-center justify-between gap-4 py-4"
                      >
                        <div className="min-w-0">
                          <a
                            className="flex items-center gap-2 break-all text-sm font-medium text-teal-700 hover:underline"
                            href={d.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {d.name}
                            <ArrowUpRight size={14} />
                          </a>
                          <p className="mt-1 text-xs text-slate-500">
                            {humanize(d.category)} · {date(d.createdAt)} ·{" "}
                            {d.authorName} ·{" "}
                            {d.visibility === "shared"
                              ? "Shared with brokers"
                              : "Admin only"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty>No document links added.</Empty>
                )}
                {data.isAdmin && (
                  <a
                    className={`${secondary} mt-4`}
                    href={`/api/admin/members/${memberId}/id-card`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Download member ID card <ArrowUpRight size={14} />
                  </a>
                )}
              </Panel>
              <Agreements data={data} />
            </>
          )}
          {tab === "communications" && data.isAdmin && (
            <MemberCommunications
              memberProfileId={memberId}
              memberName={`${m.firstName} ${m.lastName}`}
            />
          )}
          {tab === "account" && data.isAdmin && <Inspector id={memberId} />}
        </main>
      </div>
      {dialog && (
        <WorkspaceForm
          key={dialog}
          kind={dialog}
          data={data}
          memberId={memberId}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function Personal({
  data,
  onEdit,
  portal,
}: {
  data: Workspace;
  onEdit: () => void;
  portal: string;
}) {
  const m = data.member,
    raw = data.raw;
  return (
    <>
      <Panel
        title="Personal details"
        action={
          data.isAdmin && (
            <button className={secondary} onClick={onEdit}>
              Edit profile
            </button>
          )
        }
      >
        <Fields>
          <Field label="First name" value={m.firstName} />
          <Field label="Last name" value={m.lastName} />
          <Field label="Email" value={m.email} />
          <Field label="Phone" value={m.phone} />
          {raw && (
            <>
              <Field label="Date of birth" value={raw.dateOfBirth} />
              <Field
                label="Gender"
                value={raw.gender && humanize(raw.gender)}
              />
              <Field label="Work phone" value={raw.workPhone} />
              <Field
                label="Address"
                value={
                  raw.address &&
                  [
                    raw.address.line1,
                    raw.address.line2,
                    raw.address.city,
                    raw.address.state,
                    raw.address.postalCode,
                  ]
                    .filter(Boolean)
                    .join(", ")
                }
              />
            </>
          )}
        </Fields>
      </Panel>
      <Panel title="Household">
        <p className="mb-4 flex items-center gap-2 text-sm text-slate-600">
          <Users size={16} /> {m.dependentCount} dependent
          {m.dependentCount === 1 ? "" : "s"}
        </p>
        {!data.isAdmin ? (
          <Empty>Dependent details are available to administrators.</Empty>
        ) : data.family.length ? (
          <div className="divide-y divide-slate-100">
            {data.family.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div>
                  <Link
                    href={`/${portal}/members/${d.id}`}
                    className="font-medium text-teal-700 hover:underline"
                  >
                    {d.firstName} {d.lastName}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {humanize(d.relationship ?? "dependent")}
                  </p>
                </div>
                <StatusBadge status={d.status} />
              </div>
            ))}
          </div>
        ) : raw?.dependents?.length ? (
          <div className="space-y-3">
            {raw.dependents.map((d, i) => (
              <div key={i} className="text-sm">
                {d.firstName} {d.lastName}
                <span className="ml-2 text-slate-500">
                  {humanize(d.relationship)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Empty>No dependent profiles recorded.</Empty>
        )}
      </Panel>
      {raw && (
        <Panel title="Communication preferences">
          <Fields>
            <Field
              label="Email"
              value={
                raw.communicationPrefs
                  ? raw.communicationPrefs.emailOptIn
                    ? "Opted in"
                    : "Opted out"
                  : "Not recorded"
              }
            />
            <Field
              label="SMS"
              value={
                raw.communicationPrefs
                  ? raw.communicationPrefs.smsOptIn
                    ? "Opted in"
                    : "Opted out"
                  : "Not recorded"
              }
            />
            <Field
              label="Phone"
              value={
                raw.communicationPrefs
                  ? raw.communicationPrefs.callOptIn
                    ? "Opted in"
                    : "Opted out"
                  : "Not recorded"
              }
            />
          </Fields>
        </Panel>
      )}
    </>
  );
}

function Agreements({ data }: { data: Workspace }) {
  return (
    <Panel title="Agreement records">
      {data.agreements.length ? (
        <div className="space-y-4">
          {data.agreements.map((a) => (
            <div key={a.id} className="rounded-lg border border-slate-100 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-medium text-slate-800">{a.planName}</p>
                <StatusBadge status={a.status} />
              </div>
              <Fields>
                <Field label="Term" value={a.term} />
                <Field label="Effective" value={a.effectiveDate} />
                <Field label="Signed" value={date(a.signedAt)} />
                <Field
                  label="Terms accepted"
                  value={a.termsAccepted ? "Yes" : "Incomplete"}
                />
              </Fields>
            </div>
          ))}
        </div>
      ) : (
        <Empty>
          No signed membership agreement record is linked to this account.
        </Empty>
      )}
    </Panel>
  );
}

function Notes({ data, onAdd }: { data: Workspace; onAdd: () => void }) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const rows = data.notes
    .filter(
      (n) =>
        (!type || n.noteType === type) &&
        `${n.content} ${n.authorName}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => Number(b.isPinned) - Number(a.isPinned));
  return (
    <Panel
      title="Member notes"
      action={
        <button className={button} onClick={onAdd}>
          <Plus size={15} /> Add note
        </button>
      }
    >
      <div className="mb-5 flex flex-wrap gap-3">
        <input
          aria-label="Search notes"
          className={`${input} sm:max-w-xs`}
          placeholder="Search notes or author…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Note category"
          className={`${input} sm:max-w-48`}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">All categories</option>
          {[...new Set(data.notes.map((n) => n.noteType))].map((t) => (
            <option key={t} value={t}>
              {humanize(t)}
            </option>
          ))}
        </select>
      </div>
      {rows.length ? (
        <div className="space-y-4">
          {rows.map((n) => (
            <article
              key={n._id}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="font-medium text-teal-700">
                  {humanize(n.noteType)}
                </span>
                <span>· {n.authorName}</span>
                <span>· {formatDateTime(n.createdAt)}</span>
                <span>
                  ·{" "}
                  {n.visibility === "shared"
                    ? "Shared with brokers"
                    : "Admin only"}
                </span>
                {n.isPinned && <span>· Pinned</span>}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                {n.content}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <Empty>No notes match this view.</Empty>
      )}
    </Panel>
  );
}

function Alerts({
  data,
  now,
  onAdd,
}: {
  data: Workspace;
  now: number;
  onAdd: () => void;
}) {
  const [filter, setFilter] = useState("active");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const resolve = useMutation(api.insights.memberWorkspace.resolveAlert);
  const status = (a: Workspace["alerts"][number]) =>
    a.resolvedAt
      ? "resolved"
      : a.expiresAt && a.expiresAt <= now
        ? "expired"
        : "active";
  const rows = data.alerts.filter(
    (a) => filter === "all" || status(a) === filter,
  );
  return (
    <Panel
      title="Member alerts"
      action={
        <button className={button} onClick={onAdd}>
          <Plus size={15} /> Create alert
        </button>
      }
    >
      <select
        aria-label="Alert status"
        className={`${input} mb-5 sm:max-w-48`}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      >
        {["active", "resolved", "expired", "all"].map((s) => (
          <option key={s} value={s}>
            {humanize(s)}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((a) => (
            <article
              key={a._id}
              className={`rounded-xl border p-4 ${a.severity === "urgent" ? "border-red-200 bg-red-50" : a.severity === "warning" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {a.severity} · {status(a)} ·{" "}
                    {a.visibility === "shared" ? "Shared" : "Admin only"}
                  </p>
                  <p className="mt-2 break-words text-sm font-medium text-slate-900">
                    {a.title}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {a.authorName} · {date(a.createdAt)}
                    {a.expiresAt ? ` · Expires ${date(a.expiresAt)}` : ""}
                    {a.resolvedAt ? ` · Resolved ${date(a.resolvedAt)}` : ""}
                  </p>
                </div>
                {status(a) === "active" &&
                  (data.isAdmin || a.authorId === data.viewerId) && (
                    <button
                      disabled={busy !== null}
                      className={secondary}
                      onClick={async () => {
                        setBusy(a._id);
                        setError("");
                        try {
                          await resolve({ alertId: a._id });
                        } catch {
                          setError(
                            "Could not resolve alert. Please try again.",
                          );
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      {busy === a._id ? "Resolving…" : "Resolve"}
                    </button>
                  )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty>No {filter === "all" ? "" : filter} alerts.</Empty>
      )}
    </Panel>
  );
}

function Activity({ data }: { data: Workspace }) {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(20);
  const rows = data.timeline.filter(
    (a) =>
      `${a.title} ${a.description ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!from || a.createdAt >= new Date(`${from}T00:00:00`).getTime()) &&
      (!to || a.createdAt <= new Date(`${to}T23:59:59.999`).getTime()),
  );
  return (
    <Panel title="Activity history">
      <p className="mb-4 text-sm text-slate-500">
        Latest 100 recorded enrollment, payment, communication, and portal
        events.
      </p>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Search size={12} /> Search activity
          </span>
          <input
            className={input}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="space-y-1 text-xs text-slate-500">
          From
          <input
            type="date"
            className={input}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="space-y-1 text-xs text-slate-500">
          Through
          <input
            type="date"
            className={input}
            min={from}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      <Timeline rows={rows.slice(0, limit)} />
      {rows.length > limit && (
        <button
          className={`${secondary} mt-5`}
          onClick={() => setLimit(limit + 20)}
        >
          Show more activity
        </button>
      )}
    </Panel>
  );
}

function Timeline({ rows }: { rows: Workspace["timeline"] }) {
  return rows.length ? (
    <ol className="space-y-4">
      {rows.map((a) => (
        <li key={a._id} className="flex gap-3">
          <span
            aria-hidden
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-500"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800">
              {humanize(a.title)}
            </p>
            {a.description && (
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-500">
                {a.description}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              {formatDateTime(a.createdAt)}
              {a.actorName ? ` · ${a.actorName}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ol>
  ) : (
    <Empty>No activity matches this view.</Empty>
  );
}

function WorkspaceForm({
  kind,
  data,
  memberId,
  onClose,
}: {
  kind: "note" | "alert" | "document" | "edit";
  data: Workspace;
  memberId: Id<"memberProfiles">;
  onClose: () => void;
}) {
  const now = useNow();
  const addNote = useMutation(api.insights.memberWorkspace.addNote);
  const addAlert = useMutation(api.insights.memberWorkspace.createAlert);
  const addDocument = useMutation(api.insights.memberWorkspace.addDocument);
  const edit = useMutation(api.admin.members.updateMemberProfile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [visibility, setVisibility] = useState<"admin" | "shared">(
    data.isAdmin ? "admin" : "shared",
  );
  const [noteType, setNoteType] = useState<
    "general" | "enrollment" | "billing" | "support" | "follow_up" | "internal"
  >("general");
  const titles = {
    note: "Add member note",
    alert: "Create member alert",
    document: "Add document link",
    edit: "Edit member profile",
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const val = (name: string) => String(form.get(name) ?? "").trim();
    setBusy(true);
    setError("");
    try {
      if (kind === "note")
        await addNote({
          memberId,
          content: val("content"),
          noteType,
          visibility,
          isPinned: form.get("pinned") === "on",
        });
      if (kind === "alert")
        await addAlert({
          memberId,
          title: val("title"),
          severity: val("severity") as "info" | "warning" | "urgent",
          visibility,
          expiresAt: val("expires")
            ? new Date(`${val("expires")}T23:59:59`).getTime()
            : undefined,
        });
      if (kind === "document")
        await addDocument({
          memberId,
          name: val("name"),
          url: val("url"),
          category: val("category") as
            | "agreement"
            | "enrollment"
            | "correspondence"
            | "other",
          visibility,
        });
      if (kind === "edit")
        await edit({
          memberId,
          firstName: val("firstName"),
          lastName: val("lastName"),
          email: val("email"),
          phone: val("phone"),
          dateOfBirth: val("dateOfBirth"),
          address: {
            line1: val("line1"),
            line2: val("line2"),
            city: val("city"),
            state: val("state"),
            postalCode: val("postalCode"),
            country: data.raw?.address?.country ?? "US",
          },
        });
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open title={titles[kind]} onClose={onClose} preventClose={busy}>
      <form onSubmit={submit} className="space-y-4 px-6 pb-6">
        {kind === "note" && (
          <>
            <FormField label="Note category">
              <select
                className={input}
                value={noteType}
                onChange={(e) => {
                  const type = e.target.value as typeof noteType;
                  setNoteType(type);
                  if (type === "internal") setVisibility("admin");
                }}
              >
                {[
                  "general",
                  "enrollment",
                  "billing",
                  "support",
                  "follow_up",
                  ...(data.isAdmin ? ["internal"] : []),
                ].map((t) => (
                  <option key={t} value={t}>
                    {humanize(t)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Note">
              <textarea
                required
                name="content"
                maxLength={10000}
                rows={6}
                className={input}
                placeholder="Record the conversation, decision, or next step…"
              />
            </FormField>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="pinned" /> Pin to member overview
            </label>
          </>
        )}
        {kind === "alert" && (
          <>
            <FormField label="Alert message">
              <textarea
                name="title"
                required
                maxLength={500}
                rows={3}
                className={input}
              />
            </FormField>
            <FormField label="Priority">
              <select name="severity" className={input}>
                <option value="info">Information</option>
                <option value="warning">Needs attention</option>
                <option value="urgent">Urgent</option>
              </select>
            </FormField>
            <FormField label="Expiration date (optional)">
              <input
                name="expires"
                type="date"
                min={new Date(now).toLocaleDateString("en-CA")}
                className={input}
              />
            </FormField>
          </>
        )}
        {kind === "document" && (
          <>
            <FormField label="Document name">
              <input name="name" required maxLength={200} className={input} />
            </FormField>
            <FormField label="HTTPS document URL">
              <input
                name="url"
                type="url"
                pattern="https://.*"
                required
                maxLength={2000}
                className={input}
                placeholder="https://…"
              />
            </FormField>
            <FormField label="Category">
              <select name="category" className={input}>
                {["agreement", "enrollment", "correspondence", "other"].map(
                  (c) => (
                    <option key={c} value={c}>
                      {humanize(c)}
                    </option>
                  ),
                )}
              </select>
            </FormField>
          </>
        )}
        {kind === "edit" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["firstName", "First name", data.member.firstName, "text"],
                ["lastName", "Last name", data.member.lastName, "text"],
                ["email", "Email", data.member.email, "email"],
                ["phone", "Phone", data.member.phone, "tel"],
                ["dateOfBirth", "Date of birth", data.raw?.dateOfBirth, "date"],
                ["line1", "Street address", data.raw?.address?.line1, "text"],
                ["line2", "Address line 2", data.raw?.address?.line2, "text"],
                ["city", "City", data.raw?.address?.city, "text"],
                ["state", "State", data.raw?.address?.state, "text"],
                [
                  "postalCode",
                  "Postal code",
                  data.raw?.address?.postalCode,
                  "text",
                ],
              ] as const
            ).map(([name, label, value, type]) => (
              <FormField label={label} key={name}>
                <input
                  className={input}
                  name={name}
                  type={type}
                  required={name === "firstName" || name === "lastName"}
                  defaultValue={value ?? ""}
                />
              </FormField>
            ))}
          </div>
        )}
        {kind !== "edit" &&
          (data.isAdmin ? (
            <FormField label="Visibility">
              <select
                className={input}
                value={visibility}
                disabled={kind === "note" && noteType === "internal"}
                onChange={(e) =>
                  setVisibility(e.target.value as "admin" | "shared")
                }
              >
                <option value="admin">Admin only</option>
                <option value="shared">
                  Admins and brokers assigned to this member
                </option>
              </select>
            </FormField>
          ) : (
            <p className="rounded-lg bg-teal-50 p-3 text-xs text-teal-800">
              Visible to administrators and brokers with access to this member.
            </p>
          ))}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={busy}
            className={secondary}
            onClick={onClose}
          >
            Cancel
          </button>
          <button disabled={busy} className={button}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
function Fields({ children }: { children: ReactNode }) {
  return <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">{children}</dl>;
}
function Field({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-slate-800">
        {value || "Not recorded"}
      </dd>
    </div>
  );
}
function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-sm leading-6 text-slate-500">
      {children}
    </p>
  );
}
function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}
function Jump({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"
    >
      View details <ChevronRight size={14} />
    </button>
  );
}

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
