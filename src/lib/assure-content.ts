/** Public service information. Membership ownership and vendor identifiers remain server-side. */
export const ASSURE_NAME = "AssureVantage";
export const ASSURE_URL = "https://www.assurevantage.com";
export const ASSURE_DESCRIPTION =
  "Everyday healthcare access, mental wellbeing and oral care. Explore AssureVantage memberships, understand your benefits and find the support you need.";
export const START_DATE_NOTE =
  "Your welcome packet and member card show your benefit effective date. Enrollment and payment confirmation do not mean every provider service is immediately available. Check that date before arranging care.";
export const BFL_SESSION_NOTE =
  "Up to 10 short-term counseling sessions per life event, subject to the program’s terms and provider availability.";
export type ServiceKey =
  | "virtual-care"
  | "labs"
  | "pharmacy"
  | "balance-for-life"
  | "oral-health-scan"
  | "teledentistry"
  | "discount";
export type Service = {
  title: string;
  label: string;
  eyebrow: string;
  intro: string;
  image: string;
  included: string;
  items: string[];
  steps: string[];
  limits: string;
  faq: [string, string][];
};
export const SERVICES: Record<ServiceKey, Service> = {
  "virtual-care": {
    title: "A doctor’s visit that fits your day.",
    label: "Virtual care",
    eyebrow: "Lyric Health · Included in Essentials",
    image: "virtual-medicine.png",
    intro:
      "Talk with a clinician from your phone or computer. Essentials brings virtual urgent care, primary care and dermatology together, so getting help can fit around work and family.",
    included:
      "Included with Essentials. It is not part of a standalone Oral Care or Balance for Life membership.",
    items: [
      "Virtual urgent care for everyday concerns such as a cold, sinus symptoms or a rash",
      "Virtual primary care for an ongoing relationship, follow-up visits and routine health concerns",
      "Virtual dermatology with photos reviewed by a clinician",
      "Prescriptions when clinically appropriate and permitted",
    ],
    steps: [
      "Find your Lyric instructions and member number in your Essentials welcome packet.",
      "Register with Lyric and choose the appropriate visit type.",
      "Speak with a clinician or submit your dermatology information, then follow their care instructions.",
    ],
    limits:
      "Virtual visits cannot replace all in-person care. Appointment availability, clinical eligibility and prescription rules apply. Medication, testing or treatment outside the included service may have separate costs. This is not emergency care.",
    faq: [
      [
        "Is this the same as teledentistry?",
        "No. Lyric provides virtual medical care through Essentials. Oral Care includes a separate virtual dental consultation service.",
      ],
      [
        "Are my prescriptions included?",
        "A clinician may prescribe when appropriate. The prescription itself is subject to pharmacy pricing and the RxValet program; receiving a prescription does not guarantee a no-cost medication.",
      ],
    ],
  },
  labs: {
    title: "A clearer path to routine lab work.",
    label: "Lab services",
    eyebrow: "QuestSelect · Included in Essentials",
    image: "lab-services.png",
    intro:
      "Essentials includes eligible lab services through QuestSelect. Understand the ordering process before your appointment so your doctor and lab use the right program.",
    included:
      "Included with Essentials. Use your Essentials member number for QuestSelect.",
    items: [
      "Access to eligible laboratory services through the QuestSelect program",
      "A network of Quest Diagnostics patient service locations",
      "Lab work ordered by your healthcare provider under program rules",
      "Member instructions explaining what to present at the lab",
    ],
    steps: [
      "Tell your ordering provider that you are a QuestSelect member.",
      "Confirm that the ordered tests and chosen location participate in the program.",
      "Give the lab your Essentials member number and follow the QuestSelect instructions in your packet.",
    ],
    limits:
      "Eligible tests must follow QuestSelect’s ordering and processing rules. Tests or services outside the program may be billed separately. Confirm eligibility before testing; an Essentials membership does not make every possible test free.",
    faq: [
      [
        "Can I walk in and request any test?",
        "Start with the provider-order and eligibility instructions in your packet. Confirm the required order and appointment process with QuestSelect before visiting.",
      ],
      [
        "Which number should I use?",
        "Use the Essentials member number shown on your member materials, rather than a different dental or website account identifier.",
      ],
    ],
  },
  pharmacy: {
    title: "Make sense of your prescription savings.",
    label: "Prescription savings",
    eyebrow: "RxValet · Included in Essentials",
    image: "pharmacy-pic.png",
    intro:
      "RxValet combines an eligible medication program with prescription discounts. Check the current medication list and pharmacy instructions to understand what you will pay.",
    included:
      "Included with Essentials. Eligibility and medication availability are determined by the current RxValet program.",
    items: [
      "An eligible no-cost generic medication list",
      "Savings on other eligible prescriptions",
      "Program instructions for participating pharmacies and available delivery options",
      "Support for checking a medication before filling it",
    ],
    steps: [
      "Register using the RxValet instructions in your Essentials welcome packet.",
      "Check your medication against the current formulary and confirm pharmacy participation.",
      "Present the correct RxValet card before the prescription is processed and confirm the final price.",
    ],
    limits:
      "Not every medication is included or available at no cost. Formulary, pharmacy, delivery and clinical requirements apply. Specialty, brand-name, weight-management and other medications may have separate eligibility rules and costs. Confirm current pricing directly with RxValet.",
    faq: [
      [
        "Does this replace my health insurance?",
        "No. This is a membership benefit and prescription savings program, not insurance.",
      ],
      [
        "Why might a medication still cost money?",
        "It may be outside the included list or subject to different program terms. Check the current formulary and final pharmacy price before filling it.",
      ],
    ],
  },
  "balance-for-life": {
    title: "Support for the moments that feel heavy.",
    label: "Mental wellbeing",
    eyebrow: "Balance for Life · Standalone or included in Essentials",
    image: "mental-health-pic.png",
    intro:
      "A place to start when you need someone to talk to. Balance for Life brings live support, short-term counseling and an app for everyday wellbeing together.",
    included:
      "Included with Essentials, or available as its own monthly membership. You do not need to purchase it twice.",
    items: [
      BFL_SESSION_NOTE,
      "Live support by phone, available around the clock",
      "Zenn, an AI wellness companion within the Balance for Life app",
      "Wellbeing resources, coaching and referrals under the program’s terms",
    ],
    steps: [
      "Check your membership effective date and Balance for Life instructions.",
      "Download the Balance for Life app or use the support contact in your welcome packet.",
      "Use your assigned member code to access eligible support and request counseling when needed.",
    ],
    limits:
      "Zenn is an AI wellness companion, not a licensed therapist or an emergency service. Longer-term, inpatient, residential or other referred treatment may have additional costs. Availability and program terms apply. For immediate danger or a medical emergency, call emergency services.",
    faq: [
      [
        "Is Balance for Life already in Essentials?",
        "Yes. Essentials includes Balance for Life. The catalog removes the separate Balance for Life purchase when you add Essentials.",
      ],
      [
        "Is Zenn a text-message service?",
        "Zenn is accessed in the Balance for Life app. Follow the app instructions in your member packet.",
      ],
    ],
  },
  "oral-health-scan": {
    title: "Get a closer look at your oral health.",
    label: "AI oral scanning",
    eyebrow: "Included in Oral Care",
    image: "pinky-swear.png",
    intro:
      "Take guided photos with your smartphone to receive an oral-health screening report. It is a useful starting point for a conversation with a dental professional.",
    included:
      "Included with Oral Care. Oral Care is a separate membership from Essentials.",
    items: [
      "A guided smartphone photo process",
      "An AI-assisted screening report about visible oral-health concerns",
      "An oral-scan entry point in your member portal",
      "A next step toward professional dental advice",
    ],
    steps: [
      "Sign in to your member portal after your Oral Care benefit is effective.",
      "Open Oral Scan and follow the photo and lighting instructions.",
      "Review the report and discuss concerns with a licensed dental professional.",
    ],
    limits:
      "A screening report is not a diagnosis and does not replace dental examinations, X-rays or treatment. Photo quality and visible surfaces limit what can be assessed. A scan cannot rule out all dental conditions.",
    faq: [
      [
        "Do I need special equipment?",
        "Use a compatible smartphone camera and follow the in-app instructions. Good lighting and clear photos help the screening process.",
      ],
      [
        "Where do I start a scan?",
        "Sign in and open Oral Scan in your member portal. Public marketing pages explain the benefit; the scan itself is accessed through your account.",
      ],
    ],
  },
  teledentistry: {
    title: "Dental guidance, without the trip.",
    label: "Teledentistry",
    eyebrow: "DialCare · Included in Oral Care",
    image: "doctor-with-patients.png",
    intro:
      "Talk with a licensed dentist remotely about a dental concern. Virtual guidance can help you understand an appropriate next step when you are away from your usual dental office.",
    included:
      "Included with Oral Care. This is separate from the virtual medical care in Essentials.",
    items: [
      "Access to the program’s virtual dental consultation service",
      "Guidance about tooth pain, damaged teeth and other oral-health concerns",
      "Prescriptions when clinically appropriate and permitted",
      "Advice about when in-person dental care is needed",
    ],
    steps: [
      "Find your DialCare access instructions and member identifier.",
      "Request a consultation using the program’s phone or online service.",
      "Follow the dentist’s guidance, including any recommendation for an in-person visit.",
    ],
    limits:
      "Consultations do not include in-person procedures such as cleanings, fillings or extractions. Prescriptions depend on clinical assessment and applicable rules. Availability and program terms apply. Urgent or dangerous symptoms may require emergency services.",
    faq: [
      [
        "Can a virtual visit fix a tooth?",
        "A dentist can assess the information you provide and advise you. Procedures that require hands-on care still need an in-person appointment.",
      ],
      [
        "Does this include Lyric medical visits?",
        "No. Lyric medical visits are an Essentials benefit. Teledentistry is a separate Oral Care benefit.",
      ],
    ],
  },
  discount: {
    title: "Know your dental savings before you go.",
    label: "Dental discounts",
    eyebrow: "Careington network · Included in Oral Care",
    image: "care-workers.png",
    intro:
      "Access participating dentists who offer negotiated member rates. Check the provider and procedure before booking, then pay the participating dentist directly.",
    included:
      "Included with Oral Care. The discount program is not dental insurance.",
    items: [
      "Access to a participating dental discount network",
      "Negotiated rates for eligible procedures",
      "A provider-search entry point in your member portal",
      "Member materials to present at a participating dental office",
    ],
    steps: [
      "Search for a participating provider and confirm participation with the office.",
      "Ask for the current member fee for your planned treatment before scheduling.",
      "Present your member information and pay the provider directly at the discounted rate.",
    ],
    limits:
      "Savings vary by provider, location and procedure. The program does not pay claims or guarantee a particular saving. This dental discount program is not available in Vermont or Washington. Provider participation may change.",
    faq: [
      [
        "Will any dentist accept it?",
        "Only participating providers offer the program’s rates. Confirm participation and the relevant fee with the dental office before receiving care.",
      ],
      [
        "Is it insurance?",
        "No. You pay the provider directly. Refer to the Oral Care membership agreement and program disclosures for the full terms.",
      ],
    ],
  },
};
export const ASSURE_FAQS: [string, string][] = [
  [
    "What does AssureVantage offer?",
    "AssureVantage offers Essentials, standalone Balance for Life, and Oral Care memberships. Essentials includes virtual medical care, lab services, prescription savings and Balance for Life. Oral Care is a separate membership.",
  ],
  [
    "Is Oral Care included with Essentials?",
    "Oral Care is offered separately and can be added to Essentials. Its price is added to your total. Balance for Life, however, is already included with Essentials.",
  ],
  [
    "Is this health insurance?",
    "No. These are membership programs providing access to specified services and discounts. They do not replace major medical or dental insurance. Review the terms for the membership you select.",
  ],
  ["When can I use my benefits?", START_DATE_NOTE],
  [
    "Can my family join?",
    "Essentials has individual, spouse, child and family options. Oral Care offers individual and family options. Family eligibility and access follow each program’s membership terms. Check your selected tier before enrolling.",
  ],
  [
    "How do monthly and annual billing work?",
    "Essentials and Balance for Life use monthly billing. Eligible Oral Care memberships also offer annual billing. The catalog and checkout show the billing period and total for your selection.",
  ],
  [
    "How do I get help after enrolling?",
    "Your member packet contains the contact for each benefit. For Essentials and Balance for Life membership support, use info@getidealhealth.com or 844-433-2502. For Oral Care membership support, use support@getidealoh.com or (844) 679-9367.",
  ],
  [
    "How do I manage or cancel a membership?",
    "Sign in to your member portal and open Membership & billing. You can review your membership and access billing management. Cancellation timing, access through the paid period and any refund rights follow your membership agreement.",
  ],
];
export const ASSURE_PAGES: Record<
  string,
  { title: string; description: string }
> = {
  essentials: {
    title: "Essentials membership",
    description:
      "Virtual medical care, eligible lab services, prescription savings and Balance for Life in one monthly membership.",
  },
  "balance-for-life": {
    title: "Balance for Life",
    description:
      "Mental wellbeing, live support and short-term counseling. Available on its own and included with Essentials.",
  },
  oralcare: {
    title: "Oral Care membership",
    description:
      "AI oral screening, teledentistry and participating dental network discounts in one membership.",
  },
  "program-plans": {
    title: "Memberships & pricing",
    description:
      "Compare Essentials, Balance for Life and Oral Care. See membership options, included benefits and your selected total.",
  },
  plans: {
    title: "Oral Care plans",
    description:
      "Choose an individual or family Oral Care membership and compare billing options.",
  },
  faq: {
    title: "Questions & answers",
    description:
      "Understand membership benefits, family options, enrollment, billing and support across AssureVantage.",
  },
  "how-it-works": {
    title: "How membership works",
    description:
      "Explore your benefits, choose a membership, enroll and access your program instructions.",
  },
  compare: {
    title: "Compare memberships",
    description:
      "Understand which benefits are included and which memberships can be purchased together.",
  },
  blog: {
    title: "Guides & resources",
    description:
      "Practical guidance for using virtual care, pharmacy savings, labs, mental wellbeing and oral care.",
  },
  help: {
    title: "Member help",
    description:
      "Find the right AssureVantage membership and benefit support contacts.",
  },
  about: {
    title: "About AssureVantage",
    description:
      "Better access. Greater value. More peace of mind. Understand our membership approach to everyday care.",
  },
  "for-employers": {
    title: "For employers & brokers",
    description:
      "Explore the AssureVantage membership offering for teams and ask about employer and broker enrollment.",
  },
  terms: {
    title: "Membership terms & disclosures",
    description:
      "Important program disclosures and information about your AssureVantage membership agreement.",
  },
  privacy: {
    title: "Privacy policy",
    description:
      "How personal information is used to operate and support membership services.",
  },
};
for (const [key, service] of Object.entries(SERVICES))
  if (!ASSURE_PAGES[key])
    ASSURE_PAGES[key] = { title: service.label, description: service.intro };
export function assureProductName(name: string) {
  return name.replace(
    /Ideal Oral Health|Ideal Oral|Ideal Health|New Ideal|Ideal/g,
    "AssureVantage",
  );
}
