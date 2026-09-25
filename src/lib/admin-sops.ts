// Structured metadata for the in-app SOP Library (rendered by SopDirectory and
// SopArticle at /admin/docs/sops[...]). The markdown files under docs/admin/sops
// remain the source of truth for each procedure's *body*; this module carries the
// at-a-glance metadata that drives the directory table, the colored area tags,
// the filter views, and each SOP's header card.
//
// Keeping this here (rather than in per-file frontmatter) lets the directory
// render without parsing 19 documents, and lets the header card show a curated
// one-line summary instead of the long prose intro.

export type SopArea =
  | "Onboarding"
  | "Members & Partners"
  | "Finance"
  | "Operations"
  | "Troubleshooting"
  | "Admin & Access";

export type AreaStyle = {
  /** Pill: light background, readable text, hairline border (mirrors StatusBadge). */
  tag: string;
  /** Solid dot used next to the area name. */
  dot: string;
  /** Accent bar along the top of a SOP header. */
  bar: string;
  /** Soft header tint. */
  soft: string;
};

export const AREA_ORDER: SopArea[] = [
  "Onboarding",
  "Members & Partners",
  "Finance",
  "Operations",
  "Troubleshooting",
  "Admin & Access",
];

// Full literal class strings — Tailwind scans source for these, so they must be
// written out in full (never composed dynamically) to be generated.
export const AREA_STYLE: Record<SopArea, AreaStyle> = {
  "Onboarding": {
    tag: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
    soft: "bg-emerald-50",
  },
  "Members & Partners": {
    tag: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
    bar: "bg-blue-500",
    soft: "bg-blue-50",
  },
  "Finance": {
    tag: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
    soft: "bg-amber-50",
  },
  "Operations": {
    tag: "bg-cyan-50 text-cyan-700 border-cyan-200",
    dot: "bg-cyan-500",
    bar: "bg-cyan-500",
    soft: "bg-cyan-50",
  },
  "Troubleshooting": {
    tag: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
    bar: "bg-rose-500",
    soft: "bg-rose-50",
  },
  "Admin & Access": {
    tag: "bg-violet-50 text-violet-700 border-violet-200",
    dot: "bg-violet-500",
    bar: "bg-violet-500",
    soft: "bg-violet-50",
  },
};

export type SopMeta = {
  /** e.g. "SOP-001" */
  code: string;
  /** Route key under sops/ — matches ADMIN_DOCS, e.g. "SOP-001-onboard-selfpay-employer-group". */
  slug: string;
  /** Short title, no "SOP-00X:" prefix. */
  title: string;
  /** What you end up with. */
  outcome: string;
  /** The trigger, in a few words. */
  when: string;
  /** How often: Onboarding | Regular | Monthly | As needed | Rare. */
  frequency: string;
  /** Who can do this (short). */
  who: string;
  area: SopArea;
  tags: string[];
  /** Primary admin pages this procedure touches. */
  pages: string[];
};

export const SOPS: SopMeta[] = [
  {
    code: "SOP-001",
    slug: "SOP-001-onboard-selfpay-employer-group",
    title: "Onboard a Self-Pay Employer Group",
    outcome: "A live self-pay employer, ready to enroll members",
    when: "A new employer is ready to enroll",
    frequency: "Onboarding",
    who: "Any admin",
    area: "Onboarding",
    tags: ["employer", "self-pay", "hierarchy"],
    pages: ["Hierarchy"],
  },
  {
    code: "SOP-002",
    slug: "SOP-002-onboard-listbill-employer-group",
    title: "Onboard a List-Bill Employer Group",
    outcome: "A list-bill employer set up for consolidated billing",
    when: "An employer signs a payroll-deduction deal",
    frequency: "Onboarding",
    who: "Any admin",
    area: "Onboarding",
    tags: ["employer", "list-bill", "hierarchy"],
    pages: ["Hierarchy", "List-Bill Invoices"],
  },
  {
    code: "SOP-003",
    slug: "SOP-003-bulk-enroll-eligibility-file",
    title: "Bulk-Enroll Members from an Eligibility File",
    outcome: "Members created or updated in bulk from a roster",
    when: "A new or updated roster arrives",
    frequency: "Regular",
    who: "Any admin",
    area: "Onboarding",
    tags: ["eligibility", "members", "bulk upload"],
    pages: ["Eligibility Files"],
  },
  {
    code: "SOP-004",
    slug: "SOP-004-onboard-broker-agency-and-reps",
    title: "Onboard a Broker/Agency and Their Reps",
    outcome: "A new agency and its reps, issuing tracked sales",
    when: "An agency signs on, or adds a rep",
    frequency: "Onboarding",
    who: "Any admin",
    area: "Onboarding",
    tags: ["broker", "rep codes", "commission"],
    pages: ["Brokers", "Rep Codes"],
  },
  {
    code: "SOP-005",
    slug: "SOP-005-review-partner-application",
    title: "Review and Approve a Partner Application",
    outcome: "An application approved into a live Broker, or rejected",
    when: "A new application lands in the queue",
    frequency: "As needed",
    who: "Any admin",
    area: "Members & Partners",
    tags: ["partner", "application", "broker"],
    pages: ["Partner Applications"],
  },
  {
    code: "SOP-006",
    slug: "SOP-006-generate-deliver-vendor-files",
    title: "Generate and Deliver Vendor Files",
    outcome: "A vendor-ready eligibility file, downloaded to send",
    when: "New members need pushing to a vendor",
    frequency: "Monthly",
    who: "Any admin",
    area: "Operations",
    tags: ["vendor files", "careington", "dialcare"],
    pages: ["Eligibility Files", "Vendor Files"],
  },
  {
    code: "SOP-007",
    slug: "SOP-007-generate-listbill-invoice-record-payment",
    title: "Generate a List-Bill Invoice and Record Payment",
    outcome: "An itemized list-bill invoice, issued and tracked",
    when: "A monthly employer invoice is due",
    frequency: "Monthly",
    who: "Any admin",
    area: "Finance",
    tags: ["list-bill", "invoice", "billing"],
    pages: ["List-Bill Invoices"],
  },
  {
    code: "SOP-008",
    slug: "SOP-008-close-invoice-calculator-period-adjustment",
    title: "Close a Revenue & Dispersal Period",
    outcome: "A closed monthly period, or a recorded adjustment",
    when: "Month-end close, or a correction is needed",
    frequency: "Monthly",
    who: "Any admin",
    area: "Finance",
    tags: ["revenue", "close", "adjustment"],
    pages: ["Revenue & Dispersal"],
  },
  {
    code: "SOP-009",
    slug: "SOP-009-terminate-member",
    title: "Terminate a Member / Change Status",
    outcome: "A member moved to the correct status",
    when: "A member cancels or leaves",
    frequency: "As needed",
    who: "Any admin",
    area: "Members & Partners",
    tags: ["members", "status", "termination"],
    pages: ["Members"],
  },
  {
    code: "SOP-010",
    slug: "SOP-010-refund-or-cancel-subscription",
    title: "Refund or Cancel a Subscription",
    outcome: "A processed refund and/or cancelled subscription",
    when: "A member asks for a refund or to cancel",
    frequency: "As needed",
    who: "Any admin",
    area: "Finance",
    tags: ["refund", "stripe", "billing"],
    pages: ["Customer Service"],
  },
  {
    code: "SOP-011",
    slug: "SOP-011-investigate-member-identity-issue",
    title: "Investigate a Member / Identity Issue",
    outcome: "A diagnosed identity, fixed or cleanly purged",
    when: "A login or record looks broken across systems",
    frequency: "As needed",
    who: "Any admin",
    area: "Troubleshooting",
    tags: ["identity", "clerk", "toothlens"],
    pages: ["User Lookup", "Member Inspector"],
  },
  {
    code: "SOP-012",
    slug: "SOP-012-manage-admin-users",
    title: "Add, Remove, or Change an Admin User",
    outcome: "Admin access granted, changed, or revoked",
    when: "You need to change who has admin access",
    frequency: "Rare",
    who: "Any admin (act carefully)",
    area: "Admin & Access",
    tags: ["admin users", "access", "roles"],
    pages: ["Admin Users"],
  },
  {
    code: "SOP-013",
    slug: "SOP-013-reenroll-termed-listbill-employee",
    title: "Re-enroll a Termed List-Bill Employee",
    outcome: "A termed employee continued on self-pay coverage",
    when: "A termed employee wants to keep coverage",
    frequency: "As needed",
    who: "Any admin",
    area: "Members & Partners",
    tags: ["list-bill", "re-enroll", "self-pay"],
    pages: ["List-Bill", "Members"],
  },
  {
    code: "SOP-014",
    slug: "SOP-014-monthly-finance-reconciliation-checklist",
    title: "Monthly Finance Reconciliation",
    outcome: "A reconciled month finance can trust",
    when: "The first days of a new month",
    frequency: "Monthly",
    who: "Any admin",
    area: "Finance",
    tags: ["reconciliation", "finance", "monthly"],
    pages: ["Billing", "List-Bill Invoices", "Revenue & Dispersal"],
  },
  {
    code: "SOP-015",
    slug: "SOP-015-troubleshoot-eligibility-file-errors",
    title: "Troubleshoot an Eligibility File Error",
    outcome: "A recovered upload, with bad rows understood",
    when: "An upload shows failed or errored",
    frequency: "As needed",
    who: "Any admin",
    area: "Troubleshooting",
    tags: ["eligibility", "errors", "recovery"],
    pages: ["Eligibility Files"],
  },
  {
    code: "SOP-016",
    slug: "SOP-016-handle-partner-kit-lead",
    title: "Handle a Partner Kit Lead",
    outcome: "A triaged lead, advanced or closed",
    when: "A partner-kit request comes in",
    frequency: "Regular",
    who: "Any admin",
    area: "Members & Partners",
    tags: ["partner", "leads", "outreach"],
    pages: ["Partner Kit Leads"],
  },
  {
    code: "SOP-017",
    slug: "SOP-017-create-configure-site",
    title: "Create and Configure a White-Label Site",
    outcome: "A new branded site, configured and integrated",
    when: "You're launching a new brand",
    frequency: "Rare",
    who: "Any admin (+ engineering)",
    area: "Onboarding",
    tags: ["site", "branding", "integrations"],
    pages: ["Hierarchy"],
  },
  {
    code: "SOP-018",
    slug: "SOP-018-manage-rep-codes",
    title: "Create and Manage Rep Codes",
    outcome: "A tracking code that credits sales to a rep",
    when: "A rep needs a code, or one must retire",
    frequency: "As needed",
    who: "Any admin",
    area: "Operations",
    tags: ["rep codes", "commission", "share links"],
    pages: ["Rep Codes"],
  },
  {
    code: "SOP-019",
    slug: "SOP-019-grant-free-comp-access",
    title: "Grant Free / Comp Access",
    outcome: "A plan granted at $0, the supported way",
    when: "Someone needs coverage at no charge",
    frequency: "As needed",
    who: "Any admin",
    area: "Members & Partners",
    tags: ["comp", "free access", "members"],
    pages: ["Dashboard", "Members"],
  },
];

export function getSop(slug: string): SopMeta | undefined {
  return SOPS.find((s) => s.slug === slug);
}

export function areaCount(area: SopArea): number {
  return SOPS.filter((s) => s.area === area).length;
}

/**
 * Strips the leading H1 and the Purpose / Who can do this / When you'd do this
 * intro lines from a SOP's markdown, so the body can render *below* the designed
 * header and at-a-glance card without duplicating them. Everything else — the
 * "Before you begin" and "Related guide" lines and all `##` sections — is kept
 * verbatim.
 */
export function stripSopIntro(content: string): string {
  const lines = content.split("\n");
  const out: string[] = [];
  let h1Removed = false;
  for (const line of lines) {
    if (!h1Removed && /^#\s+/.test(line)) {
      h1Removed = true;
      continue;
    }
    if (/^\*\*(Purpose|Who can do this|When you'd do this):\*\*/.test(line)) {
      continue;
    }
    out.push(line);
  }
  return out.join("\n").replace(/^\n+/, "");
}
