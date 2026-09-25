"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { AREA_ORDER, AREA_STYLE, SOPS, areaCount, type SopArea, type SopMeta } from "@/lib/admin-sops";

type Filter = SopArea | "All";

const PERMISSION_HREF = "/admin/docs/guide/00-overview#1-the-permission-model-read-this-first";

const GLOSSARY: { term: string; def: string }[] = [
  { term: "Site (Carrier)", def: "The brand at the top of the tree — e.g. “Ideal Oral Health.” Usually just one." },
  { term: "Account", def: "The middle tier: a company or producer that owns one or more employer Groups under a Site. (Formerly also called “Broker” — no longer.)" },
  { term: "Group (Organization / Employer)", def: "One specific employer or association whose members enroll. Each has a unique Group Code." },
  { term: "Broker", def: "A sales/commission partner — Program Managers, FMOs, agencies who resell the plans. A separate system from the Account tree; managed on the Brokers page." },
  { term: "Rep Code", def: "A tracking code for one salesperson, so a completed sale is credited to them for commission." },
  { term: "Member", def: "A person in a plan, moving through a status pipeline (lead → eligible → active → terminated, and so on)." },
  { term: "Primary / Dependent", def: "The Primary owns and pays for the plan. Dependents (spouse, children) are covered on it at no extra charge." },
  { term: "Self-Pay", def: "The member pays their own subscription through Stripe." },
  { term: "List-Bill", def: "The employer pays one combined bill for all its members (payroll deduction), rather than each member paying." },
  { term: "Eligibility File", def: "A spreadsheet an employer sends listing who should be covered. Upload it to create or update members in bulk." },
  { term: "Vendor File", def: "A file we generate and send outward to a fulfillment partner (Careington, DialCare) listing who is covered." },
  { term: "Careington / DialCare / Toothlens", def: "Outside partners: Careington (dental discount network), DialCare (teledentistry), Toothlens (AI oral scan)." },
  { term: "Comp / Free access", def: "Giving a member a plan at $0 (testing, VIP, or employer-paid) rather than charging them." },
];

const LAYOUT_KEY: { name: string; desc: string }[] = [
  { name: "At a glance", desc: "the outcome, when you'd do it, how often, and who — up top, before any steps." },
  { name: "Before you begin", desc: "what to have in hand first." },
  { name: "Steps", desc: "numbered, in order. Button labels appear in bold, exactly as shown in the product." },
  { name: "Verification", desc: "how to confirm it worked — many confirmations here are a brief pop-up with no other record." },
  { name: "If something goes wrong", desc: "the common snags and how to resolve them." },
  { name: "Related SOPs", desc: "where to go next." },
];

function AreaTag({ area }: { area: SopArea }) {
  const s = AREA_STYLE[area];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.tag}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {area}
    </span>
  );
}

function href(sop: SopMeta) {
  return `/admin/docs/sops/${sop.slug}`;
}

export function SopDirectory() {
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return SOPS.filter((s) => {
      if (filter !== "All" && s.area !== filter) return false;
      if (terms.length === 0) return true;
      const hay = [s.code, s.title, s.outcome, s.when, s.frequency, s.area, ...s.tags, ...s.pages]
        .join(" ")
        .toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [filter, query]);

  const chips: Filter[] = ["All", ...AREA_ORDER];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Header band */}
        <div className="bg-slate-900 px-6 py-6 sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
            Ideal Admin &middot; Operations
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">SOP Library</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Step-by-step procedures for the tasks admins actually perform. Pick a task below — each one names the exact
            buttons to click, in order, and how to confirm it worked.
          </p>
          <p className="mt-3 text-xs text-slate-400">
            {SOPS.length} procedures across {AREA_ORDER.length} areas &middot; new here? Skim{" "}
            <Link href="#glossary" className="text-slate-200 underline underline-offset-2 hover:text-white">
              the glossary
            </Link>{" "}
            and the{" "}
            <Link href={PERMISSION_HREF} className="text-slate-200 underline underline-offset-2 hover:text-white">
              permission model
            </Link>{" "}
            first.
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-wrap items-center gap-1.5">
            {chips.map((c) => {
              const active = filter === c;
              const count = c === "All" ? SOPS.length : areaCount(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFilter(c)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {c !== "All" && <span className={`h-1.5 w-1.5 rounded-full ${AREA_STYLE[c].dot}`} aria-hidden />}
                  {c}
                  <span className={active ? "text-slate-300" : "text-slate-400"}>{count}</span>
                </button>
              );
            })}
          </div>
          <div className="relative sm:w-64">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks, pages, tags…"
              aria-label="Search SOPs"
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>
        </div>

        {/* Table (md and up) */}
        <div className="hidden md:block">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-6 py-2.5 font-semibold">Procedure</th>
                <th className="px-4 py-2.5 font-semibold">Outcome</th>
                <th className="px-4 py-2.5 font-semibold">When you'd do this</th>
                <th className="px-4 py-2.5 font-semibold">How often</th>
                <th className="px-6 py-2.5 font-semibold">Area</th>
              </tr>
            </thead>
            <tbody>
              {results.map((s) => (
                <tr key={s.slug} className="group border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-6 py-3 align-top">
                    <Link href={href(s)} className="font-medium text-slate-900 group-hover:text-blue-700">
                      {s.title}
                    </Link>
                    <div className="mt-0.5 font-mono text-xs text-slate-400">{s.code}</div>
                  </td>
                  <td className="px-4 py-3 align-top text-slate-600">{s.outcome}</td>
                  <td className="px-4 py-3 align-top text-slate-600">{s.when}</td>
                  <td className="px-4 py-3 align-top text-slate-500">{s.frequency}</td>
                  <td className="px-6 py-3 align-top">
                    <AreaTag area={s.area} />
                  </td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr className="border-t border-slate-100">
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                    No procedures match that filter or search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Cards (mobile) */}
        <div className="divide-y divide-slate-100 md:hidden">
          {results.map((s) => (
            <Link key={s.slug} href={href(s)} className="block px-4 py-3 hover:bg-slate-50">
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium text-slate-900">{s.title}</span>
                <AreaTag area={s.area} />
              </div>
              <p className="mt-1 text-sm text-slate-600">{s.outcome}</p>
              <p className="mt-1 text-xs text-slate-400">
                {s.code} &middot; {s.frequency} &middot; {s.when}
              </p>
            </Link>
          ))}
          {results.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-slate-500">No procedures match that filter or search.</p>
          )}
        </div>
      </section>

      {/* Glossary */}
      <section id="glossary" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">The words you'll see</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
          The admin app reuses a handful of terms throughout. Two minutes here makes every procedure easier to follow.
        </p>
        <dl className="mt-5 grid grid-cols-1 gap-x-10 gap-y-0 sm:grid-cols-2">
          {GLOSSARY.map((g) => (
            <div key={g.term} className="border-t border-slate-100 py-3">
              <dt className="text-sm font-semibold text-slate-800">{g.term}</dt>
              <dd className="mt-0.5 text-sm leading-6 text-slate-600">{g.def}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Layout key */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">How each procedure is laid out</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
          Every SOP follows the same shape, so once you have read one you can read them all.
        </p>
        <ul className="mt-4 space-y-2.5">
          {LAYOUT_KEY.map((k) => (
            <li key={k.name} className="flex gap-3 text-sm leading-6">
              <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-slate-300" aria-hidden />
              <span className="text-slate-600">
                <span className="font-semibold text-slate-800">{k.name}</span> — {k.desc}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
