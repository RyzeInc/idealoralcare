/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin_adminAudit from "../admin/adminAudit.js";
import type * as admin_adminUsers from "../admin/adminUsers.js";
import type * as admin_backfillEssentialsCodes from "../admin/backfillEssentialsCodes.js";
import type * as admin_billing from "../admin/billing.js";
import type * as admin_commissions from "../admin/commissions.js";
import type * as admin_coreValues from "../admin/coreValues.js";
import type * as admin_customerService from "../admin/customerService.js";
import type * as admin_devTools from "../admin/devTools.js";
import type * as admin_distributionPartners from "../admin/distributionPartners.js";
import type * as admin_eligibility from "../admin/eligibility.js";
import type * as admin_eligibilityProvisioning from "../admin/eligibilityProvisioning.js";
import type * as admin_essentialsEligibility from "../admin/essentialsEligibility.js";
import type * as admin_fileStorage from "../admin/fileStorage.js";
import type * as admin_grantFreeAccess from "../admin/grantFreeAccess.js";
import type * as admin_hierarchy from "../admin/hierarchy.js";
import type * as admin_idMaintenance from "../admin/idMaintenance.js";
import type * as admin_index from "../admin/index.js";
import type * as admin_integrations from "../admin/integrations.js";
import type * as admin_invoiceCalculator from "../admin/invoiceCalculator.js";
import type * as admin_lifecycleBackfill from "../admin/lifecycleBackfill.js";
import type * as admin_listBillInvoices from "../admin/listBillInvoices.js";
import type * as admin_memberCards from "../admin/memberCards.js";
import type * as admin_memberEmail from "../admin/memberEmail.js";
import type * as admin_members from "../admin/members.js";
import type * as admin_navigation from "../admin/navigation.js";
import type * as admin_notifications from "../admin/notifications.js";
import type * as admin_repAttributionBackfill from "../admin/repAttributionBackfill.js";
import type * as admin_repCodes from "../admin/repCodes.js";
import type * as admin_revenueHealth from "../admin/revenueHealth.js";
import type * as admin_seedNewIdeal from "../admin/seedNewIdeal.js";
import type * as admin_sftpDelivery from "../admin/sftpDelivery.js";
import type * as admin_siteSettings from "../admin/siteSettings.js";
import type * as admin_teamMembers from "../admin/teamMembers.js";
import type * as admin_unifiedData from "../admin/unifiedData.js";
import type * as admin_userAudit from "../admin/userAudit.js";
import type * as admin_vendorFiles from "../admin/vendorFiles.js";
import type * as admin_vendorStatements from "../admin/vendorStatements.js";
import type * as admin_ventures from "../admin/ventures.js";
import type * as admin_walletPasses from "../admin/walletPasses.js";
import type * as auth from "../auth.js";
import type * as catalog_index from "../catalog/index.js";
import type * as catalog_mutations from "../catalog/mutations.js";
import type * as catalog_products from "../catalog/products.js";
import type * as catalog_queries from "../catalog/queries.js";
import type * as contacts from "../contacts.js";
import type * as crm_access from "../crm/access.js";
import type * as crm_activities from "../crm/activities.js";
import type * as crm_analytics from "../crm/analytics.js";
import type * as crm_campaignEngine from "../crm/campaignEngine.js";
import type * as crm_campaigns from "../crm/campaigns.js";
import type * as crm_companies from "../crm/companies.js";
import type * as crm_contacts from "../crm/contacts.js";
import type * as crm_deals from "../crm/deals.js";
import type * as crm_dripCampaigns from "../crm/dripCampaigns.js";
import type * as crm_dripEngine from "../crm/dripEngine.js";
import type * as crm_email from "../crm/email.js";
import type * as crm_guards from "../crm/guards.js";
import type * as crm_imports from "../crm/imports.js";
import type * as crm_ingest from "../crm/ingest.js";
import type * as crm_lib_contactStatus from "../crm/lib/contactStatus.js";
import type * as crm_lib_dealCache from "../crm/lib/dealCache.js";
import type * as crm_lib_dripAdvance from "../crm/lib/dripAdvance.js";
import type * as crm_lib_dripCache from "../crm/lib/dripCache.js";
import type * as crm_lib_dripSchedule from "../crm/lib/dripSchedule.js";
import type * as crm_lib_emailGate from "../crm/lib/emailGate.js";
import type * as crm_lib_emailProgress from "../crm/lib/emailProgress.js";
import type * as crm_lib_filters from "../crm/lib/filters.js";
import type * as crm_lib_jobTitles from "../crm/lib/jobTitles.js";
import type * as crm_lib_merge from "../crm/lib/merge.js";
import type * as crm_lib_normalize from "../crm/lib/normalize.js";
import type * as crm_lib_relationshipTags from "../crm/lib/relationshipTags.js";
import type * as crm_linkedRecords from "../crm/linkedRecords.js";
import type * as crm_maintenance from "../crm/maintenance.js";
import type * as crm_pipelines from "../crm/pipelines.js";
import type * as crm_segments from "../crm/segments.js";
import type * as crm_settings from "../crm/settings.js";
import type * as crm_setup from "../crm/setup.js";
import type * as crm_suppressions from "../crm/suppressions.js";
import type * as crm_tags from "../crm/tags.js";
import type * as crm_tasks from "../crm/tasks.js";
import type * as crm_telephony from "../crm/telephony.js";
import type * as crm_workflowEngine from "../crm/workflowEngine.js";
import type * as crm_workflowTriggers from "../crm/workflowTriggers.js";
import type * as crm_workflows from "../crm/workflows.js";
import type * as crons from "../crons.js";
import type * as debug_emailLog from "../debug/emailLog.js";
import type * as emailEvents from "../emailEvents.js";
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
import type * as insights_book from "../insights/book.js";
import type * as insights_downline from "../insights/downline.js";
import type * as insights_funnel from "../insights/funnel.js";
import type * as insights_memberWorkspace from "../insights/memberWorkspace.js";
import type * as insights_metrics from "../insights/metrics.js";
import type * as insights_retention from "../insights/retention.js";
import type * as insights_revenue from "../insights/revenue.js";
import type * as insights_rollups from "../insights/rollups.js";
import type * as insights_roster from "../insights/roster.js";
import type * as insights_scope from "../insights/scope.js";
import type * as insights_visits from "../insights/visits.js";
import type * as insights_watchlist from "../insights/watchlist.js";
import type * as legal_emailFulfillment from "../legal/emailFulfillment.js";
import type * as legal_membershipAgreements from "../legal/membershipAgreements.js";
import type * as legal_w9Forms from "../legal/w9Forms.js";
import type * as lib_authGuards from "../lib/authGuards.js";
import type * as lib_brokerResolve from "../lib/brokerResolve.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_dispersal from "../lib/dispersal.js";
import type * as lib_emailTemplates from "../lib/emailTemplates.js";
import type * as lib_env from "../lib/env.js";
import type * as lib_essentialsCodes from "../lib/essentialsCodes.js";
import type * as lib_hash from "../lib/hash.js";
import type * as lib_memberBilling from "../lib/memberBilling.js";
import type * as lib_memberCreation from "../lib/memberCreation.js";
import type * as lib_memberLifecycle from "../lib/memberLifecycle.js";
import type * as lib_periods from "../lib/periods.js";
import type * as lib_promoLinks from "../lib/promoLinks.js";
import type * as lib_repAttribution from "../lib/repAttribution.js";
import type * as lib_resend from "../lib/resend.js";
import type * as lib_sanitize from "../lib/sanitize.js";
import type * as newsletter from "../newsletter.js";
import type * as nexus_categories from "../nexus/categories.js";
import type * as nexus_index from "../nexus/index.js";
import type * as nexus_leads from "../nexus/leads.js";
import type * as nexus_products from "../nexus/products.js";
import type * as nexus_seed from "../nexus/seed.js";
import type * as partnerKit from "../partnerKit.js";
import type * as partnerPipeline from "../partnerPipeline.js";
import type * as repOnboarding from "../repOnboarding.js";
import type * as resources_admin from "../resources/admin.js";
import type * as resources_agreement from "../resources/agreement.js";
import type * as resources_library from "../resources/library.js";
import type * as shop_admin from "../shop/admin.js";
import type * as shop_clicks from "../shop/clicks.js";
import type * as shop_constants from "../shop/constants.js";
import type * as shop_index from "../shop/index.js";
import type * as shop_queries from "../shop/queries.js";
import type * as shop_seed from "../shop/seed.js";
import type * as subscriptions_bundles from "../subscriptions/bundles.js";
import type * as subscriptions_cart_mutations from "../subscriptions/cart_mutations.js";
import type * as subscriptions_carts from "../subscriptions/carts.js";
import type * as subscriptions_commissions from "../subscriptions/commissions.js";
import type * as subscriptions_entitlements from "../subscriptions/entitlements.js";
import type * as subscriptions_events from "../subscriptions/events.js";
import type * as subscriptions_mutations from "../subscriptions/mutations.js";
import type * as subscriptions_public from "../subscriptions/public.js";
import type * as subscriptions_queries from "../subscriptions/queries.js";
import type * as subscriptions_reconcile from "../subscriptions/reconcile.js";
import type * as subscriptions_webhookActions from "../subscriptions/webhookActions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "admin/adminAudit": typeof admin_adminAudit;
  "admin/adminUsers": typeof admin_adminUsers;
  "admin/backfillEssentialsCodes": typeof admin_backfillEssentialsCodes;
  "admin/billing": typeof admin_billing;
  "admin/commissions": typeof admin_commissions;
  "admin/coreValues": typeof admin_coreValues;
  "admin/customerService": typeof admin_customerService;
  "admin/devTools": typeof admin_devTools;
  "admin/distributionPartners": typeof admin_distributionPartners;
  "admin/eligibility": typeof admin_eligibility;
  "admin/eligibilityProvisioning": typeof admin_eligibilityProvisioning;
  "admin/essentialsEligibility": typeof admin_essentialsEligibility;
  "admin/fileStorage": typeof admin_fileStorage;
  "admin/grantFreeAccess": typeof admin_grantFreeAccess;
  "admin/hierarchy": typeof admin_hierarchy;
  "admin/idMaintenance": typeof admin_idMaintenance;
  "admin/index": typeof admin_index;
  "admin/integrations": typeof admin_integrations;
  "admin/invoiceCalculator": typeof admin_invoiceCalculator;
  "admin/lifecycleBackfill": typeof admin_lifecycleBackfill;
  "admin/listBillInvoices": typeof admin_listBillInvoices;
  "admin/memberCards": typeof admin_memberCards;
  "admin/memberEmail": typeof admin_memberEmail;
  "admin/members": typeof admin_members;
  "admin/navigation": typeof admin_navigation;
  "admin/notifications": typeof admin_notifications;
  "admin/repAttributionBackfill": typeof admin_repAttributionBackfill;
  "admin/repCodes": typeof admin_repCodes;
  "admin/revenueHealth": typeof admin_revenueHealth;
  "admin/seedNewIdeal": typeof admin_seedNewIdeal;
  "admin/sftpDelivery": typeof admin_sftpDelivery;
  "admin/siteSettings": typeof admin_siteSettings;
  "admin/teamMembers": typeof admin_teamMembers;
  "admin/unifiedData": typeof admin_unifiedData;
  "admin/userAudit": typeof admin_userAudit;
  "admin/vendorFiles": typeof admin_vendorFiles;
  "admin/vendorStatements": typeof admin_vendorStatements;
  "admin/ventures": typeof admin_ventures;
  "admin/walletPasses": typeof admin_walletPasses;
  auth: typeof auth;
  "catalog/index": typeof catalog_index;
  "catalog/mutations": typeof catalog_mutations;
  "catalog/products": typeof catalog_products;
  "catalog/queries": typeof catalog_queries;
  contacts: typeof contacts;
  "crm/access": typeof crm_access;
  "crm/activities": typeof crm_activities;
  "crm/analytics": typeof crm_analytics;
  "crm/campaignEngine": typeof crm_campaignEngine;
  "crm/campaigns": typeof crm_campaigns;
  "crm/companies": typeof crm_companies;
  "crm/contacts": typeof crm_contacts;
  "crm/deals": typeof crm_deals;
  "crm/dripCampaigns": typeof crm_dripCampaigns;
  "crm/dripEngine": typeof crm_dripEngine;
  "crm/email": typeof crm_email;
  "crm/guards": typeof crm_guards;
  "crm/imports": typeof crm_imports;
  "crm/ingest": typeof crm_ingest;
  "crm/lib/contactStatus": typeof crm_lib_contactStatus;
  "crm/lib/dealCache": typeof crm_lib_dealCache;
  "crm/lib/dripAdvance": typeof crm_lib_dripAdvance;
  "crm/lib/dripCache": typeof crm_lib_dripCache;
  "crm/lib/dripSchedule": typeof crm_lib_dripSchedule;
  "crm/lib/emailGate": typeof crm_lib_emailGate;
  "crm/lib/emailProgress": typeof crm_lib_emailProgress;
  "crm/lib/filters": typeof crm_lib_filters;
  "crm/lib/jobTitles": typeof crm_lib_jobTitles;
  "crm/lib/merge": typeof crm_lib_merge;
  "crm/lib/normalize": typeof crm_lib_normalize;
  "crm/lib/relationshipTags": typeof crm_lib_relationshipTags;
  "crm/linkedRecords": typeof crm_linkedRecords;
  "crm/maintenance": typeof crm_maintenance;
  "crm/pipelines": typeof crm_pipelines;
  "crm/segments": typeof crm_segments;
  "crm/settings": typeof crm_settings;
  "crm/setup": typeof crm_setup;
  "crm/suppressions": typeof crm_suppressions;
  "crm/tags": typeof crm_tags;
  "crm/tasks": typeof crm_tasks;
  "crm/telephony": typeof crm_telephony;
  "crm/workflowEngine": typeof crm_workflowEngine;
  "crm/workflowTriggers": typeof crm_workflowTriggers;
  "crm/workflows": typeof crm_workflows;
  crons: typeof crons;
  "debug/emailLog": typeof debug_emailLog;
  emailEvents: typeof emailEvents;
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
  "insights/book": typeof insights_book;
  "insights/downline": typeof insights_downline;
  "insights/funnel": typeof insights_funnel;
  "insights/memberWorkspace": typeof insights_memberWorkspace;
  "insights/metrics": typeof insights_metrics;
  "insights/retention": typeof insights_retention;
  "insights/revenue": typeof insights_revenue;
  "insights/rollups": typeof insights_rollups;
  "insights/roster": typeof insights_roster;
  "insights/scope": typeof insights_scope;
  "insights/visits": typeof insights_visits;
  "insights/watchlist": typeof insights_watchlist;
  "legal/emailFulfillment": typeof legal_emailFulfillment;
  "legal/membershipAgreements": typeof legal_membershipAgreements;
  "legal/w9Forms": typeof legal_w9Forms;
  "lib/authGuards": typeof lib_authGuards;
  "lib/brokerResolve": typeof lib_brokerResolve;
  "lib/constants": typeof lib_constants;
  "lib/dispersal": typeof lib_dispersal;
  "lib/emailTemplates": typeof lib_emailTemplates;
  "lib/env": typeof lib_env;
  "lib/essentialsCodes": typeof lib_essentialsCodes;
  "lib/hash": typeof lib_hash;
  "lib/memberBilling": typeof lib_memberBilling;
  "lib/memberCreation": typeof lib_memberCreation;
  "lib/memberLifecycle": typeof lib_memberLifecycle;
  "lib/periods": typeof lib_periods;
  "lib/promoLinks": typeof lib_promoLinks;
  "lib/repAttribution": typeof lib_repAttribution;
  "lib/resend": typeof lib_resend;
  "lib/sanitize": typeof lib_sanitize;
  newsletter: typeof newsletter;
  "nexus/categories": typeof nexus_categories;
  "nexus/index": typeof nexus_index;
  "nexus/leads": typeof nexus_leads;
  "nexus/products": typeof nexus_products;
  "nexus/seed": typeof nexus_seed;
  partnerKit: typeof partnerKit;
  partnerPipeline: typeof partnerPipeline;
  repOnboarding: typeof repOnboarding;
  "resources/admin": typeof resources_admin;
  "resources/agreement": typeof resources_agreement;
  "resources/library": typeof resources_library;
  "shop/admin": typeof shop_admin;
  "shop/clicks": typeof shop_clicks;
  "shop/constants": typeof shop_constants;
  "shop/index": typeof shop_index;
  "shop/queries": typeof shop_queries;
  "shop/seed": typeof shop_seed;
  "subscriptions/bundles": typeof subscriptions_bundles;
  "subscriptions/cart_mutations": typeof subscriptions_cart_mutations;
  "subscriptions/carts": typeof subscriptions_carts;
  "subscriptions/commissions": typeof subscriptions_commissions;
  "subscriptions/entitlements": typeof subscriptions_entitlements;
  "subscriptions/events": typeof subscriptions_events;
  "subscriptions/mutations": typeof subscriptions_mutations;
  "subscriptions/public": typeof subscriptions_public;
  "subscriptions/queries": typeof subscriptions_queries;
  "subscriptions/reconcile": typeof subscriptions_reconcile;
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
