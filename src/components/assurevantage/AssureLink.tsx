"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";
import { ASSURE_URL } from "@/lib/assure-content";
export function AssureLink({ href, ...props }: ComponentProps<typeof Link>) {
  const params = useSearchParams();
  let target = href;
  if (typeof href === "string" && href.startsWith("/")) {
    const url = new URL(href, ASSURE_URL);
    const ref = params?.get("ref");
    if (ref && !url.searchParams.has("ref")) url.searchParams.set("ref", ref);
    target = (href === "/" ? ASSURE_URL : url.pathname) + url.search + url.hash;
  }
  return <Link {...props} href={target} />;
}
