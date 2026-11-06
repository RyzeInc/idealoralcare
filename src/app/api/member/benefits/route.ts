import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { convexServiceSecret } from "@/lib/convex-service";
import { isEssentialsSlug, isBflSlug } from "@/convex/lib/productSlugs";
import { ESSENTIALS_VENDOR_CODES } from "@/lib/essentials-packet-pdf";
export async function GET() {
  const { userId, getToken } = await auth();
  if (!userId)
    return NextResponse.json(
      { error: "Sign in to view your benefits." },
      { status: 401 },
    );
  try {
    const token = await getToken({ template: "convex" });
    if (!token)
      return NextResponse.json(
        { error: "Your secure session is still connecting. Please try again." },
        { status: 503 },
      );
    const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    client.setAuth(token);
    const [dashboard, entitlements, profile] = await Promise.all([
      client.query(api.subscriptions.queries.getMyDashboard, {}),
      client.query(api.subscriptions.queries.getMyEntitlements, {}),
      client.query(api.subscriptions.queries.getMemberCardDataPublic, {
        customerId: userId,
        serviceSecret: convexServiceSecret(),
      }),
    ]);
    const products = entitlements.map((e) => ({
      id: String(e.productId),
      slug: e.product?.slug ?? "",
      name: e.product?.name ?? "Membership",
      status: e.status,
    }));
    const slugs = products.map((p) => p.slug);
    // Employer-billed members may have a profile without a direct-billing bundle.
    if (!slugs.length && profile?.productSlug) slugs.push(profile.productSlug);
    const essentials = slugs.some(isEssentialsSlug),
      bfl = essentials || slugs.some(isBflSlug),
      oral = slugs.some(
        (s) => s.startsWith("oralcare-") || s.startsWith("oral-health-"),
      );
    const benefits = [
      ...(essentials
        ? [
            {
              key: "virtual-care",
              title: "Lyric virtual care",
              url: `https://${ESSENTIALS_VENDOR_CODES.lyric.url}`,
              phone: ESSENTIALS_VENDOR_CODES.lyric.phone,
            },
            {
              key: "labs",
              title: "QuestSelect labs",
              url: "https://www.questdiagnostics.com/",
              phone: ESSENTIALS_VENDOR_CODES.questSelect.labLine,
            },
            {
              key: "pharmacy",
              title: "RxValet prescription savings",
              url: `https://${ESSENTIALS_VENDOR_CODES.rxValet.url.replace(/^https?:\/\//, "")}`,
              phone: ESSENTIALS_VENDOR_CODES.rxValet.phone,
            },
          ]
        : []),
      ...(bfl
        ? [
            {
              key: "balance-for-life",
              title: "Balance for Life",
              url: `https://${ESSENTIALS_VENDOR_CODES.balanceForLife.url.replace(/^https?:\/\//, "")}`,
              phone: ESSENTIALS_VENDOR_CODES.balanceForLife.phone,
            },
          ]
        : []),
      ...(oral
        ? [
            {
              key: "oral-health-scan",
              title: "Oral scan",
              url: "/assurevantage/dashboard?tab=oral-scan",
            },
            {
              key: "teledentistry",
              title: "Teledentistry",
              url: "/assurevantage/dashboard?tab=teledentistry",
            },
            {
              key: "discount",
              title: "Provider search",
              url: "/assurevantage/dashboard?tab=provider-search",
            },
          ]
        : []),
    ];
    return NextResponse.json(
      {
        products,
        benefits,
        role: dashboard.role,
        bundle: dashboard.bundle
          ? {
              status: dashboard.bundle.status,
              cadence: dashboard.bundle.cadence,
            }
          : null,
        nextRenewalDate: dashboard.nextRenewalDate,
        upcomingChargeAmount: dashboard.upcomingChargeAmount,
        profile: profile
          ? {
              memberName: profile.memberName,
              memberId: profile.memberId,
              effectiveDate: profile.effectiveDate,
              planName: profile.planName,
              essentialsMemberNumber: essentials
                ? profile.essentialsMemberNumber
                : null,
              essentialsGroupNumber: essentials
                ? profile.essentialsGroupNumber
                : null,
              bflMemberCode: bfl ? profile.bflMemberCode : null,
            }
          : null,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "We couldn’t load your membership information. Please try again or contact member support.",
      },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
