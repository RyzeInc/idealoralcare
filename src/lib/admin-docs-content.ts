// Build-time-embedded content for the admin docs viewer (see admin-docs.ts).
// Every doc is imported statically so its content is compiled into the JS
// bundle by webpack (see the `asset/source` rule in next.config.ts) instead
// of being read from disk at request time.

import root from "../../docs/admin/README.md";

import sopsIndex from "../../docs/admin/sops/README.md";
import sop001 from "../../docs/admin/sops/SOP-001-onboard-selfpay-employer-group.md";
import sop002 from "../../docs/admin/sops/SOP-002-onboard-listbill-employer-group.md";
import sop003 from "../../docs/admin/sops/SOP-003-bulk-enroll-eligibility-file.md";
import sop004 from "../../docs/admin/sops/SOP-004-onboard-broker-agency-and-reps.md";
import sop005 from "../../docs/admin/sops/SOP-005-review-partner-application.md";
import sop006 from "../../docs/admin/sops/SOP-006-generate-deliver-vendor-files.md";
import sop007 from "../../docs/admin/sops/SOP-007-generate-listbill-invoice-record-payment.md";
import sop008 from "../../docs/admin/sops/SOP-008-close-invoice-calculator-period-adjustment.md";
import sop009 from "../../docs/admin/sops/SOP-009-terminate-member.md";
import sop010 from "../../docs/admin/sops/SOP-010-refund-or-cancel-subscription.md";
import sop011 from "../../docs/admin/sops/SOP-011-investigate-member-identity-issue.md";
import sop012 from "../../docs/admin/sops/SOP-012-manage-admin-users.md";
import sop013 from "../../docs/admin/sops/SOP-013-reenroll-termed-listbill-employee.md";
import sop014 from "../../docs/admin/sops/SOP-014-monthly-finance-reconciliation-checklist.md";
import sop015 from "../../docs/admin/sops/SOP-015-troubleshoot-eligibility-file-errors.md";

import guide00 from "../../docs/admin/guide/00-overview.md";
import guide01 from "../../docs/admin/guide/01-members-partners.md";
import guide02 from "../../docs/admin/guide/02-operations.md";
import guide03 from "../../docs/admin/guide/03-finance.md";
import guide04 from "../../docs/admin/guide/04-support-system.md";
import guide05 from "../../docs/admin/guide/05-known-issues.md";

export type AdminDocEntry = {
  content: string;
  /** Route key (relative to /admin/docs) of the directory this doc lives in — used to resolve relative markdown links. */
  dir: string;
};

// Keys mirror the /admin/docs/** route: "" is the root index, "sops" is the
// SOP Library index, "sops/SOP-001-..." is a single SOP, etc.
export const ADMIN_DOCS: Record<string, AdminDocEntry> = {
  "": { content: root, dir: "" },

  sops: { content: sopsIndex, dir: "sops" },
  "sops/SOP-001-onboard-selfpay-employer-group": { content: sop001, dir: "sops" },
  "sops/SOP-002-onboard-listbill-employer-group": { content: sop002, dir: "sops" },
  "sops/SOP-003-bulk-enroll-eligibility-file": { content: sop003, dir: "sops" },
  "sops/SOP-004-onboard-broker-agency-and-reps": { content: sop004, dir: "sops" },
  "sops/SOP-005-review-partner-application": { content: sop005, dir: "sops" },
  "sops/SOP-006-generate-deliver-vendor-files": { content: sop006, dir: "sops" },
  "sops/SOP-007-generate-listbill-invoice-record-payment": { content: sop007, dir: "sops" },
  "sops/SOP-008-close-invoice-calculator-period-adjustment": { content: sop008, dir: "sops" },
  "sops/SOP-009-terminate-member": { content: sop009, dir: "sops" },
  "sops/SOP-010-refund-or-cancel-subscription": { content: sop010, dir: "sops" },
  "sops/SOP-011-investigate-member-identity-issue": { content: sop011, dir: "sops" },
  "sops/SOP-012-manage-admin-users": { content: sop012, dir: "sops" },
  "sops/SOP-013-reenroll-termed-listbill-employee": { content: sop013, dir: "sops" },
  "sops/SOP-014-monthly-finance-reconciliation-checklist": { content: sop014, dir: "sops" },
  "sops/SOP-015-troubleshoot-eligibility-file-errors": { content: sop015, dir: "sops" },

  "guide/00-overview": { content: guide00, dir: "guide" },
  "guide/01-members-partners": { content: guide01, dir: "guide" },
  "guide/02-operations": { content: guide02, dir: "guide" },
  "guide/03-finance": { content: guide03, dir: "guide" },
  "guide/04-support-system": { content: guide04, dir: "guide" },
  "guide/05-known-issues": { content: guide05, dir: "guide" },
};
