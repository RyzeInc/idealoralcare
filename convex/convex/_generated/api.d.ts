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
import type * as admin_coreValues from "../admin/coreValues.js";
import type * as admin_index from "../admin/index.js";
import type * as admin_navigation from "../admin/navigation.js";
import type * as admin_siteSettings from "../admin/siteSettings.js";
import type * as admin_teamMembers from "../admin/teamMembers.js";
import type * as admin_ventures from "../admin/ventures.js";
import type * as auth from "../auth.js";
import type * as catalog_index from "../catalog/index.js";
import type * as catalog_mutations from "../catalog/mutations.js";
import type * as catalog_products from "../catalog/products.js";
import type * as catalog_queries from "../catalog/queries.js";
import type * as contacts from "../contacts.js";
import type * as inquiries from "../inquiries.js";
import type * as newsletter from "../newsletter.js";
import type * as nexus_categories from "../nexus/categories.js";
import type * as nexus_index from "../nexus/index.js";
import type * as nexus_leads from "../nexus/leads.js";
import type * as nexus_products from "../nexus/products.js";
import type * as nexus_seed from "../nexus/seed.js";
import type * as subscriptions_bundles from "../subscriptions/bundles.js";
import type * as subscriptions_cart_mutations from "../subscriptions/cart_mutations.js";
import type * as subscriptions_carts from "../subscriptions/carts.js";
import type * as subscriptions_entitlements from "../subscriptions/entitlements.js";
import type * as subscriptions_events from "../subscriptions/events.js";
import type * as subscriptions_queries from "../subscriptions/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "admin/adminUsers": typeof admin_adminUsers;
  "admin/coreValues": typeof admin_coreValues;
  "admin/index": typeof admin_index;
  "admin/navigation": typeof admin_navigation;
  "admin/siteSettings": typeof admin_siteSettings;
  "admin/teamMembers": typeof admin_teamMembers;
  "admin/ventures": typeof admin_ventures;
  auth: typeof auth;
  "catalog/index": typeof catalog_index;
  "catalog/mutations": typeof catalog_mutations;
  "catalog/products": typeof catalog_products;
  "catalog/queries": typeof catalog_queries;
  contacts: typeof contacts;
  inquiries: typeof inquiries;
  newsletter: typeof newsletter;
  "nexus/categories": typeof nexus_categories;
  "nexus/index": typeof nexus_index;
  "nexus/leads": typeof nexus_leads;
  "nexus/products": typeof nexus_products;
  "nexus/seed": typeof nexus_seed;
  "subscriptions/bundles": typeof subscriptions_bundles;
  "subscriptions/cart_mutations": typeof subscriptions_cart_mutations;
  "subscriptions/carts": typeof subscriptions_carts;
  "subscriptions/entitlements": typeof subscriptions_entitlements;
  "subscriptions/events": typeof subscriptions_events;
  "subscriptions/queries": typeof subscriptions_queries;
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
