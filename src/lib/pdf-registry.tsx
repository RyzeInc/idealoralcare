/**
 * PDF DOCUMENT REGISTRY — every PDF the system can generate, with fixture data.
 *
 * Drives the debug preview at /debug/pdf-preview so any document can be
 * rendered and inspected without a real member, invoice, or statement in the
 * database, and without sending an email.
 *
 * Adding a PDF: add an entry here and it appears in the preview automatically.
 */

import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import {
  FulfillmentPacketPdf,
  MembershipAgreementPdf,
  MemberCardPdf,
  MemberCardsPdf,
  type FulfillmentPacketData,
} from "./fulfillment-pdf";
import {
  EssentialsPacketPdf,
  EssentialsMembershipAgreementPdf,
  EssentialsMemberCardPdf,
  type EssentialsPacketData,
} from "./essentials-packet-pdf";
import { essentialsAppendPaths } from "./essentials-packet-assets";
import { ListBillInvoicePdf, type ListBillInvoicePdfData } from "./list-bill-invoice-pdf";
import { VendorStatementPdf, VendorStatementBundlePdf } from "./vendor-statement-pdf";
import type { VendorStatementDocument } from "./vendor-statement-document";

export type PdfCategory = "member" | "billing" | "vendor";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SAMPLE_MEMBER: FulfillmentPacketData = {
  memberName: "Test Member",
  memberFirstName: "Test",
  memberEmail: "test.member@example.com",
  memberId: "100-10001",
  subscriberId: "100-10001-01",
  groupCode: "IOH-DTC",
  planName: "Ideal Oral Savings Plan",
  effectiveDate: "June 1, 2026",
  term: "ANNUAL",
  memberAddress: "123 Any Street\nTallahassee, FL 32303",
  periodicCharge: "$19.95",
  processingFee: "$0.00",
  memberServicesPhone: "(844) 679-9367",
  memberWebsite: "www.getidealoh.com",
};

const SAMPLE_FAMILY: FulfillmentPacketData[] = [
  SAMPLE_MEMBER,
  {
    ...SAMPLE_MEMBER,
    memberName: "Alex Member",
    memberFirstName: "Alex",
    memberEmail: "alex.member@example.com",
    memberId: "100-10001-02",
    subscriberId: "100-10001-02",
  },
  {
    ...SAMPLE_MEMBER,
    memberName: "Riley Member",
    memberFirstName: "Riley",
    memberEmail: "riley.member@example.com",
    memberId: "100-10001-03",
    subscriberId: "100-10001-03",
  },
];

const SAMPLE_ESSENTIALS_MEMBER: EssentialsPacketData = {
  memberName: "Test Member",
  memberFirstName: "Test",
  memberEmail: "test.member@example.com",
  essentialsMemberNumber: "841716653",
  essentialsGroupNumber: "895794",
  planName: "Essentials Plan — Employee",
  coverageType: "Employee",
  effectiveDate: "October 1, 2026",
  term: "Monthly",
  memberAddress: "123 Any Street\nTallahassee, FL 32303",
  periodicCharge: "$58.95",
};

export const SAMPLE_LIST_BILL_INVOICE: ListBillInvoicePdfData = {
  invoiceNumberDisplay: "INV-2026-0042",
  isDraft: true,
  brandName: "Ryze LLC",
  groupName: "Crunch Fitness – Denver Metro",
  groupCode: "CRUNCH-DEN",
  organizationCode: "ORG-1042",
  accountName: "Crunch Fitness Holdings LLC",
  coveragePeriod: "2026-05",
  coverageStart: Date.UTC(2026, 4, 1),
  coverageEnd: Date.UTC(2026, 4, 31),
  billingDate: Date.UTC(2026, 4, 1),
  paymentDueDate: Date.UTC(2026, 4, 15),
  subtotalCents: 214500,
  adjustmentCents: -5000,
  adjustmentNotes: "Retro term credit — member 100-99201 terminated 4/28",
  totalCents: 209500,
  amountPaidCents: 0,
  balanceCents: 209500,
  memberCount: 14,
  lines: [
    { memberId: "100-10001", lastName: "Anderson",  firstName: "James",    productLabel: "MO – Individual",  rateCents: 14500 },
    { memberId: "100-10002", lastName: "Beaumont",  firstName: "Sophia",   productLabel: "MF – Family",      rateCents: 21500 },
    { memberId: "100-10003", lastName: "Chen",      firstName: "Wei",      productLabel: "MS – Member+Sp",   rateCents: 18500 },
    { memberId: "100-10004", lastName: "Davis",     firstName: "Olivia",   productLabel: "MO – Individual",  rateCents: 14500 },
    { memberId: "100-10005", lastName: "Ellison",   firstName: "Marcus",   productLabel: "MF – Family",      rateCents: 21500 },
    { memberId: "100-10006", lastName: "Fontaine",  firstName: "Claire",   productLabel: "MO – Individual",  rateCents: 14500 },
    { memberId: "100-10007", lastName: "Garcia",    firstName: "Luis",     productLabel: "MS – Member+Sp",   rateCents: 18500 },
    { memberId: "100-10008", lastName: "Hassan",    firstName: "Amira",    productLabel: "MO – Individual",  rateCents: 14500 },
    { memberId: "100-10009", lastName: "Ivanova",   firstName: "Natasha",  productLabel: "MF – Family",      rateCents: 21500 },
    { memberId: "100-10010", lastName: "Jackson",   firstName: "Derek",    productLabel: "MO – Individual",  rateCents: 14500 },
    { memberId: "100-10011", lastName: "Kim",       firstName: "Jinsoo",   productLabel: "MO – Individual",  rateCents: 14500 },
    { memberId: "100-10012", lastName: "Lopez",     firstName: "Elena",    productLabel: "MS – Member+Sp",   rateCents: 18500 },
    { memberId: "100-10013", lastName: "Martínez",  firstName: "Rodrigo",  productLabel: "MF – Family",      rateCents: 21500 },
    { memberId: "100-10014", lastName: "Nguyen",    firstName: "Thanh",    productLabel: "MO – Individual",  rateCents: 14500 },
  ],
  aging: {
    currentCents: 209500,
    upTo30Cents: 0,
    days31To60Cents: 0,
    days61To90Cents: 0,
    days91PlusCents: 0,
    totalDueCents: 209500,
  },
  remitTo: {
    payeeName: "Ryze LLC",
    addressLines: ["1846 Fernando Ln", "Tallahassee, FL 32303 US"],
    contactEmail: "info@ryzenexus.com",
  },
};

function sampleVendorStatement(
  overrides: Partial<VendorStatementDocument> = {},
): VendorStatementDocument {
  return {
    statementNumberDisplay: "VS-10001",
    status: "issued",
    vendor: "careington",
    vendorName: "Careington International Corporation",
    basis: "Active primaries as of coverage month close",
    period: "2026-05",
    coverageStart: Date.UTC(2026, 4, 1),
    coverageEnd: Date.UTC(2026, 4, 31, 23, 59, 59, 999),
    statementDate: Date.UTC(2026, 5, 1),
    paymentDueDate: Date.UTC(2026, 5, 15),
    sourceClosedAt: Date.UTC(2026, 5, 1),
    showMemberDetail: true,
    showGroups: true,
    showTier: true,
    showBroker: false,
    showFullSplit: false,
    showAdjustmentDetail: true,
    columns: [
      { key: "memberId", label: "Member ID" },
      { key: "memberName", label: "Member" },
      { key: "organization", label: "Organization" },
      { key: "rateClass", label: "Tier" },
      { key: "amount", label: "Amount" },
    ],
    memberDetailAvailable: true,
    memberDetailComplete: true,
    missingDetailGroups: [],
    itemizedCents: 48000,
    closedSubtotalCents: 48000,
    attributionBasis: "frozen",
    primaryCount: 6,
    individualCount: 4,
    familyCount: 2,
    groupCodeVaries: false,
    memberLines: [
      { memberId: "100-10001", firstName: "James",   lastName: "Anderson", amountCents: 8000, groupCode: "CRUNCH-DEN", groupName: "Crunch Fitness – Denver Metro", rateClass: "Individual" },
      { memberId: "100-10002", firstName: "Sophia",  lastName: "Beaumont", amountCents: 8000, groupCode: "CRUNCH-DEN", groupName: "Crunch Fitness – Denver Metro", rateClass: "Family" },
      { memberId: "100-10003", firstName: "Wei",     lastName: "Chen",     amountCents: 8000, groupCode: "CRUNCH-DEN", groupName: "Crunch Fitness – Denver Metro", rateClass: "Individual" },
      { memberId: "100-10004", firstName: "Olivia",  lastName: "Davis",    amountCents: 8000, groupCode: "ACME-FL",    groupName: "Acme Corp",                     rateClass: "Individual" },
      { memberId: "100-10005", firstName: "Marcus",  lastName: "Ellison",  amountCents: 8000, groupCode: "ACME-FL",    groupName: "Acme Corp",                     rateClass: "Family" },
      { memberId: "100-10006", firstName: "Claire",  lastName: "Fontaine", amountCents: 8000, groupCode: "ACME-FL",    groupName: "Acme Corp",                     rateClass: "Individual" },
    ],
    groups: [
      { groupCode: "CRUNCH-DEN", groupName: "Crunch Fitness – Denver Metro", organizationCode: "ORG-1042", primaryCount: 3, individualCount: 2, familyCount: 1, amountCents: 24000 },
      { groupCode: "ACME-FL",    groupName: "Acme Corp",                     organizationCode: "ORG-2051", primaryCount: 3, individualCount: 2, familyCount: 1, amountCents: 24000 },
    ],
    adjustments: [
      { reason: "Retro termination", notes: "Member 100-99201 terminated 4/28", deltaCents: -2000, createdAt: Date.UTC(2026, 5, 1) },
    ],
    subtotalCents: 48000,
    adjustmentCents: -2000,
    totalCents: 46000,
    amountPaidCents: 0,
    balanceCents: 46000,
    brandName: "Ryze LLC",
    remitFrom: {
      payeeName: "Ryze LLC",
      addressLines: ["1846 Fernando Ln", "Tallahassee, FL 32303 US"],
      contactEmail: "info@ryzenexus.com",
    },
    ...overrides,
  };
}

const SAMPLE_VENDOR_STATEMENTS: VendorStatementDocument[] = [
  sampleVendorStatement(),
  sampleVendorStatement({
    statementNumberDisplay: "VS-10002",
    vendor: "toothlens",
    vendorName: "Toothlens",
    subtotalCents: 18000,
    itemizedCents: 18000,
    closedSubtotalCents: 18000,
    adjustmentCents: 0,
    totalCents: 18000,
    balanceCents: 18000,
    adjustments: [],
    memberLines: [
      { memberId: "100-10001", firstName: "James",  lastName: "Anderson", amountCents: 3000, groupCode: "CRUNCH-DEN", groupName: "Crunch Fitness – Denver Metro", rateClass: "Individual" },
      { memberId: "100-10002", firstName: "Sophia", lastName: "Beaumont", amountCents: 3000, groupCode: "CRUNCH-DEN", groupName: "Crunch Fitness – Denver Metro", rateClass: "Family" },
    ],
  }),
];

// ─── Registry ────────────────────────────────────────────────────────────────

export interface PdfDocumentEntry {
  label: string;
  description: string;
  category: PdfCategory;
  /** Where this document is produced in the real app. */
  source: string;
  /** Download filename for the preview. */
  filename: string;
  build: () => ReactElement<DocumentProps>;
  /**
   * Absolute paths to PDFs appended after the rendered pages. The preview
   * merges these too — otherwise it would quietly show a shorter document than
   * the one members actually receive.
   */
  appendAssets?: () => string[];
}

function element(node: React.ReactElement): ReactElement<DocumentProps> {
  return node as unknown as ReactElement<DocumentProps>;
}

export const PDF_DOCUMENTS = {
  "fulfillment-packet": {
    label: "Member Fulfillment Packet",
    description: "Welcome letter, AI scan, DialCare and program summaries, plus the member ID card pages.",
    category: "member",
    source: "POST /api/generate-fulfillment-pdf · GET /api/documents?type=packet",
    filename: "sample-fulfillment-packet.pdf",
    build: () => element(createElement(FulfillmentPacketPdf, { data: SAMPLE_MEMBER })),
  },
  "membership-agreement": {
    label: "Membership Agreement",
    description: "Standalone membership agreement page attached alongside the packet.",
    category: "member",
    source: "POST /api/generate-fulfillment-pdf · GET /api/documents?type=agreement",
    filename: "sample-membership-agreement.pdf",
    build: () => element(createElement(MembershipAgreementPdf, { data: SAMPLE_MEMBER })),
  },
  "member-card": {
    label: "Member ID Card (single)",
    description: "Title page plus front and back of one member's ID card.",
    category: "member",
    source: "GET /api/documents?type=card · /api/member-card-pdf · admin id-card route",
    filename: "sample-member-card.pdf",
    build: () => element(createElement(MemberCardPdf, { data: SAMPLE_MEMBER })),
  },
  "member-cards-family": {
    label: "Member ID Cards (family bundle)",
    description: "Front and back pair for the primary and each dependent, no title pages.",
    category: "member",
    source: "GET /api/admin/members/[memberId]/id-card (when the member has dependents)",
    filename: "sample-member-cards-family.pdf",
    build: () => element(createElement(MemberCardsPdf, { people: SAMPLE_FAMILY })),
  },
  "essentials-packet": {
    label: "Essentials Welcome Packet",
    description:
      "Welcome letter, benefit router, Lyric virtual care, RxValet pharmacy, QuestSelect labs and Balance for Life, plus the member ID card. The BFL welcome letter is appended after the generated pages.",
    category: "member",
    source: "POST /api/generate-essentials-pdf · GET /api/documents?type=essentials-packet",
    filename: "sample-essentials-packet.pdf",
    build: () => element(createElement(EssentialsPacketPdf, { data: SAMPLE_ESSENTIALS_MEMBER })),
    appendAssets: essentialsAppendPaths,
  },
  "essentials-agreement": {
    label: "Essentials Membership Agreement",
    description: "Standalone Essentials membership agreement attached alongside the packet.",
    category: "member",
    source: "POST /api/generate-essentials-pdf · GET /api/documents?type=essentials-agreement",
    filename: "sample-essentials-agreement.pdf",
    build: () =>
      element(createElement(EssentialsMembershipAgreementPdf, { data: SAMPLE_ESSENTIALS_MEMBER })),
  },
  "essentials-card": {
    label: "Essentials Member ID Card",
    description: "Title page plus front and back of an Essentials member ID card.",
    category: "member",
    source: "GET /api/documents?type=essentials-card",
    filename: "sample-essentials-card.pdf",
    build: () => element(createElement(EssentialsMemberCardPdf, { data: SAMPLE_ESSENTIALS_MEMBER })),
  },
  "list-bill-invoice": {
    label: "List-Bill Invoice",
    description: "Group invoice summary with aging buckets plus the itemised member-product lines.",
    category: "billing",
    source: "GET /api/admin/list-bill-invoices/[invoiceId]/group-pdf",
    filename: "sample-list-bill-invoice.pdf",
    build: () => element(createElement(ListBillInvoicePdf, { data: SAMPLE_LIST_BILL_INVOICE })),
  },
  "vendor-statement": {
    label: "Vendor Remittance Statement",
    description: "One vendor's remittance statement for a single coverage month.",
    category: "vendor",
    source: "GET /api/admin/vendor-statements/[statementId]/document?format=pdf",
    filename: "sample-vendor-statement.pdf",
    build: () => element(createElement(VendorStatementPdf, { doc: SAMPLE_VENDOR_STATEMENTS[0] })),
  },
  "vendor-statement-bundle": {
    label: "Vendor Statement Bundle",
    description: "Every live vendor statement for one coverage month, one per page.",
    category: "vendor",
    source: "GET /api/admin/vendor-statements/period/[period]/document?format=pdf",
    filename: "sample-vendor-statement-bundle.pdf",
    build: () =>
      element(
        createElement(VendorStatementBundlePdf, {
          docs: SAMPLE_VENDOR_STATEMENTS,
          period: "2026-05",
        }),
      ),
  },
} satisfies Record<string, PdfDocumentEntry>;

export type PdfDocumentId = keyof typeof PDF_DOCUMENTS;

export function isPdfDocumentId(value: string): value is PdfDocumentId {
  return Object.prototype.hasOwnProperty.call(PDF_DOCUMENTS, value);
}

export interface PdfDocumentSummary {
  id: PdfDocumentId;
  label: string;
  description: string;
  category: PdfCategory;
  source: string;
  filename: string;
}

export function listPdfDocuments(): PdfDocumentSummary[] {
  return (Object.keys(PDF_DOCUMENTS) as PdfDocumentId[]).map((id) => {
    const entry = PDF_DOCUMENTS[id];
    return {
      id,
      label: entry.label,
      description: entry.description,
      category: entry.category,
      source: entry.source,
      filename: entry.filename,
    };
  });
}
