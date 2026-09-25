import type { Metadata } from "next";

// Metadata lives here because the page is a client component (it reads the
// site theme for the brand name).
export const metadata: Metadata = {
  title: "Teledentistry | 24/7 Virtual Dental Consultations | Ideal Health",
  description:
    "24/7/365 virtual consultations with licensed dentists via phone or video chat. Ideal Health Teledentistry — care on your schedule, wherever you are.",
  alternates: { canonical: "/health/teledentistry" },
  openGraph: {
    title: "24/7 Teledentistry — Talk to a Dentist Anytime",
    description:
      "Virtual dental consultations available 24/7/365 via phone or video. Get prescriptions, second opinions, and expert oral health guidance from home.",
    url: "https://getidealoh.com/health/teledentistry",
    images: [{ url: "/health-assets/teledentistr_1024x1024.png", width: 1024, height: 1024 }],
  },
};

export default function TeledentistryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
