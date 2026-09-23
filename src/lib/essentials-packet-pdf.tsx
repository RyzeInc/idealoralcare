import React from "react";
import { Document, Page, Text, View, Image } from "@react-pdf/renderer";
import {
  s,
  cardStyles,
  Bullet,
  Numbered,
  PageHeader,
  BLUE,
  GREEN,
  ORANGE,
  DARK,
  GRAY,
  LIGHT_BLUE,
  LIGHT_GREEN,
} from "@/lib/pdf-theme";
import {
  ESSENTIALS_BFL_GROUP_NUMBER,
  ESSENTIALS_BFL_MEMBER_CODE,
  ESSENTIALS_RX_BIN,
  ESSENTIALS_RX_GROUP,
  ESSENTIALS_RX_PCN,
} from "@/lib/constants";

/**
 * IDEAL HEALTH ESSENTIALS — MEMBER FULFILLMENT PACKET
 *
 * Content is consolidated from the source material Benefits Horizon supplied
 * (Notes/GIH Notes/essentials_notes/): the 2025 Essentials Benefits Guide,
 * telehealth.pdf and the three Lyric "How To Use" sheets. Those documents
 * overlap heavily, so each section here carries the best version of a given
 * fact exactly once rather than repeating it per vendor brochure.
 *
 * The Balance for Life welcome letter is NOT reproduced here — it is appended
 * verbatim after these pages (see essentials-packet-assets.ts) because it
 * carries App Store / Google Play QR codes we have no source URLs for.
 */

// ─── Vendor codes ────────────────────────────────────────────────────────────
// Identical for every member. Kept in one block so a correction is a one-line
// change rather than a hunt through page copy.
export const ESSENTIALS_VENDOR_CODES = {
  lyric: {
    name: "Lyric Health",
    phone: "1.866.223.8831",
    url: "www.getlyric.com",
    app: "Lyric Health App",
  },
  rxValet: {
    name: "RxValet",
    phone: "(855) 798-2538",
    url: "www.myrxvalet.com",
    rxGroup: ESSENTIALS_RX_GROUP,
    rxBin: ESSENTIALS_RX_BIN,
    pcn: ESSENTIALS_RX_PCN,
  },
  questSelect: {
    name: "QuestSelect",
    labLine: "1.800.646.7788",
  },
  balanceForLife: {
    name: "Balance for Life",
    phone: "833-354-2691",
    ttd: "833-354-2691",
    email: "info@balanceforlifebh.com",
    url: "https://balanceforlifebh.com",
    // Two distinct BFL identifiers, not alternatives:
    //   groupNumber — "CMG", the same for every enrolling member (Benefits
    //                 Horizon, May 27). Equivalent to the "Group ID" field on
    //                 the BFL employee flyer.
    //   memberCode  — "Ideal", as printed on the BFL welcome letter that is
    //                 appended to this packet. Both are shown so a member
    //                 quoting either one is recognised.
    groupNumber: ESSENTIALS_BFL_GROUP_NUMBER,
    memberCode: ESSENTIALS_BFL_MEMBER_CODE,
    zenn: "1-561-559-ZENN",
  },
} as const;

export const ESSENTIALS_SUPPORT = {
  phone: "844-433-2502",
  email: "info@getidealhealth.com",
  website: "www.getidealhealth.com",
  hours: "Mon – Fri: 9am – 6pm",
} as const;

/** True when a catalog product slug belongs to the Essentials program. */
export function isEssentialsSlug(slug?: string | null): boolean {
  return typeof slug === "string" && slug.startsWith("essentials-");
}

/** "essentials-employee-spouse" -> "Employee + Spouse" */
export function essentialsCoverageLabel(slug?: string | null): string {
  if (!isEssentialsSlug(slug)) return "Employee";
  const suffix = slug!.slice("essentials-".length);
  return (
    {
      employee: "Employee",
      "employee-spouse": "Employee + Spouse",
      "employee-child": "Employee + Child",
      "employee-family": "Employee + Family",
    }[suffix] ?? "Employee"
  );
}

// ─── Data type ───────────────────────────────────────────────────────────────
export interface EssentialsPacketData {
  memberName: string;
  memberFirstName: string;
  memberEmail: string;
  /** 9-digit number Lyric and QuestSelect look the member up by. */
  essentialsMemberNumber: string;
  /** 6-digit group number used for vendor tracking. */
  essentialsGroupNumber: string;
  planName: string;
  coverageType?: string;
  effectiveDate: string;
  term?: string;
  memberAddress?: string;
  periodicCharge?: string;
  logoDataUri?: string;
}

const BRAND = "IDEAL HEALTH";

function Footer({ label }: { label: string }) {
  return (
    <Text fixed style={s.footer}>
      Ideal Health Essentials | {label}
    </Text>
  );
}

/** Label/value pair used by the vendor contact strips. */
function ContactStrip({ items }: { items: { label: string; value: string }[] }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 8 }}>
      {items.map((item) => (
        <View key={item.label} style={{ ...s.metaBox, width: `${100 / items.length}%`, marginRight: 4 }}>
          <Text style={s.metaLabel}>{item.label}</Text>
          <Text style={s.metaValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Page 1: Welcome letter ──────────────────────────────────────────────────
function WelcomePage({ data }: { data: EssentialsPacketData }) {
  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader logoDataUri={data.logoDataUri} fallbackLabel={BRAND} />

      <Text style={{ ...s.h1, textAlign: "center" }}>Member Welcome Packet</Text>
      <Text style={{ fontSize: 10, color: GRAY, textAlign: "center", marginBottom: 12 }}>
        Ideal Health Essentials — Virtual Care · Pharmacy · Labs · Behavioral Health
      </Text>

      <ContactStrip
        items={[
          { label: "Program Name", value: "Ideal Health Essentials" },
          { label: "Member Number", value: data.essentialsMemberNumber },
          { label: "Effective Date", value: data.effectiveDate },
        ]}
      />

      <View style={s.noticeBox}>
        <Text style={{ fontSize: 10 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", color: ORANGE }}>Important: </Text>
          <Text>
            This is a membership program and is NOT insurance. It does not satisfy the Affordable
            Care Act minimum essential coverage requirement and does not cover basic medical needs.
          </Text>
        </Text>
      </View>

      <Text style={{ ...s.h3, marginTop: 6 }}>Welcome Letter</Text>

      {[data.essentialsMemberNumber, data.memberName, data.memberAddress ?? "[STREET ADDRESS]"].map(
        (line, i) => (
          <Text key={i} style={{ fontSize: 10, marginBottom: 0 }}>
            {line}
          </Text>
        ),
      )}

      <Text style={{ fontSize: 10, marginTop: 8, marginBottom: 6 }}>Dear {data.memberFirstName},</Text>

      {[
        `Welcome to Ideal Health. We are committed to providing high-quality, non-insurance benefit plans tailored to your needs, with the goal of offering peace of mind through affordable and effective health benefit solutions.`,
        `This is not a traditional insurance policy — it works differently than what you may be used to. Each benefit has its own procedure and its own contact, and this packet explains what to do and who to call for each one. Please keep it for your records.`,
        `For help using your benefits, contact Member Services at ${ESSENTIALS_SUPPORT.phone} or ${ESSENTIALS_SUPPORT.email}, ${ESSENTIALS_SUPPORT.hours}.`,
      ].map((para) => (
        <Text key={para.slice(0, 40)} style={s.body}>
          {para}
        </Text>
      ))}

      <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: GREEN, marginBottom: 3 }}>
        Included in this packet:
      </Text>
      {[
        "How to use your benefits — which provider to contact for what",
        "Virtual Care (Lyric), Pharmacy (RxValet), Labs (QuestSelect) and Behavioral Health (Balance for Life)",
        "Your Member ID card, front and back",
      ].map((item) => (
        <Bullet key={item} text={item} />
      ))}

      <Text style={{ ...s.h4, marginTop: 10, marginBottom: 4, color: GREEN }}>
        How to Access Your Benefits
      </Text>
      <View style={{ backgroundColor: LIGHT_GREEN, padding: 8, marginBottom: 8, borderRadius: 4 }}>
        {[
          {
            n: 1,
            text: `Keep your Member Number (${data.essentialsMemberNumber}) handy. Lyric Telehealth and QuestSelect both identify you by this number.`,
          },
          {
            n: 2,
            text: `Register with each provider you plan to use. RxValet registration steps are on the pharmacy page.`,
          },
          {
            n: 3,
            text: `Contact the provider for the benefit you need — the next page shows which one to call. Unsure where to start? Call Member Services at ${ESSENTIALS_SUPPORT.phone}.`,
          },
        ].map((item) => (
          <Numbered key={item.n} n={item.n} text={item.text} />
        ))}
      </View>

      <Text style={{ ...s.h4, marginTop: 10, marginBottom: 6 }}>Member Summary</Text>
      {[
        ["Member Name", data.memberName, "Member Number", data.essentialsMemberNumber],
        ["Group Number", data.essentialsGroupNumber, "Coverage", data.coverageType ?? "Employee"],
        ["Plan", data.planName, "Effective Date", data.effectiveDate],
        ["Term", data.term ?? "Monthly", "Member Services", ESSENTIALS_SUPPORT.phone],
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

      <Footer label={`Welcome Packet | ${data.effectiveDate}`} />
    </Page>
  );
}

// ─── Page 2: How to use your benefits ────────────────────────────────────────
const BENEFIT_ROUTES = [
  {
    need: "I FEEL SICK AND NEED TO TALK TO A DOCTOR",
    provider: "Lyric Health — Virtual Care",
    detail: `Call ${ESSENTIALS_VENDOR_CODES.lyric.phone}, use the ${ESSENTIALS_VENDOR_CODES.lyric.app}, or visit ${ESSENTIALS_VENDOR_CODES.lyric.url}. Available 24/7/365 for urgent care; primary care and dermatology are also included.`,
  },
  {
    need: "I NEED A PRESCRIPTION",
    provider: "RxValet — Pharmacy Savings",
    detail: `Register at ${ESSENTIALS_VENDOR_CODES.rxValet.url} using your Member Number and Rx Group ${ESSENTIALS_VENDOR_CODES.rxValet.rxGroup}. Questions: ${ESSENTIALS_VENDOR_CODES.rxValet.phone}. Always present your RxValet card at the pharmacy first.`,
  },
  {
    need: "I NEED BLOOD DRAWN OR LAB SERVICE",
    provider: "QuestSelect — Laboratory Testing",
    detail: `Tell your doctor's office and the Quest Diagnostics lab that you are a QuestSelect member and give them your Member Number. Lab Line: ${ESSENTIALS_VENDOR_CODES.questSelect.labLine}.`,
  },
  {
    need: "I NEED MENTAL HEALTH OR WELLBEING SUPPORT",
    provider: "Balance for Life — Member Support Program",
    detail: `Call ${ESSENTIALS_VENDOR_CODES.balanceForLife.phone} (TTD/TTY same number), email ${ESSENTIALS_VENDOR_CODES.balanceForLife.email}, or visit ${ESSENTIALS_VENDOR_CODES.balanceForLife.url}. Group Number: ${ESSENTIALS_VENDOR_CODES.balanceForLife.groupNumber} · Member Code: ${ESSENTIALS_VENDOR_CODES.balanceForLife.memberCode}.`,
  },
];

function HowToUseBenefitsPage({ data }: { data: EssentialsPacketData }) {
  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader logoDataUri={data.logoDataUri} fallbackLabel={BRAND} />

      <Text style={s.h2}>How to Use Your Essential Benefits</Text>
      <Text style={s.body}>
        Below is which service provider to contact depending on what you need. Each benefit has its
        own procedure and its own contact — there is no single number that routes all of them.
      </Text>

      <View style={s.noticeBox}>
        <Text style={{ fontSize: 9.5 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", color: ORANGE }}>Have this ready: </Text>
          <Text>
            Your Member Number {data.essentialsMemberNumber} and Group Number{" "}
            {data.essentialsGroupNumber}. Lyric and QuestSelect identify you by the Member Number.
          </Text>
        </Text>
      </View>

      {BENEFIT_ROUTES.map((route) => (
        <View
          key={route.need}
          style={{ backgroundColor: LIGHT_BLUE, padding: 10, marginBottom: 8, borderRadius: 4 }}
        >
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: BLUE, marginBottom: 2 }}>
            {route.need}
          </Text>
          <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold", color: GREEN, marginBottom: 3 }}>
            {route.provider}
          </Text>
          <Text style={{ fontSize: 9.5, lineHeight: 1.45 }}>{route.detail}</Text>
        </View>
      ))}

      <Text style={{ ...s.h4, marginTop: 6 }}>Keep in Mind</Text>
      {[
        "This is not your traditional insurance policy — it is a new approach to affordable healthcare and it works differently than what you may be used to.",
        "Each benefit is delivered by a third-party organization. Register with each one before you need it, so you are not doing paperwork while you are unwell.",
        "Your Member ID card at the back of this packet carries every number you need in one place.",
      ].map((item) => (
        <Bullet key={item} text={item} small />
      ))}

      <Footer label="How to Use Your Benefits" />
    </Page>
  );
}

// ─── Page 3: Virtual care — urgent + primary ─────────────────────────────────
function VirtualCarePage({ data }: { data: EssentialsPacketData }) {
  const { lyric } = ESSENTIALS_VENDOR_CODES;
  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader logoDataUri={data.logoDataUri} fallbackLabel={BRAND} />

      <Text style={s.h2}>Virtual Care — Lyric Health</Text>
      <Text style={s.body}>
        Convenient, affordable access to licensed physicians from your phone, tablet or computer.
        No waiting rooms. Roughly 70% of low-acuity illnesses can be treated virtually.
      </Text>

      <ContactStrip
        items={[
          { label: "Call", value: lyric.phone },
          { label: "Online", value: lyric.url },
          { label: "App", value: lyric.app },
        ]}
      />

      {/* Virtual Urgent Care */}
      <Text style={{ ...s.h3, marginTop: 4 }}>Virtual Urgent Care — 24/7/365</Text>
      <Text style={s.bodySmall}>
        Get seen now for non-emergency conditions, any time of day or night.
      </Text>
      {[
        { n: 1, text: `Call | Tap | Click — call ${lyric.phone}, use the app, or visit ${lyric.url} to schedule a consultation with a state-licensed physician.` },
        { n: 2, text: "Triage — you speak to a Care Coordinator who triages and updates your Electronic Health Record (EHR)." },
        { n: 3, text: "Consult — the physician recommends a treatment plan; any prescription is sent electronically to your pharmacy." },
      ].map((step) => (
        <Numbered key={step.n} n={step.n} text={step.text} />
      ))}
      <Text style={{ ...s.h4, marginTop: 6, marginBottom: 2, color: GREEN }}>
        Common conditions treated
      </Text>
      <Text style={{ fontSize: 9, lineHeight: 1.45, marginBottom: 8 }}>
        Cold &amp; flu symptoms · Sinus problems · Ear infection · Allergies · Urinary tract
        infection · Nausea · Pink eye · Stomach viruses · Infections · Rashes · Sore throat · Acne ·
        Recommendations · Second opinions and more
      </Text>

      {/* Virtual Primary Care */}
      <Text style={{ ...s.h3, marginTop: 4 }}>Virtual Primary Care — Scheduled</Text>
      <Text style={s.bodySmall}>
        Establish a dedicated Virtual Primary Care Physician to manage your ongoing health,
        medications and preventative care over time — without visiting a doctor&apos;s office.
      </Text>
      {[
        { n: 1, text: `Call | Tap | Click — schedule via ${lyric.url} or the ${lyric.app}.` },
        { n: 2, text: "Schedule — choose your preferred provider, date and time, update your EHR, and receive confirmation reminders before your appointment." },
        { n: 3, text: "Consult — the physician contacts you at your scheduled time by phone or video." },
      ].map((step) => (
        <Numbered key={step.n} n={step.n} text={step.text} />
      ))}
      <Text style={{ ...s.h4, marginTop: 6, marginBottom: 2, color: GREEN }}>Services provided</Text>
      {[
        "Establishment of a Virtual Primary Care Physician",
        "Management of health conditions over time",
        "Medication management, including on-going refills",
        "Lab tests and routine screening",
        "Health assessment screening & evaluation",
        "Review and interpretation of lab test results and screenings",
        "In-network recommendations and referrals for specialty care",
      ].map((item) => (
        <Bullet key={item} text={item} small />
      ))}

      <Footer label="Virtual Care — Urgent & Primary" />
    </Page>
  );
}

// ─── Page 4: Dermatology + when to use + access ──────────────────────────────
function DermatologyPage({ data }: { data: EssentialsPacketData }) {
  const { lyric } = ESSENTIALS_VENDOR_CODES;
  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader logoDataUri={data.logoDataUri} fallbackLabel={BRAND} />

      <Text style={s.h2}>Virtual Dermatology — 72-Hour Response</Text>
      <Text style={s.body}>
        Board-certified dermatologists treat and diagnose hundreds of common skin, nail and hair
        conditions, and help manage chronic skin conditions. No more waiting weeks for an
        appointment — you receive a treatment plan, and a prescription if needed, within 72 hours of
        intake.
      </Text>

      {[
        { n: 1, text: `Log in to request a consult — use the ${lyric.app} or visit ${lyric.url} to log into your member portal. Available 24/7/365.` },
        { n: 2, text: "Upload three images — describe the condition and upload at least three clear photos." },
        { n: 3, text: "Dermatologist review — the dermatologist reviews your consultation details, health records and images within 72 hours and provides a treatment plan." },
        { n: 4, text: "Prescription — sent electronically to your local pharmacy when necessary." },
      ].map((step) => (
        <Numbered key={step.n} n={step.n} text={step.text} />
      ))}

      <Text style={{ ...s.h4, marginTop: 8, marginBottom: 2, color: GREEN }}>
        Common skin conditions
      </Text>
      <Text style={{ fontSize: 9, lineHeight: 1.45, marginBottom: 8 }}>
        Athlete&apos;s foot · Cold sores · Eczema · Ringworm · Poison ivy · Shingles · Acne ·
        Psoriasis · Rosacea · Rash · Skin infections and much more
      </Text>

      <Text style={{ ...s.h3, marginTop: 4 }}>When to Use Virtual Care</Text>
      {[
        "When you need care now",
        "When you have a health-related question and just need professional guidance",
        "When you are considering the ER or an urgent care center for a non-emergency issue",
        "When you are on vacation, a business trip, or away from home",
      ].map((item) => (
        <Bullet key={item} text={item} />
      ))}

      <Text style={{ ...s.h3, marginTop: 10 }}>Three Ways to Access Care</Text>
      <View style={{ flexDirection: "row", marginTop: 4, marginBottom: 8 }}>
        {[
          { title: "Lyric Health App", body: "Download from the App Store or Google Play and log into your member portal." },
          { title: "Member Portal", body: `Log in and schedule at any time from any device at ${lyric.url}.` },
          { title: "Call Direct", body: `Speak with a Care Coordinator right away — no app needed. ${lyric.phone}.` },
        ].map((item) => (
          <View key={item.title} style={s.contactCell}>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: BLUE, marginBottom: 2 }}>
              {item.title}
            </Text>
            <Text style={{ fontSize: 8.5, lineHeight: 1.35 }}>{item.body}</Text>
          </View>
        ))}
      </View>

      <View style={s.disclosureBox}>
        <Text style={{ fontSize: 8, lineHeight: 1.4, color: GRAY }}>
          <Text style={{ fontFamily: "Helvetica-Bold", color: DARK }}>Important notes: </Text>
          Licensed healthcare providers provide clinical services through medical practices
          affiliated with Lyric and other network providers. Additional or different telehealth
          requirements may apply in certain states; see {lyric.url} for full terms and conditions.
          Dermatology: AR, AZ, IA, ID and IN require scheduled video consultations. Those who are
          pregnant, trying to become pregnant, or nursing are not eligible for online dermatology
          visits. Lyric Health does not guarantee that a prescription will be written and does not
          prescribe DEA controlled substances, lifestyle drugs, or certain other drugs which may be
          harmful because of their potential for abuse. Lyric Health physicians reserve the right to
          deny care for potential misuse of services. Lyric Health operates subject to state
          regulations.
        </Text>
      </View>

      <Footer label="Virtual Care — Dermatology" />
    </Page>
  );
}

// ─── Page 5: Pharmacy — RxValet ──────────────────────────────────────────────
function PharmacyPage({ data }: { data: EssentialsPacketData }) {
  const { rxValet } = ESSENTIALS_VENDOR_CODES;
  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader logoDataUri={data.logoDataUri} fallbackLabel={BRAND} />

      <Text style={s.h2}>Pharmacy — RxValet</Text>
      <Text style={s.body}>
        RxValet gives you several options to obtain your medications — local pharmacy pricing, mail
        order, and access to Prescription Assistance Programs that can significantly reduce your
        cost. The application process is simple and quick.
      </Text>

      <ContactStrip
        items={[
          { label: "Rx Group", value: rxValet.rxGroup },
          { label: "Rx BIN", value: rxValet.rxBin },
          { label: "PCN", value: rxValet.pcn },
        ]}
      />

      <Text style={{ ...s.h3, marginTop: 4 }}>How to Register</Text>
      {[
        { n: 1, text: `Go to ${rxValet.url}.` },
        { n: 2, text: "Choose Login / Register, then click ‘Register Now.’" },
        { n: 3, text: `Enter your Member Number (${data.essentialsMemberNumber}) and the Rx Group number ${rxValet.rxGroup}.` },
        { n: 4, text: "Review your card and check that your information is correct. ALWAYS present this card at the pharmacy first." },
        { n: 5, text: `Bookmark ${rxValet.url} so you receive important emails from RxValet.` },
        { n: 6, text: `If you need to contact RxValet, call ${rxValet.phone}.` },
      ].map((step) => (
        <Numbered key={step.n} n={step.n} text={step.text} />
      ))}

      <View style={{ backgroundColor: LIGHT_GREEN, padding: 10, marginTop: 10, marginBottom: 8, borderRadius: 4 }}>
        <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: GREEN, marginBottom: 3 }}>
          Fee Schedule
        </Text>
        <Bullet text="1,000+ acute and chronic generic medications for $0" />
        <Bullet text="GLP-1 weight loss medications start at $249.95" />
      </View>

      <Text style={{ ...s.h3, marginTop: 4 }}>Programs Included</Text>
      {[
        ["Prescription Assistance Programs", "Income-based. Not all medications qualify, but when one does it is clearly displayed. A short online form determines eligibility."],
        ["International Pharmacy", "Lowest pricing for brand-name medications, often 70% off retail, sourced from Tier 1 countries such as Canada and Australia."],
        ["340b Drug Pricing Program", "A state and local avenue to obtain medications at a 25%–50% discount."],
        ["Home Delivery", "The mail-order pharmacy obtains the prescription from your doctor or pharmacy and completes the order, typically with no shipping or handling fees."],
        ["Insulin Program", "A flat-rate path for insulin and diabetes-related medications — all insulin, regardless of brand, starting under $95 a month."],
        ["Diabetic Supply Management", "Volume pricing through the mail-order pharmacy on the supplies that make monitoring costly."],
        ["Prior Authorizations", "RxValet handles prior authorizations and assists with ordering through its integrated programs."],
      ].map(([title, body]) => (
        <View key={title} style={{ marginBottom: 5 }}>
          <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold", color: BLUE }}>{title}</Text>
          <Text style={{ fontSize: 9, lineHeight: 1.4 }}>{body}</Text>
        </View>
      ))}

      <Footer label="Pharmacy — RxValet" />
    </Page>
  );
}

// ─── Page 6: Labs — QuestSelect ──────────────────────────────────────────────
function LabsPage({ data }: { data: EssentialsPacketData }) {
  const { questSelect } = ESSENTIALS_VENDOR_CODES;
  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader logoDataUri={data.logoDataUri} fallbackLabel={BRAND} />

      <Text style={s.h2}>Laboratory Testing — QuestSelect</Text>
      <Text style={s.body}>
        The Quest Diagnostics Advanced Lab Program, QuestSelect, lets you obtain outpatient
        laboratory testing at no cost to you. When you use QuestSelect you have a $0 copay for over
        1,200 different blood, urine, cytology, pathology and culture tests.
      </Text>

      <ContactStrip
        items={[
          { label: "Lab Line", value: questSelect.labLine },
          { label: "Your Member Number", value: data.essentialsMemberNumber },
          { label: "Copay", value: "$0 — 1,200+ tests" },
        ]}
      />

      <Text style={{ ...s.h3, marginTop: 4 }}>How to Use It</Text>
      {[
        { n: 1, text: "When your doctor orders lab testing, tell the receptionist at your doctor's office — and at the Quest Diagnostics lab — that you are a QuestSelect member." },
        { n: 2, text: `Give them your Member Number (${data.essentialsMemberNumber}). This is how Quest Diagnostics knows not to bill you for the care.` },
        { n: 3, text: `If your doctor has given you a written lab order, call the Lab Line at ${questSelect.labLine} to schedule your visit.` },
        { n: 4, text: `If your doctor's office draws your blood in the office and does not use Quest, ask them to call the Quest Diagnostics Lab Line at ${questSelect.labLine} to pick up your test sample.` },
      ].map((step) => (
        <Numbered key={step.n} n={step.n} text={step.text} />
      ))}

      <View style={s.noticeBox}>
        <Text style={{ fontSize: 9.5 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", color: ORANGE }}>Note: </Text>
          <Text>
            This is a subscription program and is NOT insurance. It provides outpatient laboratory
            testing at no out-of-pocket cost when you present your QuestSelect membership and ask to
            use QuestSelect.
          </Text>
        </Text>
      </View>

      <Text style={{ ...s.h3, marginTop: 4 }}>What QuestSelect Does Not Cover</Text>
      {[
        "Testing ordered during hospitalization",
        "Lab work needed on an emergency or STAT basis",
        "Testing completed at another laboratory",
        "Time-sensitive esoteric testing such as fertility testing, bone marrow studies and spinal fluid tests",
        "Genetic lab tests",
      ].map((item) => (
        <Bullet key={item} text={item} />
      ))}

      <Footer label="Laboratory Testing — QuestSelect" />
    </Page>
  );
}

// ─── Page 7: Behavioral health lead-in (BFL letter is appended after) ────────
function BehavioralHealthPage({ data }: { data: EssentialsPacketData }) {
  const { balanceForLife } = ESSENTIALS_VENDOR_CODES;
  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader logoDataUri={data.logoDataUri} fallbackLabel={BRAND} />

      <Text style={s.h2}>Behavioral Health &amp; Wellbeing — Balance for Life</Text>
      <Text style={s.body}>
        Balance for Life is your Member Support Program: a confidential, 24/7 service covering
        emotional, mental and overall wellbeing. It is staffed by professionals with expertise in
        wellbeing, family matters, relationships, debt management, employment issues and consumer
        rights.
      </Text>

      <ContactStrip
        items={[
          { label: "Toll-Free / TTD / TTY", value: balanceForLife.phone },
          { label: "Group Number", value: balanceForLife.groupNumber },
          { label: "Member Code", value: balanceForLife.memberCode },
        ]}
      />

      <Text style={{ ...s.h3, marginTop: 4 }}>What Is Included</Text>
      {[
        ["Short-Term Counseling", "Up to 10 no-cost sessions per individual, per incident — telephonically, in person, or by video."],
        ["Live Answer 24/7", "Immediate, unlimited support with a counselor whenever you need it most."],
        ["Chat with ZENN", "A 24/7/365 AI chatbot for safe, non-judgmental support across anxiety, depression, chronic pain, eating disorders, loneliness, relationships, resilience, substance abuse, trauma and PTSD."],
        ["Aware Mindfulness", "A six-week mindfulness journey to build self-awareness and emotional balance."],
        ["Life, Work-Life & Wellness Coaching", "Virtual support for personal and professional growth, practical research on everyday challenges, and self-directed wellness programs."],
        ["Preferred Provider Network", "Inpatient and outpatient care including residential treatment with withdrawal management. Available at additional self-pay cost or through your own insurance."],
      ].map(([title, body]) => (
        <View key={title} style={{ marginBottom: 5 }}>
          <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold", color: BLUE }}>{title}</Text>
          <Text style={{ fontSize: 9, lineHeight: 1.4 }}>{body}</Text>
        </View>
      ))}

      <View style={{ backgroundColor: LIGHT_BLUE, padding: 10, marginTop: 6, borderRadius: 4 }}>
        <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold", color: BLUE, marginBottom: 3 }}>
          How to get started
        </Text>
        <Text style={{ fontSize: 9, lineHeight: 1.45 }}>
          Call {balanceForLife.phone}, email {balanceForLife.email}, or visit{" "}
          {balanceForLife.url}. Give Group Number {balanceForLife.groupNumber} or Member Code{" "}
          {balanceForLife.memberCode} when asked to identify your program. You can also text ZENN
          at {balanceForLife.zenn}. The Balance for Life welcome letter on the following pages
          includes the App Store and Google Play codes for the BFL app.
        </Text>
      </View>

      <View style={{ ...s.disclosureBox, marginTop: 8 }}>
        <Text style={{ fontSize: 8, lineHeight: 1.4, color: GRAY }}>
          Balance for Life is not an Affordable Care Act compliant plan. It is not medical coverage
          and does not cover basic medical needs. Preferred Provider Network services are at
          additional self-pay cost or through the participant&apos;s insurance — participants should
          check with their insurer regarding coverage.
        </Text>
      </View>

      <Footer label="Behavioral Health — Balance for Life" />
    </Page>
  );
}

// ─── Member ID card pages ────────────────────────────────────────────────────
function MemberCardTitlePage({ data }: { data: EssentialsPacketData }) {
  return (
    <Page size="LETTER" style={cardStyles.titlePage}>
      <View style={cardStyles.titleContainer}>
        {data.logoDataUri ? <Image style={cardStyles.titleLogo} src={data.logoDataUri} /> : null}
        <Text style={cardStyles.titleMain}>Your Member ID Card</Text>
        <Text style={cardStyles.titleSub}>Ideal Health Essentials</Text>

        <View style={cardStyles.titleField}>
          <Text style={cardStyles.titleLabel}>MEMBER</Text>
          <Text style={cardStyles.titleValue}>{data.memberName}</Text>
        </View>
        <View style={cardStyles.titleField}>
          <Text style={cardStyles.titleLabel}>MEMBER NUMBER</Text>
          <Text style={cardStyles.titleValue}>{data.essentialsMemberNumber}</Text>
        </View>
      </View>
    </Page>
  );
}

function MemberCardFrontPage({ data }: { data: EssentialsPacketData }) {
  const fields = [
    { label: "Member", value: data.memberName },
    { label: "Member Number", value: data.essentialsMemberNumber },
    { label: "Group Number", value: data.essentialsGroupNumber },
    { label: "Coverage", value: data.coverageType ?? "Employee" },
    { label: "Plan", value: data.planName },
    { label: "Effective", value: data.effectiveDate },
  ];

  return (
    <Page size="LETTER" style={cardStyles.cardPage}>
      <View style={cardStyles.bleedContainer}>
        <View style={cardStyles.cardContainer}>
          <View style={cardStyles.topBar} />

          <View style={cardStyles.header}>
            <View style={cardStyles.headerLeft}>
              {data.logoDataUri ? <Image style={cardStyles.logo} src={data.logoDataUri} /> : null}
              <View style={cardStyles.headerText}>
                <Text style={cardStyles.brandName}>Ideal Health</Text>
                <Text style={cardStyles.cardType}>Essentials Member Card</Text>
              </View>
            </View>
            <View style={cardStyles.headerRight}>
              <Text style={cardStyles.headerRightLine}>{ESSENTIALS_SUPPORT.website}</Text>
              <Text>{ESSENTIALS_SUPPORT.phone}</Text>
            </View>
          </View>

          <View style={cardStyles.fieldsGrid}>
            {fields.map((field) => (
              <View key={field.label} style={cardStyles.field}>
                <Text style={cardStyles.fieldLabel}>{field.label}</Text>
                <Text
                  style={
                    field.label.includes("Number")
                      ? { ...cardStyles.fieldValue, ...cardStyles.memberId }
                      : cardStyles.fieldValue
                  }
                >
                  {field.value}
                </Text>
              </View>
            ))}
          </View>

          <View style={cardStyles.footer}>
            <Text style={cardStyles.footerMain}>THIS IS NOT INSURANCE.</Text>
            <Text style={cardStyles.footerSub}>
              A membership program. Not ACA minimum essential coverage.
            </Text>
          </View>
        </View>
      </View>
    </Page>
  );
}

function MemberCardBackPage({ data }: { data: EssentialsPacketData }) {
  const { lyric, rxValet, questSelect, balanceForLife } = ESSENTIALS_VENDOR_CODES;
  return (
    <Page size="LETTER" style={cardStyles.cardPage}>
      <View style={cardStyles.bleedContainer}>
        <View style={cardStyles.cardContainer}>
          <View style={cardStyles.topBar} />

          <View style={cardStyles.backContent}>
            <View style={cardStyles.backSection}>
              <Text style={cardStyles.backSectionTitle}>Virtual Care — Lyric</Text>
              <Text style={cardStyles.backText}>
                {lyric.phone} · {lyric.url} · Member No. {data.essentialsMemberNumber}
              </Text>
            </View>

            <View style={cardStyles.backSection}>
              <Text style={cardStyles.backSectionTitle}>Pharmacy — RxValet</Text>
              <Text style={cardStyles.backText}>
                Rx Group {rxValet.rxGroup} · BIN {rxValet.rxBin} · PCN {rxValet.pcn}
              </Text>
              <Text style={cardStyles.backText}>
                {rxValet.phone} · {rxValet.url}
              </Text>
            </View>

            <View style={cardStyles.backSection}>
              <Text style={cardStyles.backSectionTitle}>Labs — QuestSelect</Text>
              <Text style={cardStyles.backText}>
                Lab Line {questSelect.labLine} · Member No. {data.essentialsMemberNumber}
              </Text>
            </View>

            <View style={cardStyles.backSection}>
              <Text style={cardStyles.backSectionTitle}>Behavioral Health — Balance for Life</Text>
              <Text style={cardStyles.backText}>
                {balanceForLife.phone} · Group {balanceForLife.groupNumber} · Member Code{" "}
                {balanceForLife.memberCode}
              </Text>
            </View>
          </View>

          <View style={cardStyles.footer}>
            <Text style={cardStyles.footerMain}>THIS IS NOT INSURANCE.</Text>
            <Text style={cardStyles.footerSub}>
              Member Services {ESSENTIALS_SUPPORT.phone} · {ESSENTIALS_SUPPORT.website}
            </Text>
          </View>
        </View>
      </View>
    </Page>
  );
}

// ─── Membership agreement ────────────────────────────────────────────────────
function MembershipAgreementPage({ data }: { data: EssentialsPacketData }) {
  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader logoDataUri={data.logoDataUri} fallbackLabel={BRAND} />

      <Text style={{ ...s.h1, textAlign: "center" }}>Membership Agreement</Text>
      <Text style={{ fontSize: 10, color: GRAY, textAlign: "center", marginBottom: 10 }}>
        Ideal Health Essentials — Terms and Conditions
      </Text>

      {[
        ["Program", "Ideal Health Essentials"],
        ["Member Name", data.memberName],
        ["Member Number", data.essentialsMemberNumber],
        ["Group Number", data.essentialsGroupNumber],
        ["Email", data.memberEmail],
        ["Address", data.memberAddress ?? "—"],
        ["Plan", data.planName],
        ["Coverage", data.coverageType ?? "Employee"],
        ["Monthly Charge", data.periodicCharge ?? "—"],
        ["Effective Date", data.effectiveDate],
      ].map(([label, value]) => (
        <View key={label} style={{ flexDirection: "row", marginBottom: 2 }}>
          <View style={s.fieldLabelCell}>
            <Text style={s.summaryLabelText}>{label}</Text>
          </View>
          <View style={s.fieldValueCell}>
            <Text style={s.summaryValueText}>{value}</Text>
          </View>
        </View>
      ))}

      <Text style={{ ...s.h4, marginTop: 10 }}>Agreement</Text>
      <Text style={s.bodySmall}>
        These terms and conditions (&quot;Terms&quot;) outline the agreement between you
        (&quot;Member&quot;) and Ideal Health Essentials (&quot;Provider&quot;) regarding the Ideal
        Health Essentials Monthly Membership Plan (&quot;Membership Plan&quot;). By enrolling in the
        Membership Plan, you acknowledge that you have read, understood and agree to these Terms.
      </Text>

      <Text style={{ ...s.h4, marginTop: 6 }}>Plan Details</Text>
      <Text style={s.bodySmall}>
        This Membership Plan is NOT insurance and does not satisfy ACA minimum essential coverage.
        The Membership Plan does not cover any additional medical services or treatments beyond what
        is explicitly stated in the plan documents. Telehealth and discount programs are provided
        through third-party organizations and are not connected to the Essentials provider.
      </Text>
      <Text style={s.bodySmall}>
        Individuals ages 2 to 65 are eligible for Ideal Health membership. Dependents under the age
        of two are not eligible. Dependent children are eligible until the last day of their 25th
        year. Individuals are eligible until the last day of their 64th year.
      </Text>

      <Text style={{ ...s.h4, marginTop: 6 }}>Payment and Billing</Text>
      {[
        "By enrolling, you authorize Provider to charge your payment method automatically each month.",
        "All charges are processed in the currency specified at the time of enrollment.",
        "It is your responsibility to ensure your payment information remains up to date.",
        "The billing cycle commences on the 16th day of each calendar month and continues for one calendar month, concluding on the 15th day of the following month.",
        "The effective date is the first day of the month following the billing cycle during which the member enrolled and paid for the plan.",
      ].map((item) => (
        <Bullet key={item} text={item} small />
      ))}

      <Footer label="Membership Agreement (1 of 2)" />
    </Page>
  );
}

function MembershipAgreementPage2({ data }: { data: EssentialsPacketData }) {
  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader logoDataUri={data.logoDataUri} fallbackLabel={BRAND} />

      <Text style={{ ...s.h2, marginBottom: 8 }}>Membership Agreement (continued)</Text>
      <Text style={{ fontSize: 9, color: GRAY, marginBottom: 8 }}>
        {data.memberName} · Member Number {data.essentialsMemberNumber}
      </Text>

      <Text style={{ ...s.h4, marginTop: 0 }}>Cancellation Policy</Text>
      {[
        "To cancel, notify Provider by email at support@getidealoh.com.",
        "Cancellation requests must be received at least 30 days in advance to avoid charges for the following month.",
        "Requests received within less than 30 days will result in a charge for the subsequent month.",
        "Provider will send a confirmation email upon receipt of your cancellation request.",
      ].map((item) => (
        <Bullet key={item} text={item} small />
      ))}

      <Text style={{ ...s.h4, marginTop: 6 }}>Termination or Modification by Provider</Text>
      {[
        "Provider reserves the right to terminate or modify the Membership Plan with 30 days prior notice.",
        "Non-payment results in cancellation of the plan on the last day of the month.",
        "A Member is in default if their payment method fails and they do not provide an alternative method by the close of business at the end of the billing cycle.",
      ].map((item) => (
        <Bullet key={item} text={item} small />
      ))}

      <View style={{ ...s.disclosureBox, marginTop: 8 }}>
        <Text style={{ fontSize: 8, lineHeight: 1.4, color: GRAY }}>
          <Text style={{ fontFamily: "Helvetica-Bold", color: DARK }}>
            Limitation of liability and governing law.{" "}
          </Text>
          Provider shall not be liable for any indirect, incidental, special, consequential or
          punitive damages arising out of the Membership Plan or its termination. Provider&apos;s
          liability is limited to the total amount paid by the Member during the three-month period
          immediately preceding the claim. These Terms are governed by and construed in accordance
          with the laws of the jurisdiction in which Provider operates.
        </Text>
      </View>

      <Footer label="Membership Agreement (2 of 2)" />
    </Page>
  );
}

// ─── Root documents ──────────────────────────────────────────────────────────
export function EssentialsPacketPdf({ data }: { data: EssentialsPacketData }) {
  return (
    <Document
      title="Ideal Health Essentials Member Welcome Packet"
      author="Ideal Health"
      subject="Member Welcome Packet"
    >
      <WelcomePage data={data} />
      <HowToUseBenefitsPage data={data} />
      <VirtualCarePage data={data} />
      <DermatologyPage data={data} />
      <PharmacyPage data={data} />
      <LabsPage data={data} />
      <BehavioralHealthPage data={data} />
      <MemberCardTitlePage data={data} />
      <MemberCardFrontPage data={data} />
      <MemberCardBackPage data={data} />
    </Document>
  );
}

export function EssentialsMembershipAgreementPdf({ data }: { data: EssentialsPacketData }) {
  return (
    <Document
      title={`Ideal Health Essentials Membership Agreement - ${data.memberName}`}
      author="Ideal Health"
      subject="Membership Agreement"
    >
      <MembershipAgreementPage data={data} />
      <MembershipAgreementPage2 data={data} />
    </Document>
  );
}

export function EssentialsMemberCardPdf({ data }: { data: EssentialsPacketData }) {
  return (
    <Document
      title={`Ideal Health Essentials Member Card - ${data.memberName}`}
      author="Ideal Health"
      subject="Member Card"
    >
      <MemberCardTitlePage data={data} />
      <MemberCardFrontPage data={data} />
      <MemberCardBackPage data={data} />
    </Document>
  );
}
