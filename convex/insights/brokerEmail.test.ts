/**
 * BROKER → MEMBER EMAIL — the ways this could go wrong are a broker reaching
 * members outside their book, sending without the (pending-approval)
 * permission, or injecting markup. Each is pinned here.
 */

import { describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { ensureBuiltInPacks } from "../lib/access/provision";
import { brokerEmailHtml, MAX_SENDS_PER_DAY } from "./brokerEmail";

const who = (id: string, email: string) => ({
  tokenIdentifier: `https://clerk.test|${id}`, subject: id, email, emailVerified: true, name: id === "rep_mail" ? "Rita Rep" : id,
});

async function setup() {
  const t = convexTest(schema);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("adminUsers", { clerkUserId: "owner", email: "owner@ideal.test", name: "Owner", role: "owner", createdAt: now });
    const packs = Object.fromEntries(await ensureBuiltInPacks(ctx)) as Record<string, Id<"accessPacks">>;
    const emailPack = await ctx.db.insert("accessPacks", {
      key: "agent_with_email", name: "Agent + email", description: "test", roles: ["rep", "broker"],
      permissions: ["partner.book", "partner.email"], builtIn: false, createdAt: now, updatedAt: now,
    });
    const agency = await ctx.db.insert("distributionPartners", {
      name: "Harbor Agency", type: "agency", contactName: "A", contactEmail: "a@harbor.test", status: "active", createdAt: now, updatedAt: now,
    });
    const siteId = await ctx.db.insert("sites", {
      slug: "ideal-health", name: "Ideal Health", type: "primary", branding: {}, allowedPlanIds: [],
      enrollmentDefaults: {
        requireGroupCode: false, requireEligibilityMatch: false, allowSelfEnrollment: true, requirePayment: true,
        autoActivate: true, collectAddress: false, collectPhone: false, collectEmployeeId: false,
      },
      status: "active", createdAt: now, updatedAt: now,
    });
    const accountId = await ctx.db.insert("accounts", {
      siteId, slug: "ind", name: "Individual", accountType: "individual", billingModel: "direct",
      contacts: [], status: "active", createdAt: now, updatedAt: now,
    });
    const groupId = await ctx.db.insert("groups", {
      siteId, accountId, slug: "default", name: "Individual Enrollment", groupCode: "IDEALDO", status: "active", createdAt: now, updatedAt: now,
    });
    return { packs, emailPack, agency, siteId, accountId, groupId };
  });
  const owner = t.withIdentity(who("owner", "owner@ideal.test"));
  const claim = async (id: string, email: string, packId: Id<"accessPacks">) => {
    const invited = await owner.action(api.access.invites.invitePerson, {
      email, name: id, roles: [{ role: "rep", partnerId: ids.agency, packIds: [packId] }], sendEmail: false,
    });
    const token = new URL(invited.claimUrl!).searchParams.get("token")!;
    await t.withIdentity(who(id, email)).action(api.access.invites.claimInvitation, { token });
    const leader = await t.run((ctx) => ctx.db.query("partnerLeaders").withIndex("by_clerk_id", (q) => q.eq("clerkUserId", id)).first());
    return leader!._id;
  };
  const mailer = await claim("rep_mail", "rita@harbor.test", ids.emailPack);
  const plain = await claim("rep_plain", "pat@harbor.test", ids.packs.partner_agent);

  await t.run(async (ctx) => {
    const base = {
      siteId: ids.siteId, accountId: ids.accountId, groupId: ids.groupId, lastName: "Test",
      memberType: "active" as const, memberRole: "primary" as const, status: "active" as const,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    const rows: [string, string, Record<string, unknown>][] = [
      ["mine_ok", String(mailer), { email: "ok@member.test" }],
      ["mine_optout", String(mailer), { email: "out@member.test", communicationPrefs: { emailOptIn: false, smsOptIn: true, callOptIn: true } }],
      ["mine_noemail", String(mailer), {}],
      ["someone_elses", String(plain), { email: "other@member.test" }],
    ];
    for (const [name, repId, extra] of rows) {
      await ctx.db.insert("memberProfiles", {
        ...base, memberId: name, barcode: name, firstName: name, attributedRepId: repId, attributedAgencyId: String(ids.agency), ...extra,
      });
    }
  });
  return { t, ...ids, asMailer: t.withIdentity(who("rep_mail", "rita@harbor.test")), asPlain: t.withIdentity(who("rep_plain", "pat@harbor.test")) };
}

describe("broker member email", () => {
  test("is invisible without the partner.email permission, which no built-in pack grants", async () => {
    const s = await setup();
    expect(await s.asPlain.query(api.insights.brokerEmail.getComposer, {})).toBeNull();
    await expect(s.asPlain.action(api.insights.brokerEmail.send, { subject: "Hi", message: "Hello" })).rejects.toThrow(/permission/);
  });

  test("reaches only the broker's own members, skipping opted-out and address-less ones", async () => {
    vi.useFakeTimers();
    const s = await setup();
    const composer = await s.asMailer.query(api.insights.brokerEmail.getComposer, {});
    expect(composer).toMatchObject({ recipients: 1, skippedNoEmail: 1, skippedOptedOut: 1, replyTo: "rita@harbor.test" });

    const result = await s.asMailer.action(api.insights.brokerEmail.send, { subject: "Your benefits", message: "Hi {{firstName}}" });
    expect(result.scheduled).toBe(1);
    const campaign = await s.t.run((ctx) => ctx.db.get(result.campaignId as Id<"emailCampaigns">));
    expect(campaign).toMatchObject({ createdBy: "rep_mail", templateId: "broker-custom", recipientCount: 1 });

    // Run the queued delivery. No Resend key in tests, so it records a failed
    // send — which still proves who it went to and who it is credited to.
    await s.t.finishAllScheduledFunctions(vi.runAllTimers);
    const sends = await s.t.run((ctx) => ctx.db.query("emailSends").collect());
    expect(sends.map((r) => r.to)).toEqual(["ok@member.test"]);
    expect(sends[0]).toMatchObject({ sentByName: "Rita Rep (broker)", subject: "Your benefits" });
    const activity = await s.t.run((ctx) => ctx.db.query("memberActivities").collect());
    expect(activity.map((a) => a.actorType)).toEqual(["partner"]);
    vi.useRealTimers();
  });

  test("is capped per day", async () => {
    const s = await setup();
    await s.t.run(async (ctx) => {
      for (let i = 0; i < MAX_SENDS_PER_DAY; i++) {
        await ctx.db.insert("emailCampaigns", {
          name: "x", templateId: "broker-custom", templateLabel: "Broker message", subject: "x", mode: "custom",
          recipientCount: 1, sentCount: 1, failedCount: 0, status: "completed", createdBy: "rep_mail", createdAt: Date.now(),
        });
      }
    });
    await expect(s.asMailer.action(api.insights.brokerEmail.send, { subject: "Hi", message: "Hello" })).rejects.toThrow(/a day/);
  });

  test("escapes whatever the broker writes", () => {
    const html = brokerEmailHtml('<script>alert(1)</script>\n\n<a href="x">click</a>', "Rita <Rep>", "Harbor", "rita@harbor.test");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('<a href="x">');
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Rita &lt;Rep&gt;");
    expect(html).toContain("Stop emails from my broker");
  });
});
