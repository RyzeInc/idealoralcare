/**
 * A PARTNER'S OWN EXECUTED AGREEMENT, surfaced in their resource library.
 *
 * The library proper (`library.ts`) is curated material an admin publishes to
 * an audience. This is the opposite: one document, belonging to exactly one
 * partner, that nobody curates. It lives beside the library on
 * /partner/resources but deliberately not *in* `partnerResources` — a signed
 * contract is not a resource to be filed, featured, or granted to an audience,
 * and putting it in that table would make an audience misconfiguration able to
 * leak it.
 *
 * SCOPE RULE: the signing agency's principal only. Not their downline reps,
 * and not a parent FMO upline. The library hands agency-wide material down to
 * reps on purpose (see the `specific` audience in library.ts) — an executed
 * contract carrying an authorized signature and NPN is not that.
 *
 * "Principal" has to be spelled out rather than assumed to mean partner scope.
 * `claimInvite` patches `clerkUserId` onto the partnerLeaders row, NOT onto
 * distributionPartners, so an agency principal who onboarded through the
 * current invite flow signs in as REP scope with `isPrimary: true`. Only the
 * legacy flow produces partner scope. Gating on partner scope alone would hide
 * the agreement from the exact person who signed it.
 */

import { mutation, query, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { tryResolveViewerScope } from "../insights/scope";

/**
 * The submission this viewer signed, or null.
 *
 * Matched on partner id, never on email — `partnerKitSubmissions.email` is
 * self-reported at intake, unverified and non-unique, so matching on it would
 * let anyone claim another agency's agreement by reusing their address.
 */
async function findMyAgreement(
  ctx: QueryCtx,
): Promise<Doc<"partnerKitSubmissions"> | null> {
  const scope = await tryResolveViewerScope(ctx);
  // Admins have no agreement of their own.
  if (!scope || scope.kind === "admin") return null;

  // A rep only qualifies as the signatory when they are the agency's primary
  // leader — which is what promotion creates for the person who signed. A
  // downline rep gets nothing.
  if (scope.kind === "rep") {
    const leader = await ctx.db.get(scope.leaderId);
    if (!leader?.isPrimary) return null;
  }

  const direct = await ctx.db
    .query("partnerKitSubmissions")
    .withIndex("by_approved_partner", (q) =>
      q.eq("approvedPartnerId", String(scope.partnerId)),
    )
    .first();
  if (direct) return direct;

  // Partners promoted through the application pipeline rather than by direct
  // kit promotion carry the link on the application instead.
  const application = await ctx.db
    .query("repOnboardingSubmissions")
    .withIndex("by_approved_partner", (q) =>
      q.eq("approvedPartnerId", String(scope.partnerId)),
    )
    .first();
  if (!application?.partnerKitSubmissionId) return null;
  return await ctx.db.get(application.partnerKitSubmissionId);
}

/** Which stored file is this partner's signed copy, if any. */
function executedFileId(kit: Doc<"partnerKitSubmissions">): string | null {
  // An uploaded kit is the partner's own signed instrument — always prefer it
  // over anything we rendered.
  if (kit.partnerKitFileId) return kit.partnerKitFileId;
  return kit.executedAgreementFileId ?? null;
}

/**
 * Metadata for the "your signed agreement" card. No URL — same rule as the
 * library: a storage URL is a bearer credential and is minted per click.
 */
export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const kit = await findMyAgreement(ctx);
    if (!kit) return null;

    return {
      partnerAgencyName: kit.partnerAgencyName,
      method: kit.method,
      signedDate: kit.signedDate,
      signedAt: kit.createdAt,
      printedName: kit.printedName,
      fileName:
        kit.partnerKitFileName ??
        `Partner Agreement — ${kit.partnerAgencyName}.pdf`,
      /**
       * False while an online submission's copy is still rendering, or if the
       * render failed. The card shows a "being prepared" state rather than a
       * dead download.
       */
      available: executedFileId(kit) !== null,
    };
  },
});

/** Mint a download URL for the viewer's own agreement. */
export const getMineDownloadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    // Re-resolved from scratch rather than trusting anything the client sends:
    // there is no id to pass, so there is nothing to forge.
    const kit = await findMyAgreement(ctx);
    if (!kit) return null;

    const fileId = executedFileId(kit);
    if (!fileId) return null;

    const url = await ctx.storage.getUrl(fileId as Id<"_storage">);
    if (!url) return null;

    return {
      url,
      fileName:
        kit.partnerKitFileName ??
        `Partner Agreement — ${kit.partnerAgencyName}.pdf`,
    };
  },
});
