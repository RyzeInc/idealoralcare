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
      
      // TODO: Re-enable after Convex API types are regenerated with getCustomerDashboard query
      // Fetch dashboard data using the Clerk user ID
      // const dashboardData = await convex.query(api.subscriptions.queries.getCustomerDashboard, {
      //   customerId: user.id,
      // });
      // 
      // if (dashboardData?.entitlements && dashboardData.entitlements.length > 0) {
      //   hasSubscriptions = true;
      //   subscriptions = dashboardData.entitlements.map((ent: any) => ({...}));
      // }
      
      // For now, render empty state while API types are being updated
      hasSubscriptions = false;
    } catch (error) {
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
          />
        </div>
      </section>
    </div>
  );
}
