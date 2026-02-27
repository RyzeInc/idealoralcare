import { currentUser } from "@clerk/nextjs/server";
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

  // Mock subscription data (replace with Convex query)
  const hasSubscriptions = false;
  const subscriptions: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
    cadence: string;
    renewDate: string;
    status: string;
  }> = [];

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
