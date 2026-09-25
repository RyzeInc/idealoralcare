"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function SiteComparePage() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/${pathname.split("/")[1]}/plans`);
  }, [pathname, router]);
  return null;
}
