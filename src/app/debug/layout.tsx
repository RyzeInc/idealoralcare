import { notFound } from "next/navigation";
import { isAdminRequest } from "@/lib/require-admin-request";

/**
 * Debug tools (email tester, previews) are internal. The email tester sends
 * real mail from our domain, so non-admins get a 404 rather than a hint that
 * the page exists.
 */
export default async function DebugLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminRequest())) notFound();
  return <>{children}</>;
}
