import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import {
  CalendarCheck, Check, HeartHandshake, MessageCircle, MessageCircleHeart, ShieldCheck, Smartphone, Sparkles, Stethoscope,
} from "lucide-react";
import { NewIdealHeader, NewIdealFooter } from "@/components/newideal/NewIdealChrome";
import { BflEnrollButton } from "@/components/newideal/BflEnrollButton";
import { BFL_BRAND as B } from "@/convex/lib/bflBrand";
import styles from "./bfl.module.css";

/**
 * Balance for Life, sold on its own through Ideal Health.
 *
 * Styled to Balance for Life's own brand (balanceforlifebh.com) — their
 * violet and teal, Inter with Fraunces for display, pill buttons, warm canvas
 * — inside the Ideal site chrome, so it reads as their product offered by us.
 * Facts here match their site and welcome letter; pricing and terms are ours.
 */

const inter = Inter({ subsets: ["latin"], variable: "--bfl-sans", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], variable: "--bfl-display", display: "swap" });

export const metadata: Metadata = {
  title: "Balance for Life — Ideal Health",
  description:
    "Balance for Life through Ideal Health for $19.95/month: Zenn, an AI wellness companion available 24/7, plus up to 10 sessions with a licensed counselor per life event, and live support around the clock.",
};

const display = { fontFamily: "var(--bfl-display), Georgia, serif" } as const;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: B.teal }}>
      {children}
    </p>
  );
}

function SectionHeading({ eyebrow, title, intro, center = false }: { eyebrow: string; title: string; intro?: string; center?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: center ? "center" : "flex-start", textAlign: center ? "center" : "left" }}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 style={{ ...display, margin: 0, maxWidth: "24ch", fontSize: "clamp(1.5rem, 3vw, 2.25rem)", fontWeight: 600, lineHeight: 1.2, letterSpacing: "-0.01em", color: B.midnight }}>
        {title}
      </h2>
      {intro && <p style={{ margin: 0, maxWidth: "42rem", fontSize: "1.0625rem", lineHeight: 1.65, color: B.inkMuted }}>{intro}</p>}
    </div>
  );
}

function CheckItem({ title, body }: { title: string; body?: string }) {
  return (
    <li style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <span style={{ marginTop: 2, display: "flex", width: 24, height: 24, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: "50%", background: B.violet100, color: B.violet600 }} aria-hidden>
        <Check size={14} strokeWidth={3} />
      </span>
      <span>
        <span style={{ display: "block", fontSize: "1rem", fontWeight: body ? 600 : 400, color: B.ink }}>{title}</span>
        {body && <span style={{ display: "block", marginTop: 2, fontSize: "0.9rem", color: B.inkMuted }}>{body}</span>}
      </span>
    </li>
  );
}

const STEPS = [
  { icon: <MessageCircleHeart size={22} />, title: "Check in with Zenn, any hour", body: "Open the Balance for Life app when something is on your mind — 2 a.m. included. Zenn listens, helps you sort through it, and knows when to bring in a person." },
  { icon: <CalendarCheck size={22} />, title: "Get matched with a licensed counselor", body: "When you need more than a chat, you're connected to a licensed counselor, in your language, with up to 10 sessions per life event." },
  { icon: <HeartHandshake size={22} />, title: "Keep going between sessions", body: "Journal, mood check-ins, goals and expert-led workshops live in the same app, so progress doesn't stop when a session ends." },
];

const ALSO_INCLUDED = [
  { icon: <Sparkles size={20} />, title: "Coaching", body: "Life, work-life and wellness coaching, plus practical research and resources for everyday challenges." },
  { icon: <MessageCircle size={20} />, title: "Aware Mindfulness", body: "A six-week program to build self-awareness and emotional balance." },
  { icon: <Smartphone size={20} />, title: "Phone, video, text or chat", body: "Reach support however suits you — through the app, the member website, or by phone." },
  { icon: <Stethoscope size={20} />, title: "Preferred provider network", body: "Inpatient and outpatient care, including residential treatment, at additional self-pay cost or through your own insurance." },
];

export default function BalanceForLifePage() {
  return (
    <div className={`health-landing ${inter.variable} ${fraunces.variable}`} style={{ background: B.canvas, fontFamily: "var(--bfl-sans), system-ui, sans-serif", color: B.ink }}>
      <NewIdealHeader />

      {/* ── Hero ── */}
      <section style={{ background: "white", padding: "12px 12px 0" }} aria-labelledby="bfl-title">
        <div className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <Image src={B.logo} alt="Balance for Life" width={220} height={48} priority style={{ height: "auto", width: 200 }} />
              <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600, color: B.violet700 }}>Offered through Ideal Health</p>
              <h1 id="bfl-title" style={{ margin: 0, maxWidth: "18ch", fontSize: "clamp(2.4rem, 5.2vw, 3.6rem)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.02em", color: B.ink }}>
                Behavioral health care{" "}
                <span style={{ ...display, display: "block", fontWeight: 400, fontStyle: "italic", letterSpacing: 0 }}>right when you&nbsp;need&nbsp;it</span>
              </h1>
              <p style={{ margin: 0, maxWidth: "40ch", fontSize: "1.1875rem", lineHeight: 1.6, color: B.ink }}>
                Someone to talk to on the hard nights, and a licensed counselor when you&apos;re ready. $19.95 a month
                through Ideal Health.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 20, marginTop: 6 }}>
                <BflEnrollButton />
                <Link href="/newideal/essentials" style={{ fontSize: "0.95rem", fontWeight: 600, color: B.ink }}>
                  Already in the Essentials Plan →
                </Link>
              </div>
            </div>

            {/* Zenn conversation, drawn in their app's style */}
            <figure className={styles.phone} aria-hidden>
              <div style={{ borderRadius: "2.25rem", border: `6px solid ${B.midnight}`, background: B.midnight, boxShadow: B.shadowElevated }}>
                <div style={{ minHeight: 470, overflow: "hidden", borderRadius: "1.85rem", background: "white", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${B.hairline}`, padding: "22px 16px 12px" }}>
                    <span style={{ display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: "50%", background: B.violet100, color: B.violet600 }}>
                      <MessageCircle size={16} />
                    </span>
                    <div style={{ lineHeight: 1.2 }}>
                      <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600 }}>Zenn</p>
                      <p style={{ margin: 0, fontSize: "0.6875rem", color: B.inkMuted }}>AI wellness companion · available now</p>
                    </div>
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, padding: "16px 12px" }}>
                    {[
                      { me: true, text: "I can’t sleep. My mind won’t stop racing." },
                      { me: false, text: "That sounds exhausting. Want to try a two-minute grounding exercise, or talk it through first?" },
                      { me: true, text: "Talk first." },
                      { me: false, text: "Okay. What’s the thought that keeps coming back tonight?" },
                    ].map((m) => (
                      <p
                        key={m.text}
                        style={{
                          margin: 0, maxWidth: "85%", padding: "8px 12px", fontSize: "0.8125rem", lineHeight: 1.35,
                          alignSelf: m.me ? "flex-end" : "flex-start",
                          borderRadius: m.me ? "16px 16px 6px 16px" : "16px 16px 16px 6px",
                          background: m.me ? B.violet500 : B.surfaceMuted,
                          color: m.me ? "white" : B.ink,
                        }}
                      >
                        {m.text}
                      </p>
                    ))}
                  </div>
                  <div style={{ margin: "0 12px 12px", borderRadius: 12, background: B.tealSoft, padding: "10px 12px", fontSize: "0.6875rem", lineHeight: 1.35 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: B.teal }}>
                      <ShieldCheck size={14} /> A licensed counselor is one tap away
                    </span>
                    <span style={{ display: "block", marginTop: 2, color: B.inkMuted }}>
                      Zenn is an AI wellness companion, not a therapist or an emergency service.
                    </span>
                  </div>
                </div>
              </div>
            </figure>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ background: "white", padding: "clamp(48px, 7vw, 96px) 0" }}>
        <div className="container">
          <SectionHeading
            center
            eyebrow="How it works"
            title="Support that meets you where you are, then goes further"
            intro="Start with a conversation. Move to a licensed counselor when you need one. Keep the momentum in between."
          />
          <ol style={{ listStyle: "none", padding: 0, margin: "40px 0 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
            {STEPS.map((step, i) => (
              <li key={step.title} style={{ display: "flex", flexDirection: "column", gap: 12, borderRadius: 16, border: `1px solid ${B.hairline}`, background: B.canvas, padding: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ display: "flex", width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, background: B.violet100, color: B.violet600 }} aria-hidden>
                    {step.icon}
                  </span>
                  <span style={{ ...display, fontSize: "1.5rem", fontWeight: 500, color: B.violet300 }} aria-hidden>{i + 1}</span>
                </div>
                <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600, color: B.ink }}>{step.title}</h3>
                <p style={{ margin: 0, fontSize: "0.9875rem", lineHeight: 1.6, color: B.inkMuted }}>{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Meet Zenn + counselors ── */}
      <section style={{ background: B.canvas, padding: "clamp(48px, 7vw, 96px) 0" }}>
        <div className="container" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 48, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <SectionHeading
              eyebrow="Meet Zenn"
              title="An AI companion that knows when to bring in a person"
              intro="Zenn is there at the hour a friend might not be. It helps you name what's going on, offers something practical to try, and hands you to a licensed counselor when a conversation needs one."
            />
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
              <CheckItem title="Available 24/7, in 70 languages" body="No appointment, no waiting room." />
              <CheckItem title="Built for everyday stress" body="Sleep, work, parenting, relationships, the hard weeks." />
              <CheckItem title="A human is one tap away" body="Escalates to a licensed counselor when it matters." />
            </ul>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: B.inkSoft }}>
              Zenn is an AI wellness companion, not a therapist or an emergency service.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 22, background: B.surfaceMuted, borderRadius: 24, padding: "clamp(24px, 4vw, 40px)" }}>
            <SectionHeading
              eyebrow="Licensed counselors"
              title="A counselor who speaks your language"
              intro="Calls to the support line are answered live by a master's-level counselor, 24 hours a day. When you're ready for sessions, you're matched from a nationwide network."
            />
            <dl style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, margin: 0 }}>
              {[
                ["84,000+", "licensed counselors"],
                ["70", "languages spoken"],
                ["24/7", "Zenn is available"],
              ].map(([stat, label]) => (
                <div key={label}>
                  <dt style={{ ...display, fontSize: "clamp(1.5rem, 3vw, 1.875rem)", fontWeight: 600, color: B.violet600 }}>{stat}</dt>
                  <dd style={{ margin: "2px 0 0", fontSize: "0.8125rem", color: B.inkMuted }}>{label}</dd>
                </div>
              ))}
            </dl>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
              <CheckItem title="Up to 10 counseling sessions per life event, included" />
              <CheckItem title="Video, phone or in person, depending on where you are" />
              <CheckItem title="Crisis support answered live, around the clock" />
            </ul>
          </div>
        </div>
      </section>

      {/* ── Also included ── */}
      <section style={{ background: "white", padding: "clamp(48px, 7vw, 88px) 0" }}>
        <div className="container">
          <SectionHeading eyebrow="Also included" title="More than counseling" />
          <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 20 }}>
            {ALSO_INCLUDED.map((item) => (
              <article key={item.title} style={{ display: "flex", flexDirection: "column", gap: 10, borderRadius: 16, border: `1px solid ${B.hairline}`, background: B.canvas, padding: 22 }}>
                <span style={{ display: "flex", width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, background: B.tealSoft, color: B.teal }} aria-hidden>
                  {item.icon}
                </span>
                <h3 style={{ margin: 0, fontSize: "1.0625rem", fontWeight: 600 }}>{item.title}</h3>
                <p style={{ margin: 0, fontSize: "0.9375rem", lineHeight: 1.6, color: B.inkMuted }}>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Getting started through Ideal ── */}
      <section style={{ background: B.canvas, padding: "clamp(48px, 7vw, 88px) 0" }}>
        <div className="container" style={{ maxWidth: 820 }}>
          <SectionHeading eyebrow="Getting started" title="Enroll with Ideal Health, then just open the app" />
          <ol style={{ listStyle: "none", padding: 0, margin: "28px 0 0", display: "grid", gap: 16 }}>
            {[
              "Enroll online. Your membership starts the first of the month after you enroll.",
              "We email your welcome packet and member card, with your member code.",
              "Download the Balance for Life app on the App Store or Google Play — or call any time — and give your member code when asked.",
            ].map((step, i) => (
              <li key={step} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <span style={{ flexShrink: 0, display: "inline-flex", width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: "50%", background: B.violet500, color: "white", fontWeight: 600 }}>
                  {i + 1}
                </span>
                <p style={{ margin: "4px 0 0", fontSize: "1rem", lineHeight: 1.6 }}>{step}</p>
              </li>
            ))}
          </ol>
          <div style={{ marginTop: 32, borderRadius: 16, border: `1px solid ${B.hairline}`, background: "white", padding: "18px 20px" }}>
            {[
              "This is a membership program and is NOT insurance. It does not satisfy ACA minimum essential coverage.",
              "Preferred provider network services are at additional self-pay cost or through your own insurance.",
              "In an emergency, call 911, or call or text 988.",
            ].map((line) => (
              <p key={line} style={{ display: "flex", gap: 8, margin: "4px 0", fontSize: "0.8125rem", lineHeight: 1.55, color: B.inkMuted }}>
                <Check size={14} style={{ flexShrink: 0, marginTop: 3, color: B.teal }} /> {line}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: B.midnight, padding: "clamp(48px, 7vw, 80px) 0" }}>
        <div className="container" style={{ textAlign: "center", maxWidth: 640, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <h2 style={{ ...display, margin: 0, fontSize: "clamp(1.75rem, 3.2vw, 2.4rem)", fontWeight: 600, color: "white" }}>
            Real support, <span style={{ fontStyle: "italic", fontWeight: 400 }}>right when you&nbsp;need&nbsp;it</span>
          </h2>
          <p style={{ margin: 0, color: B.violet100, fontSize: "1.0625rem", lineHeight: 1.65 }}>
            Balance for Life for $19.95 a month. Want telehealth, labs and pharmacy savings too?{" "}
            <Link href="/newideal/essentials" style={{ color: "white", fontWeight: 600 }}>See Essentials</Link>.
          </p>
          <BflEnrollButton label="Get your membership" onDark />
        </div>
      </section>

      <NewIdealFooter />
    </div>
  );
}
