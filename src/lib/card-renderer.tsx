/**
 * SHARED MEMBER CARD RENDERER
 *
 * Pure rendering logic for member ID cards used across:
 * - Dashboard (React component with flip animation)
 * - Fulfillment emails (PDF attachment)
 * - Digital wallet passes (Apple Wallet, Google Pay, Samsung Pay)
 *
 * Card structure: Front side (member info) + Back side (networks/services)
 */

export interface MemberCardData {
  memberName: string;
  memberId: string;
  planName: string;
  effectiveDate: string;
  groupCode?: string;
  subscriberId?: string;
  networks: {
    careington: { name: string; memberUrl: string };
    dialCare: { name: string; memberUrl: string };
    toothlens: { name: string; memberUrl: string };
  };
  supportPhone: string;
  supportEmail: string;
}

/**
 * Rendered card sides for use in different contexts
 */
export interface RenderedCardSides {
  front: RenderedCardSide;
  back: RenderedCardSide;
}

export interface RenderedCardSide {
  type: 'front' | 'back';
  data: MemberCardData;
  fragments: {
    header: object;
    content: object[];
    footer: object;
  };
}

/**
 * Pure function: Render card front side structure for PDF or HTML
 * Returns all data needed to render without React state
 */
export function renderCardFront(cardData: MemberCardData): RenderedCardSide {
  return {
    type: 'front',
    data: cardData,
    fragments: {
      header: {
        logo: 'ideal-oral-health-logo.png',
        brandName: 'Ideal Oral Health',
        cardType: 'Member ID Card',
        website: 'www.getidealoh.com',
        phone: cardData.supportPhone,
      },
      content: [
        {
          label: 'Member',
          value: cardData.memberName,
          column: 1,
        },
        {
          label: 'Member ID',
          value: cardData.memberId,
          column: 2,
          isMemberId: true,
        },
        {
          label: 'Provider Group Code',
          value: cardData.groupCode || 'IDEALDO',
          column: 1,
        },
        {
          label: 'Effective',
          value: cardData.effectiveDate,
          column: 2,
        },
        {
          label: 'Plan',
          value: cardData.planName,
          column: 1,
        },
        {
          label: 'Subscriber ID',
          value: cardData.subscriberId || cardData.memberId,
          column: 2,
        },
      ],
      footer: {
        main: 'THIS IS NOT INSURANCE.',
        sub: 'This is a discount program. Savings vary by provider.',
      },
    },
  };
}

/**
 * Pure function: Render card back side structure
 * Returns all data needed to render networks and instructions
 */
export function renderCardBack(cardData: MemberCardData): RenderedCardSide {
  return {
    type: 'back',
    data: cardData,
    fragments: {
      header: {
        logo: 'ideal-oral-health-logo.png',
        brandName: 'Ideal Oral Health',
        cardType: 'Important Information',
      },
      content: [
        {
          section: 'Networks & Services',
          items: [
            {
              name: 'Teledentistry — DialCare',
              phone: '(800) 290-0523',
              website: cardData.networks.dialCare.memberUrl,
            },
            {
              name: 'Dental Discount Network',
              phone: cardData.supportPhone,
              website: cardData.networks.careington.memberUrl,
            },
            {
              name: 'AI Oral Scan',
              website: cardData.networks.toothlens.memberUrl,
            },
          ],
        },
        {
          section: 'How to Use',
          items: [
            '1. Present card at participating provider',
            '2. Mention you are an Ideal Oral Health member',
            '3. Ask about member discounts',
          ],
        },
      ],
      footer: {
        main: 'THIS IS NOT INSURANCE. IT IS A DISCOUNT PROGRAM.',
        website: 'www.getidealoh.com',
        supportEmail: cardData.supportEmail,
      },
    },
  };
}

/**
 * Render both sides of the card
 */
export function renderCardBothSides(cardData: MemberCardData): RenderedCardSides {
  return {
    front: renderCardFront(cardData),
    back: renderCardBack(cardData),
  };
}

/**
 * Format card data for wallet pass generation (Apple Wallet, Google Pay, Samsung Pay)
 * All three wallet formats need: member ID, name, effective date, networks, QR code, barcode
 */
export interface WalletPassData {
  memberName: string;
  memberId: string;
  barcode: string; // barcode data for scanning
  qrCode: string; // QR code URL pointing to member portal
  effectiveDate: string;
  expiryDate?: string;
  planName: string;
  supportPhone: string;
  networks: string[];
  logoUrl: string;
  stripImageUrl?: string;
}

export function prepareWalletPassData(cardData: MemberCardData): WalletPassData {
  return {
    memberName: cardData.memberName,
    memberId: cardData.memberId,
    barcode: cardData.memberId.toUpperCase(), // CODE128 barcode format
    qrCode: `https://getidealoh.com/member/${cardData.memberId}/card`,
    effectiveDate: cardData.effectiveDate,
    planName: cardData.planName,
    supportPhone: cardData.supportPhone,
    networks: [
      cardData.networks.dialCare.name,
      cardData.networks.careington.name,
      cardData.networks.toothlens.name,
    ],
    logoUrl: 'https://getidealoh.com/logo.png',
    stripImageUrl: 'https://getidealoh.com/card-strip.png',
  };
}

/**
 * CSS/style constants for consistent card rendering
 */
export const CARD_STYLES = {
  colors: {
    primary: '#0066CC',
    secondary: '#14b8a6',
    dark: '#0f172a',
    gray: '#94a3b8',
    lightGray: '#e2e8f0',
    background: '#f8fafc',
  },
  spacing: {
    cardPadding: '1.5rem',
    fieldGap: '0.75rem 1.5rem',
  },
  border: {
    radius: '14px',
    color: '#cbd5e1',
  },
  text: {
    label: { fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase' },
    value: { fontSize: '0.9375rem', fontWeight: 700 },
  },
};

/**
 * Convert fulfillment packet data to member card data
 * Used by PDF generation and wallet pass creation
 */
export function fulfillmentToCardData(fulfillmentData: {
  memberName: string;
  memberId: string;
  planName: string;
  effectiveDate: string;
  groupCode: string;
  subscriberId?: string;
  memberServicesPhone?: string;
  memberWebsite?: string;
  memberEmail?: string;
}): MemberCardData {
  const phone = fulfillmentData.memberServicesPhone || '(800) 290-0523';
  const website = fulfillmentData.memberWebsite || 'www.getidealoh.com';
  const email = fulfillmentData.memberEmail || 'support@getidealoh.com';

  return {
    memberName: fulfillmentData.memberName,
    memberId: fulfillmentData.memberId,
    planName: fulfillmentData.planName,
    effectiveDate: fulfillmentData.effectiveDate,
    groupCode: fulfillmentData.groupCode,
    subscriberId: fulfillmentData.subscriberId,
    networks: {
      careington: {
        name: 'Dental Discount Network',
        memberUrl: website,
      },
      dialCare: {
        name: 'DialCare Teledentistry',
        memberUrl: 'https://dialcare.com',
      },
      toothlens: {
        name: 'AI Oral Scan',
        memberUrl: 'https://www.getidealoh.com',
      },
    },
    supportPhone: phone,
    supportEmail: email,
  };
}
