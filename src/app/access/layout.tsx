import {
  PublicDomainFrame,
  isAssureHost,
} from "@/components/assurevantage/PublicDomainFrame";
export async function generateMetadata() {
  return (await isAssureHost())
    ? {
        title: "Account access | AssureVantage",
        robots: { index: false, follow: false },
      }
    : {};
}
export default function Layout({ children }: { children: React.ReactNode }) {
  return <PublicDomainFrame>{children}</PublicDomainFrame>;
}
