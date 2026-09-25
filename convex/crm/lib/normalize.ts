/**
 * CRM NORMALIZATION
 *
 * Pure functions only — no ctx, no db access — so they're cheap to unit test
 * and safe to call from both mutations and the client-side CSV mapper preview.
 *
 * These are the CRM's own normalizers, deliberately not shared with
 * convex/lib/sanitize.ts's normalizePhone(): that one is tuned for enrollment
 * data (SSN-adjacent, single source of truth per member). The CRM ingests
 * messy cold-list data from many sources and needs its own dedupe-key rules.
 */

const ROLE_LOCAL_PARTS = new Set([
  "info", "sales", "support", "admin", "office", "hello", "contact",
  "postmaster", "abuse", "webmaster", "noreply", "no-reply", "help",
  "billing", "hr", "careers", "jobs", "marketing", "team", "mail",
]);

const COMPANY_SUFFIXES =
  /\b(inc|incorporated|llc|l\.l\.c|ltd|limited|corp|corporation|co|company|group|holdings|llp|lp|pllc|pc)\.?\s*$/i;

/** Lowercased + trimmed. Returns undefined for empty/invalid input. */
export function normalizeEmail(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@") || trimmed.startsWith("@") || trimmed.endsWith("@")) {
    return undefined;
  }
  return trimmed;
}

/** True for role/shared mailboxes that should never receive individual outreach. */
export function isRoleAddress(email: string | undefined | null): boolean {
  const normalized = normalizeEmail(email ?? undefined);
  if (!normalized) return false;
  const localPart = normalized.split("@")[0];
  return ROLE_LOCAL_PARTS.has(localPart);
}

/** Bare lowercase host from an email address, or undefined. */
export function extractDomain(email: string | undefined | null): string | undefined {
  const normalized = normalizeEmail(email ?? undefined);
  if (!normalized) return undefined;
  const at = normalized.lastIndexOf("@");
  if (at === -1) return undefined;
  const domain = normalized.slice(at + 1);
  return domain || undefined;
}

/**
 * US-centric E.164 normalizer for CRM phone fields. Strips everything but
 * digits, assumes a bare 10-digit number is +1. Returns undefined for
 * anything that isn't plausibly a US/CA number — deliberately conservative,
 * since a wrong E.164 becomes a dial target.
 */
export function normalizePhoneE164(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return undefined;
}

/** Lowercased, whitespace-collapsed, legal-suffix-stripped. The company dedupe key. */
export function normalizeCompanyKey(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const collapsed = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!collapsed) return undefined;
  const stripped = collapsed.replace(COMPANY_SUFFIXES, "").trim();
  return stripped || collapsed;
}

/** Lowercased "first last" with punctuation stripped. Used inside the contact dedupeKey. */
export function normalizeNameKey(
  firstName: string | undefined | null,
  lastName: string | undefined | null,
): string {
  const clean = (s: string | undefined | null) =>
    (s ?? "").trim().toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
  return `${clean(firstName)} ${clean(lastName)}`.trim();
}

/** nameKey|companyKey fallback dedupe key for rows with no email. */
export function buildDedupeKey(
  firstName: string | undefined | null,
  lastName: string | undefined | null,
  companyName: string | undefined | null,
): string | undefined {
  const nameKey = normalizeNameKey(firstName, lastName);
  if (!nameKey) return undefined;
  const companyKey = normalizeCompanyKey(companyName) ?? "";
  return `${nameKey}|${companyKey}`;
}

/** fullName + email + companyName + jobTitle + phone digits, space-joined, lowercased. */
export function buildContactSearchText(fields: {
  fullName?: string;
  email?: string;
  companyName?: string;
  jobTitle?: string;
  mobilePhone?: string;
  officePhone?: string;
}): string {
  const phoneDigits = [fields.mobilePhone, fields.officePhone]
    .filter(Boolean)
    .map((p) => (p as string).replace(/\D/g, ""))
    .join(" ");
  return [fields.fullName, fields.email, fields.companyName, fields.jobTitle, phoneDigits]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .trim();
}

/** name + domain + industry + city/state, space-joined, lowercased. */
export function buildCompanySearchText(fields: {
  name?: string;
  domain?: string;
  industry?: string;
  city?: string;
  state?: string;
}): string {
  return [fields.name, fields.domain, fields.industry, fields.city, fields.state]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .trim();
}
