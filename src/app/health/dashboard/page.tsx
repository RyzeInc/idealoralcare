import { currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import HealthHeader from "@/components/health/HealthHeader";
import DashboardTabs from "@/components/health/DashboardTabs";
import "@/app/health/health.css";

/**
 * HEALTH DASHBOARD PAGE
 *
 * Member dashboard with tabbed interface:
 * - Overview: active subscriptions, account info, billing
 * - Provider Search: Dental Discount Network dental network finder
 * - Oral Scan: AI Oral Scanning SmileScan
 * - Teledentistry: 24/7 virtual dental consultations
 */

export default async function DashboardPage() {
  const user = await currentUser();

  // Fetch subscription and member profile data from Convex
  let hasSubscriptions = false;
  let subscriptions: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
    cadence: string;
    renewDate: string;
    status: string;
  }> = [];
  let memberCardData: {
    memberName: string;
    memberId: string;
    planName: string;
    effectiveDate: string;
    barcode: string;
    networks: {
      careington: { name: string; memberUrl: string };
      dialCare: { name: string; memberUrl: string };
      toothlens: { name: string; memberUrl: string };
    };
    supportPhone: string;
    supportEmail: string;
  } | null = null;

  if (user?.id) {
    try {
      const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");

      // Fetch member card profile data (safe public query — server-side Clerk userId verified above)
      const profileData = await convex.query(
        api.subscriptions.queries.getMemberCardDataPublic as any,
        { customerId: user.id }
      );
      if (profileData) memberCardData = profileData;

      // Fetch bundle status for subscription indicator
      const bundleData = await convex.query(
        api.subscriptions.queries.getCustomerBundlePublic,
        { customerId: user.id }
      );
      if (bundleData?.status && bundleData.status !== "cancelled") {
        hasSubscriptions = true;
        const renewDate = bundleData.currentPeriodEnd
          ? new Date(bundleData.currentPeriodEnd).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "—";
        const totalCents = bundleData.pricingSnapshot?.totalCents ?? 0;
        subscriptions = [
          {
            id: String(bundleData._id),
            name: memberCardData?.planName ?? "Ideal Oral Health Plan",
            category: "Oral Health",
            price: totalCents,
            cadence: totalCents > 2000 ? "annual" : "monthly",
            renewDate,
            status: bundleData.status,
          },
        ];
      }
    } catch (error) {
      // Fail gracefully — show empty state
    }
  }

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="health-landing">
      <HealthHeader />

      {/* Hero Section */}
      <section className="section bg--blue" style={{ paddingTop: "7rem", paddingBottom: "2.5rem" }}>
        <div className="container">
          <h1
            style={{
              fontSize: "clamp(2rem, 5vw, 2.75rem)",
              fontWeight: 700,
              color: "#0f172a",
              marginBottom: "0.5rem",
            }}
          >
            Welcome back, {user?.firstName || "Member"}!
          </h1>
          <p style={{ color: "#475569", fontSize: "1.125rem" }}>
            Manage your health plans and account settings
          </p>
        </div>
      </section>

      {/* Main Dashboard Content */}
      <section className="section bg--white" style={{ paddingTop: "3rem", paddingBottom: "4rem" }}>
        <div className="container" style={{ maxWidth: "1100px" }}>
          <DashboardTabs
            firstName={user?.firstName ?? null}
            email={user?.emailAddresses[0]?.emailAddress ?? null}
            fullName={user?.fullName ?? null}
            memberSince={memberSince}
            hasSubscriptions={hasSubscriptions}
            subscriptions={subscriptions}
            userId={user?.id ?? null}
            memberCardData={memberCardData}
          />
        </div>
      </section>
    </div>
  );
}
