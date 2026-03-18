import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// ─── Brand colours ────────────────────────────────────────────────────────────
const BLUE = "#1E88E5";
const GREEN = "#35C48A";
const ORANGE = "#F9A825";
const DARK = "#222222";
const GRAY = "#666666";
const LIGHT_BLUE = "#EAF4FD";
const LIGHT_GREEN = "#EAFBF4";
const NOTICE_BG = "#FFF8E1";
const DISCLOSURE_BG = "#F5F5F5";
const META_BG = "#F4F8FB";
const ROW_ALT = "#FAFAFA";

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: DARK,
    paddingTop: 52,
    paddingBottom: 36,
    paddingHorizontal: 40,
  },
  // Header / Footer
  logo: { width: 130, marginBottom: 10 },
  footer: {
    position: "absolute",
    bottom: 14,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 8,
    color: GRAY,
  },
  // Typography
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold", color: BLUE, marginBottom: 2 },
  h2: { fontSize: 16, fontFamily: "Helvetica-Bold", color: BLUE, marginBottom: 6 },
  h3: { fontSize: 12, fontFamily: "Helvetica-Bold", color: BLUE, marginBottom: 4 },
  h4: { fontSize: 11, fontFamily: "Helvetica-Bold", color: BLUE, marginBottom: 3 },
  sectionHeadingGreen: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: GREEN,
    marginTop: 8,
    marginBottom: 2,
  },
  body: { fontSize: 10, lineHeight: 1.5, marginBottom: 6 },
  bodySmall: { fontSize: 9, lineHeight: 1.4, marginBottom: 4 },
  italic: { fontFamily: "Helvetica-Oblique", fontSize: 10, color: GRAY, marginBottom: 6 },
  // Layout
  row: { flexDirection: "row" },
  spacer: { marginBottom: 8 },
  // Meta table
  metaBox: {
    backgroundColor: META_BG,
    padding: 8,
    marginBottom: 4,
    width: "100%",
  },
  metaLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: BLUE, marginBottom: 1 },
  metaValue: { fontSize: 9, color: DARK },
  // Notice box
  noticeBox: {
    backgroundColor: NOTICE_BG,
    borderLeftWidth: 3,
    borderLeftColor: ORANGE,
    padding: 10,
    marginBottom: 10,
  },
  // Member summary table
  summaryLabelCell: {
    backgroundColor: LIGHT_BLUE,
    padding: "5 8",
    width: "20%",
  },
  summaryValueCell: {
    padding: "5 8",
    width: "30%",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  summaryLabelText: { fontSize: 9, fontFamily: "Helvetica-Bold", color: BLUE },
  summaryValueText: { fontSize: 9, color: DARK },
  // Two-column highlights
  highlightLeft: {
    backgroundColor: LIGHT_GREEN,
    padding: 10,
    width: "45%",
    marginRight: 8,
  },
  highlightRight: {
    backgroundColor: LIGHT_BLUE,
    padding: 10,
    width: "55%",
  },
  // Disclosure box
  disclosureBox: {
    backgroundColor: DISCLOSURE_BG,
    padding: 10,
    marginTop: 6,
  },
  // Agreement fields
  fieldLabelCell: {
    backgroundColor: LIGHT_BLUE,
    padding: "5 8",
    width: "32%",
  },
  fieldValueCell: {
    padding: "5 8",
    width: "68%",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  // Schedule table
  schedBandRow: {
    backgroundColor: "#666666",
    padding: "5 8",
    marginTop: 6,
  },
  schedHeaderRow: {
    backgroundColor: LIGHT_BLUE,
    flexDirection: "row",
    padding: "4 0",
  },
  schedDataRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E8E8E8" },
  schedCodeCell: { width: "13%", padding: "4 6", fontSize: 8.5 },
  schedDescCell: { width: "72%", padding: "4 6", fontSize: 8.5 },
  schedAmtCell: { width: "15%", padding: "4 6", fontSize: 8.5, textAlign: "right" },
  // Bullet / numbered list
  bulletRow: { flexDirection: "row", marginBottom: 3 },
  bulletDot: { width: 14, marginTop: 1, fontSize: 10 },
  bulletNum: { width: 18, marginTop: 1, fontSize: 10 },
  bulletText: { flex: 1, fontSize: 10, lineHeight: 1.4 },
  bulletTextSmall: { flex: 1, fontSize: 9, lineHeight: 1.4 },
  contactCell: {
    backgroundColor: DISCLOSURE_BG,
    padding: "6 8",
    width: "33.33%",
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Bullet({ text, small = false }: { text: string; small?: boolean }) {
  return (
    <View style={s.bulletRow}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={small ? s.bulletTextSmall : s.bulletText}>{text}</Text>
    </View>
  );
}

function Numbered({ n, text }: { n: number; text: string }) {
  return (
    <View style={s.bulletRow}>
      <Text style={s.bulletNum}>{n}.</Text>
      <Text style={s.bulletText}>{text}</Text>
    </View>
  );
}

function SectionHeadingGreen({ text }: { text: string }) {
  return <Text style={s.sectionHeadingGreen}>{text}</Text>;
}

// ─── Service schedule data ─────────────────────────────────────────────────
const SERVICE_SCHEDULE = [
  {
    section: "Diagnostic Services",
    rows: [
      { code: "D0120", desc: "Periodic oral evaluation - established patient", amt: "$35" },
      { code: "D0150", desc: "Comprehensive oral evaluation - new or established patient", amt: "$61" },
      { code: "D0270", desc: "Bitewing - single radiographic image", amt: "$21" },
      { code: "D0272", desc: "Bitewings - two radiographic images", amt: "$33" },
      { code: "D0273", desc: "Bitewings - three radiographic images", amt: "$39" },
      { code: "D0274", desc: "Bitewings - four radiographic images", amt: "$46" },
    ],
  },
  {
    section: "Preventive Services",
    rows: [
      { code: "D1110", desc: "Prophylaxis - adult", amt: "$71" },
      { code: "D1120", desc: "Prophylaxis - child", amt: "$49" },
    ],
  },
  {
    section: "Restorative Services",
    rows: [
      { code: "D2330", desc: "Resin-based composite - one surface, anterior", amt: "$109" },
      { code: "D2391", desc: "Resin-based composite - one surface, posterior", amt: "$122" },
      { code: "D2750", desc: "Crown - porcelain fused to high noble metal", amt: "$892" },
      { code: "D2790", desc: "Crown - full cast high noble metal", amt: "$859" },
    ],
  },
  {
    section: "Endodontic Services",
    rows: [
      { code: "D3310", desc: "Endodontic therapy, anterior tooth", amt: "$547" },
      { code: "D3330", desc: "Endodontic therapy, molar tooth", amt: "$863" },
    ],
  },
  {
    section: "Periodontic Services",
    rows: [
      { code: "D4341", desc: "Scaling and root planing - four or more teeth per quadrant", amt: "$183" },
      { code: "D4910", desc: "Periodontal maintenance", amt: "$111" },
    ],
  },
  {
    section: "Prosthodontic Services (removable)",
    rows: [
      { code: "D5110", desc: "Complete denture - maxillary", amt: "$1,184" },
      { code: "D5120", desc: "Complete denture - mandibular", amt: "$1,184" },
      { code: "D5213", desc: "Maxillary partial denture - cast metal framework", amt: "$1,308" },
      { code: "D5214", desc: "Mandibular partial denture - cast metal framework", amt: "$1,308" },
      { code: "D5750", desc: "Reline complete maxillary denture (indirect)", amt: "$363" },
      { code: "D5751", desc: "Reline complete mandibular denture (indirect)", amt: "$363" },
    ],
  },
  {
    section: "Oral Surgery Services",
    rows: [{ code: "D7140", desc: "Extraction, erupted tooth or exposed root", amt: "$120" }],
  },
  {
    section: "Adjunctive Services",
    rows: [
      { code: "D9215", desc: "Local anesthesia in conjunction with operative or surgical procedures", amt: "$24" },
      { code: "D9230", desc: "Inhalation of nitrous oxide / analgesia / anxiolysis", amt: "$41" },
    ],
  },
];

// ─── Data type ────────────────────────────────────────────────────────────────
export interface FulfillmentPacketData {
  memberName: string;
  memberFirstName: string;
  memberEmail: string;
  memberId: string;
  subscriberId?: string;
  groupCode: string;
  planName: string;
  effectiveDate: string;
  term?: string;
  memberAddress?: string;
  periodicCharge?: string;
  processingFee?: string;
  memberServicesPhone?: string;
  memberWebsite?: string;
  logoDataUri?: string;
}

// ─── Page logo/footer wrapper ─────────────────────────────────────────────────
function PageHeader({ logoDataUri }: { logoDataUri?: string }) {
  if (!logoDataUri) {
    return (
      <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: BLUE, marginBottom: 8 }}>
        IDEAL ORAL HEALTH
      </Text>
    );
  }
  return <Image style={s.logo} src={logoDataUri} />;
}

// ─── Page 1: Welcome Letter ───────────────────────────────────────────────────
function WelcomePage({ data }: { data: FulfillmentPacketData }) {
  const phone = data.memberServicesPhone ?? "(800) 290-0523";
  const website = data.memberWebsite ?? "www.careington.com";

  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader logoDataUri={data.logoDataUri} />

      {/* Title */}
      <Text style={{ ...s.h1, textAlign: "center" }}>Member Fulfillment Packet</Text>
      <Text style={{ fontSize: 10, color: GRAY, textAlign: "center", marginBottom: 12 }}>
        Ideal Oral Health — Careington Dental Savings Program
      </Text>

      {/* Meta table */}
      <View style={{ flexDirection: "row", marginBottom: 8 }}>
        {[
          { label: "Program Name", value: "Ideal Oral Health" },
          { label: "Network / Vendor", value: "Careington discount program" },
          { label: "Effective Date", value: data.effectiveDate },
        ].map((item) => (
          <View key={item.label} style={{ ...s.metaBox, width: "33.33%", marginRight: 4 }}>
            <Text style={s.metaLabel}>{item.label}</Text>
            <Text style={s.metaValue}>{item.value}</Text>
          </View>
        ))}
      </View>

      {/* Notice */}
      <View style={s.noticeBox}>
        <Text style={{ fontSize: 10 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", color: ORANGE }}>Important: </Text>
          <Text>
            This plan is not insurance. Members are responsible for payment at the time of service
            and receive access to negotiated discounts through participating providers.
          </Text>
        </Text>
      </View>

      {/* Welcome letter heading */}
      <Text style={{ ...s.h3, marginTop: 6 }}>1. Welcome Letter</Text>

      {/* Address block */}
      {[
        data.memberId,
        data.memberName,
        data.memberAddress ?? "[STREET ADDRESS]",
      ].map((line) => (
        <Text key={line} style={{ fontSize: 10, marginBottom: 0 }}>
          {line}
        </Text>
      ))}

      <Text style={{ fontSize: 10, marginTop: 8, marginBottom: 6 }}>
        Dear {data.memberFirstName},
      </Text>

      {[
        `Welcome to Ideal Oral Health. We are excited to have you enrolled and to help connect you with dental savings and oral health support through your membership.`,
        `Your program is designed to make it easier to access participating providers, understand your member benefits, and use your included services with confidence. Please keep this packet for your records and refer to it whenever you need your membership details or support information.`,
        `For your convenience, your membership card(s) and summary materials are included with this packet. Please present your card at each appointment and keep your member information available when scheduling services.`,
        `To find participating providers, get help using your plan, or request additional information, contact Member Services at ${phone} or visit ${website}.`,
      ].map((para) => (
        <Text key={para.slice(0, 40)} style={s.body}>
          {para}
        </Text>
      ))}

      <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: GREEN, marginBottom: 3 }}>
        Included in this packet:
      </Text>
      {[
        "Member ID card / digital ID card instructions",
        "Program summary and access details",
        "Membership agreement and cancellation terms",
        "Sample schedule of dental services and member-pay amounts",
      ].map((item) => (
        <Bullet key={item} text={item} />
      ))}

      {/* Member Summary */}
      <Text style={{ ...s.h4, marginTop: 10, marginBottom: 6 }}>Member Summary</Text>
      {[
        ["Member Name", data.memberName, "Member ID", data.memberId],
        [
          "Subscriber ID",
          data.subscriberId ?? data.memberId,
          "Group Code",
          data.groupCode,
        ],
        ["Effective Date", data.effectiveDate, "Term", data.term ?? "Annual"],
        ["Website", website, "Member Services", phone],
      ].map((row, i) => (
        <View key={i} style={{ flexDirection: "row", marginBottom: 2 }}>
          <View style={s.summaryLabelCell}>
            <Text style={s.summaryLabelText}>{row[0]}</Text>
          </View>
          <View style={s.summaryValueCell}>
            <Text style={s.summaryValueText}>{row[1]}</Text>
          </View>
          <View style={s.summaryLabelCell}>
            <Text style={s.summaryLabelText}>{row[2]}</Text>
          </View>
          <View style={s.summaryValueCell}>
            <Text style={s.summaryValueText}>{row[3]}</Text>
          </View>
        </View>
      ))}

      <Text style={s.footer}>Ideal Oral Health | Fulfillment Packet | {data.effectiveDate}</Text>
    </Page>
  );
}

// ─── Page 2: Program Summary ──────────────────────────────────────────────────
function ProgramSummaryPage({ data }: { data: FulfillmentPacketData }) {
  const phone = data.memberServicesPhone ?? "(800) 290-0523";
  const website = data.memberWebsite ?? "www.careington.com";

  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader logoDataUri={data.logoDataUri} />

      <Text style={s.h2}>2. Program Summary &amp; Member Use</Text>

      {/* Two-column highlights */}
      <View style={{ flexDirection: "row", marginBottom: 10 }}>
        <View style={s.highlightLeft}>
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: GREEN, marginBottom: 5 }}>
            What members receive
          </Text>
          {[
            "Access to participating dental providers",
            "Reduced member-pay amounts on eligible services",
            "Support locating providers and using the program",
            "Membership materials and ID card details",
          ].map((item) => (
            <Bullet key={item} text={item} small />
          ))}
        </View>
        <View style={s.highlightRight}>
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: BLUE, marginBottom: 5 }}>
            How to use the program
          </Text>
          {[
            "Confirm the provider participates before treatment.",
            "Schedule your appointment and identify yourself as a member.",
            "Present your member ID card at the visit.",
            "Pay the discounted member amount directly to the provider at time of service.",
          ].map((item, i) => (
            <Numbered key={i} n={i + 1} text={item} />
          ))}
        </View>
      </View>

      <Text style={s.h3}>Program Details</Text>
      {[
        `Dental — Ideal Oral Health Dental Savings Program (powered by the Careington network): Members save on many common dental services, including preventive care and select major procedures, through participating providers.`,
        `Provider Search: To locate a participating provider, call ${phone} or visit ${website}.`,
        `Member Reminder: This plan is not insurance. Members are responsible for payment at the time of service and receive access to negotiated discounts through participating providers.`,
      ].map((item) => (
        <Bullet key={item.slice(0, 40)} text={item} />
      ))}

      <View style={{ ...s.disclosureBox, marginTop: 8 }}>
        <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 5 }}>
          Disclosure Summary
        </Text>
        {[
          "THIS PLAN IS NOT INSURANCE and is not intended to replace health insurance.",
          "The plan does not pay providers directly. Members must pay for all services but receive discounts from participating providers.",
          "The range of discounts varies by provider and service. Provider participation may change.",
          "A written list of participating providers is available upon request.",
          "Cancellation, refund, and state-specific language should be reviewed against your final program documents before release.",
        ].map((item) => (
          <Bullet key={item.slice(0, 40)} text={item} small />
        ))}
      </View>

      <Text style={s.footer}>Ideal Oral Health | Program Summary</Text>
    </Page>
  );
}

// ─── Page 3: Membership Agreement ────────────────────────────────────────────
function MembershipAgreementPage({ data }: { data: FulfillmentPacketData }) {
  const fields: [string, string][] = [
    ["Discount Plan Organization", "Careington International Corporation"],
    ["Program Brand", "Ideal Oral Health"],
    ["Group Code", data.groupCode],
    ["Group Name", "Ideal Oral Health"],
    ["Member ID", data.memberId],
    ["Effective Date", data.effectiveDate],
    ["Term", data.term ?? "Annual"],
    ["Periodic Charge", data.periodicCharge ?? "[PERIODIC CHARGE]"],
    ["Processing Fee", data.processingFee ?? "[PROCESSING FEE]"],
    [
      "Cancellation Contact",
      data.memberServicesPhone
        ? `${data.memberServicesPhone} | info@getidealoh.com`
        : "801-820-0010 | info@getidealoh.com",
    ],
  ];

  const sections: [string, string][] = [
    [
      "Purchase and Renewal Conditions",
      "By enrolling in the program, the member confirms they are at least 18 years old or are enrolling on behalf of a minor child for whom they are a parent or legal guardian. Membership charges, renewal timing, and any automatic renewal language match the finalized billing process.",
    ],
    [
      "Termination Conditions",
      "Ideal Oral Health and its program administrator reserve the right to terminate membership for permitted reasons, including non-payment. Any refund treatment follows the final approved contract language and applicable law.",
    ],
    [
      "Cancellation Conditions",
      "Members have a clearly identified process for cancellation requests. Contact by mailing address, email, or phone. A 30-day cancellation window is available; processing-fee rules and pro-rata refund rules match the final approved state-specific language.",
    ],
    [
      "Description of Services",
      "The program offers access to participating providers and negotiated savings on eligible dental services. Additional program components may be described in the enclosed materials and on the member website.",
    ],
    [
      "Limitations, Exclusions & Exceptions",
      "This discount membership program is not insurance. Members are responsible for payment at the time of service. Discounts are available only from participating providers, actual savings vary, and provider participation is subject to change. Services may not be combined with other discounts where prohibited.",
    ],
    [
      "Complaint Procedure",
      "Complaints should be submitted in writing to: info@getidealoh.com or 801-820-0010. Escalation and appeal processes are available through the program administrator.",
    ],
  ];

  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader logoDataUri={data.logoDataUri} />

      <Text style={s.h2}>3. Membership Agreement</Text>
      <Text style={s.italic}>
        This agreement is a record of your enrollment. Finalized billing, cancellation, and legal
        language apply as provided at time of enrollment.
      </Text>

      {/* Fields table */}
      {fields.map(([label, value]) => (
        <View key={label} style={{ flexDirection: "row", marginBottom: 2 }}>
          <View style={s.fieldLabelCell}>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: BLUE }}>{label}</Text>
          </View>
          <View style={s.fieldValueCell}>
            <Text style={{ fontSize: 9, color: DARK }}>{value}</Text>
          </View>
        </View>
      ))}

      {/* Sections */}
      {sections.map(([title, text]) => (
        <View key={title}>
          <SectionHeadingGreen text={title} />
          <Text style={s.bodySmall}>{text}</Text>
        </View>
      ))}

      <Text style={s.footer}>Ideal Oral Health | Membership Agreement</Text>
    </Page>
  );
}

// ─── Page 4: Schedule of Services ────────────────────────────────────────────
function SchedulePage({ data }: { data: FulfillmentPacketData }) {
  const phone = data.memberServicesPhone ?? "(800) 290-0523";

  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader logoDataUri={data.logoDataUri} />

      <Text style={s.h2}>4. Sample Schedule of Services</Text>
      <Text style={{ fontSize: 9, fontFamily: "Helvetica-Oblique", color: GRAY, marginBottom: 8 }}>
        Abbreviated sample based on the Careington POS schedule. Confirm codes and pricing against
        your final fee schedule before use.
      </Text>

      {/* Contact strip */}
      <View style={{ flexDirection: "row", marginBottom: 8 }}>
        {[
          ["Business Hours", "Mon–Fri 7am–7pm CT"],
          ["Customer Service", phone],
          ["Mail", "Ideal Oral Health Member Services"],
        ].map(([label, value]) => (
          <View key={label} style={s.contactCell}>
            <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", color: BLUE }}>
              {label}
            </Text>
            <Text style={{ fontSize: 8.5, color: DARK }}>{value}</Text>
          </View>
        ))}
      </View>

      {/* Service tables */}
      {SERVICE_SCHEDULE.map((section) => (
        <View key={section.section}>
          {/* Band header */}
          <View style={s.schedBandRow}>
            <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold", color: "#FFFFFF" }}>
              {section.section}
            </Text>
          </View>
          {/* Column headers */}
          <View style={s.schedHeaderRow}>
            <Text style={{ ...s.schedCodeCell, fontFamily: "Helvetica-Bold", fontSize: 8.5, color: BLUE }}>
              Code
            </Text>
            <Text style={{ ...s.schedDescCell, fontFamily: "Helvetica-Bold", fontSize: 8.5, color: BLUE }}>
              Description
            </Text>
            <Text style={{ ...s.schedAmtCell, fontFamily: "Helvetica-Bold", fontSize: 8.5, color: BLUE }}>
              Member Pays
            </Text>
          </View>
          {/* Rows */}
          {section.rows.map((row, i) => (
            <View
              key={row.code}
              style={{
                ...s.schedDataRow,
                backgroundColor: i % 2 === 1 ? ROW_ALT : "#FFFFFF",
              }}
            >
              <Text style={s.schedCodeCell}>{row.code}</Text>
              <Text style={s.schedDescCell}>{row.desc}</Text>
              <Text style={s.schedAmtCell}>{row.amt}</Text>
            </View>
          ))}
        </View>
      ))}

      {/* Exclusions */}
      <Text style={{ ...s.h4, marginTop: 10 }}>Exclusions &amp; Limitations</Text>
      {[
        "Fees are subject to change.",
        "The dollar amount adjacent to each procedure may not be the only cost incurred; consult your participating provider for a detailed treatment plan before work begins.",
        "Provider participation cannot be guaranteed and may change over time.",
        "Members must verify that a dentist is participating before treatment. Services from non-participating providers are not discounted.",
        "Discount plans are not insurance.",
      ].map((item, i) => (
        <Numbered key={i} n={i + 1} text={item} />
      ))}

      <Text style={s.footer}>Ideal Oral Health | Sample Schedule of Services</Text>
    </Page>
  );
}

// ─── Root document ────────────────────────────────────────────────────────────
export function FulfillmentPacketPdf({ data }: { data: FulfillmentPacketData }) {
  return (
    <Document
      title="Ideal Oral Health Member Fulfillment Packet"
      author="Ideal Oral Health"
      subject="Member Fulfillment Packet"
    >
      <WelcomePage data={data} />
      <ProgramSummaryPage data={data} />
      <MembershipAgreementPage data={data} />
      <SchedulePage data={data} />
    </Document>
  );
}
