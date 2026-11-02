"use client";

import { SITE_MARKETING_FEATURES, isSiteMarketingEnabled, type SiteMarketing } from "@/convex/lib/siteMarketing";

export function SiteMarketingSettings({ value, onChange, shopEnabled, onShopChange, isPrimary }: {
  value: SiteMarketing;
  onChange: (value: SiteMarketing) => void;
  shopEnabled: boolean;
  onShopChange: (value: boolean) => void;
  isPrimary: boolean;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">
        Choose the sections and links this brand promotes. Member benefits, plan descriptions,
        pricing, and existing memberships are managed separately. Direct service and resource URLs remain accessible.
      </p>
      {["Landing sections", "Services", "Resources"].map(group => (
        <fieldset key={group} className="space-y-2">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{group}</legend>
          {SITE_MARKETING_FEATURES.filter(feature => feature.group === group).map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isSiteMarketingEnabled(value, key)}
                onChange={event => onChange({ ...value, [key]: event.target.checked })} />
              {label}
            </label>
          ))}
        </fieldset>
      ))}
      {!isPrimary && (
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Shop</legend>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={shopEnabled} onChange={event => onShopChange(event.target.checked)} />
            Enable the preventative care shop for this brand
          </label>
          <p className="mt-1 text-xs text-slate-500">The platform shop switch must also be on. This controls both the shop page and its navigation link.</p>
        </fieldset>
      )}
      <button type="button" className="text-sm text-blue-600 hover:underline" onClick={() => onChange({})}>
        Reset marketing visibility to defaults
      </button>
    </div>
  );
}
