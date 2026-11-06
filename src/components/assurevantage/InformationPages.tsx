import { ArrowRight, Check } from "lucide-react";
import { ASSURE_FAQS, START_DATE_NOTE, SERVICES } from "@/lib/assure-content";
import { FAQ, PageIntro, SectionCTA } from "./MarketingPages";
import { AssureLink as Link } from "./AssureLink";
import styles from "./experience.module.css";
import { GUIDES } from "@/lib/assure-guides";
export { GUIDES } from "@/lib/assure-guides";
export function HelpPage() {
  return (
    <main>
      <PageIntro
        eyebrow="We’re here to help"
        title="The right support, for what you need."
        intro="Membership questions and provider questions have different contacts. Start here to find the right team."
      />
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.supportGrid}>
            <article className={styles.benefitCard}>
              <h2 style={{ fontSize: "1.6rem" }}>
                Essentials & Balance for Life
              </h2>
              <p>
                For membership, welcome materials and help finding the correct
                benefit access instructions.
              </p>
              <a href="mailto:info@getidealhealth.com">
                info@getidealhealth.com
              </a>
              <a href="tel:8444332502">844-433-2502</a>
              <p className={styles.fine}>
                Monday–Friday, 9am–6pm. For provider-specific care, use the
                contact in your member packet.
              </p>
            </article>
            <article className={styles.benefitCard}>
              <h2 style={{ fontSize: "1.6rem" }}>Oral Care</h2>
              <p>
                For your oral membership, member card and help with dental
                program access.
              </p>
              <a href="mailto:support@getidealoh.com">support@getidealoh.com</a>
              <a href="tel:8446799367">(844) 679-9367</a>
              <p className={styles.fine}>
                These established Ideal support contacts continue to support
                AssureVantage memberships.
              </p>
            </article>
          </div>
          <div className={styles.notice} style={{ marginTop: 30 }}>
            <h3>New to AssureVantage?</h3>
            <p>
              For general information and employer or broker inquiries, email{" "}
              <a href="mailto:info@assurevantage.com">info@assurevantage.com</a>
              . For medical or dental care, use the provider instructions in
              your packet. This inbox is not an emergency care service.
            </p>
          </div>
          <div className={styles.actions}>
            <Link className={styles.button} href="/assurevantage/dashboard">
              Open member portal <ArrowRight size={18} />
            </Link>
            <Link className={styles.secondary} href="/assurevantage/faq">
              Questions & answers
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
export function HowItWorks() {
  return (
    <main>
      <PageIntro
        eyebrow="Membership, made clear"
        title="From choosing to using your benefits."
        intro="One place to understand your options, enroll and find your next step."
      />
      <section className={styles.section}>
        <div className={`${styles.container} ${styles.gridTwo}`}>
          <div>
            <h2>Know what happens next.</h2>
            <p>
              Our memberships bring access to specific services and discounts.
              Each provider has its own instructions, and your membership
              materials help you use them.
            </p>
            <div className={styles.notice}>
              <h3>Check your effective date</h3>
              <p>{START_DATE_NOTE}</p>
            </div>
          </div>
          <ol className={styles.steps}>
            <li>
              Explore the benefits and decide whether Essentials, Balance for
              Life, Oral Care or a combination fits your needs.
            </li>
            <li>
              Choose a household tier. Review the billing period, selected total
              and membership agreements.
            </li>
            <li>
              Sign in or create an account and complete enrollment using the
              available payment methods.
            </li>
            <li>
              Review your welcome materials for your member details, effective
              date and provider access instructions.
            </li>
            <li>
              Use your member portal for benefit guidance, documents and
              membership management.
            </li>
          </ol>
        </div>
      </section>
      <section className={`${styles.section} ${styles.tinted}`}>
        <div className={`${styles.container} ${styles.narrow}`}>
          <h2>Before you enroll.</h2>
          <FAQ
            items={[
              ASSURE_FAQS[1],
              ASSURE_FAQS[2],
              ASSURE_FAQS[5],
              ASSURE_FAQS[7],
            ]}
          />
        </div>
      </section>
      <SectionCTA />
    </main>
  );
}
export function CompareMemberships() {
  return (
    <main>
      <PageIntro
        eyebrow="Choose with confidence"
        title="See how your options fit together."
        intro="Start with the benefits you want. Balance for Life is included in Essentials; Oral Care can be purchased separately or alongside another membership."
      />
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption
                style={{ padding: 18, textAlign: "left", fontWeight: 600 }}
              >
                Included benefits by membership
              </caption>
              <thead>
                <tr>
                  <th scope="col">Benefit</th>
                  <th scope="col">Essentials</th>
                  <th scope="col">Balance for Life</th>
                  <th scope="col">Oral Care</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Virtual medical care", "Included", "—", "—"],
                  ["Eligible lab services", "Included", "—", "—"],
                  ["Prescription savings", "Included", "—", "—"],
                  ["Mental wellbeing support", "Included", "Included", "—"],
                  ["AI oral screening", "—", "—", "Included"],
                  ["Teledentistry", "—", "—", "Included"],
                  ["Dental discounts", "—", "—", "Included"],
                  [
                    "Billing",
                    "Monthly",
                    "Monthly",
                    "Monthly or eligible annual",
                  ],
                ].map((row) => (
                  <tr key={row[0]}>
                    <th scope="row">{row[0]}</th>
                    {row.slice(1).map((cell, i) => (
                      <td key={i}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.fine} style={{ marginTop: 20 }}>
            A dash means that service is not included in that standalone
            membership. Provider eligibility, availability and program terms
            apply. Prices and household tiers are shown in the catalog.
          </p>
          <div className={styles.actions}>
            <Link className={styles.button} href="/assurevantage/program-plans">
              See memberships & pricing <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
export function FAQPage() {
  return (
    <main>
      <PageIntro
        eyebrow="Questions & answers"
        title="A clearer picture of your membership."
        intro="Understand how AssureVantage memberships work, what is included and where to find help."
      />
      <section className={styles.section}>
        <div className={`${styles.container} ${styles.narrow}`}>
          <FAQ />
          <h2 style={{ marginTop: 48 }}>Questions about a specific benefit?</h2>
          <div className={styles.gridTwo}>
            {Object.entries(SERVICES).map(([key, s]) => (
              <Link
                className={styles.textLink}
                key={key}
                href={`/assurevantage/${key}`}
              >
                {s.label} <ArrowRight size={16} />
              </Link>
            ))}
          </div>
          <p style={{ marginTop: 32 }}>
            Still need help?{" "}
            <Link href="/assurevantage/help">
              Contact your membership support team.
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
export function Resources() {
  return (
    <main>
      <PageIntro
        eyebrow="Guides & resources"
        title="A little preparation. A clearer next step."
        intro="Practical guides to help you understand and use each part of your membership."
      />
      <section className={styles.section}>
        <div className={`${styles.container} ${styles.grid}`}>
          {Object.entries(GUIDES).map(([slug, g]) => (
            <article className={styles.benefitCard} key={slug}>
              <span className={styles.tag}>{SERVICES[g.key].label}</span>
              <h2 style={{ fontSize: "1.4rem" }}>{g.title}</h2>
              <p>{g.intro}</p>
              <Link
                className={styles.textLink}
                href={`/assurevantage/blog/${slug}`}
              >
                Read guide <ArrowRight size={16} />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
export function ResourceArticle({ slug }: { slug: string }) {
  const g = GUIDES[slug];
  return (
    <main>
      <PageIntro
        eyebrow={`${SERVICES[g.key].label} · Member guide`}
        title={g.title}
        intro={g.intro}
      />
      <article className={`${styles.section} ${styles.prose}`}>
        <div className={`${styles.container} ${styles.narrow}`}>
          <Link href="/assurevantage/blog">← All guides</Link>
          <p className={styles.articleMeta}>
            AssureVantage · Updated November 6, 2026
          </p>
          {g.sections.map(([title, copy]) => (
            <section key={title}>
              <h2>{title}</h2>
              <p>{copy}</p>
            </section>
          ))}
          <div className={styles.notice} style={{ marginTop: 32 }}>
            <p>{START_DATE_NOTE}</p>
          </div>
          <div className={styles.actions}>
            <Link className={styles.button} href={`/assurevantage/${g.key}`}>
              Explore {SERVICES[g.key].label.toLowerCase()}{" "}
              <ArrowRight size={18} />
            </Link>
            <Link className={styles.secondary} href="/assurevantage/help">
              Get help
            </Link>
          </div>
          <p className={styles.fine}>
            This guide explains membership use. Your selected program’s current
            agreement and provider instructions govern access, eligibility and
            included services.
          </p>
        </div>
      </article>
    </main>
  );
}
export function AboutPage() {
  return (
    <main>
      <PageIntro
        eyebrow="About AssureVantage"
        title="Better access. Greater value. More peace of mind."
        intro="We bring everyday healthcare access, mental wellbeing and oral care memberships together so you can understand your options and take the next step."
      />
      <section className={styles.section}>
        <div className={`${styles.container} ${styles.gridTwo}`}>
          <div>
            <h2>Support for everyday decisions.</h2>
            <p>
              Some days you need a clinician’s advice. Other days it’s a
              prescription, a lab visit or someone to talk to. AssureVantage
              offers membership options for those different needs, with clear
              information about what each includes.
            </p>
            <p>
              Services are delivered through the relevant program providers.
              Essentials brings Lyric virtual care, QuestSelect, RxValet and
              Balance for Life together. Oral Care combines AI oral screening,
              DialCare teledentistry and participating dental network discounts.
            </p>
          </div>
          <div className={styles.notice}>
            <h3>Understand the membership model</h3>
            <p>
              These programs provide specified services and discounts. They are
              not insurance and do not replace medical or dental insurance.
              Review the relevant membership terms and check your benefit
              effective date.
            </p>
            <Link href="/assurevantage/compare" className={styles.textLink}>
              See what each membership includes <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
      <SectionCTA />
    </main>
  );
}
export function EmployersPage() {
  return (
    <main>
      <PageIntro
        eyebrow="For employers & brokers"
        title="Bring clearer benefit options to your team."
        intro="Explore everyday medical, mental wellbeing and oral care memberships, then talk with us about the right enrollment approach for your group."
      />
      <section className={styles.section}>
        <div className={`${styles.container} ${styles.gridTwo}`}>
          <div>
            <h2>Start with the needs of your group.</h2>
            <ul className={styles.list}>
              {[
                "Understand the services and membership combinations available.",
                "Discuss household tiers, eligibility, billing and the intended effective date.",
                "Agree the group setup and member communication before launch.",
              ].map((text) => (
                <li key={text}>
                  <Check size={18} />
                  {text}
                </li>
              ))}
            </ul>
            <div className={styles.actions}>
              <a
                className={styles.button}
                href="mailto:info@assurevantage.com?subject=Employer%20or%20broker%20inquiry"
              >
                Discuss your group <ArrowRight size={18} />
              </a>
              <Link className={styles.secondary} href="/register/rep">
                Broker registration
              </Link>
            </div>
          </div>
          <div className={styles.notice}>
            <h3>Already working with us?</h3>
            <p>
              Employer eligibility uploads and partner tools require your
              assigned account access. Signing in does not create a new employer
              agreement or change an existing group’s benefits.
            </p>
            <Link href="/employer" className={styles.textLink}>
              Employer sign-in →
            </Link>
            <p style={{ marginTop: 18 }}>
              Need a reseller or partner agreement? Request the current
              documents from your account contact before signing.
            </p>
          </div>
        </div>
      </section>
      <CompareMembershipsSummary />
    </main>
  );
}
function CompareMembershipsSummary() {
  return (
    <section className={`${styles.section} ${styles.tinted}`}>
      <div className={styles.container}>
        <h2>Get to know the offering.</h2>
        <p>
          Essentials, Balance for Life and Oral Care have different inclusions.
          Explore the standard options before discussing group-specific
          arrangements.
        </p>
        <Link href="/assurevantage/compare" className={styles.textLink}>
          Compare memberships <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
export function TermsPage() {
  return (
    <main>
      <PageIntro
        eyebrow="Program information"
        title="Membership terms & disclosures."
        intro="Understand what you’re purchasing. Your selected membership agreement contains the terms that apply to your enrollment."
      />
      <section className={`${styles.section} ${styles.prose}`}>
        <div className={`${styles.container} ${styles.narrow}`}>
          <h2>Membership programs, not insurance</h2>
          <p>
            AssureVantage memberships provide access to specified third-party
            services and discounts. They do not replace medical or dental
            insurance. Services, family eligibility, exclusions, cancellation
            and refund rights follow the agreement presented for your selected
            membership.
          </p>
          <h2>Essentials and Balance for Life</h2>
          <p>
            Essentials includes virtual medical care, eligible lab services,
            prescription savings and Balance for Life. Balance for Life is also
            sold separately. Oral Care is an additional purchase. Clinical
            eligibility, provider availability and program rules apply. Referred
            or excluded care may have additional costs.
          </p>
          <p>{START_DATE_NOTE}</p>
          <h2>Oral Care disclosure</h2>
          <p>
            <strong>
              THIS PLAN IS NOT INSURANCE and is not intended to replace health
              insurance.
            </strong>{" "}
            This plan does not meet the minimum creditable coverage requirements
            under M.G.L. c.111M and 956 CMR 5.00. This plan is not a Qualified
            Health Plan under the Affordable Care Act. The range of discounts
            will vary depending on the type of provider and service. The plan
            does not pay providers directly. Plan members must pay for all
            services but will receive a discount from participating providers. A
            written list of participating providers is available upon request.
          </p>
          <p>
            You may cancel within the first 30 days after effective date or
            receipt of membership materials (whichever is later) and receive a
            full refund. Discount Plan Organization and administrator:
            Careington International Corporation, 7400 Gaylord Parkway, Frisco,
            TX 75034; phone 800-441-0380. This dental discount plan is not
            available in Vermont or Washington.
          </p>
          <h2>Your documents and membership</h2>
          <p>
            Review the agreement before completing checkout. Your welcome
            materials and member portal provide your membership information and
            access instructions. If you need a copy of an agreement or help with
            cancellation, contact the support team for your membership.
          </p>
          <Link href="/assurevantage/help" className={styles.textLink}>
            Find membership support →
          </Link>
        </div>
      </section>
    </main>
  );
}
export function PrivacyPage() {
  return (
    <main>
      <PageIntro
        eyebrow="Your information"
        title="Privacy policy."
        intro="How information is used to operate and support AssureVantage membership services."
      />
      <section className={`${styles.section} ${styles.prose}`}>
        <div className={`${styles.container} ${styles.narrow}`}>
          <p>
            We collect information you provide when enrolling, managing your
            account or contacting support, including your name, contact details,
            membership information and information needed to facilitate
            services. Payment and billing information is processed through our
            payment service providers.
          </p>
          <h2>How information is used</h2>
          <p>
            Information is used to process enrollment, administer membership,
            communicate about services, provide support and comply with legal
            obligations. Relevant information may be shared with program
            providers to facilitate your membership and requested services. We
            do not sell your personal information to third parties.
          </p>
          <h2>Provider services</h2>
          <p>
            Clinical, pharmacy, laboratory, dental and wellbeing services may be
            delivered by separate providers. Their services have their own
            notices and privacy practices. Review those notices when registering
            with or using a provider.
          </p>
          <h2>Security and choices</h2>
          <p>
            We use technical and organizational measures to protect personal
            information. No internet transmission or storage method is
            completely secure. Depending on applicable law, you may have rights
            to access, correct or delete personal information. Contact
            membership support for assistance with your information or
            communication preferences.
          </p>
          <h2>Contact</h2>
          <p>
            For questions about AssureVantage information practices, email{" "}
            <a href="mailto:info@assurevantage.com">info@assurevantage.com</a>.
            For account-specific requests,{" "}
            <Link href="/assurevantage/help">
              find your membership support team
            </Link>
            .
          </p>
          <p className={styles.fine}>Updated November 6, 2026.</p>
        </div>
      </section>
    </main>
  );
}
