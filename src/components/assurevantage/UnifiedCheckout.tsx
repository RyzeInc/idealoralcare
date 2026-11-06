"use client";
import { useRef, useState, type ReactNode } from "react";
import { useUser, SignOutButton } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowLeft, Check, Lock, X } from "lucide-react";
import { useCart } from "@/lib/health-plans";
import { formatPrice, getPrice, type CartItem } from "@/lib/health-plans/types";
import {
  hasConflictingPrograms,
  isMembershipProgramSlug,
  isBflSlug,
} from "@/convex/lib/productSlugs";
import { InlineAuth } from "@/app/newideal/checkout/page.client";
import { AgentRepCodeSelector } from "@/components/health/AgentRepCodeSelector";
import {
  MembershipAgreementModal,
  EssentialsMembershipModal,
  TermsAndConditionsModal,
} from "@/components/legal";
import { assureProductName, START_DATE_NOTE } from "@/lib/assure-content";
import { shoppingUrl } from "@/lib/checkout-transfer";
import { PROVIDER_GROUP_CODE } from "@/lib/constants";
import { AssureLink as Link } from "./AssureLink";
import styles from "./experience.module.css";

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      className={styles.checkoutSection}
      aria-labelledby={`checkout-step-${number}`}
    >
      <h2 id={`checkout-step-${number}`}>
        <span className={styles.stepNumber}>{number}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
function profileFromBrowser() {
  try {
    return JSON.parse(
      sessionStorage.getItem("careington_profile") || "null",
    ) as {
      dateOfBirth?: string;
      gender?: string;
      phone?: string;
      address?: {
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postalCode?: string;
      };
    } | null;
  } catch {
    return null;
  }
}
function membershipLabel(item: CartItem) {
  if (item.product.category === "dental")
    return `AssureVantage Oral Care — ${item.product.slug.includes("family") ? "Family" : "Individual"}`;
  return assureProductName(item.product.name);
}
/** One retail checkout for every AssureVantage product and combination. */
export function UnifiedCheckout() {
  const { user, isLoaded, isSignedIn } = useUser();
  const {
    cart,
    monthlyOnly,
    subtotalCents,
    setCadence,
    setPaymentMethod,
    removeItem,
    setReferralCode,
  } = useCart();
  const saveAgreement = useMutation(
    api.legal.membershipAgreements.createMembershipAgreement,
  );
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  const [openProduct, setOpenProduct] = useState<string | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const charge = (item: CartItem) =>
    getPrice(item.product, cart.cadence, cart.paymentMethod);
  const key = (item: CartItem) =>
    JSON.stringify([
      user?.id,
      item.productId,
      cart.cadence,
      cart.paymentMethod,
      charge(item),
    ]);
  const selectionKey = JSON.stringify([user?.id, cart.items.map(key)]);
  const signedAll = cart.items.every((item) => !!signatures[key(item)]);
  const termsAccepted = acceptedTerms === selectionKey;
  const conflict = hasConflictingPrograms(
    cart.items.map((item) => item.product.slug),
  );
  const canPay =
    !!isSignedIn &&
    signedAll &&
    termsAccepted &&
    !busy &&
    !conflict &&
    cart.items.length > 0;
  const signing = cart.items.find((item) => item.productId === openProduct);
  const period = cart.cadence === "annual" ? "year" : "month";
  async function pay() {
    if (!canPay || !user || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const profile = profileFromBrowser();
      const address = Object.values(profile?.address || {})
        .filter(Boolean)
        .join(", ");
      // Persist every signed agreement before creating a payment session. A failed save blocks payment.
      try {
        for (const item of cart.items) {
          await saveAgreement({
            userId: user.id,
            memberId: user.id,
            memberName:
              user.fullName ||
              user.primaryEmailAddress?.emailAddress ||
              "Member",
            memberAddress: address,
            email: user.primaryEmailAddress?.emailAddress || "",
            planName: membershipLabel(item),
            groupCode:
              item.product.category === "dental" ? PROVIDER_GROUP_CODE : "",
            term: cart.cadence === "annual" ? "Annual" : "Monthly",
            classification: isBflSlug(item.product.slug)
              ? "Balance for Life"
              : isMembershipProgramSlug(item.product.slug)
                ? "Essentials"
                : "Oral Savings",
            paymentMode:
              cart.paymentMethod === "ach"
                ? "Bank Transfer (ACH)"
                : "Credit/Debit Card",
            periodicCharge: formatPrice(charge(item)),
            processingFee: "$0.00",
            membershipTermsAgreed: true,
            termsAndConditionsAgreed: true,
            memberSignature: signatures[key(item)],
            signatureTimestamp: Date.now(),
          });
        }
      } catch {
        throw new Error(
          "We couldn’t save all signed agreements. Please try again. No payment has been started.",
        );
      }
      const ordered = [...cart.items].sort(
        (a, b) =>
          Number(isMembershipProgramSlug(b.product.slug)) -
          Number(isMembershipProgramSlug(a.product.slug)),
      );
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: ordered[0].productId,
          additionalPlanIds: ordered.slice(1).map((item) => item.productId),
          cadence: cart.cadence,
          paymentMethod: cart.paymentMethod,
          siteSlug: "assurevantage",
          referralCode: cart.referralCode || undefined,
          memberProfile: profile || undefined,
          successUrl: `${window.location.origin}/assurevantage/program-success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/assurevantage/program-checkout`,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.url)
        throw new Error(
          data.error || "We couldn’t start payment. Please try again.",
        );
      window.location.assign(data.url);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "We couldn’t save your agreements or start payment. Please try again.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <main>
      <section className={styles.pageHero}>
        <div className={styles.container}>
          <Link href={shoppingUrl(cart)} className={styles.textLink}>
            <ArrowLeft size={17} /> Back to memberships
          </Link>
          <p className={styles.eyebrow} style={{ marginTop: 24 }}>
            Your membership, your next step
          </p>
          <h1>Review & complete your enrollment.</h1>
          <p className={styles.lead}>
            Review your order, choose how to pay, create your account and sign
            your agreements. You’ll enter payment details securely with Stripe.
          </p>
        </div>
      </section>
      <div className={`${styles.container} ${styles.checkoutGrid}`}>
        <div>
          <Section number={1} title="Review Your Order">
            <ul className={styles.orderItems}>
              {cart.items.map((item) => (
                <li key={item.productId}>
                  <div>
                    <strong>{membershipLabel(item)}</strong>
                    <span>
                      {formatPrice(charge(item))} / {period}
                    </span>
                  </div>
                  <button
                    aria-label={`Remove ${membershipLabel(item)}`}
                    onClick={() => removeItem(item.productId)}
                    disabled={busy}
                  >
                    <X size={18} />
                  </button>
                </li>
              ))}
            </ul>
            <h3>Billing Cycle</h3>
            <div className={styles.billing}>
              {(["monthly", "annual"] as const).map((cadence) => (
                <button
                  key={cadence}
                  aria-pressed={cart.cadence === cadence}
                  disabled={busy || (monthlyOnly && cadence === "annual")}
                  onClick={() => setCadence(cadence)}
                >
                  {cadence === "monthly" ? "Monthly" : "Annual"}
                </button>
              ))}
            </div>
            {monthlyOnly && (
              <p className={styles.fine}>
                Essentials and Balance for Life require monthly billing. This
                applies to the whole order.
              </p>
            )}
            <p className={styles.fine}>
              Your membership renews{" "}
              {cart.cadence === "annual" ? "annually" : "monthly"} unless
              canceled. Your payment receipt confirms the billing dates.
            </p>
          </Section>
          <Section number={2} title="Payment Method">
            <div className={styles.paymentChoices}>
              {(
                [
                  ["ach", "Bank Transfer (ACH)"],
                  ["card", "Credit/Debit Card"],
                ] as const
              ).map(([method, label]) => (
                <button
                  key={method}
                  aria-pressed={cart.paymentMethod === method}
                  disabled={busy}
                  onClick={() => setPaymentMethod(method)}
                >
                  <span>{label}</span>
                  {cart.paymentMethod === method && <Check size={20} />}
                </button>
              ))}
            </div>
            <p className={styles.fine}>
              Prices update for your selected payment method. Payment details
              are collected after you complete this checkout.
            </p>
          </Section>
          <Section number={3} title="Account">
            {!isLoaded ? (
              <p role="status">
                Loading account options… You can continue reviewing your order
                below.
              </p>
            ) : isSignedIn ? (
              <div>
                <p>
                  <strong>
                    Signed in as{" "}
                    {user?.fullName || user?.primaryEmailAddress?.emailAddress}.
                  </strong>
                </p>
                <SignOutButton redirectUrl="/assurevantage/program-checkout">
                  <button className={styles.secondary} disabled={busy}>
                    Use a different account
                  </button>
                </SignOutButton>
              </div>
            ) : (
              <div className="health-landing">
                <p>
                  Create an account or sign in here. Your order stays on this
                  page.
                </p>
                <InlineAuth />
              </div>
            )}
          </Section>
          <Section number={4} title="Agent / Rep Selection">
            <AgentRepCodeSelector
              referralCode={cart.referralCode}
              onReferralCodeChange={setReferralCode}
              lockedFromUrl={cart.referralCodeSource === "url"}
            />
          </Section>
          <Section number={5} title="Confirm & Pay">
            <p>
              You authorize {formatPrice(subtotalCents)} for this order,
              recurring every {period} until canceled under your membership
              terms. Review and sign each agreement for your selected
              memberships.
            </p>
            <div className={styles.agreementChoices}>
              {cart.items.map((item) => (
                <div key={key(item)}>
                  <span>{membershipLabel(item)} membership agreement</span>
                  <button
                    className={styles.secondary}
                    disabled={!isSignedIn || busy}
                    onClick={() => setOpenProduct(item.productId)}
                  >
                    {signatures[key(item)]
                      ? "Signed — review again"
                      : "Review & sign agreement"}
                  </button>
                </div>
              ))}
            </div>
            {!isSignedIn && (
              <p className={styles.fine}>
                Complete Account in Step 3 to sign in your own name. You can
                review your order and pricing before creating an account.
              </p>
            )}
            <button
              className={styles.secondary}
              onClick={() => setTermsOpen(true)}
              disabled={busy}
            >
              {termsAccepted
                ? "Terms accepted — review again"
                : "Review & accept terms and non-insurance disclosure"}
            </button>
            <p className={styles.fine} style={{ marginTop: 20 }}>
              These memberships are not insurance. {START_DATE_NOTE}
            </p>
            {conflict && (
              <p role="alert">
                Essentials already includes Balance for Life. Remove the
                standalone Balance for Life membership to continue.
              </p>
            )}
            {error && (
              <p role="alert" className={styles.checkoutError}>
                {error}
              </p>
            )}
          </Section>
        </div>
        <aside className={styles.checkoutSummary} aria-label="Order Summary">
          <h2>Order Summary</h2>
          <ul className={styles.summaryItems}>
            {cart.items.map((item) => (
              <li key={item.productId}>
                <span>{membershipLabel(item)}</span>
                <strong>{formatPrice(charge(item))}</strong>
              </li>
            ))}
          </ul>
          <div className={styles.orderTotal}>
            <strong>Due Today</strong>
            <strong>{formatPrice(subtotalCents)}</strong>
          </div>
          <p>
            Renews {cart.cadence === "annual" ? "annually" : "monthly"} at{" "}
            {formatPrice(subtotalCents)} / {period}, unless canceled.
          </p>
          <ul className={styles.checkoutChecklist}>
            <li>
              {isSignedIn ? "✓ Account ready" : "Complete Account in Step 3"}
            </li>
            <li>
              {signedAll
                ? "✓ Agreements signed"
                : "Review and sign all agreements in Step 5"}
            </li>
            <li>
              {termsAccepted
                ? "✓ Terms accepted"
                : "Accept terms and non-insurance disclosure in Step 5"}
            </li>
          </ul>
          <button className={styles.button} onClick={pay} disabled={!canPay}>
            <Lock size={17} />
            {busy
              ? "Saving agreements & opening payment…"
              : "Proceed to Payment"}
          </button>
          <p className={styles.fine}>
            No payment is submitted until you continue through Stripe’s secure
            payment form.
          </p>
        </aside>
      </div>
      {signing &&
        (isMembershipProgramSlug(signing.product.slug) ? (
          <EssentialsMembershipModal
            key={key(signing)}
            isOpen
            onClose={() => setOpenProduct(null)}
            program={isBflSlug(signing.product.slug) ? "bfl" : "essentials"}
            onAccept={(signature) => {
              setSignatures((prev) => ({ ...prev, [key(signing)]: signature }));
              setOpenProduct(null);
            }}
            memberData={{
              memberName:
                user?.fullName || user?.primaryEmailAddress?.emailAddress || "",
              email: user?.primaryEmailAddress?.emailAddress || "",
              planName: membershipLabel(signing),
              periodicChargeCents: charge(signing),
            }}
          />
        ) : (
          <MembershipAgreementModal
            key={key(signing)}
            isOpen
            brandName="AssureVantage"
            onClose={() => setOpenProduct(null)}
            onAccept={(signature) => {
              setSignatures((prev) => ({ ...prev, [key(signing)]: signature }));
              setOpenProduct(null);
            }}
            memberData={{
              memberId: "Assigned after enrollment",
              memberName:
                user?.fullName || user?.primaryEmailAddress?.emailAddress || "",
              memberAddress: "",
              email: user?.primaryEmailAddress?.emailAddress || "",
              planName: membershipLabel(signing),
              groupCode: PROVIDER_GROUP_CODE,
              effectiveDate: "See your member card and welcome materials",
              billingInterval: cart.cadence,
              periodicChargeCents: charge(signing),
            }}
          />
        ))}
      <TermsAndConditionsModal
        brandName="AssureVantage"
        key={selectionKey}
        isOpen={termsOpen}
        onClose={() => setTermsOpen(false)}
        onAccept={() => {
          setAcceptedTerms(selectionKey);
          setTermsOpen(false);
        }}
      />
    </main>
  );
}
