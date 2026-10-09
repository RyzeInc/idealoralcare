/**
 * ACCESS CATALOG — every role, permission and built-in access pack.
 *
 * Pure data with no Convex imports, so the admin UI (src/) and the server
 * share one definition of what each permission means.
 *
 * Model:
 *   - A person (accessProfiles) holds one or more ROLES (accessRoles): staff,
 *     program manager, FMO, agency, broker, rep, carrier, organization. One
 *     person can hold several — a broker who is also a rep and the head of a
 *     Program Manager has three roles.
 *   - Each role carries ACCESS PACKS (accessPacks), named bundles of
 *     permissions. A role's links (partner, rep record, group) decide WHOSE
 *     data it reaches; its packs decide WHAT it can do there.
 *   - A permission only counts when it arrives through a role allowed to hold
 *     it (PERMISSION_ROLES). Admin-console permissions come only through a
 *     staff role, so no custom pack can hand a broker the admin console.
 */

export const ROLE_TYPES = [
  "staff",
  "program_manager",
  "fmo",
  "agency",
  "broker",
  "rep",
  "carrier",
  "organization",
] as const;
export type RoleType = (typeof ROLE_TYPES)[number];

export const ROLE_INFO: Record<RoleType, { label: string; description: string; link: "none" | "partner" | "agency" | "group" | "label" }> = {
  staff: { label: "Staff", description: "Internal team member using the admin console.", link: "none" },
  program_manager: { label: "Program Manager", description: "Person at a Program Manager partner.", link: "partner" },
  fmo: { label: "FMO", description: "Person at a Field Marketing Organization.", link: "partner" },
  agency: { label: "Agency", description: "Person at an agency.", link: "partner" },
  broker: { label: "Broker", description: "Licensed broker writing business, usually through an agency.", link: "agency" },
  rep: { label: "Rep", description: "Front-line rep with rep codes under an agency.", link: "agency" },
  carrier: { label: "Carrier", description: "Contact at a carrier or network.", link: "label" },
  organization: { label: "Organization", description: "Employer or group contact.", link: "group" },
};

/** Roles that reach the partner portal, highest first (used to pick a default). */
export const PARTNER_ROLES: RoleType[] = ["program_manager", "fmo", "agency", "broker", "rep"];

export type Portal = "admin" | "partner" | "employer";

export interface PermissionInfo {
  label: string;
  description: string;
  portal: Portal;
  group: string;
  /** Holding this permission also grants these (permission keys). */
  implies?: readonly string[];
  /** Reaches member PHI, money, or other people's access. Shown as a warning. */
  sensitive?: boolean;
}

export const PERMISSIONS = {
  "insights.view": { portal: "admin", group: "Overview", label: "Dashboard & insights", description: "Book-wide dashboards, revenue and production for every partner.", sensitive: true },
  "members.view": { portal: "admin", group: "Members", label: "View members", description: "Member records, coverage, documents and history.", sensitive: true },
  "members.edit": { portal: "admin", group: "Members", label: "Edit members", description: "Change member records, entitlements and free access.", implies: ["members.view"], sensitive: true },
  "support.use": { portal: "admin", group: "Support", label: "Customer service", description: "Customer service search, inquiries and member emails.", sensitive: true },
  "crm.use": { portal: "admin", group: "Sales", label: "CRM", description: "Pipeline, contacts, companies, tasks and activities." },
  "crm.manage": { portal: "admin", group: "Sales", label: "CRM manager", description: "Bulk changes, deletes, merges, imports and sending campaigns.", implies: ["crm.use"] },
  "partners.view": { portal: "admin", group: "Partners", label: "View partners", description: "Brokers, agencies, rep codes, applications and partner leads." },
  "partners.manage": { portal: "admin", group: "Partners", label: "Manage partners", description: "Create and change partners, reps, rep codes and partner invites.", implies: ["partners.view"] },
  "groups.view": { portal: "admin", group: "Operations", label: "View hierarchy", description: "Sites, accounts and employer groups." },
  "groups.manage": { portal: "admin", group: "Operations", label: "Manage hierarchy", description: "Create and change sites (including their integrations), accounts, groups and group pricing.", implies: ["groups.view"] },
  "eligibility.view": { portal: "admin", group: "Operations", label: "View eligibility", description: "Eligibility files and employer intake submissions.", sensitive: true },
  "eligibility.manage": { portal: "admin", group: "Operations", label: "Process eligibility", description: "Approve, import and provision eligibility files and employer upload access.", implies: ["eligibility.view"], sensitive: true },
  "vendorFiles.view": { portal: "admin", group: "Operations", label: "View vendor files", description: "Files generated for carriers and networks.", sensitive: true },
  "vendorFiles.manage": { portal: "admin", group: "Operations", label: "Send vendor files", description: "Generate and deliver files to carriers and networks.", implies: ["vendorFiles.view"], sensitive: true },
  "billing.view": { portal: "admin", group: "Finance", label: "View billing", description: "Billing, list-bill invoices, vendor statements and revenue.", sensitive: true },
  "billing.manage": { portal: "admin", group: "Finance", label: "Manage billing", description: "Change billing, invoices, statements and plan pricing.", implies: ["billing.view"], sensitive: true },
  "commissions.view": { portal: "admin", group: "Finance", label: "View commissions", description: "Commission rates, statements and payables.", sensitive: true },
  "commissions.manage": { portal: "admin", group: "Finance", label: "Manage commissions", description: "Change commission rates and run payouts.", implies: ["commissions.view"], sensitive: true },
  "content.manage": { portal: "admin", group: "Content", label: "Site content", description: "Site settings, team, resources library, shop and navigation." },
  "audit.view": { portal: "admin", group: "System", label: "Audit & user lookup", description: "Admin audit log and user lookup.", sensitive: true },
  "access.manage": { portal: "admin", group: "System", label: "Manage access", description: "Invite people, assign roles and access packs, and edit packs.", sensitive: true },
  "system.manage": { portal: "admin", group: "System", label: "Developer tools", description: "Dev tools, backfills and data migrations.", sensitive: true },
  "partner.book": { portal: "partner", group: "Partner portal", label: "Own book", description: "Overview, members, production, retention and watchlist for their own book." },
  "partner.downline": { portal: "partner", group: "Partner portal", label: "Downline", description: "Agencies and reps beneath them." },
  "partner.groups": { portal: "partner", group: "Partner portal", label: "Employer groups", description: "Employer groups credited to their book." },
  "partner.resources": { portal: "partner", group: "Partner portal", label: "Resources", description: "Marketing materials and agreements." },
  // Pending sign-off: deliberately in no built-in pack. Add it to a pack (or a
  // person) in Access & Roles once broker-to-member email is approved.
  "partner.email": { portal: "partner", group: "Partner portal", label: "Email own members", description: "Send an email to members in their own book from the Members page. Replies go to the broker.", sensitive: true },
  "employer.upload": { portal: "employer", group: "Employer portal", label: "Eligibility uploads", description: "Upload rosters for their own organization." },
} as const satisfies Record<string, PermissionInfo>;

export type Permission = keyof typeof PERMISSIONS;
export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as Permission[];

export function isPermission(value: string): value is Permission {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

export const ADMIN_PERMISSIONS = PERMISSION_KEYS.filter((p) => PERMISSIONS[p].portal === "admin");

/** Which roles a permission can arrive through. Carriers have no portal yet. */
export const PERMISSION_ROLES: Record<Portal, RoleType[]> = {
  admin: ["staff"],
  partner: PARTNER_ROLES,
  employer: ["organization"],
};

export function roleCanHold(role: RoleType, permission: Permission): boolean {
  const info: PermissionInfo = PERMISSIONS[permission];
  return PERMISSION_ROLES[info.portal].includes(role);
}

/** Add everything each permission implies. */
export function expandPermissions(permissions: Iterable<string>): Permission[] {
  const out = new Set<Permission>();
  const visit = (p: string) => {
    if (!isPermission(p) || out.has(p)) return;
    out.add(p);
    const info: PermissionInfo = PERMISSIONS[p];
    for (const implied of info.implies ?? []) visit(implied);
  };
  for (const p of permissions) visit(p);
  return PERMISSION_KEYS.filter((p) => out.has(p));
}

// ---------------------------------------------------------------------------
// Built-in access packs. Deliberately narrow: each grants the least a job
// needs, and admins add more by editing a pack or assigning a second one.
// ---------------------------------------------------------------------------

export interface PackDefinition {
  key: string;
  name: string;
  description: string;
  roles: RoleType[];
  permissions: Permission[];
}

export const OWNER_PACK_KEY = "owner";
export const STAFF_LEGACY_PACK_KEY = "staff_legacy";
export const CRM_MANAGER_PACK_KEY = "crm_manager";
export const PARTNER_LEGACY_PACK_KEY = "partner_legacy";
export const ORGANIZATION_UPLOADS_PACK_KEY = "organization_uploads";

/** What an existing editor could do before access packs, minus managing access and dev tools. */
const LEGACY_EDITOR_PERMISSIONS = ADMIN_PERMISSIONS.filter(
  (p) => p !== "access.manage" && p !== "system.manage" && p !== "crm.manage",
);

export const BUILT_IN_PACKS: PackDefinition[] = [
  {
    key: OWNER_PACK_KEY,
    name: "Owner",
    description: "Everything in the admin console, including managing access and developer tools. Only owners can grant it.",
    roles: ["staff"],
    permissions: [...ADMIN_PERMISSIONS],
  },
  {
    key: STAFF_LEGACY_PACK_KEY,
    name: "Staff — legacy full console",
    description: "What editors could reach before access packs, except managing access and developer tools. Given to existing editors on import; replace with narrower packs.",
    roles: ["staff"],
    permissions: LEGACY_EDITOR_PERMISSIONS,
  },
  {
    key: CRM_MANAGER_PACK_KEY,
    name: "CRM manager",
    description: "CRM plus bulk changes, deletes, imports and campaign sends.",
    roles: ["staff"],
    permissions: ["crm.manage"],
  },
  {
    key: "staff_sales",
    name: "Sales",
    description: "CRM and a read-only view of partners and rep codes.",
    roles: ["staff"],
    permissions: ["crm.use", "partners.view"],
  },
  {
    key: "staff_support",
    name: "Customer support",
    description: "Look up members and handle customer service. Cannot change billing or coverage.",
    roles: ["staff"],
    permissions: ["members.view", "support.use"],
  },
  {
    key: "staff_eligibility",
    name: "Eligibility operations",
    description: "Process eligibility files and employer intake; view groups and vendor files.",
    roles: ["staff"],
    permissions: ["eligibility.manage", "members.view", "groups.view", "vendorFiles.view"],
  },
  {
    key: "staff_partner_ops",
    name: "Partner operations",
    description: "Onboard and manage partners, reps and rep codes; view groups.",
    roles: ["staff"],
    permissions: ["partners.manage", "groups.view"],
  },
  {
    key: "staff_finance",
    name: "Finance",
    description: "Billing, list-bill invoices and vendor statements; view commissions, members and groups.",
    roles: ["staff"],
    permissions: ["billing.manage", "commissions.view", "members.view", "groups.view"],
  },
  {
    key: "staff_content",
    name: "Content editor",
    description: "Site content, resources library and shop. No member or financial data.",
    roles: ["staff"],
    permissions: ["content.manage"],
  },
  {
    key: "staff_auditor",
    name: "Read-only reviewer",
    description: "View-only across members, partners, operations, finance and the audit log. Changes nothing.",
    roles: ["staff"],
    permissions: ["insights.view", "members.view", "partners.view", "groups.view", "eligibility.view", "vendorFiles.view", "billing.view", "commissions.view", "audit.view"],
  },
  {
    key: PARTNER_LEGACY_PACK_KEY,
    name: "Partner — legacy portal",
    description: "Every partner portal page, as partners had before access packs. Given to existing partners on import.",
    roles: PARTNER_ROLES,
    permissions: ["partner.book", "partner.downline", "partner.groups", "partner.resources"],
  },
  {
    key: "partner_leadership",
    name: "Partner leadership",
    description: "Own book, downline, employer groups and resources.",
    roles: ["program_manager", "fmo", "agency"],
    permissions: ["partner.book", "partner.downline", "partner.groups", "partner.resources"],
  },
  {
    key: "partner_agent",
    name: "Broker / rep — own book",
    description: "Their own book and the resources library.",
    roles: ["broker", "rep", "agency"],
    permissions: ["partner.book", "partner.resources"],
  },
  {
    key: "partner_resources",
    name: "Resources only",
    description: "Resources library only — for people still onboarding.",
    roles: PARTNER_ROLES,
    permissions: ["partner.resources"],
  },
  {
    key: ORGANIZATION_UPLOADS_PACK_KEY,
    name: "Organization — eligibility uploads",
    description: "Upload eligibility rosters for their own organization. Staff still review every file.",
    roles: ["organization"],
    permissions: ["employer.upload"],
  },
  {
    key: "carrier_signin",
    name: "Carrier — sign-in only",
    description: "An account with no tools yet. Carrier reporting is not built.",
    roles: ["carrier"],
    permissions: [],
  },
];

export function builtInPack(key: string): PackDefinition | undefined {
  return BUILT_IN_PACKS.find((pack) => pack.key === key);
}

/** Permissions an editor without an access profile keeps until imported. */
export function legacyEditorPermissions(isCrmManager: boolean): Permission[] {
  return expandPermissions(isCrmManager ? [...LEGACY_EDITOR_PERMISSIONS, "crm.manage"] : LEGACY_EDITOR_PERMISSIONS);
}

export const LEGACY_PARTNER_PERMISSIONS: Permission[] = builtInPack(PARTNER_LEGACY_PACK_KEY)!.permissions;

/** Pages each permission unlocks, for previews and navigation. */
export interface PageAccess {
  href: string;
  label: string;
  portal: Portal;
  /** Any one of these is enough. */
  anyOf: Permission[];
}

export const PAGES: PageAccess[] = [
  { portal: "admin", href: "/admin", label: "Dashboard", anyOf: ["insights.view"] },
  { portal: "admin", href: "/admin/insights", label: "Insights", anyOf: ["insights.view"] },
  { portal: "admin", href: "/admin/crm", label: "CRM", anyOf: ["crm.use"] },
  { portal: "admin", href: "/admin/members", label: "Members", anyOf: ["members.view"] },
  { portal: "admin", href: "/admin/brokers", label: "Brokers", anyOf: ["partners.view"] },
  { portal: "admin", href: "/admin/rep-codes", label: "Rep Codes", anyOf: ["partners.view"] },
  { portal: "admin", href: "/admin/partnerkit", label: "Partner Kit Leads", anyOf: ["partners.view"] },
  { portal: "admin", href: "/admin/partner-applications", label: "Partner Applications", anyOf: ["partners.view"] },
  { portal: "admin", href: "/admin/mgu-agreement", label: "MGU Agreement", anyOf: ["partners.view"] },
  { portal: "admin", href: "/admin/resources", label: "Resources", anyOf: ["content.manage"] },
  { portal: "admin", href: "/admin/hierarchy", label: "Hierarchy", anyOf: ["groups.view"] },
  { portal: "admin", href: "/admin/eligibility", label: "Eligibility Files", anyOf: ["eligibility.view"] },
  { portal: "admin", href: "/admin/eligibility/intake", label: "Employer Intake", anyOf: ["eligibility.view"] },
  { portal: "admin", href: "/admin/vendor-files", label: "Vendor Files", anyOf: ["vendorFiles.view"] },
  { portal: "admin", href: "/admin/billing", label: "Billing", anyOf: ["billing.view"] },
  { portal: "admin", href: "/admin/list-bill", label: "List-Bill Groups", anyOf: ["billing.view"] },
  { portal: "admin", href: "/admin/list-bill-invoices", label: "List-Bill Invoices", anyOf: ["billing.view"] },
  { portal: "admin", href: "/admin/vendor-statements", label: "Vendor Statements", anyOf: ["billing.view"] },
  { portal: "admin", href: "/admin/invoice-calculator", label: "Revenue & Dispersal", anyOf: ["billing.view"] },
  { portal: "admin", href: "/admin/commissions", label: "Commissions", anyOf: ["commissions.view"] },
  { portal: "admin", href: "/admin/shop", label: "Shop", anyOf: ["content.manage"] },
  { portal: "admin", href: "/admin/customer-service", label: "Customer Service", anyOf: ["support.use"] },
  { portal: "admin", href: "/admin/communications", label: "Communications", anyOf: ["support.use"] },
  { portal: "admin", href: "/admin/access", label: "Access & Roles", anyOf: ["access.manage"] },
  { portal: "admin", href: "/admin/users", label: "Legacy staff list", anyOf: ["access.manage"] },
  { portal: "admin", href: "/admin/user-audit", label: "User Lookup", anyOf: ["audit.view"] },
  { portal: "admin", href: "/admin/audit-log", label: "Audit Log", anyOf: ["audit.view"] },
  { portal: "admin", href: "/admin/settings", label: "Site Settings", anyOf: ["content.manage"] },
  { portal: "admin", href: "/admin/dev-tools", label: "Dev Tools", anyOf: ["system.manage"] },
  { portal: "partner", href: "/partner", label: "Overview", anyOf: ["partner.book"] },
  { portal: "partner", href: "/partner/members", label: "Members", anyOf: ["partner.book"] },
  { portal: "partner", href: "/partner/production", label: "Production", anyOf: ["partner.book"] },
  { portal: "partner", href: "/partner/retention", label: "Retention", anyOf: ["partner.book"] },
  { portal: "partner", href: "/partner/downline", label: "Downline", anyOf: ["partner.downline"] },
  { portal: "partner", href: "/partner/groups", label: "Groups", anyOf: ["partner.groups"] },
  { portal: "partner", href: "/partner/watchlist", label: "Watchlist", anyOf: ["partner.book"] },
  { portal: "partner", href: "/partner/resources", label: "Resources", anyOf: ["partner.resources"] },
  { portal: "employer", href: "/employer/upload", label: "Eligibility uploads", anyOf: ["employer.upload"] },
];

/** The page registry entry for a path: exact match first, then the longest prefix. */
export function pageFor(href: string): PageAccess | undefined {
  const exact = PAGES.find((page) => page.href === href);
  if (exact) return exact;
  return PAGES.filter((page) => page.href !== "/admin" && page.href !== "/partner" && href.startsWith(`${page.href}/`)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
}

export function canSee(permissions: Iterable<string>, href: string): boolean {
  const page = pageFor(href);
  if (!page) return true;
  const held = new Set(permissions);
  return page.anyOf.some((p) => held.has(p));
}
