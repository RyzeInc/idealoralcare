import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;
  const { userId } = await auth();
  if (!userId)
    redirect(
      `/${siteSlug}/sign-in?redirect_url=${encodeURIComponent(`/${siteSlug}/manage-plans`)}`,
    );
  return <>{children}</>;
}
