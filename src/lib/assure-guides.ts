import type { ServiceKey } from "./assure-content";
export const GUIDES: Record<
  string,
  {
    title: string;
    intro: string;
    key: ServiceKey;
    sections: [string, string][];
  }
> = {
  "preparing-for-a-virtual-visit": {
    title: "Preparing for a virtual medical visit",
    intro:
      "A little preparation can make a remote appointment easier to navigate.",
    key: "virtual-care",
    sections: [
      [
        "Choose the right service",
        "Use virtual urgent care for an eligible everyday concern, primary care for ongoing care, or the dermatology process for a skin concern. Check your provider instructions for visit availability and requirements.",
      ],
      [
        "Have your information ready",
        "Keep your member number, a current medication list and a clear description of your symptoms nearby. For a video visit, find a quiet space and check your connection.",
      ],
      [
        "Understand your next step",
        "Ask the clinician about follow-up care and any recommended prescription or test. A recommendation does not automatically make an outside service or medication part of your membership.",
      ],
    ],
  },
  "planning-your-lab-visit": {
    title: "Planning a lab visit with QuestSelect",
    intro:
      "Confirm the order, participating location and member details before your appointment.",
    key: "labs",
    sections: [
      [
        "Start with the order",
        "Tell your provider that you use QuestSelect and follow the program’s ordering instructions. Confirm that the requested test is eligible before it is performed.",
      ],
      [
        "Check the location",
        "Use the provider’s current location and appointment information. Ask whether your chosen location can process your tests under QuestSelect.",
      ],
      [
        "Present the right information",
        "Take your Essentials member number and the instructions in your packet. Contact the program if a bill or processing question does not match what you expected.",
      ],
    ],
  },
  "checking-your-prescription-savings": {
    title: "Checking your prescription savings",
    intro:
      "Know the medication, pharmacy and expected price before a prescription is filled.",
    key: "pharmacy",
    sections: [
      [
        "Check the current list",
        "RxValet has an eligible medication list and separate savings options. A medicine’s presence in one program does not guarantee that every form, dose or quantity has the same price.",
      ],
      [
        "Confirm the pharmacy process",
        "Use the registration and card details in your packet. Ask the pharmacy to check your program information before the medication is processed.",
      ],
      [
        "Compare the final cost",
        "Ask about your actual out-of-pocket cost and any available delivery options. Clinical decisions and medication changes belong with your prescribing professional.",
      ],
    ],
  },
  "getting-started-with-balance-for-life": {
    title: "Getting started with Balance for Life",
    intro:
      "Find the path that fits: everyday wellbeing resources, live support or counseling.",
    key: "balance-for-life",
    sections: [
      [
        "Set up access before you need it",
        "Once your membership is effective, follow the app registration instructions in your welcome packet. Keep your assigned member code private and available when accessing the program.",
      ],
      [
        "Choose human or app-based support",
        "Zenn is an AI wellness companion in the app. It is distinct from a licensed counselor. Use the program’s live support and counseling pathways when you want professional help.",
      ],
      [
        "Understand the included sessions",
        "The program describes up to 10 short-term counseling sessions per life event, subject to its terms and availability. Referred longer-term or inpatient care may have additional costs.",
      ],
    ],
  },
  "getting-started-with-oral-scanning": {
    title: "Getting started with AI oral scanning",
    intro:
      "Use a smartphone screening as a starting point for discussing your oral health.",
    key: "oral-health-scan",
    sections: [
      [
        "Follow the guided photos",
        "Open Oral Scan in your member portal. Follow the lighting, framing and photo instructions rather than guessing which pictures to upload.",
      ],
      [
        "Read the report in context",
        "The screening looks at visible information. It cannot replace an examination, X-rays or a dentist’s clinical judgment.",
      ],
      [
        "Choose a professional next step",
        "Discuss concerns with a licensed dental professional. If you need in-person care, check participating providers and fees before your visit.",
      ],
    ],
  },
  "using-teledentistry": {
    title: "Using a virtual dental consultation",
    intro:
      "Understand what a remote dentist can help with and when an in-person visit is still needed.",
    key: "teledentistry",
    sections: [
      [
        "Describe the concern clearly",
        "Have your member details ready and describe what changed, when it started and the information the dentist asks for. Follow the program’s consultation process.",
      ],
      [
        "Know the limits of a virtual visit",
        "Advice can help you choose a next step, but a remote consultation cannot perform a cleaning, filling or extraction. Prescribing depends on the assessment and applicable rules.",
      ],
      [
        "Follow the care recommendation",
        "A recommendation for in-person care is separate from the consultation. Confirm provider participation and the cost of treatment before arranging it.",
      ],
    ],
  },
  "understanding-dental-discounts": {
    title: "Understanding your dental discounts",
    intro:
      "A dental discount membership helps you access participating providers’ member rates. It works differently from insurance.",
    key: "discount",
    sections: [
      [
        "Confirm participation",
        "Check the current directory and confirm with the dental office that it participates in your specific program before making an appointment.",
      ],
      [
        "Ask about the procedure fee",
        "Savings depend on the treatment, provider and location. Ask for the member fee and an estimate before receiving care rather than relying on a headline percentage.",
      ],
      [
        "Pay the provider directly",
        "The discount program does not reimburse claims or pay the dentist for you. Bring your member materials and follow the office’s payment process. Review program and state availability restrictions.",
      ],
    ],
  },
};
