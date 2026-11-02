"use client";

import { useState, useSyncExternalStore } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { buildSiteEnrollmentLink, type SiteLinkDestination } from "@/lib/site-links";

const subscribe = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => "";

export function SiteEnrollmentLinks({ siteSlug, status }: { siteSlug: string; status: string }) {
  const origin = useSyncExternalStore(subscribe, getOrigin, getServerOrigin);
  const agents = useQuery(api.enrollment.agents.listPublicAgents, {});
  const [destination, setDestination] = useState<SiteLinkDestination>("plans");
  const [referralCode, setReferralCode] = useState("");
  const [notice, setNotice] = useState("");
  const url = origin ? buildSiteEnrollmentLink({ origin, siteSlug, destination, referralCode }) : "";

  return (
    <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-800">Landing and broker links</legend>
      <p className="text-xs text-slate-500">Use this website&apos;s address to share the brand before its custom domain is ready. Broker codes stay the same after a rename.</p>
      {status !== "active" && <p className="text-xs text-amber-700">This site is {status}. Activate and verify it before sharing enrollment links.</p>}
      <label className="block text-sm text-slate-700">
        Destination
        <select value={destination} onChange={event => { setDestination(event.target.value as SiteLinkDestination); setNotice(""); }} className="mt-1 w-full rounded border border-slate-300 px-2 py-2">
          <option value="landing">Brand landing page</option>
          <option value="plans">Plans</option>
          <option value="enroll">Enrollment</option>
          <option value="scan">Member oral scan (sign-in required)</option>
        </select>
      </label>
      <label className="block text-sm text-slate-700">
        Broker attribution
        <select value={referralCode} onChange={event => { setReferralCode(event.target.value); setNotice(""); }} className="mt-1 w-full rounded border border-slate-300 px-2 py-2">
          <option value="">No broker code</option>
          {(agents ?? []).map(agent => <option key={agent.repCode} value={agent.repCode}>{agent.name} — {agent.repCode}{agent.groupName ? ` (${agent.groupName})` : ""}</option>)}
        </select>
      </label>
      {agents === undefined && <p className="text-xs text-slate-500">Loading broker codes…</p>}
      <label className="block text-sm text-slate-700">
        Shareable link
        <input readOnly value={url} onFocus={event => event.target.select()} className="mt-1 w-full rounded border border-slate-300 p-2 font-mono text-xs" />
      </label>
      <div className="flex items-center gap-3">
        <button type="button" disabled={!url} className="text-sm text-blue-600 disabled:opacity-50" onClick={async () => {
          try { await navigator.clipboard.writeText(url); setNotice("Link copied."); }
          catch { setNotice("Select the link above and copy it."); }
        }}>Copy link</button>
        {url && <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600">Open link ↗</a>}
      </div>
      <p role="status" className="text-xs text-slate-500">{notice}</p>
    </fieldset>
  );
}
