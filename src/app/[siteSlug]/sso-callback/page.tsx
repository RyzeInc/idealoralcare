import { assureMetadata } from "@/lib/assure-metadata";
export const metadata = assureMetadata("sso-callback", {
  title: "Secure sign-in",
  description: "Completing your secure sign-in.",
});
export { default } from "@/app/health/sso-callback/page";
