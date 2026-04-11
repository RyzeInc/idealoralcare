import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Enroll | Ideal Health Oral Health Plan",
  description:
    "Enroll in an Ideal Health oral health plan. Choose your enrollment path — individual, broker-assisted, or group enrollment.",
};

export default function EnrollLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
