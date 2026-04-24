/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin_adminUsers from "../admin/adminUsers.js";
import type * as admin_billing from "../admin/billing.js";
import type * as admin_commissions from "../admin/commissions.js";
import type * as admin_coreValues from "../admin/coreValues.js";
import type * as admin_customerService from "../admin/customerService.js";
import type * as admin_devTools from "../admin/devTools.js";
import type * as admin_distributionPartners from "../admin/distributionPartners.js";
import type * as admin_eligibility from "../admin/eligibility.js";
import type * as admin_eligibilityProvisioning from "../admin/eligibilityProvisioning.js";
import type * as admin_grantFreeAccess from "../admin/grantFreeAccess.js";
import type * as admin_hierarchy from "../admin/hierarchy.js";
import type * as admin_index from "../admin/index.js";
import type * as admin_memberCards from "../admin/memberCards.js";
import type * as admin_members from "../admin/members.js";
import type * as admin_navigation from "../admin/navigation.js";
import type * as admin_notifications from "../admin/notifications.js";
import type * as admin_repCodes from "../admin/repCodes.js";
import type * as admin_sftpDelivery from "../admin/sftpDelivery.js";
import type * as admin_siteSettings from "../admin/siteSettings.js";
import type * as admin_teamMembers from "../admin/teamMembers.js";
import type * as admin_userAudit from "../admin/userAudit.js";
import type * as admin_vendorFiles from "../admin/vendorFiles.js";
import type * as admin_ventures from "../admin/ventures.js";
import type * as admin_walletPasses from "../admin/walletPasses.js";
import type * as auth from "../auth.js";
import type * as catalog_index from "../catalog/index.js";
import type * as catalog_mutations from "../catalog/mutations.js";
import type * as catalog_products from "../catalog/products.js";
import type * as catalog_queries from "../catalog/queries.js";
import type * as contacts from "../contacts.js";
import type * as crons from "../crons.js";
import type * as enrollment from "../enrollment.js";
import type * as enrollment_agents from "../enrollment/agents.js";
import type * as enrollment_dependents from "../enrollment/dependents.js";
import type * as enrollment_index from "../enrollment/index.js";
import type * as enrollment_members from "../enrollment/members.js";
import type * as enrollment_seed from "../enrollment/seed.js";
import type * as enrollment_sessions from "../enrollment/sessions.js";
import type * as healthplans_index from "../healthplans/index.js";
import type * as healthplans_oral from "../healthplans/oral.js";
import type * as healthplans_toothlens from "../healthplans/toothlens.js";
import type * as hierarchy from "../hierarchy.js";
import type * as hierarchy_site_resolver from "../hierarchy/site_resolver.js";
import type * as inquiries from "../inquiries.js";
import type * as legal_emailFulfillment from "../legal/emailFulfillment.js";
import type * as legal_membershipAgreements from "../legal/membershipAgreements.js";
import type * as lib_authGuards from "../lib/authGuards.js";
import type * as lib_env from "../lib/env.js";
import type * as lib_gmail from "../lib/gmail.js";
import type * as lib_sanitize from "../lib/sanitize.js";
import type * as newsletter from "../newsletter.js";
import type * as nexus_categories from "../nexus/categories.js";
import type * as nexus_index from "../nexus/index.js";
import type * as nexus_leads from "../nexus/leads.js";
import type * as nexus_products from "../nexus/products.js";
import type * as nexus_seed from "../nexus/seed.js";
import type * as subscriptions_bundles from "../subscriptions/bundles.js";
import type * as subscriptions_cart_mutations from "../subscriptions/cart_mutations.js";
import type * as subscriptions_carts from "../subscriptions/carts.js";
import type * as subscriptions_commissions from "../subscriptions/commissions.js";
import type * as subscriptions_entitlements from "../subscriptions/entitlements.js";
import type * as subscriptions_events from "../subscriptions/events.js";
import type * as subscriptions_mutations from "../subscriptions/mutations.js";
import type * as subscriptions_queries from "../subscriptions/queries.js";
import type * as subscriptions_webhookActions from "../subscriptions/webhookActions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "admin/adminUsers": typeof admin_adminUsers;
  "admin/billing": typeof admin_billing;
  "admin/commissions": typeof admin_commissions;
  "admin/coreValues": typeof admin_coreValues;
  "admin/customerService": typeof admin_customerService;
  "admin/devTools": typeof admin_devTools;
  "admin/distributionPartners": typeof admin_distributionPartners;
  "admin/eligibility": typeof admin_eligibility;
  "admin/eligibilityProvisioning": typeof admin_eligibilityProvisioning;
  "admin/grantFreeAccess": typeof admin_grantFreeAccess;
  "admin/hierarchy": typeof admin_hierarchy;
  "admin/index": typeof admin_index;
  "admin/memberCards": typeof admin_memberCards;
  "admin/members": typeof admin_members;
  "admin/navigation": typeof admin_navigation;
  "admin/notifications": typeof admin_notifications;
  "admin/repCodes": typeof admin_repCodes;
  "admin/sftpDelivery": typeof admin_sftpDelivery;
  "admin/siteSettings": typeof admin_siteSettings;
  "admin/teamMembers": typeof admin_teamMembers;
  "admin/userAudit": typeof admin_userAudit;
  "admin/vendorFiles": typeof admin_vendorFiles;
  "admin/ventures": typeof admin_ventures;
  "admin/walletPasses": typeof admin_walletPasses;
  auth: typeof auth;
  "catalog/index": typeof catalog_index;
  "catalog/mutations": typeof catalog_mutations;
  "catalog/products": typeof catalog_products;
  "catalog/queries": typeof catalog_queries;
  contacts: typeof contacts;
  crons: typeof crons;
  enrollment: typeof enrollment;
  "enrollment/agents": typeof enrollment_agents;
  "enrollment/dependents": typeof enrollment_dependents;
  "enrollment/index": typeof enrollment_index;
  "enrollment/members": typeof enrollment_members;
  "enrollment/seed": typeof enrollment_seed;
  "enrollment/sessions": typeof enrollment_sessions;
  "healthplans/index": typeof healthplans_index;
  "healthplans/oral": typeof healthplans_oral;
  "healthplans/toothlens": typeof healthplans_toothlens;
  hierarchy: typeof hierarchy;
  "hierarchy/site_resolver": typeof hierarchy_site_resolver;
  inquiries: typeof inquiries;
  "legal/emailFulfillment": typeof legal_emailFulfillment;
  "legal/membershipAgreements": typeof legal_membershipAgreements;
  "lib/authGuards": typeof lib_authGuards;
  "lib/env": typeof lib_env;
  "lib/gmail": typeof lib_gmail;
  "lib/sanitize": typeof lib_sanitize;
  newsletter: typeof newsletter;
  "nexus/categories": typeof nexus_categories;
  "nexus/index": typeof nexus_index;
  "nexus/leads": typeof nexus_leads;
  "nexus/products": typeof nexus_products;
  "nexus/seed": typeof nexus_seed;
  "subscriptions/bundles": typeof subscriptions_bundles;
  "subscriptions/cart_mutations": typeof subscriptions_cart_mutations;
  "subscriptions/carts": typeof subscriptions_carts;
  "subscriptions/commissions": typeof subscriptions_commissions;
  "subscriptions/entitlements": typeof subscriptions_entitlements;
  "subscriptions/events": typeof subscriptions_events;
  "subscriptions/mutations": typeof subscriptions_mutations;
  "subscriptions/queries": typeof subscriptions_queries;
  "subscriptions/webhookActions": typeof subscriptions_webhookActions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
