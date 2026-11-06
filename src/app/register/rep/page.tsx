import RepRegistrationClient from "./page.client";
import {
  PublicDomainFrame,
  isAssureHost,
} from "@/components/assurevantage/PublicDomainFrame";
import { assureMetadata } from "@/lib/assure-metadata";

const legacyMetadata = {
  title: "Broker / Agency / Rep Registration | Ideal Oral Health",
  description:
    "Submit broker, agency, and front-line rep onboarding details to Ideal Oral Health.",
};

export async function generateMetadata() {
  return (await isAssureHost())
    ? assureMetadata("../register/rep", {
        title: "Broker & agency registration",
        description: "Register your interest in working with AssureVantage.",
      })
    : legacyMetadata;
}

export default function RepRegistrationPage() {
  return (
    <PublicDomainFrame>
      <RepRegistrationClient />
    </PublicDomainFrame>
  );
}
