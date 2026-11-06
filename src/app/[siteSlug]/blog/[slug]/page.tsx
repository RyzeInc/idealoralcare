import LegacyPage, {
  generateMetadata as legacyMetadata,
} from "@/app/health/blog/[slug]/page";
import {
  ResourceArticle,
  GUIDES,
} from "@/components/assurevantage/InformationPages";
import { BLOG_POSTS } from "@/app/health/blog/posts";
import { notFound, permanentRedirect } from "next/navigation";
import { assureMetadata } from "@/lib/assure-metadata";
function legacyGuide(slug: string) {
  return slug.includes("teledentistry")
    ? "using-teledentistry"
    : /scan|oral-health|mouth|ai-/.test(slug)
      ? "getting-started-with-oral-scanning"
      : "understanding-dental-discounts";
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteSlug: string; slug: string }>;
}) {
  const p = await params;
  if (p.siteSlug !== "assurevantage")
    return legacyMetadata({ params: Promise.resolve(p) });
  const guide = GUIDES[p.slug];
  return guide
    ? assureMetadata(`blog/${p.slug}`, {
        title: guide.title,
        description: guide.intro,
      })
    : {};
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ siteSlug: string; slug: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const p = await params;
  if (p.siteSlug !== "assurevantage") return <LegacyPage params={params} />;
  if (!GUIDES[p.slug]) {
    if (BLOG_POSTS.some((post) => post.slug === p.slug)) {
      const ref = (await searchParams).ref;
      permanentRedirect(
        `/assurevantage/blog/${legacyGuide(p.slug)}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`,
      );
    }
    notFound();
  }
  return <ResourceArticle slug={p.slug} />;
}
