/**
 * ENROLLMENT WIZARD TYPES
 * 
 * Defines the complete state machine, actions, and configuration
 * for the multi-step enrollment wizard flow.
 */

// ============================================
// ENROLLMENT STEP DEFINITIONS
// ============================================

export type EnrollmentStep = 
  | "eligibility"
  | "plans"
  | "personal-info"
  | "payment"
  | "review"
  | "confirmation";

// ============================================
// HIERARCHY CONTEXT (From Convex schema)
// ============================================

export interface SiteContext {
  _id?: string;
  slug: string;
  name: string;
  type: "primary" | "whitelabel" | "channel";
  domain?: string;
  basePath?: string;
  branding?: {
    logoUrl?: string;
    logoStorageId?: string;
    faviconUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    heroHeadline?: string;
    heroSubtext?: string;
    heroImageUrl?: string;
    customCSS?: string;
    footerText?: string;
  };
  allowedPlanIds?: string[];
  defaultCadence?: "monthly" | "annual";
  defaultPaymentMethod?: "card" | "ach";
  enrollmentDefaults?: {
    requireGroupCode: boolean;
    requireEligibilityMatch: boolean;
    allowSelfEnrollment: boolean;
    requirePayment: boolean;
    autoActivate: boolean;
    collectAddress: boolean;
    collectPhone: boolean;
    collectEmployeeId: boolean;
    collectDependents?: boolean;
    termsDocumentUrl?: string;
    privacyPolicyUrl?: string;
    welcomeMessage?: string;
    supportEmail?: string;
    supportPhone?: string;
  };
  status?: "onboarding" | "active" | "suspended" | "terminated";
}

export interface AccountContext {
  _id?: string;
  siteId?: string;
  slug: string;
  name: string;
  accountType: "individual" | "employer" | "broker" | "channel_partner" | "internal";
  billingModel?: "direct" | "per_member" | "monthly_flat";
  contacts?: Array<{
    name: string;
    email: string;
    role: string;
  }>;
  status?: "onboarding" | "active" | "suspended" | "terminated";
}

export interface GroupContext {
  _id?: string;
  siteId?: string;
  accountId?: string;
  slug: string;
  name: string;
  description?: string;
  groupCode: string;
  allowedPlanIds?: string[];
  plannedCapacity?: number;
  maxCapacity?: number;
  status?: "onboarding" | "active" | "suspended" | "closed";
}

// ============================================
// PERSONAL INFO AND ADDRESS
// ============================================

export interface PersonalInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  gender?: string;
  employeeId?: string;
  ssn?: string; // Do NOT persist; used only for verification
  dependents?: Array<{
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    relationship: string;
  }>;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface PaymentInfo {
  method: "card" | "ach";
  cardBrand?: string;
  cardLast4?: string;
  bankLast4?: string;
  stripeTokenId?: string;
}

// ============================================
// SELECTED PLAN
// ============================================

export interface SelectedPlan {
  productId: string;
  name: string;
  price: number; // cents
  cadence: "monthly" | "annual";
  paymentMethod: "card" | "ach";
}

// ============================================
// ENROLLMENT STATE MACHINE
// ============================================

export interface EnrollmentWizardState {
  // Session
  sessionId: string;
  
  // Step navigation
  currentStep: EnrollmentStep;
  completedSteps: EnrollmentStep[];
  
  // Step data: Eligibility
  eligibilityData?: {
    groupCode?: string;
    employeeId?: string;
    dateOfBirth?: string;
  };
  
  // Step data: Plans
  selectedPlans: Record<string, SelectedPlan>;
  
  // Step data: Personal Info
  personalInfo: PersonalInfo;
  
  // Step data: Payment
  address?: Address;
  paymentInfo?: PaymentInfo;
  signedWaivers: string[]; // Document IDs or names
  
  // Step data: Member Profile
  memberProfileId?: string;
  
  // Hierarchy context
  site?: SiteContext;
  account?: AccountContext;
  group?: GroupContext;
  brokerCode?: string; // Broker/agent attribution
  resolvedConfig?: EnrollmentConfig;
  
  // Pricing
  subtotal: number; // cents
  discount: number; // cents
  tax: number; // cents
  total: number; // cents
  
  // UI state
  isLoading: boolean;
  error?: string;
}

// ============================================
// ACTIONS (State Machine Transitions)
// ============================================

export type EnrollmentAction =
  | { type: "SET_SESSION_ID"; payload: string }
  | { type: "SET_CURRENT_STEP"; payload: EnrollmentStep }
  | { type: "MARK_STEP_COMPLETED"; payload: EnrollmentStep }
  | { type: "SET_ELIGIBILITY_DATA"; payload: { groupCode?: string; employeeId?: string; dateOfBirth?: string } }
  | { type: "SET_SITE_CONTEXT"; payload: SiteContext }
  | { type: "SET_ACCOUNT_CONTEXT"; payload: AccountContext }
  | { type: "SET_GROUP_CONTEXT"; payload: GroupContext }
  | { type: "SET_RESOLVED_CONFIG"; payload: EnrollmentConfig }
  | { type: "SELECT_PLAN"; payload: { productId: string; name: string; price: number; cadence: "monthly" | "annual"; paymentMethod: "card" | "ach" } }
  | { type: "DESELECT_PLAN"; payload: string } // productId
  | { type: "SET_CADENCE"; payload: "monthly" | "annual" }
  | { type: "SET_PAYMENT_METHOD"; payload: "card" | "ach" }
  | { type: "SET_PERSONAL_INFO"; payload: Partial<PersonalInfo> }
  | { type: "SET_ADDRESS"; payload: Address }
  | { type: "SET_PAYMENT_INFO"; payload: PaymentInfo }
  | { type: "ADD_SIGNED_WAIVER"; payload: string } // Document ID
  | { type: "SET_MEMBER_PROFILE_ID"; payload: string }
  | { type: "SET_BROKER_CODE"; payload: string }
  | { type: "UPDATE_PRICING"; payload: { subtotal: number; discount: number; tax: number; total: number } }
  | { type: "SET_ERROR"; payload: string }
  | { type: "CLEAR_ERROR" }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "RESET" };

// ============================================
// ENROLLMENT CONFIGURATION
// ============================================

export interface EnrollmentConfig {
  // From site
  requireGroupCode: boolean;
  requireEligibilityMatch: boolean;
  allowSelfEnrollment: boolean;
  requirePayment: boolean;
  autoActivate: boolean;
  collectAddress: boolean;
  collectPhone: boolean;
  collectEmployeeId: boolean;
  collectDependents: boolean;
  welcomeMessage: string;
  supportEmail: string;
  supportPhone: string;
  
  // From account
  billingModel: "direct" | "per_member" | "monthly_flat";
  
  // From group
  plannedCapacity?: number;
  maxCapacity?: number;
  
  // Resolved defaults
  defaultCadence: "monthly" | "annual";
  defaultPaymentMethod: "card" | "ach";
  allowedPlanIds: string[];
}

export const DEFAULT_ENROLLMENT_CONFIG: EnrollmentConfig = {
  requireGroupCode: false,
  requireEligibilityMatch: false,
  allowSelfEnrollment: true,
  requirePayment: true,
  autoActivate: true,
  collectAddress: true,
  collectPhone: true,
  collectEmployeeId: false,
  collectDependents: false,
  welcomeMessage: "Welcome to Ideal Health",
  supportEmail: "support@idealhealth.com",
  supportPhone: "1-844-IDEAL-01",
  billingModel: "direct",
  defaultCadence: "monthly",
  defaultPaymentMethod: "card",
  allowedPlanIds: [],
};
