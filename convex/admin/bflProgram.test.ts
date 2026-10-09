/**
 * STANDALONE BALANCE FOR LIFE — sold on its own, but never alongside
 * Essentials (which already includes it), and never sent to the Lyric /
 * RxValet / QuestSelect roster, since a BFL-only member has none of those.
 */

import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";
import { hasConflictingPrograms, isMembershipProgramSlug, BFL_SLUG } from "../lib/productSlugs";
import { EMAIL_TEMPLATES } from "../lib/emailTemplates";

const ADMIN = { tokenIdentifier: "https://test.clerk.dev|bfl_admin", subject: "bfl_admin" };

describe("product families", () => {
  test("Essentials and standalone BFL conflict; Oral Care combines with either", () => {
    expect(hasConflictingPrograms(["essentials-employee", BFL_SLUG])).toBe(true);
    expect(hasConflictingPrograms([BFL_SLUG, "oralcare-employee"])).toBe(false);
    expect(hasConflictingPrograms(["essentials-employee", "oralcare-employee"])).toBe(false);
    expect(isMembershipProgramSlug(BFL_SLUG)).toBe(true);
    expect(isMembershipProgramSlug("oralcare-employee")).toBe(false);
  });

  test("the BFL welcome email points members at the app, not a ZENN text line", () => {
    const { subject, html } = EMAIL_TEMPLATES["bfl-fulfillment-packet"].render({
      memberFirstName: "Jordan", essentialsMemberNumber: "841716653", planName: "Balance for Life — Individual",
      effectiveDate: "Nov 1, 2026", memberServicesPhone: "844-433-2502", portalUrl: "https://example.test",
    });
    expect(subject).toMatch(/Balance for Life/);
    expect(html).toContain("App Store or Google Play");
    expect(html).toContain("IDEAL");
    expect(html).not.toMatch(/559-ZENN/);
  });
});

describe("Essentials eligibility file", () => {
  test("leaves out members who bought standalone Balance for Life only", async () => {
    const t = convexTest(schema);
    const groupId = await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("adminUsers", { clerkUserId: "bfl_admin", email: "a@t.dev", name: "A", role: "owner", createdAt: now });
      const siteId = await ctx.db.insert("sites", {
        slug: "newideal", name: "New Ideal Health", type: "whitelabel", branding: {}, allowedPlanIds: [],
        enrollmentDefaults: {
          requireGroupCode: false, requireEligibilityMatch: false, allowSelfEnrollment: true, requirePayment: true,
          autoActivate: true, collectAddress: false, collectPhone: false, collectEmployeeId: false,
        },
        status: "active", createdAt: now, updatedAt: now,
      });
      const accountId = await ctx.db.insert("accounts", {
        siteId, slug: "individual", name: "Individual", accountType: "individual", billingModel: "direct",
        contacts: [], status: "active", createdAt: now, updatedAt: now,
      });
      const groupId = await ctx.db.insert("groups", {
        siteId, accountId, slug: "newideal-dtc", name: "DTC", groupCode: "IDEALDO", status: "active", createdAt: now, updatedAt: now,
      });
      const product = (slug: string) =>
        ctx.db.insert("catalogProducts", {
          slug, name: slug, category: "newideal", description: "", inclusions: [], exclusions: [],
          eligibilityRules: { requiresVerification: false, disclosureText: "" }, activationBehavior: "immediate",
          pricing: { monthlyCardCents: 1, monthlyACHCents: 1, annualCardCents: 1, annualACHCents: 1 },
          isVisible: true, isFeatured: false, order: 0, createdAt: now, updatedAt: now,
        });
      const essentials = await product("essentials-employee");
      const bfl = await product(BFL_SLUG);
      const bundleId = await ctx.db.insert("subscriptionBundles", {
        customerId: "x", cadence: "monthly", paymentMethod: "card", stripeCustomerId: "cus_x", status: "active",
        currentPeriodStart: now, currentPeriodEnd: now + 1, createdAt: now, updatedAt: now,
        pricingSnapshot: { cadence: "monthly", paymentMethod: "card", totalCents: 1, planCount: 1, capturedAt: now },
      });
      const member = async (customerId: string | undefined, productId?: typeof bfl) => {
        await ctx.db.insert("memberProfiles", {
          memberId: `M-${customerId ?? "roster"}`, barcode: "b", customerId, siteId, accountId, groupId,
          firstName: customerId ?? "Roster", lastName: "Test", memberType: "active", memberRole: "primary",
          status: "active", createdAt: now, updatedAt: now,
        });
        if (customerId && productId) {
          await ctx.db.insert("entitlements", {
            customerId, bundleId, productId, periodStart: now, periodEnd: now + 1, expiresAt: now + 1, activatedAt: now, status: "active",
            endCondition: "renew", createdAt: now, createdVia: "initial_purchase",
          });
        }
      };
      await member("essentials_buyer", essentials);
      await member("bfl_buyer", bfl);
      await member(undefined); // employer roster member, no login or entitlements
      return groupId;
    });

    const file = await t.withIdentity(ADMIN).action(api.admin.essentialsEligibility.generateEssentialsEligibilityFile, {
      format: "combined", groupId,
    });
    expect(file.content).toContain("essentials_buyer");
    expect(file.content).toContain("Roster");
    expect(file.content).not.toContain("bfl_buyer");
    expect(file.memberCount).toBe(2);
  });
});
