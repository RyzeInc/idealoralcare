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
import { renderCardFront, renderCardBack, type MemberCardData } from "@/lib/card-renderer";

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
  const phone = data.memberServicesPhone ?? "support@getidealoh.com";
  const website = data.memberWebsite ?? "www.getidealoh.com";

  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader logoDataUri={data.logoDataUri} />

      {/* Title */}
      <Text style={{ ...s.h1, textAlign: "center" }}>Member Fulfillment Packet</Text>
      <Text style={{ fontSize: 10, color: GRAY, textAlign: "center", marginBottom: 12 }}>
        Ideal Oral Health — AI Dental Scan - Teledentistry - Dental Savings Program
      </Text>

      {/* Meta table */}
      <View style={{ flexDirection: "row", marginBottom: 8 }}>
        {[
          { label: "Program Name", value: "Ideal Oral Health" },
          { label: "Member ID", value: data.memberId },
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
      <Text style={{ ...s.h3, marginTop: 6 }}>Welcome Letter</Text>

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
        "AI Oral Scan — how to access and use",
        "Teledentistry program details and how to access",
        "Dental Discount Network program details and how to access savings",
        "Member ID card (front and back)",
      ].map((item) => (
        <Bullet key={item} text={item} />
      ))}

      {/* How to Use Your Membership */}
      <Text style={{ ...s.h4, marginTop: 10, marginBottom: 4, color: GREEN }}>
        How to Access Your Benefits
      </Text>
      <View style={{ backgroundColor: LIGHT_GREEN, padding: 8, marginBottom: 8, borderRadius: 4 }}>
        {[
          { n: 1, text: "Log in to your Member Portal at www.getidealoh.com/health/dashboard to access your AI Oral Scan, view your card, and manage your membership." },
          { n: 2, text: "To locate a participating dental provider, visit your Member Portal at getidealoh.com/health/dashboard or contact support@getidealoh.com for assistance." },
          { n: 3, text: "When scheduling an appointment, inform the provider's office you are an Ideal Oral Health member." },
          { n: 4, text: "Present your Member ID card upon arrival to receive savings. The provider will collect payment at the time of service." },
        ].map((item) => (
          <Numbered key={item.n} n={item.n} text={item.text} />
        ))}
      </View>

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

// ─── Page 2: AI Oral Scan ────────────────────────────────────────────────────
function AIScanningSummaryPage({ data }: { data: FulfillmentPacketData }) {
  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader logoDataUri={data.logoDataUri} />

      <Text style={s.h2}>1. AI Oral Scan</Text>
      <Text style={s.body}>
        Your Ideal Oral Health membership includes access to an AI-powered dental assessment tool that lets you monitor your oral health from home. Simply upload or take a photo of your teeth from your Member Portal and receive an instant AI-driven screening of potential dental issues.
      </Text>

      <Text style={{ ...s.h4, color: GREEN, marginTop: 6 }}>What AI Oral Scan Can Do:</Text>
      {[
        "Detect potential dental issues early through AI-powered photo analysis",
        "Monitor visible changes in your oral health over time with unlimited repeat scans",
        "Provide AI-generated insights to help you decide when to seek professional care",
        "Review scan history to track your oral health progress",
        "Share scan results with your dentist or during a teledentistry consultation",
      ].map((item) => (
        <Bullet key={item.slice(0, 40)} text={item} />
      ))}

      <Text style={{ ...s.h4, color: GREEN, marginTop: 6 }}>How to Use AI Oral Scan:</Text>
      {[
        { n: 1, text: "Log in to your Member Portal at www.getidealoh.com/health/dashboard." },
        { n: 2, text: "Open the Oral Scan tab from your dashboard." },
        { n: 3, text: "Upload or take a clear photo of your teeth following the on-screen guide." },
        { n: 4, text: "Review your AI-generated results and any recommended next steps." },
        { n: 5, text: "Use your results to guide a teledentistry consultation or share with your dentist at your next visit." },
      ].map((item) => (
        <Numbered key={item.n} n={item.n} text={item.text} />
      ))}

      <Text style={{ ...s.h4, color: GREEN, marginTop: 6 }}>When to Use AI Scanning:</Text>
      {[
        "Before scheduling a dental appointment — to understand any visible areas of concern",
        "Between regular dental visits — to monitor your oral health at home",
        "After dental treatment — to track healing and changes",
        "When you notice something unusual — discoloration, swelling, or sensitivity",
        "Before a teledentistry consultation — to share visual context with the dentist",
      ].map((item) => (
        <Bullet key={item.slice(0, 40)} text={item} />
      ))}

      <View style={s.noticeBox}>
        <Text style={{ fontSize: 9, lineHeight: 1.4 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", color: ORANGE }}>Important: </Text>
          <Text>
            AI Oral Scan is a screening tool — it is not a clinical diagnosis. Always consult a licensed dentist for professional evaluation and treatment. Your data is protected with SOC 2 Type 2 and HIPAA-compliant security protocols.
          </Text>
        </Text>
      </View>

      <Text style={s.footer}>Ideal Oral Health | AI Oral Scan</Text>
    </Page>
  );
}

// ─── Page 4: Dental Discount Network ─────────────────────────────────────────
function ProgramSummaryPage({ data }: { data: FulfillmentPacketData }) {
  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader logoDataUri={data.logoDataUri} />

      <Text style={s.h2}>4. Dental Savings Network</Text>

      <Text style={s.body}>
        Your Ideal Oral Health membership includes access to one of the largest dental discount networks in the nation, with a focus on neighborhood dentists and transparent, member-friendly pricing.
      </Text>

      <Text style={{ ...s.h4, color: GREEN, marginTop: 6 }}>Dental Discount Features:</Text>
      {[
        "Save 20% to 50% on most dental procedures including routine oral exams, unlimited cleanings and major work such as dentures, root canals and crowns",
        "20% savings on orthodontics including braces and retainers for children and adults",
        "20% reduction on specialists\u2019 normal fees. Specialties include endodontics, oral surgery, pediatric dentistry, periodontics, and prosthodontics where available",
        "Cosmetic dentistry such as bonding and veneers also included",
        "All dentists must meet highly selective credentialing standards based on education, background, license standing and other requirements",
      ].map((item) => (
        <Bullet key={item.slice(0, 40)} text={item} />
      ))}

      <Text style={{ ...s.h4, color: GREEN, marginTop: 12 }}>How to access the discount:</Text>
      {[
        "To locate a participating provider, please email support@getidealoh.com or visit getidealoh.com/health/dashboard to access the online provider search.",
        "When scheduling an appointment, please inform the participating provider\u2019s office you are a member of the Careington Dental Network.",
        "Please present your Careington ID card upon arrival to receive savings.",
        "The provider will collect payment at the time of service. You are responsible for paying the total bill, less the applicable savings, when service is provided.",
      ].map((item, index) => (
        <Text key={index} style={{ ...s.body, marginBottom: 8, marginLeft: 10 }}>
          <Text style={{ fontWeight: "bold" }}>Step {index + 1}: </Text>
          {item}
        </Text>
      ))}

      <Text style={{ fontSize: 8, fontFamily: "Helvetica-Oblique", color: GRAY, marginTop: 14, lineHeight: 1.5 }}>
        THIS PLAN IS NOT INSURANCE and is not intended to replace health insurance. This plan does not meet the minimum creditable coverage requirements under M.G.L. c.111M and 956 CMR 5.00. This plan is not a Qualified Health Plan under the Affordable Care Act. The range of discounts will vary depending on the type of provider and service. The plan does not pay providers directly. Plan members must pay for all services but will receive a discount from participating providers. The list of participating providers is at getidealoh.com/health/dashboard. A written list of participating providers is available upon request. You may cancel within the first 30 days after effective date or receipt of membership materials (whichever is later) and receive a full refund. Discount Plan Organization and administrator: Careington International Corporation, 7400 Gaylord Parkway, Frisco, TX 75034; phone 800-441-0380.{"\n\n"}This plan is not available in Vermont or Washington.
      </Text>

      <Text style={s.footer}>Ideal Oral Health | Dental Savings Network</Text>
    </Page>
  );
}

// ─── Page 3: DialCare Teledentistry ──────────────────────────────────────────
function DialCareSummaryPage({ data }: { data: FulfillmentPacketData }) {
  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader logoDataUri={data.logoDataUri} />

      <Text style={s.h2}>2. Teledentistry (DialCare)</Text>
      <Text style={s.body}>
        DialCare Teledentistry provides a comprehensive virtual dental solution. Teledentistry offers convenient, robust care through 24/7/365 virtual consultations with licensed dentists via phone or video session for advice and diagnoses on a wide variety of oral health ailments, urgent care, dental-related questions and second opinions. With Teledentistry, members can access the care they need on their schedule.
      </Text>

      <Text style={{ ...s.h4, color: GREEN, marginTop: 6 }}>Teledentistry dentists can advise on the following:</Text>
      {[
        "Oral pain",
        "Broken, chipped, sensitive or misaligned teeth",
        "Gum swelling and bleeding",
        "Sores, lesions, swelling or infections",
        "Orthodontia needs",
        "Provide expert second opinions to give peace of mind for oral health diagnoses and treatment options",
        "Provide clinically appropriate prescriptions for non-DEA controlled substances",
        "And much more",
      ].map((item) => (
        <Bullet key={item} text={item} />
      ))}

      <Text style={{ ...s.h4, color: GREEN, marginTop: 6 }}>When to use Teledentistry:</Text>
      {[
        "For non-emergency dental issues, questions and concerns",
        "When a member lives a significant distance from a dentist",
        "For second opinions on dental care",
        "When the member\u2019s primary dentist is unavailable",
        "When traveling within the U.S. and in need of dental care or guidance",
        "During or after normal business hours, nights, weekends and holidays",
        "To avoid unnecessary trips to the E.R.",
      ].map((item) => (
        <Bullet key={item} text={item} />
      ))}

      <Text style={{ ...s.h4, color: GREEN, marginTop: 6 }}>HOW TO ACCESS</Text>
      <Text style={s.body}>
        To register, the member simply follows the link in the confirmation email, downloads the DialCare mobile app or visits dialcare.com/verify. If they have any problems registering, members can contact DialCare for assistance at (855) 335-2255. Once registered, members can log in online at member.dialcare.com or through the mobile app to request consults or to update medical history.
      </Text>

      <View style={s.noticeBox}>
        <Text style={{ fontSize: 9, lineHeight: 1.4 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", color: ORANGE }}>Look for your DialCare email: </Text>
          <Text>
            Shortly after enrollment, you will receive a separate "Register Your Account" email directly from DialCare. Use this email to set up your teledentistry account. If you do not see it, check your spam/junk folder or contact DialCare at (855) 335-2255.
          </Text>
        </Text>
      </View>

      <Text style={s.bodySmall}>
        State availability may vary. Please visit dialcare.com/states for up-to-date information.
      </Text>

      <Text style={s.footer}>Ideal Oral Health | Teledentistry — DialCare</Text>
    </Page>
  );
}

// ─── Membership Agreement ────────────────────────────────────────────────────
function MembershipAgreementPage({ data }: { data: FulfillmentPacketData }) {
  const fields: [string, string][] = [
    ["Program", "Ideal Oral Health"],
    ["Group Code", data.groupCode],
    ["Member ID", data.memberId],
    ["Member Name", data.memberName],
    ["Address", data.memberAddress ?? "[ADDRESS]"],
    ["Email", data.memberEmail],
    ["Effective Date", data.effectiveDate],
    ["Term", data.term ?? "Annual"],
    ["Plan Name", data.planName],
  ];

  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader logoDataUri={data.logoDataUri} />

      <Text style={s.h2}>Membership Agreement</Text>

      {/* Member Information */}
      <SectionHeadingGreen text="Member Information" />
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

      {/* Intro */}
      <Text style={{ ...s.bodySmall, marginTop: 8 }}>
        The Terms and Conditions you have accepted or will accept upon registering at www.dialcare.com, are part of this membership agreement (Agreement) between you and DialCare, LLC (&quot;DialCare&quot;). DialCare provides administrative services to DialCare clinicians and does not provide professional medical services. The Terms and Conditions define the obligations of DialCare, its authorized agents and yourself, and they establish the basic rules of safe and fair use of DialCare&apos;s public website, member website, and services (Services). DialCare and its authorized agents reserve the right to immediately and without advance notice terminate the Services and deny access to individuals who do not abide by the Terms and Conditions.
      </Text>

      <Text style={s.bodySmall}>
        To add a family member to your plan or change mode of payment, contact Ideal Oral Health at support@getidealoh.com. For assistance using your plan, please call Member Services at 1-855-335-2255.
      </Text>

      {/* Purchase and Renewal Conditions */}
      <SectionHeadingGreen text="Purchase and Renewal Conditions" />
      <Text style={s.bodySmall}>
        By joining a plan, for yourself or on behalf of a minor child for whom you are a parent or legal guardian, you confirm that you are at least 18 years old and you authorize Ryze LLC to charge your credit card or checking account for the plan you have selected. By joining, you indicate you have read and agree to the terms and conditions of the plan.
      </Text>
      <Text style={s.bodySmall}>
        Payment Term: Members on a monthly plan are billed on a recurring monthly basis. Members on an annual plan are billed once per year for the full membership term. All plan benefits — including AI Dental Scan, Teledentistry, and Dental Savings Network — are included under both payment terms.
      </Text>
      <Text style={{ ...s.bodySmall, fontStyle: 'italic' }}>
        This charge will automatically renew at the end of your membership term, and your credit card or checking account will be automatically charged for the appropriate amount, until you notify Ideal Health that you wish to cancel the plan.
      </Text>

      {/* Termination Conditions */}
      <SectionHeadingGreen text="Termination Conditions" />
      <Text style={s.bodySmall}>
        Ryze LLC and DialCare reserve the right to terminate plan members from its plan for any reason, including non-payment. If Ryze LLC terminates the plan or your membership for a reason other than non-payment, you will receive a pro-rata refund of your membership fees.
      </Text>

      {/* Cancellation Conditions */}
      <SectionHeadingGreen text="Cancellation Conditions" />
      <Text style={s.bodySmall}>
        You have the right to cancel within the first 30 days after effective date or receipt of membership materials (whichever is later) and receive a full refund, less the processing fee, if applicable. If for any reason you wish to cancel, submit a cancellation request with your name and member ID by mail to Ryze LLC, 1200 E Ridge Rd STE 1, McAllen TX 78503, or email support@getidealoh.com. Ryze LLC will stop collecting membership fees in a reasonable amount of time, but no later than 30 days after receiving a cancellation request.
      </Text>
      <Text style={s.bodySmall}>
        When you cancel, you will continue to have access to the plan for the remainder of the period for which you have paid; your membership will terminate at the end of that period. The preceding sentence does not apply to quarterly, semi-annual or annual memberships in FL and OK, where you will receive a pro-rata refund whenever you cancel.
      </Text>

      {/* Description of Services */}
      <SectionHeadingGreen text="Description of Services" />
      <Text style={s.bodySmall}>
        Please see the enclosed materials for a specific description of the programs included in your plan.
      </Text>

      {/* Limitations, Exclusions and Exceptions */}
      <SectionHeadingGreen text="Limitations, Exclusions and Exceptions" />
      <Text style={s.bodySmall}>
        This is a discount plan offered by Careington. Careington is not a licensed insurer, health maintenance organization or other underwriter of health care services. This plan is not insurance. No portion of any provider&apos;s fees will be reimbursed or otherwise paid by Careington. Careington is not licensed to provide and does not provide health care services or items to individuals. You will receive discounts for services at certain health care providers who have contracted with the plan. You are obligated to pay for all health care services at the time of service. Savings are based upon the provider&apos;s normal fees. Actual savings will vary depending upon location and specific services or products purchased. Please verify such services with each individual provider. The plan&apos;s discounts may not be used in conjunction with any other discount plan or program. All listed or quoted prices are current prices by participating providers and subject to change without notice.
      </Text>
      <Text style={s.bodySmall}>
        Any procedures performed by a non-participating provider are not discounted. From time to time, certain providers may offer products or services to the general public at prices lower than the discounted prices available through this plan. In such event, members will be charged the lowest price. Discounts on professional services are not available when prohibited by law. This plan does not discount all procedures. Providers are subject to change without notice and services may vary in some states. It is your responsibility to verify that the provider participates in the plan. At any time Careington may substitute a provider network at its sole discretion. Careington cannot guarantee the continued participation of any provider. If the provider leaves the plan, you will need to select another provider. Providers contracted by Careington are solely responsible for the professional advice and treatment rendered to members and Careington disclaims any liability with respect to such matters.
      </Text>

      {/* Complaint Procedure */}
      <SectionHeadingGreen text="Complaint Procedure" />
      <Text style={s.bodySmall}>
        If you would like to file a complaint, you must submit your complaint in writing to:
      </Text>
      <View style={{ backgroundColor: DISCLOSURE_BG, padding: 6, marginBottom: 4 }}>
        <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>DialCare</Text>
        <Text style={{ fontSize: 9 }}>P.O. Box 2568</Text>
        <Text style={{ fontSize: 9 }}>Frisco, TX 75034</Text>
      </View>
      <Text style={s.bodySmall}>
        You have the right to request an appeal if you are dissatisfied with the complaint resolution. After completing the complaint resolution process, if you remain dissatisfied you may contact your state insurance department. Contact information for your state insurance department is available upon request.
      </Text>

      <Text style={s.footer}>Ideal Oral Health | Membership Agreement</Text>
    </Page>
  );
}

// ─── Page 6: Schedule of Services ────────────────────────────────────────────
function SchedulePage({ data }: { data: FulfillmentPacketData }) {
  const phone = data.memberServicesPhone ?? "support@getidealoh.com";

  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader logoDataUri={data.logoDataUri} />

      <Text style={s.h2}>Sample Schedule of Services</Text>
      <Text style={{ fontSize: 9, fontFamily: "Helvetica-Oblique", color: GRAY, marginBottom: 8 }}>
        Abbreviated sample schedule of discounted member-pay amounts. Confirm codes and pricing
        against the current fee schedule before use.
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

// ─── Member Card Styles ────────────────────────────────────────────────────────
const cardStyles = StyleSheet.create({
  // Title Page
  titlePage: {
    fontFamily: "Helvetica",
    fontSize: 12,
    color: DARK,
    padding: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    textAlign: "center",
  },
  titleLogo: {
    width: 100,
    height: 100,
    marginBottom: 20,
    marginLeft: "auto",
    marginRight: "auto",
  },
  titleMain: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: BLUE,
    marginBottom: 10,
  },
  titleSub: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    marginBottom: 30,
  },
  titleField: {
    marginBottom: 20,
  },
  titleLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: GRAY,
    marginBottom: 5,
  },
  titleValue: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: BLUE,
  },
  // Card Pages - designed for 8.5x11 printing with card in center
  cardPage: {
    padding: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  bleedContainer: {
    width: "3.75in",
    height: "2.375in",
    backgroundColor: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.125in",
  },
  cardContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    padding: 18,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    overflow: "hidden",
    position: "relative",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: "#0066CC",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    flex: 1,
  },
  logo: {
    width: 40,
    height: 40,
  },
  headerText: {
    flex: 1,
  },
  brandName: {
    fontSize: 10.5,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 1,
  },
  cardType: {
    fontSize: 7,
    color: "#64748b",
  },
  headerRight: {
    fontSize: 6.5,
    color: "#94a3b8",
    textAlign: "right",
  },
  headerRightLine: {
    marginBottom: 2,
  },
  fieldsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 2,
  },
  field: {
    width: "50%",
    marginBottom: 6,
    paddingRight: 6,
  },
  fieldLabel: {
    fontSize: 5.5,
    fontWeight: "bold",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  fieldValue: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#0f172a",
  },
  memberId: {
    fontFamily: "Courier",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
    marginTop: 4,
    textAlign: "center",
  },
  footerMain: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#0f172a",
    letterSpacing: 0.4,
  },
  footerSub: {
    fontSize: 5.5,
    color: "#94a3b8",
    marginTop: 1,
  },
  // Back side
  backContent: {
    flex: 1,
    justifyContent: "flex-start",
  },
  backSection: {
    marginBottom: 8,
  },
  backSectionTitle: {
    fontSize: 7,
    fontWeight: "bold",
    color: BLUE,
    marginBottom: 3,
    textTransform: "uppercase",
  },
  backText: {
    fontSize: 6.5,
    color: DARK,
    lineHeight: 1.3,
    marginBottom: 2,
  },
});

interface MemberCardField {
  label: string;
  value: string;
}

// Title page with member name and ID
function MemberCardTitlePage({ data }: { data: FulfillmentPacketData }) {
  return (
    <Page style={cardStyles.titlePage} size="LETTER">
      <View style={cardStyles.titleContainer}>
        {data.logoDataUri && (
          <Image
            src={data.logoDataUri}
            style={cardStyles.titleLogo}
          />
        )}
        <Text style={cardStyles.titleMain}>Member ID Card</Text>
        <Text style={cardStyles.titleSub}>Ideal Oral Health</Text>

        <View style={cardStyles.titleField}>
          <Text style={cardStyles.titleLabel}>Member Name</Text>
          <Text style={cardStyles.titleValue}>{data.memberName}</Text>
        </View>

        <View style={cardStyles.titleField}>
          <Text style={cardStyles.titleLabel}>Member ID</Text>
          <Text style={cardStyles.titleValue}>{data.memberId}</Text>
        </View>
      </View>
    </Page>
  );
}

// Front of card
function MemberCardFrontPage({ data }: { data: FulfillmentPacketData }) {
  const fields: MemberCardField[] = [
    { label: "Member", value: data.memberName },
    { label: "Member ID", value: data.memberId },
    { label: "Group Code", value: data.groupCode || "IDEALDO" },
    { label: "Effective", value: data.effectiveDate },
  ];

  return (
    <Page style={cardStyles.cardPage} size="LETTER">
      <View style={cardStyles.bleedContainer}>
        <View style={cardStyles.cardContainer}>
          <View style={cardStyles.topBar} />

          {/* Header with logo and contact info */}
          <View style={cardStyles.header}>
            <View style={cardStyles.headerLeft}>
              {data.logoDataUri && (
                <Image
                  src={data.logoDataUri}
                  style={cardStyles.logo}
                />
              )}
              <View style={cardStyles.headerText}>
                <Text style={cardStyles.brandName}>Ideal Oral Health</Text>
                <Text style={cardStyles.cardType}>Member ID Card</Text>
              </View>
            </View>
            <View style={cardStyles.headerRight}>
              <Text style={cardStyles.headerRightLine}>{data.memberWebsite}</Text>
              <Text style={cardStyles.headerRightLine}>{data.memberServicesPhone}</Text>
            </View>
          </View>

          {/* Fields grid */}
          <View style={cardStyles.fieldsGrid}>
            {fields.map((field, idx) => (
              <View key={idx} style={cardStyles.field}>
                <Text style={cardStyles.fieldLabel}>{field.label}</Text>
                <Text style={[cardStyles.fieldValue, field.label === "Member ID" ? cardStyles.memberId : {}]}>
                  {field.value}
                </Text>
              </View>
            ))}
          </View>

          {/* Footer */}
          <View style={cardStyles.footer}>
            <Text style={cardStyles.footerMain}>THIS IS NOT INSURANCE.</Text>
            <Text style={cardStyles.footerSub}>This is a discount program. Savings vary by provider.</Text>
          </View>
        </View>
      </View>
    </Page>
  );
}

// Back of card - matches dashboard card back exactly
function MemberCardBackPage({ data }: { data: FulfillmentPacketData }) {
  const website = data.memberWebsite ?? "www.getidealoh.com";
  const phone = data.memberServicesPhone ?? "support@getidealoh.com";

  return (
    <Page style={cardStyles.cardPage} size="LETTER">
      <View style={cardStyles.bleedContainer}>
        <View style={cardStyles.cardContainer}>
          {/* Top bar gradient */}
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            backgroundColor: BLUE,
          }} />

          {/* Networks section - matching dashboard layout */}
          <View style={{ marginTop: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 6.5, fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>
              Networks &amp; Services
            </Text>

            {/* Teledentistry - DialCare */}
            <View style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 7.5, fontWeight: 'bold', color: DARK, flex: 1 }}>
                  Teledentistry — DialCare
                </Text>
                <Text style={{ fontSize: 6.5, color: '#94a3b8', marginLeft: 4 }}>
                  support@getidealoh.com
                </Text>
              </View>
              <Text style={{ fontSize: 6.5, color: '#475569', marginTop: 1 }}>
                www.dialcare.com
              </Text>
            </View>

            {/* Dental Discount Network */}
            <View style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 7.5, fontWeight: 'bold', color: DARK, flex: 1 }}>
                  Dental Discount Network
                </Text>
                <Text style={{ fontSize: 6.5, color: '#94a3b8', marginLeft: 4 }}>
                  {phone}
                </Text>
              </View>
              <Text style={{ fontSize: 6.5, color: '#475569', marginTop: 1 }}>
                {website.replace('https://', '')}
              </Text>
            </View>

            {/* AI Oral Scan */}
            <View>
              <Text style={{ fontSize: 7.5, fontWeight: 'bold', color: DARK }}>
                AI Oral Scan
              </Text>
              <Text style={{ fontSize: 6.5, color: '#475569', marginTop: 1 }}>
                www.getidealoh.com
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View style={{
            borderTopWidth: 1,
            borderTopColor: '#e2e8f0',
            paddingTop: 6,
            marginTop: 8,
            textAlign: 'center',
          }}>
            <Text style={{ fontSize: 6.5, fontWeight: 'bold', color: DARK, letterSpacing: 0.2 }}>
              THIS IS NOT INSURANCE. IT IS A DISCOUNT PROGRAM.
            </Text>
          </View>
        </View>
      </View>
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
      <AIScanningSummaryPage data={data} />
      <DialCareSummaryPage data={data} />
      <ProgramSummaryPage data={data} />
      <MemberCardTitlePage data={data} />
      <MemberCardFrontPage data={data} />
      <MemberCardBackPage data={data} />
    </Document>
  );
}

export function MembershipAgreementPdf({ data }: { data: FulfillmentPacketData }) {
  return (
    <Document
      title={`Ideal Oral Health Membership Agreement - ${data.memberName}`}
      author="Ideal Oral Health"
      subject="Membership Agreement"
    >
      <MembershipAgreementPage data={data} />
    </Document>
  );
}

export function MemberCardPdf({ data }: { data: FulfillmentPacketData }) {
  return (
    <Document
      title={`Ideal Oral Health Member Card - ${data.memberName}`}
      author="Ideal Oral Health"
      subject="Member Card"
    >
      <MemberCardTitlePage data={data} />
      <MemberCardFrontPage data={data} />
      <MemberCardBackPage data={data} />
    </Document>
  );
}
