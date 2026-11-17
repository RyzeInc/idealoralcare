import { ASSURE_ORIGIN } from "./site-domains";

export type LinkLanding = "essentials" | "oralcare";

/**
 * A holder's AssureVantage link. The ending is their vanity slug or, for older
 * records without one, their rep code — the site resolves either.
 */
export function partnerLink(ending: string, landing?: LinkLanding | null): string {
  const url = new URL(`/${encodeURIComponent(ending.trim())}`, ASSURE_ORIGIN);
  if (landing) url.searchParams.set("to", landing);
  return url.toString();
}

export interface LinkRow {
  name: string;
  detail: string | null;
  email: string | null;
  holderType: string | null;
  code: string;
  ending: string;
  active: boolean;
  /** Memberships on the book through this link (dependents and demo accounts excluded). */
  activeMembers: number;
  /** Memberships through this link that have since ended. */
  endedMembers: number;
  /** Visits to the link. Not sign-ups. */
  linkVisits: number;
}

export const HOLDER_LABEL: Record<string, string> = {
  broker: "Broker",
  rep: "Sales rep",
  organization: "Organization",
  partner: "Partner",
  other: "Other",
};

const cell = (value: string | number) => {
  const text = String(value);
  // Leading = + - @ would run as a formula when the file is opened in a spreadsheet.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function linksCsv(rows: LinkRow[]): string {
  const header = ["Name", "Organization / contact", "Email", "Type", "Status", "Code", "AssureVantage link", "Oral care link", "Essentials link", "Active members", "Ended members", "Link visits"];
  const lines = rows.map((r) =>
    [
      r.name, r.detail ?? "", r.email ?? "", r.holderType ? HOLDER_LABEL[r.holderType] ?? r.holderType : "",
      r.active ? "Active" : "Off", r.code, partnerLink(r.ending), partnerLink(r.ending, "oralcare"), partnerLink(r.ending, "essentials"), r.activeMembers, r.endedMembers, r.linkVisits,
    ].map(cell).join(","),
  );
  return [header.join(","), ...lines].join("\r\n");
}

/** Plain text for pasting into an email: one holder per line. */
export function linksText(rows: LinkRow[]): string {
  return rows.map((r) => `${r.name}: ${partnerLink(r.ending)}`).join("\n");
}
