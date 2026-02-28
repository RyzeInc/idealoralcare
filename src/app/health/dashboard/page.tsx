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
 * - Provider Search: Careington dental network finder
 * - Oral Scan: Toothlens AI SmileScan
 * - Teledentistry: 24/7 virtual dental consultations
 */

export default async function DashboardPage() {
  const user = await currentUser();

  // Fetch subscription data from Convex
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

  if (user?.id) {
    try {
      const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");
      // This will work after Agent 1 creates the mutations and we have data
      // For now, the query will return empty since no subscriptions exist yet
      const dashboardData = await convex.query(api.subscriptions.queries.getCustomerDashboard, {
        customerId: user.id,
      });

      if (dashboardData?.entitlements && dashboardData.entitlements.length > 0) {
        hasSubscriptions = true;
        subscriptions = dashboardData.entitlements.map((ent: any, idx: number) => ({
          id: ent._id,
          name: ent.productId?.name || "Unknown Plan",
          category: ent.productId?.category || "unknown",
          price: (ent.productId?.pricing?.monthlyCardCents || 0) / 100,
          cadence: dashboardData.bundle?.cadence || "monthly",
          renewDate: new Date(dashboardData.nextRenewalDate || 0).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          status: ent.status,
        }));
      }
    } catch (error) {
      console.error("[dashboard] Error fetching subscription data:", error);
      // Fail gracefully - show empty state
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
              color: "#fff",
              marginBottom: "0.5rem",
            }}
          >
            Welcome back, {user?.firstName || "Member"}!
          </h1>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "1.125rem" }}>
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
          />
        </div>
      </section>
    </div>
  );
}
