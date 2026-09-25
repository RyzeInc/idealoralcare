/**
 * ADMIN NAVIGATION MODEL.
 *
 * One definition, three consumers: the sidebar, the Cmd-K palette, and the
 * CRM sub-nav. They used to hold three separate lists, which is why the CRM's
 * twelve pages were reachable from the palette only while you were already
 * inside the CRM, and why /admin/list-bill shipped with no way to reach it at
 * all.
 *
 * Icons are named here, not imported — see src/components/admin/nav-icons.ts
 * for the lookup. Keeping this module import-free means it stays plain data:
 * src/lib/__tests__/site-routes.test.ts cross-checks every href against the
 * route registry, and the doc generator can read it under bare Node.
 */

export interface AdminNavItem {
  label: string;
  /**
   * Label for surfaces that already establish the context — the CRM tab strip
   * says "Analytics", the global palette says "CRM Analytics", because in the
   * palette it sits next to Insights and Commissions.
   */
  shortLabel?: string;
  href: string;
  /** Key into the icon map in src/components/admin/nav-icons.ts. */
  icon: string;
  /** Owner-only. Hidden from everyone else. */
  requireOwner?: boolean;
  /**
   * Internal-staff-only. Every item behind /admin's gate already implies this
   * (partners are routed to /partner before the sidebar renders) — it exists
   * for surfaces like the CRM where hiding the entry should not depend on that
   * upstream gate's exact behaviour staying unchanged. See convex/crm/guards.ts
   * for the matching backend guard.
   */
  requireStaff?: boolean;
  tooltip: string;
  /**
   * Extra search terms. These are what someone types when they don't know what
   * we called the page — "churn" for Insights, "cancel" for Customer Service.
   * Matched by the sidebar filter and the palette, never displayed.
   */
  keywords?: string[];
  /**
   * Sub-destinations reachable from this item. Not rendered in the sidebar —
   * they exist so the palette can jump straight to a CRM page from anywhere in
   * the console instead of only from inside the CRM.
   */
  children?: AdminNavItem[];
}

export interface AdminNavSection {
  section: string;
  items: AdminNavItem[];
}

/** The CRM's own tab strip, and the palette's shortcut list for it. */
export const CRM_NAV_ITEMS: AdminNavItem[] = [
  { label: "CRM Home", shortLabel: "Home", href: "/admin/crm", icon: "Contact", tooltip: "Pipeline summary and today's work." },
  { label: "Pipeline", href: "/admin/crm/deals", icon: "LayoutGrid", tooltip: "Deal board by stage.", keywords: ["deals", "board", "kanban", "opportunities"] },
  { label: "Contacts", href: "/admin/crm/contacts", icon: "User", tooltip: "Prospect and customer contacts.", keywords: ["people", "leads", "prospects"] },
  { label: "Companies", href: "/admin/crm/companies", icon: "Building2", tooltip: "Prospect organizations and their deal stage.", keywords: ["accounts", "orgs", "employers"] },
  { label: "Tags", href: "/admin/crm/tags", icon: "Tag", tooltip: "Tag taxonomy for contacts and companies.", keywords: ["labels"] },
  { label: "Segments", href: "/admin/crm/segments", icon: "Filter", tooltip: "Saved filters used to target campaigns.", keywords: ["lists", "audience"] },
  { label: "Workflows", href: "/admin/crm/workflows", icon: "Zap", tooltip: "Automation rules and sequences.", keywords: ["automation", "sequences", "drip"] },
  { label: "Import", href: "/admin/crm/import", icon: "Upload", tooltip: "CSV import for contacts and companies.", keywords: ["csv", "upload", "bulk"] },
  { label: "Inbox", href: "/admin/crm/inbox", icon: "Inbox", tooltip: "Inbound replies and unhandled conversations.", keywords: ["replies", "email"] },
  { label: "Campaigns", href: "/admin/crm/campaigns", icon: "Send", tooltip: "Outbound email campaigns.", keywords: ["email", "blast", "outbound"] },
  { label: "Drip Campaigns", shortLabel: "Drip", href: "/admin/crm/drip", icon: "Network", tooltip: "Multi-phase outreach tracks and who is enrolled on each.", keywords: ["drip", "sequence", "track", "phases", "nurture", "enroll"] },
  { label: "CRM Analytics", shortLabel: "Analytics", href: "/admin/crm/analytics", icon: "BarChart3", tooltip: "Pipeline conversion and outbound performance.", keywords: ["conversion", "reporting"] },
  { label: "CRM Settings", shortLabel: "Settings", href: "/admin/crm/settings", icon: "Settings", tooltip: "Pipeline stages, sending identities, and compliance settings.", keywords: ["stages", "compliance", "sender"] },
];

export const ADMIN_NAVIGATION: AdminNavSection[] = [
  {
    section: "Overview",
    items: [
      { label: "Dashboard", href: "/admin", icon: "LayoutDashboard", tooltip: "Daily snapshot of activity, alerts, and quick links.", keywords: ["home", "start", "alerts"] },
      { label: "Insights", href: "/admin/insights", icon: "LineChart", tooltip: "Whole-book performance: growth, revenue, retention, and data health.", keywords: ["analytics", "reporting", "churn", "growth", "kpi"] },
    ],
  },
  {
    section: "Sales",
    items: [
      {
        label: "CRM",
        href: "/admin/crm",
        icon: "Contact",
        requireStaff: true,
        tooltip: "Prospect contacts, companies, tags, and call/email tracking.",
        keywords: ["pipeline", "deals", "prospects", "outreach"],
        children: CRM_NAV_ITEMS,
      },
    ],
  },
  {
    section: "Members & Partners",
    items: [
      { label: "Members", href: "/admin/members", icon: "Users", tooltip: "All people in your plans (leads, eligible, active, etc.).", keywords: ["enrollees", "subscribers", "roster", "people"] },
      { label: "Brokers", href: "/admin/brokers", icon: "Network", tooltip: "Program Managers, FMOs, and agencies that resell your plans.", keywords: ["fmo", "agency", "distribution", "program manager"] },
      { label: "Rep Codes", href: "/admin/rep-codes", icon: "Tag", tooltip: "Tracking codes that attribute enrollments to agents.", keywords: ["attribution", "vanity url", "referral", "ref"] },
      { label: "Partner Kit Leads", href: "/admin/partnerkit", icon: "BookUser", tooltip: "Agencies and companies that registered and requested the partner kit.", keywords: ["leads", "registrations", "inbound"] },
      { label: "Partner Applications", href: "/admin/partner-applications", icon: "UserPlus", tooltip: "Review broker, agency, and front-line rep onboarding submissions.", keywords: ["onboarding", "applications", "approve"] },
      { label: "Resources", href: "/admin/resources", icon: "FolderOpen", tooltip: "Marketing material, partner kits, and collateral partners download.", keywords: ["collateral", "downloads", "marketing"] },
    ],
  },
  {
    section: "Operations",
    items: [
      { label: "Hierarchy", href: "/admin/hierarchy", icon: "Building2", tooltip: "Sites → Accounts → Organizations: the partner & member tree.", keywords: ["sites", "organizations", "accounts", "branding", "white label", "domain"] },
      { label: "Eligibility Files", href: "/admin/eligibility", icon: "FileText", tooltip: "Upload member rosters from groups/employers.", keywords: ["roster", "census", "upload", "import"] },
      { label: "Vendor Files", href: "/admin/vendor-files", icon: "FileOutput", tooltip: "Generate & download outbound vendor files (manual delivery).", keywords: ["careington", "toothlens", "export", "sftp"] },
    ],
  },
  {
    section: "Finance",
    items: [
      { label: "Billing", href: "/admin/billing", icon: "DollarSign", tooltip: "Subscription billing and group invoices.", keywords: ["stripe", "payments", "subscriptions"] },
      { label: "List-Bill Groups", href: "/admin/list-bill", icon: "Building", tooltip: "Payroll-deduction groups and monthly employer remittance.", keywords: ["payroll", "deduction", "employer", "remittance", "group"] },
      { label: "List-Bill Invoices", href: "/admin/list-bill-invoices", icon: "Receipt", tooltip: "Group-paid roster invoices.", keywords: ["invoice", "employer", "payroll"] },
      { label: "Vendor Statements", href: "/admin/vendor-statements", icon: "FileCheck2", tooltip: "Locked monthly remittance statements for Toothlens, Careington, Ideal, and Ryze.", keywords: ["remittance", "statement", "vendor", "monthly close"] },
      { label: "Revenue & Dispersal", href: "/admin/invoice-calculator", icon: "Calculator", tooltip: "Per-member revenue and dispersal breakdown by group and partner.", keywords: ["revenue", "split", "dispersal", "calculator", "margin"] },
      { label: "Commissions", href: "/admin/commissions", icon: "BarChart3", tooltip: "Agent commission reporting (Coming soon — figures not yet reliable).", keywords: ["payout", "agent", "override"] },
      { label: "Shop", href: "/admin/shop", icon: "ShoppingBag", tooltip: "Affiliate products in the preventative care shop. Not plans — outbound links we earn commission on.", keywords: ["affiliate", "products", "store", "amazon"] },
    ],
  },
  {
    section: "Support",
    items: [
      { label: "Customer Service", href: "/admin/customer-service", icon: "Headphones", tooltip: "Look up members and resolve member issues.", keywords: ["support", "refund", "cancel", "ticket", "member issue"] },
      { label: "Communications", href: "/admin/communications", icon: "Mail", tooltip: "Resend documents and email members one at a time or en masse, with a full send log.", keywords: ["email", "send", "resend", "packet", "blast", "mass", "campaign", "template"] },
    ],
  },
  {
    section: "System",
    items: [
      { label: "Admin Users", href: "/admin/users", icon: "ShieldCheck", tooltip: "Invite teammates and manage admin access.", keywords: ["staff", "permissions", "roles", "invite"] },
      { label: "User Lookup", href: "/admin/user-audit", icon: "UserSearch", tooltip: "Look up a person across Clerk, Convex & Toothlens; fix or delete identity records.", keywords: ["clerk", "identity", "duplicate", "delete user"] },
      { label: "Audit Log", href: "/admin/audit-log", icon: "ClipboardList", tooltip: "System-wide append-only audit trail of admin actions.", keywords: ["history", "who changed", "trail", "compliance"] },
      { label: "Site Settings", href: "/admin/settings", icon: "Settings", tooltip: "Global site text (name, contact, social). For branding, domain & integrations use Hierarchy → Edit Site.", keywords: ["contact", "social", "footer", "config"] },
      { label: "Dev Tools", href: "/admin/dev-tools", icon: "Terminal", requireOwner: true, tooltip: "Developer utilities (Owner only).", keywords: ["maintenance", "migration", "debug"] },
    ],
  },
  {
    section: "Help",
    items: [
      { label: "SOP Library", href: "/admin/docs/sops", icon: "Library", tooltip: "Step-by-step procedures for common admin tasks.", keywords: ["how do i", "procedure", "runbook", "sop"] },
      { label: "Admin Guide", href: "/admin/docs/guide", icon: "BookOpen", tooltip: "Narrative walkthrough of the console, area by area.", keywords: ["manual", "handbook", "guide"] },
      { label: "Help & Vocabulary", href: "/admin/help", icon: "HelpCircle", tooltip: "Learn the terminology and common workflows.", keywords: ["glossary", "terms", "what is"] },
    ],
  },
];

export interface VisibilityContext {
  isOwner: boolean;
  isStaff: boolean;
}

export function isItemVisible(item: AdminNavItem, ctx: VisibilityContext): boolean {
  if (item.requireOwner && !ctx.isOwner) return false;
  if (item.requireStaff && !ctx.isStaff) return false;
  return true;
}

/** Sections with hidden items removed, and empty sections dropped entirely. */
export function visibleNavigation(ctx: VisibilityContext): AdminNavSection[] {
  return ADMIN_NAVIGATION.map((section) => ({
    section: section.section,
    items: section.items.filter((item) => isItemVisible(item, ctx)),
  })).filter((section) => section.items.length > 0);
}

/**
 * Every destination the palette can jump to: sidebar items plus their
 * children, deduplicated by href. Section names ride along so the palette can
 * show "Finance · Billing" — the label alone is ambiguous once CRM Settings
 * and Site Settings are both in the list.
 */
export function navDestinations(ctx: VisibilityContext): Array<AdminNavItem & { section: string }> {
  const out: Array<AdminNavItem & { section: string }> = [];
  const seen = new Set<string>();

  for (const section of ADMIN_NAVIGATION) {
    for (const item of section.items) {
      if (!isItemVisible(item, ctx)) continue;
      if (!seen.has(item.href)) {
        seen.add(item.href);
        out.push({ ...item, section: section.section });
      }
      for (const child of item.children ?? []) {
        if (seen.has(child.href)) continue;
        seen.add(child.href);
        out.push({ ...child, section: item.label });
      }
    }
  }

  return out;
}

/**
 * Active-item resolution by longest matching href.
 *
 * The old sidebar used `pathname.startsWith(href)`, which lights up more than
 * one row: /admin/list-bill-invoices starts with /admin/list-bill, so adding
 * the List-Bill Groups entry would have highlighted both. Longest match is the
 * only rule that stays correct as prefixes accumulate.
 */
export function activeHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    const matches = href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
    if (matches && (best === null || href.length > best.length)) best = href;
  }
  return best;
}

/** Case-insensitive match over label, section, tooltip, and keywords. */
export function matchesQuery(item: AdminNavItem, section: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [item.label, section, item.tooltip, ...(item.keywords ?? [])].join(" ").toLowerCase();
  return q.split(/\s+/).every((term) => haystack.includes(term));
}
