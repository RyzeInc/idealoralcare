import { CheckCircle, Clock, Info } from "lucide-react";
import { checkoutConfirmation } from "@/lib/checkout-confirmation";
import { START_DATE_NOTE } from "@/lib/assure-content";
import { AssureLink as Link } from "./AssureLink";
import styles from "./experience.module.css";
import { ClearCompletedCart } from "./ClearCompletedCart";
export async function EnrollmentConfirmation({
  sessionId,
}: {
  sessionId?: string;
}) {
  const state = await checkoutConfirmation(sessionId);
  const Icon =
    state === "received" ? CheckCircle : state === "processing" ? Clock : Info;
  return (
    <main>
      {state !== "unverified" && <ClearCompletedCart />}
      <section className={styles.pageHero}>
        <div className={`${styles.container} ${styles.narrow}`}>
          <span className={styles.icon}>
            <Icon size={28} />
          </span>
          <p className={styles.eyebrow}>Your enrollment</p>
          <h1>
            {state === "received"
              ? "Payment received. Here’s what happens next."
              : state === "processing"
                ? "Your payment is still processing."
                : "Check your enrollment status."}
          </h1>
          <p className={styles.lead}>
            {state === "received"
              ? "Your payment was confirmed. Membership setup and provider access follow your enrollment and program terms."
              : state === "processing"
                ? "Your checkout was completed, but payment has not yet been confirmed. You’ll find membership information in your portal as it becomes available."
                : "We couldn’t verify a completed checkout for this signed-in account. Sign in to the account used for enrollment and check your member portal, or contact support."}
          </p>
        </div>
      </section>
      <section className={styles.section}>
        <div className={`${styles.container} ${styles.narrow}`}>
          <ol className={styles.steps}>
            <li>
              Check your email for enrollment messages and member materials.
            </li>
            <li>
              Review your member card for your effective date and the programs
              you selected.
            </li>
            <li>
              Follow each provider’s registration instructions before arranging
              care.
            </li>
          </ol>
          <div className={styles.notice}>
            <h2 style={{ fontSize: "1.4rem" }}>
              Payment and benefit activation are different steps.
            </h2>
            <p>{START_DATE_NOTE}</p>
          </div>
          <div className={styles.actions}>
            <Link className={styles.button} href="/assurevantage/dashboard">
              Open your member portal
            </Link>
            <Link className={styles.secondary} href="/assurevantage/help">
              Get enrollment help
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
