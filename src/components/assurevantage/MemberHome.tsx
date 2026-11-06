"use client";
import { useCallback, useEffect, useState, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { AssureLink as Link } from "./AssureLink";
import { assureProductName, START_DATE_NOTE } from "@/lib/assure-content";
import OralScan from "@/components/health/tabs/OralScanTab";
import ProviderSearch from "@/components/health/tabs/ProviderSearchTab";
import Teledentistry from "@/components/health/tabs/TeledentistryTab";
import FamilySection from "@/components/health/FamilySection";
import ProfileCompletionPrompt from "@/components/health/ProfileCompletionPrompt";
import styles from "./experience.module.css";
type MembershipData = {
  products: { id: string; slug: string; name: string; status: string }[];
  benefits: { key: string; title: string; url: string; phone?: string }[];
  role: string;
  bundle: { status: string; cadence: string } | null;
  nextRenewalDate: number | null;
  upcomingChargeAmount: number | null;
  profile: {
    memberName: string;
    memberId: string;
    effectiveDate: string;
    planName: string;
    essentialsMemberNumber?: string | null;
    essentialsGroupNumber?: string | null;
    bflMemberCode?: string | null;
  } | null;
};
function useMembership() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [data, setData] = useState<MembershipData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const request = useMemo(() => ({ generation: 0 }), []);
  const load = useCallback(async () => {
    const current = ++request.generation;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/member/benefits", {
        cache: "no-store",
      });
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.error || "Unable to load your membership.");
      if (current === request.generation) setData(json);
    } catch (e) {
      if (current === request.generation)
        setError(
          e instanceof Error ? e.message : "Unable to load your membership.",
        );
    } finally {
      if (current === request.generation) setLoading(false);
    }
  }, [request]);
  useEffect(() => {
    setData(null);
    if (isLoaded && isSignedIn) void load();
    else {
      ++request.generation;
      setLoading(!isLoaded);
      setError("");
    }
    return () => {
      ++request.generation;
    };
  }, [isLoaded, isSignedIn, user?.id, load, request]);
  return { data, error, loading, reload: load };
}
function LoadState({
  loading,
  error,
  reload,
}: {
  loading: boolean;
  error: string;
  reload: () => void;
}) {
  return (
    <div className={styles.empty}>
      {loading ? (
        <p role="status">Loading your membership…</p>
      ) : (
        <>
          <p role="alert">{error || "Sign in to view your membership."}</p>
          <button className={styles.secondary} onClick={reload}>
            Try again
          </button>{" "}
          <Link href="/assurevantage/help">Get help</Link>
        </>
      )}
    </div>
  );
}
function DocumentLinks({ productId }: { productId?: string }) {
  return (
    <div className={styles.actions}>
      {[
        ["card", "Member card"],
        ["packet", "Welcome packet"],
        ["agreement", "Agreement"],
      ].map(([type, label]) => (
        <a
          className={styles.textLink}
          key={type}
          href={`/api/documents?type=${type}${productId ? `&productId=${encodeURIComponent(productId)}` : ""}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {label} ↗
        </a>
      ))}
    </div>
  );
}
export function MemberHome() {
  const { user } = useUser();
  const params = useSearchParams();
  const { data, error, loading, reload } = useMembership();
  const tab = params.get("tab");
  const [checkedAt] = useState(Date.now);
  const hasOral = data?.benefits.some((b) => b.key === "oral-health-scan");
  const effective = data?.profile?.effectiveDate;
  const start = effective ? new Date(effective).getTime() : NaN;
  const future = Number.isFinite(start) && start > checkedAt;
  return (
    <main>
      <section className={styles.pageHero}>
        <div className={styles.container}>
          <p className={styles.eyebrow}>Your member portal</p>
          <h1>Welcome{user?.firstName ? `, ${user.firstName}` : ""}.</h1>
          <p className={styles.lead}>
            Your benefits, documents and next steps, together.
          </p>
          <Link href="/assurevantage/manage-plans" className={styles.textLink}>
            Membership & billing →
          </Link>
        </div>
      </section>
      <section className={styles.section}>
        <div className={styles.container}>
          <ProfileCompletionPrompt />
          {loading || error || !data ? (
            <LoadState loading={loading} error={error} reload={reload} />
          ) : (
            <>
              {data.profile && (
                <div className={styles.notice}>
                  <h2 style={{ fontSize: "1.4rem" }}>
                    Your membership information
                  </h2>
                  <p>
                    <strong>{data.profile.memberName}</strong>
                    <br />
                    Member ID: {data.profile.memberId}
                    <br />
                    Benefit effective date: {data.profile.effectiveDate}
                  </p>
                  {future && (
                    <p>
                      Your displayed benefit effective date is in the future.
                      Check that date before arranging care.
                    </p>
                  )}
                  {data.profile.essentialsMemberNumber && (
                    <p>
                      Essentials member number:{" "}
                      {data.profile.essentialsMemberNumber}
                      <br />
                      Essentials group number:{" "}
                      {data.profile.essentialsGroupNumber}
                    </p>
                  )}
                  {data.profile.bflMemberCode && (
                    <p>
                      Balance for Life member code: {data.profile.bflMemberCode}
                    </p>
                  )}
                </div>
              )}
              {data.benefits.length === 0 ? (
                <div className={styles.empty}>
                  <h2 style={{ fontSize: "1.5rem" }}>
                    We haven’t found active benefit details yet.
                  </h2>
                  <p>
                    Your enrollment may still be processing, or your group may
                    need to link your membership. Contact support if you
                    expected to see benefits here.
                  </p>
                  <Link href="/assurevantage/help">
                    Find membership support →
                  </Link>
                </div>
              ) : (
                <>
                  <h2 style={{ marginTop: 40 }}>Your benefit access</h2>
                  <p>
                    Follow your welcome packet’s provider registration
                    instructions. Your effective date and provider terms apply.
                  </p>
                  <div className={styles.memberGrid}>
                    {data.benefits.map((benefit) => (
                      <article className={styles.memberCard} key={benefit.key}>
                        <h3>{benefit.title}</h3>
                        <p>
                          {benefit.key === "labs"
                            ? "Confirm your test order and QuestSelect eligibility before your lab visit."
                            : benefit.key === "pharmacy"
                              ? "Check the current medication list and use the RxValet card in your packet."
                              : benefit.key === "balance-for-life"
                                ? "Use your assigned member code and follow the app instructions in your packet."
                                : "Use the access instructions for your selected membership."}
                        </p>
                        {!future && (
                          <a
                            href={benefit.url}
                            className={styles.textLink}
                            {...(benefit.url.startsWith("https")
                              ? { target: "_blank", rel: "noopener noreferrer" }
                              : {})}
                          >
                            Open {benefit.title} ↗
                          </a>
                        )}
                        {benefit.phone && (
                          <p style={{ marginTop: 14 }}>
                            <a
                              href={`tel:${benefit.phone.replace(/[^+\d]/g, "")}`}
                            >
                              {benefit.phone}
                            </a>
                          </p>
                        )}
                        <Link
                          href={`/assurevantage/${benefit.key}`}
                          className={styles.textLink}
                        >
                          Benefit guide →
                        </Link>
                      </article>
                    ))}
                  </div>
                </>
              )}
              {hasOral && !future && tab && (
                <section style={{ marginTop: 40 }}>
                  <Link href="/assurevantage/dashboard">
                    ← Back to all benefits
                  </Link>
                  {tab === "oral-scan" ? (
                    <OralScan userId={user?.id ?? null} />
                  ) : tab === "provider-search" ? (
                    <ProviderSearch
                      branded
                      onClose={() =>
                        window.location.assign("/assurevantage/dashboard")
                      }
                    />
                  ) : tab === "teledentistry" ? (
                    <Teledentistry
                      memberId={data.profile?.memberId ?? null}
                      firstName={user?.firstName ?? null}
                      fullName={user?.fullName ?? null}
                    />
                  ) : null}
                </section>
              )}
              <h2 style={{ marginTop: 40 }}>Your membership documents</h2>
              {data.products.length ? (
                data.products.map((p) => (
                  <article
                    className={styles.memberCard}
                    key={p.id}
                    style={{ marginBottom: 20 }}
                  >
                    <h3>{assureProductName(p.name)}</h3>
                    <DocumentLinks productId={p.id} />
                  </article>
                ))
              ) : data.profile ? (
                <DocumentLinks />
              ) : null}
              {data.role === "primary" &&
                hasOral &&
                data.products.some((p) => p.slug.includes("family")) && (
                  <FamilySection />
                )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
export function MembershipBilling() {
  const { data, error, loading, reload } = useMembership();
  const [busy, setBusy] = useState(false);
  const [billingError, setBillingError] = useState("");
  async function openBilling() {
    setBusy(true);
    setBillingError("");
    try {
      const res = await fetch("/api/stripe/billing-portal", { method: "POST" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unable to open billing.");
      window.location.assign(result.url);
    } catch (e) {
      setBillingError(
        e instanceof Error ? e.message : "Unable to open billing.",
      );
      setBusy(false);
    }
  }
  return (
    <main>
      <section className={styles.pageHero}>
        <div className={styles.container}>
          <p className={styles.eyebrow}>Your account</p>
          <h1>Membership & billing.</h1>
          <p className={styles.lead}>
            Review your membership, access billing tools and find help with
            changes.
          </p>
          <Link href="/assurevantage/dashboard">← Member portal</Link>
        </div>
      </section>
      <section className={styles.section}>
        <div className={styles.container}>
          {loading || error || !data ? (
            <LoadState loading={loading} error={error} reload={reload} />
          ) : (
            <>
              <div className={styles.memberGrid}>
                <article className={styles.memberCard}>
                  <h2 style={{ fontSize: "1.6rem" }}>Membership details</h2>
                  {data.products.length ? (
                    data.products.map((p) => (
                      <p key={p.id}>
                        <strong>{assureProductName(p.name)}</strong>
                        <br />
                        Status: {p.status.replace(/_/g, " ")}
                      </p>
                    ))
                  ) : (
                    <p>
                      No directly billed membership details were found. If your
                      employer provides your benefits, contact your group
                      administrator for membership changes.
                    </p>
                  )}
                  {data.profile && (
                    <p>Benefit effective date: {data.profile.effectiveDate}</p>
                  )}
                </article>
                <article className={styles.memberCard}>
                  <h2 style={{ fontSize: "1.6rem" }}>Payments & changes</h2>
                  {data.role === "dependent" ? (
                    <p>
                      Billing is managed by the primary member. Contact them for
                      changes to your membership.
                    </p>
                  ) : (
                    <>
                      {data.upcomingChargeAmount !== null && (
                        <p>
                          Recorded membership charge:{" "}
                          {(data.upcomingChargeAmount / 100).toLocaleString(
                            "en-US",
                            { style: "currency", currency: "USD" },
                          )}
                          {data.bundle?.cadence === "annual"
                            ? "/year"
                            : "/month"}
                        </p>
                      )}
                      {data.nextRenewalDate && (
                        <p>
                          Recorded renewal date:{" "}
                          {new Date(data.nextRenewalDate).toLocaleDateString(
                            "en-US",
                          )}
                        </p>
                      )}
                      <button
                        className={styles.button}
                        disabled={busy || !data.bundle}
                        onClick={openBilling}
                      >
                        {busy ? "Opening billing…" : "Manage billing"}
                      </button>
                      <p className={styles.fine} style={{ marginTop: 18 }}>
                        Billing tools show the options available for your
                        subscription. For cancellation, tier changes or
                        employer-billed memberships, your agreement and
                        membership support team can help.
                      </p>
                      {billingError && <p role="alert">{billingError}</p>}
                    </>
                  )}
                </article>
              </div>
              <div className={styles.notice} style={{ marginTop: 28 }}>
                <h3>Need to change or cancel?</h3>
                <p>
                  Use the available billing controls or contact your membership
                  support team. Cancellation timing, remaining access and refund
                  rights follow your membership agreement.
                </p>
                <Link href="/assurevantage/help" className={styles.textLink}>
                  Membership support →
                </Link>
              </div>
              <p className={styles.fine} style={{ marginTop: 24 }}>
                {START_DATE_NOTE}
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
