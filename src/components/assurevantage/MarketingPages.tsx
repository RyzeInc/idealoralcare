import {
  SERVICE_MARKETING_FEATURES,
  type SiteMarketingFeature,
} from "@/convex/lib/siteMarketing";
import { OfferingSummary } from "./OfferingSummary";
import { SiteMarketing } from "@/components/health/SiteMarketing";
import Image from "next/image";
import { MembershipPhoto } from "./MembershipPhoto";
import {
  ArrowRight,
  Check,
  HeartPulse,
  Brain,
  Smile,
  Stethoscope,
  FlaskConical,
  Pill,
  ScanLine,
  Video,
  BadgeCheck,
  ShieldCheck,
} from "lucide-react";
import {
  SERVICES,
  ASSURE_FAQS,
  START_DATE_NOTE,
  BFL_SESSION_NOTE,
  type ServiceKey,
} from "@/lib/assure-content";
import { AssureLink as Link } from "./AssureLink";
import styles from "./experience.module.css";
const ICONS = {
  "virtual-care": Stethoscope,
  labs: FlaskConical,
  pharmacy: Pill,
  "balance-for-life": Brain,
  "oral-health-scan": ScanLine,
  teledentistry: Video,
  discount: Smile,
};
export function FAQ({ items = ASSURE_FAQS }: { items?: [string, string][] }) {
  return (
    <div className={styles.faq}>
      {items.map(([question, answer]) => (
        <details key={question}>
          <summary>{question}</summary>
          <p>{answer}</p>
        </details>
      ))}
    </div>
  );
}
export function SectionCTA() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.cta}>
          <div>
            <h2>Make room for your wellbeing.</h2>
            <p>
              Understand your options, choose what fits and keep your membership
              in one place.
            </p>
          </div>
          <Link href="/assurevantage/program-plans" className={styles.button}>
            Explore memberships <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
export function PageIntro({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro: string;
}) {
  return (
    <section className={styles.pageHero}>
      <div className={styles.container}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>{title}</h1>
        <p className={styles.lead}>{intro}</p>
      </div>
    </section>
  );
}
export function BenefitCards({
  keys = Object.keys(SERVICES) as ServiceKey[],
  compact = false,
}: {
  keys?: ServiceKey[];
  compact?: boolean;
}) {
  return (
    <div className={`${styles.grid} ${compact ? styles.overviewGrid : ""}`}>
      {keys.map((key) => {
        const service = SERVICES[key],
          Icon = ICONS[key];
        const feature = SERVICE_MARKETING_FEATURES[key];
        const card = (
          <article className={styles.benefitCard}>
            <span className={styles.icon}>
              <Icon size={23} aria-hidden="true" />
            </span>
            <h3>{service.label}</h3>
            <p>
              {key === "balance-for-life" ? (
                <OfferingSummary program="bfl" />
              ) : compact ? (
                {
                  "virtual-care":
                    "Medical advice through virtual urgent, primary and dermatology care.",
                  labs: "Eligible lab services, with clear ordering and access instructions.",
                  pharmacy:
                    "Check eligible medications and understand your prescription savings.",
                  "balance-for-life":
                    "Live support, counseling and everyday mental wellbeing resources.",
                  "oral-health-scan":
                    "A guided smartphone screening to discuss with your dentist.",
                  teledentistry:
                    "Remote dental guidance when you need a next step.",
                  discount:
                    "Participating dental providers and negotiated member rates.",
                }[key]
              ) : (
                service.intro
              )}
            </p>
            <Link className={styles.textLink} href={`/assurevantage/${key}`}>
              Explore{" "}
              {service.label.startsWith("AI")
                ? "AI oral scanning"
                : service.label.toLowerCase()}{" "}
              <ArrowRight size={16} />
            </Link>
          </article>
        );
        return feature ? (
          <SiteMarketing feature={feature} key={key}>
            {card}
          </SiteMarketing>
        ) : (
          <div key={key} style={{ display: "contents" }}>
            {card}
          </div>
        );
      })}
    </div>
  );
}
export function AssureHome() {
  return (
    <main>
      <section className={styles.hero}>
        <div className={`${styles.container} ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Healthcare access for real life</p>
            <h1>
              Better access.
              <br />
              Greater value.
              <br />
              <span style={{ color: "#006b68" }}>More peace of mind.</span>
            </h1>
            <p className={styles.lead}>
              From a doctor’s visit to someone to talk to, find everyday care
              and support through AssureVantage. Explore medical, mental
              wellbeing and oral care memberships built around the way you live.
            </p>
            <div className={styles.actions}>
              <Link
                href="/assurevantage/program-plans"
                className={styles.button}
              >
                Find your membership <ArrowRight size={18} />
              </Link>
              <Link
                href="/assurevantage/how-it-works"
                className={styles.secondary}
              >
                See how it works
              </Link>
            </div>
            <p className={styles.fine}>
              Membership programs, not insurance. Choose individual services or
              a bundle of benefits. Eligibility and program terms apply.
            </p>
          </div>
          <div>
            <div className={styles.heroImage}>
              <Image
                src="/newideal/site-files/happy-family.png"
                alt="A family spending time together at home"
                fill
                priority
                sizes="(max-width: 900px) 100vw, 500px"
              />
            </div>
            <div className={styles.imageNote}>
              <strong>Different needs. One place to start.</strong>
              <p>Medical care · Mental wellbeing · Oral health</p>
            </div>
          </div>
        </div>
      </section>
      <div className={`${styles.container} ${styles.trustStrip}`}>
        <span>
          <HeartPulse size={19} /> Everyday care and support
        </span>
        <span>
          <BadgeCheck size={19} /> Understand what’s included
        </span>
        <span>
          <ShieldCheck size={19} /> Memberships with clear next steps
        </span>
      </div>
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>A little support goes a long way</p>
              <h2>Care for more of your everyday.</h2>
              <p>
                Get to know each benefit, what it can help with and how to use
                it. We’ll show you which membership includes it.
              </p>
            </div>
            <Link
              href="/assurevantage/program-plans"
              className={styles.textLink}
            >
              Compare memberships <ArrowRight size={16} />
            </Link>
          </div>
          <BenefitCards
            compact
            keys={[
              "virtual-care",
              "labs",
              "pharmacy",
              "balance-for-life",
              "oral-health-scan",
              "teledentistry",
            ]}
          />
          <SiteMarketing feature="dentalDiscount">
            <p style={{ marginTop: 24 }}>
              Planning an in-person dental visit?{" "}
              <Link href="/assurevantage/discount">
                Explore the dental discount network →
              </Link>
            </p>
          </SiteMarketing>
        </div>
      </section>
      <section className={`${styles.section} ${styles.tinted}`}>
        <div className={styles.container}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Choose what fits</p>
              <h2>One brand. Options for your life.</h2>
              <p>
                Essentials brings everyday healthcare services together. Balance
                for Life is also available on its own. Add Oral Care separately
                for dental benefits.
              </p>
            </div>
          </div>
          <div className={styles.grid}>
            {[
              {
                path: "essentials",
                title: "Essentials",
                icon: HeartPulse,
                copy: "Virtual medical care, eligible labs, prescription savings and Balance for Life together.",
                note: "Balance for Life included. Oral Care purchased separately.",
              },
              {
                path: "balance-for-life",
                title: "Balance for Life",
                icon: Brain,
                copy: "Mental wellbeing support, live help and short-term counseling as a standalone membership.",
                note: "Already included if you choose Essentials.",
              },
              {
                path: "oralcare",
                title: "Oral Care",
                icon: Smile,
                copy: "AI oral screening, virtual dental consultations and participating dental network discounts.",
                note: "Choose it alone or add it to another membership.",
              },
            ].map((item) => (
              <article className={styles.benefitCard} key={item.path}>
                <MembershipPhoto
                  program={
                    item.path === "essentials"
                      ? "essentials"
                      : item.path === "balance-for-life"
                        ? "bfl"
                        : "oral"
                  }
                />
                <span className={styles.icon}>
                  <item.icon size={24} />
                </span>
                <h3>{item.title}</h3>
                <p>
                  <OfferingSummary
                    program={
                      item.path === "balance-for-life"
                        ? "bfl"
                        : (item.path as "essentials" | "oralcare")
                    }
                  />
                </p>
                <p className={styles.fine}>{item.note}</p>
                <Link
                  href={`/assurevantage/${item.path}`}
                  className={styles.textLink}
                >
                  Explore {item.title} <ArrowRight size={16} />
                </Link>
              </article>
            ))}
          </div>
          <div className={styles.actions}>
            <Link href="/assurevantage/program-plans" className={styles.button}>
              View current pricing <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
      <SiteMarketing feature="howItWorks">
        <section className={styles.section}>
          <div className={`${styles.container} ${styles.gridTwo}`}>
            <div>
              <p className={styles.eyebrow}>
                From joining to using your benefits
              </p>
              <h2>A clear next step, every step.</h2>
              <p>
                You should know what you’re choosing and where to go when you
                need help.
              </p>
              <Link
                href="/assurevantage/how-it-works"
                className={styles.textLink}
              >
                How membership works <ArrowRight size={16} />
              </Link>
            </div>
            <ol className={styles.steps}>
              <li>Explore benefits and compare the membership options.</li>
              <li>
                Choose your household tier and review the price, agreements and
                billing period.
              </li>
              <li>
                Check your effective date and use your welcome packet to access
                each provider.
              </li>
            </ol>
          </div>
        </section>
      </SiteMarketing>
      <SiteMarketing feature="faq">
        <section className={`${styles.section} ${styles.tinted}`}>
          <div className={`${styles.container} ${styles.narrow}`}>
            <p className={styles.eyebrow}>Before you choose</p>
            <h2>Good questions. Clear answers.</h2>
            <FAQ items={ASSURE_FAQS.slice(0, 4)} />
            <div className={styles.actions}>
              <Link href="/assurevantage/faq" className={styles.textLink}>
                More questions & answers <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      </SiteMarketing>
      <SectionCTA />
    </main>
  );
}
export function ServicePage({ serviceKey }: { serviceKey: ServiceKey }) {
  const s = SERVICES[serviceKey];
  return (
    <main>
      <section className={styles.hero}>
        <div className={`${styles.container} ${styles.heroGrid}`}>
          <div>
            <p className={styles.eyebrow}>{s.eyebrow}</p>
            <h1>{s.title}</h1>
            <p className={styles.lead}>
              {serviceKey === "balance-for-life" ? (
                <OfferingSummary program="bfl" />
              ) : (
                s.intro
              )}
            </p>
            <div className={styles.actions}>
              <Link
                href="/assurevantage/program-plans"
                className={styles.button}
              >
                Explore memberships <ArrowRight size={18} />
              </Link>
              <Link
                href="/assurevantage/dashboard"
                className={styles.secondary}
              >
                Already a member?
              </Link>
            </div>
            <p className={styles.fine}>{s.included}</p>
          </div>
          <div className={styles.heroImage}>
            <Image
              src={`/newideal/site-files/${s.image}`}
              alt={s.label}
              fill
              priority
              sizes="(max-width: 900px) 100vw, 500px"
            />
          </div>
        </div>
      </section>
      <section className={styles.section}>
        <div className={`${styles.container} ${styles.gridTwo}`}>
          <div>
            <p className={styles.eyebrow}>What you can use</p>
            <h2>Know your benefit.</h2>
            <ul className={styles.list}>
              {s.items.map((item, index) => (
                <ServiceItem key={item} service={serviceKey} index={index}>
                  <li>
                    <Check size={18} />
                    {item}
                  </li>
                </ServiceItem>
              ))}
            </ul>
          </div>
          <div>
            <p className={styles.eyebrow}>Getting started</p>
            <h2>How to access it.</h2>
            <ol className={styles.steps}>
              {s.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      </section>
      <section className={`${styles.section} ${styles.tinted}`}>
        <div className={`${styles.container} ${styles.narrow}`}>
          <h2>A few things to understand.</h2>
          <p>{s.limits}</p>
          <div className={styles.notice}>
            <h3>Your benefit start date</h3>
            <p>{START_DATE_NOTE}</p>
          </div>
        </div>
      </section>
      <SiteMarketing feature="faq">
        <section className={styles.section}>
          <div className={`${styles.container} ${styles.narrow}`}>
            <h2>Questions about {s.label.toLowerCase()}?</h2>
            <FAQ items={s.faq} />
            <p style={{ marginTop: 24 }}>
              Need a hand?{" "}
              <Link href="/assurevantage/help">
                Find the right support contact.
              </Link>
            </p>
          </div>
        </section>
      </SiteMarketing>
      <SectionCTA />
    </main>
  );
}
export function ProgramPage({
  program,
}: {
  program: "essentials" | "oralcare";
}) {
  const essentials = program === "essentials";
  const keys: ServiceKey[] = essentials
    ? ["virtual-care", "labs", "pharmacy", "balance-for-life"]
    : ["oral-health-scan", "teledentistry", "discount"];
  return (
    <main>
      <section className={styles.hero}>
        <div className={`${styles.container} ${styles.heroGrid}`}>
          <div>
            <p className={styles.eyebrow}>
              {essentials ? "Essentials membership" : "Oral Care membership"}
            </p>
            <h1>
              {essentials
                ? "Everyday care, thoughtfully brought together."
                : "Look after your smile. Understand your options."}
            </h1>
            <p className={styles.lead}>
              <OfferingSummary program={program} />
            </p>
            <div className={styles.actions}>
              <Link
                href={`/assurevantage/program-plans${essentials ? "?offering=essentials" : "?offering=oral"}`}
                className={styles.button}
              >
                See options & pricing <ArrowRight size={18} />
              </Link>
              <Link href="/assurevantage/compare" className={styles.secondary}>
                Compare memberships
              </Link>
            </div>
            <p className={styles.fine}>
              {essentials
                ? "Balance for Life is included. Oral Care is available as a separate purchase."
                : "Available on its own or as a separate addition to Essentials. This is not dental insurance."}
            </p>
          </div>
          <div className={styles.heroImage}>
            <Image
              src={`/newideal/site-files/${essentials ? "doctor-with-patients.png" : "pinky-swear.png"}`}
              alt={
                essentials
                  ? "A clinician speaking with a patient"
                  : "People joining hands"
              }
              fill
              priority
              sizes="(max-width: 900px) 100vw, 500px"
            />
          </div>
        </div>
      </section>
      <SiteMarketing anyOf={keys.map((key) => SERVICE_MARKETING_FEATURES[key])}>
        {" "}
        <section className={styles.section}>
          <div className={styles.container}>
            <p className={styles.eyebrow}>Included in this membership</p>
            <h2>
              {essentials
                ? "Explore your everyday care services."
                : "Explore your oral health services."}
            </h2>
            <BenefitCards keys={keys} />
          </div>
        </section>
      </SiteMarketing>
      <section className={`${styles.section} ${styles.tinted}`}>
        <div className={`${styles.container} ${styles.gridTwo}`}>
          <div>
            <h2>Membership that’s easy to understand.</h2>
            <ul className={styles.list}>
              <li>
                <Check size={18} />
                {essentials
                  ? "Choose individual, spouse, child or family tiers in the catalog."
                  : "Choose individual or family membership in the catalog."}
              </li>
              <li>
                <Check size={18} />
                {essentials
                  ? "Simple monthly billing. Your selected tier and total are shown before payment."
                  : "Compare eligible monthly and annual billing options before payment."}
              </li>
              <li>
                <Check size={18} />
                {essentials
                  ? BFL_SESSION_NOTE
                  : "Savings depend on your chosen provider and procedure. Confirm participation and fees before care."}
              </li>
            </ul>
          </div>
          <div className={styles.notice}>
            <h3>Before arranging care</h3>
            <p>{START_DATE_NOTE}</p>
            <p>
              {essentials
                ? "Provider rules, eligible services and exclusions apply. Review your membership agreement and provider instructions."
                : "The dental discount program is not available in Vermont or Washington. Review your membership agreement and program disclosures."}
            </p>
          </div>
        </div>
      </section>
      <SiteMarketing feature="faq">
        <section className={styles.section}>
          <div className={`${styles.container} ${styles.narrow}`}>
            <h2>Your questions, answered.</h2>
            <FAQ
              items={
                essentials
                  ? [
                      ASSURE_FAQS[1],
                      ASSURE_FAQS[3],
                      ASSURE_FAQS[4],
                      ASSURE_FAQS[5],
                    ]
                  : [
                      ASSURE_FAQS[1],
                      ASSURE_FAQS[2],
                      ASSURE_FAQS[3],
                      SERVICES.discount.faq[0],
                    ]
              }
            />
          </div>
        </section>
      </SiteMarketing>
      <SectionCTA />
    </main>
  );
}

function ServiceItem({
  service,
  index,
  children,
}: {
  service: ServiceKey;
  index: number;
  children: React.ReactNode;
}) {
  const features: SiteMarketingFeature[] = [
    "bflCounseling",
    "bflLiveSupport",
    "bflAiCompanion",
    "bflCoaching",
  ];
  return service === "balance-for-life" ? (
    <SiteMarketing feature={features[index]}>{children}</SiteMarketing>
  ) : (
    <>{children}</>
  );
}
