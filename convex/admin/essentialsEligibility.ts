import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { requireAdminAction } from "../lib/authGuards";

/**
 * ESSENTIALS ELIGIBILITY FILE GENERATION (CSV)
 *
 * Generates downloadable test/audit CSVs in three formats matching the
 * Essentials Eligibility Spreadsheet conventions:
 *
 *   - ARK       — single-vendor CSV (no GroupID/PersonCode/CoverageType/Organization)
 *   - RxValet   — same column layout as ARK
 *   - Combined  — adds GroupID, PersonCode, CoverageType, Organization columns
 *
 * Each primary member produces one row, plus one row per dependent.
 */

// ─── helpers ────────────────────────────────────────────────────────────

function formatDateUS(iso?: string | null): string {
  // ISO "YYYY-MM-DD" → "M/D/YYYY"
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${parseInt(m, 10)}/${parseInt(d, 10)}/${y}`;
}

function formatTimestampUS(ts?: number | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
}

function genderCode(g?: string | null): string {
  if (g === "male" || g === "M") return "M";
  if (g === "female" || g === "F") return "F";
  return "";
}

function relationshipLabel(rel?: string | null): string {
  switch (rel) {
    case "spouse":
    case "domestic_partner":
      return "Spouse";
    case "child":
      return "Dependent";
    default:
      return rel ? rel.charAt(0).toUpperCase() + rel.slice(1) : "Dependent";
  }
}

/**
 * Coverage code based on dependent count and composition.
 *   EE = Employee only
 *   ES = Employee + Spouse
 *   EC = Employee + Child(ren)
 *   EF = Employee + Family (spouse + child(ren))
 */
function coverageType(deps: any[]): string {
  if (!deps || deps.length === 0) return "EE";
  const hasSpouse = deps.some((d) => d.relationship === "spouse" || d.relationship === "domestic_partner");
  const hasChild = deps.some((d) => d.relationship === "child");
  if (hasSpouse && hasChild) return "EF";
  if (hasSpouse) return "ES";
  if (hasChild) return "EC";
  return "EF";
}

/** Escape a CSV cell value, quoting if it contains comma, quote, or newline. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

function digitsOnly(value?: string | null): string {
  return (value ?? "").replace(/\D/g, "");
}

// ─── row shape ─────────────────────────────────────────────────────────

interface EligRow {
  groupId: string;
  memberId: string;
  personCode: number;
  coverageType: string;
  organization: string;
  firstName: string;
  lastName: string;
  relationship: string; // "Primary" | "Spouse" | "Dependent"
  gender: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  effectiveDate: string;
  terminationDate: string;
}

// ─── core: build rows from member profiles ─────────────────────────────

async function buildRows(
  ctx: any,
  groupId?: string,
): Promise<EligRow[]> {
  // Fetch members — either for one group or all active groups
  const members: any[] = groupId
    ? await ctx.runQuery(api.admin.members.getActiveMembersByGroup, { groupId })
    : await (async () => {
        const groups: any[] = await ctx.runQuery(api.admin.hierarchy.getAllGroups);
        const active = groups.filter((g) => g.status === "active");
        const all: any[] = [];
        for (const g of active) {
          const ms: any[] = await ctx.runQuery(api.admin.members.getActiveMembersByGroup, { groupId: g._id });
          for (const m of ms) all.push({ ...m, _group: g });
        }
        return all;
      })();

  // Map of groupId → group doc, for organization name lookup
  const groupCache = new Map<string, any>();
  async function resolveGroup(gid: string): Promise<any> {
    if (groupCache.has(gid)) return groupCache.get(gid);
    const grp = await ctx.runQuery(api.admin.hierarchy.getGroupById, { groupId: gid });
    groupCache.set(gid, grp);
    return grp;
  }
  async function resolveAccount(aid: string): Promise<any> {
    return ctx.runQuery(api.admin.hierarchy.getAccountById, { accountId: aid });
  }

  const rows: EligRow[] = [];

  for (const member of members) {
    if (member.memberRole === "dependent") continue; // Dependents are emitted under their primary

    const group = member._group ?? (await resolveGroup(member.groupId));
    const account = group?.accountId ? await resolveAccount(group.accountId) : null;

    const orgName: string =
      group?.organizationCode || account?.name || group?.name || group?.slug || "";
    const groupIdStr: string = group?.groupCode || group?.organizationCode || "";

    const dependents: any[] = member.dependents ?? [];
    const cov = coverageType(dependents);

    const memberIdNumeric: string =
      member.careingtonUniqueId || digitsOnly(member.memberId) || (member.memberId ?? "");

    const addr = member.address ?? {};
    const phone = digitsOnly(member.phone);
    const effDate = member.effectiveDate
      ? formatDateUS(member.effectiveDate)
      : formatTimestampUS(member.enrolledAt ?? member.createdAt);

    const baseFields = {
      memberId: memberIdNumeric,
      coverageType: cov,
      organization: orgName,
      email: member.email ?? "",
      phone,
      address1: addr.line1 ?? "",
      address2: addr.line2 ?? "",
      city: addr.city ?? "",
      state: addr.state ?? "",
      zip: addr.postalCode ?? "",
      effectiveDate: effDate,
      terminationDate: "",
    };

    // Primary
    rows.push({
      ...baseFields,
      groupId: groupIdStr,
      personCode: 1,
      firstName: member.firstName,
      lastName: member.lastName,
      relationship: "Primary",
      gender: genderCode(member.gender),
      dateOfBirth: formatDateUS(member.dateOfBirth),
    });

    // Dependents
    dependents.forEach((dep, idx) => {
      rows.push({
        ...baseFields,
        groupId: "",
        personCode: idx + 2,
        firstName: dep.firstName,
        lastName: dep.lastName,
        relationship: relationshipLabel(dep.relationship),
        gender: "",
        dateOfBirth: formatDateUS(dep.dateOfBirth),
      });
    });
  }

  return rows;
}

// ─── format renderers ──────────────────────────────────────────────────

const ARK_HEADER = [
  "Member ID", "First Name", "Last Name", "Relationship", "Gender", "Date of Birth", "",
  "Email", "Phone Number", "Address 1", "Address 2", "City", "State", "Zip Code", "",
  "Effective Date", "Termination Date", "Notes",
];

const COMBINED_HEADER = [
  "GroupID", "Member ID", "PersonCode", "CoverageType", "Organization",
  "First Name", "Last Name", "Relationship", "Gender", "Date of Birth", "",
  "Email", "Phone Number", "Address 1", "Address 2", "City", "State", "Zip Code", "",
  "Effective Date", "Termination Date", "Notes",
];

function renderArkOrRxValet(rows: EligRow[]): string {
  const lines = [csvRow(ARK_HEADER)];
  for (const r of rows) {
    lines.push(csvRow([
      r.memberId, r.firstName, r.lastName, r.relationship, r.gender, r.dateOfBirth, "",
      r.email, r.phone, r.address1, r.address2, r.city, r.state, r.zip, "",
      r.effectiveDate, r.terminationDate, "",
    ]));
  }
  return lines.join("\r\n") + "\r\n";
}

function renderCombined(rows: EligRow[]): string {
  const lines = [csvRow(COMBINED_HEADER)];
  for (const r of rows) {
    lines.push(csvRow([
      r.groupId, r.memberId, r.personCode, r.coverageType, r.organization,
      r.firstName, r.lastName, r.relationship, r.gender, r.dateOfBirth, "",
      r.email, r.phone, r.address1, r.address2, r.city, r.state, r.zip, "",
      r.effectiveDate, r.terminationDate, "",
    ]));
  }
  return lines.join("\r\n") + "\r\n";
}

// ─── public action ─────────────────────────────────────────────────────

/**
 * Generate an Essentials eligibility CSV in the requested format. If groupId
 * is omitted, includes members across all active groups.
 */
export const generateEssentialsEligibilityFile = action({
  args: {
    format: v.union(v.literal("ark"), v.literal("rxvalet"), v.literal("combined")),
    groupId: v.optional(v.id("groups")),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ filename: string; content: string; memberCount: number; totalRecords: number; generatedAt: number }> => {
    // @ts-ignore - avoid deep type instantiation
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);

    const rows = await buildRows(ctx, args.groupId);

    const today = new Date();
    const stamp = `${today.getUTCFullYear()}${String(today.getUTCMonth() + 1).padStart(2, "0")}${String(today.getUTCDate()).padStart(2, "0")}`;

    let filename: string;
    let content: string;
    if (args.format === "combined") {
      filename = `Essentials_Eligibility_Combined_${stamp}.csv`;
      content = renderCombined(rows);
    } else if (args.format === "rxvalet") {
      filename = `Essentials_Eligibility_RxValet_${stamp}.csv`;
      content = renderArkOrRxValet(rows);
    } else {
      filename = `Essentials_Eligibility_ARK_${stamp}.csv`;
      content = renderArkOrRxValet(rows);
    }

    const primaryCount = rows.filter((r) => r.relationship === "Primary").length;

    return {
      filename,
      content,
      memberCount: primaryCount,
      totalRecords: rows.length,
      generatedAt: Date.now(),
    };
  },
});
