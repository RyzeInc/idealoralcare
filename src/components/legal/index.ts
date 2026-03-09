/**
 * Legal & Compliance Components
 * Centralized exports for membership agreements, terms, disclosures, and checkout flow
 */

// React Components
export { MembershipAgreementModal } from "./MembershipAgreementModal";
export { TermsAndConditionsModal } from "./TermsAndConditionsModal";
export { FooterDisclosure } from "./FooterDisclosure";
export { CheckoutFlow } from "./CheckoutFlow";

// Types
export interface MemberData {
  memberId: string;
  memberName: string;
  memberAddress: string;
  email: string;
  planName: string;
  groupCode: string;
  effectiveDate: string;
}

export interface AgreementData {
  membershipTermsSigned: boolean;
  termsAndConditionsAgreed: boolean;
  memberSignature: string;
}
