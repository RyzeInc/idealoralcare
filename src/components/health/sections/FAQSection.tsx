"use client";

import { useState, useRef } from "react";

const FAQS = [
  {
    question: "What exactly is included in the plan?",
    answer:
      "The Ideal Oral Health Plan includes Toothlens Smart Check AI scanning for at-home monitoring, 24/7 access to our Teledentistry Program specialists, member ID cards, and discounted access to the Dental Discount Network of thousands of dentists nationwide.",
  },
  {
    question: "Is this dental insurance?",
    answer:
      "No, this is a savings-based dental plan with discounts and teledentistry access. It serves as a complementary benefit for oral health care and prevention.",
  },
  {
    question: "How much does it cost?",
    answer:
      "Ideal Oral Health Plan membership is offered at an affordable flat monthly rate with no hidden fees. Visit our plans page for full pricing details.",
  },

  {
    question: "How do I access Toothlens teledentistry?",
    answer:
      "After enrollment, you will receive instructions to download the Toothlens Smart Check app. It is available on iOS and Android. Teledentistry consultations can be scheduled 24/7 through the app.",
  },
  {
    question: "Are there any restrictions or requirements?",
    answer:
      "This plan is available to individuals and groups. There is no medical underwriting. Anyone can enroll. Simply review the terms to ensure the plan aligns with your dental care needs.",
  },
  {
    question: "Can I keep my current dentist?",
    answer:
      "You can continue seeing your current dentist. Ideal Health works with thousands of dentists in the Dental Discount Network. We help you find participating providers near you.",
  },
  {
    question: "Is there a waiting period?",
    answer:
      "Your benefits are activated within 24 hours of enrollment. You can begin using Toothlens scanning, scheduling teledentistry appointments, and accessing network dentist discounts.",
  },
];

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}

function FAQItem({ question, answer, isOpen, onToggle }: FAQItemProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`faq-item ${isOpen ? "open" : ""}`}>
      <button className="faq-item__trigger" onClick={onToggle} aria-expanded={isOpen}>
        <span>{question}</span>
        <span className="faq-item__trigger-icon" aria-hidden="true">+</span>
      </button>
      <div
        className="faq-item__content"
        style={{ maxHeight: isOpen && contentRef.current ? contentRef.current.scrollHeight + "px" : "0" }}
      >
        <div className="faq-item__content-inner" ref={contentRef}>
          <p>{answer}</p>
        </div>
      </div>
    </div>
  );
}

export default function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section style={{ padding: "100px 0", backgroundColor: "#f8fafc" }}>
      <div className="container">
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <p
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#0066CC",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "1rem",
            }}
          >
            Common Questions
          </p>
          <h2>Frequently Asked Questions</h2>
        </div>

        <div className="faq-section">
          {FAQS.map((faq, idx) => (
            <FAQItem
              key={idx}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIdx === idx}
              onToggle={() => setOpenIdx(openIdx === idx ? null : idx)}
            />
          ))}
        </div>

        <div
          style={{
            marginTop: "4rem",
            padding: "32px",
            backgroundColor: "white",
            borderRadius: "16px",
            textAlign: "center",
            border: "1px solid #e2e8f0",
          }}
        >
          <h3 style={{ marginBottom: "0.75rem", color: "#0f172a" }}>Still have questions?</h3>
          <p style={{ margin: "0 0 1.25rem 0", color: "#475569" }}>
            Our member support team is ready to help.
          </p>
          <a
            href="/health/how-it-works"
            style={{
              display: "inline-block",
              backgroundColor: "#0066CC",
              color: "white",
              padding: "12px 28px",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: 600,
              transition: "all 0.2s ease",
            }}
          >
            Learn More
          </a>
        </div>
      </div>
    </section>
  );
}
