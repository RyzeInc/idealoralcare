import {
  PublicDomainFrame,
  isAssureHost,
} from "@/components/assurevantage/PublicDomainFrame";
import { assureMetadata } from "@/lib/assure-metadata";
import PartnerKitClient from "./page.client";
import { existsSync } from "node:fs";
import path from "node:path";
import Link from "next/link";

const legacyMetadata = {
  title: "Partner Kit — Agreement & Acknowledgment | Ideal Oral Health",
  description:
    "Complete and sign the Ideal Oral Health Partner Agreement and W-9, or download and upload your completed forms.",
};

export async function generateMetadata() {
  return (await isAssureHost())
    ? assureMetadata("../register", {
        title: "Partner agreement",
        description:
          "Request the current partner documents for your enrollment.",
      })
    : legacyMetadata;
}

export default async function PartnerKitPage() {
  const kitAvailable = Array.from({ length: 8 }, (_, index) =>
    path.join(process.cwd(), "public", "partnerkit", `page-${index + 1}.jpg`),
  ).every((file) => existsSync(file));
  if (!kitAvailable)
    return (
      <PublicDomainFrame>
        <main className="mx-auto max-w-xl space-y-4 px-6 py-20">
          <h1 className="text-2xl font-semibold">
            Partner agreement currently unavailable
          </h1>
          <p>
            Please request the current partner agreement from your account
            contact before signing.
          </p>
          {(await isAssureHost()) && (
            <p>
              <a href="mailto:info@assurevantage.com?subject=Partner%20agreement%20request">
                Request partner documents from AssureVantage →
              </a>
            </p>
          )}
          <Link href="/register/rep" className="text-blue-700 underline">
            Register as a rep or agency
          </Link>
        </main>
      </PublicDomainFrame>
    );
  return (
    <PublicDomainFrame>
      <PartnerKitClient />
    </PublicDomainFrame>
  );
}
