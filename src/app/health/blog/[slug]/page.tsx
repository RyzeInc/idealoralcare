import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import HealthHeader from "@/components/health/HealthHeader";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { BLOG_POSTS, getPostBySlug } from "../posts";
import { blogContent } from "./content";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/health/blog/${post.slug}` },
    keywords: post.keywords,
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: `https://getidealoh.com/health/blog/${post.slug}`,
      publishedTime: post.datePublished,
      authors: ["Ideal Health"],
      images: [{ url: "/health-assets/og-default.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const content = blogContent[slug];
  if (!content) notFound();

  return (
    <div className="health-landing">
      <HealthHeader />

      <ArticleJsonLd
        title={post.title}
        description={post.description}
        url={`https://getidealoh.com/health/blog/${post.slug}`}
        datePublished={post.datePublished}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "https://getidealoh.com/health" },
          { name: "Blog", url: "https://getidealoh.com/health/blog" },
          { name: post.title, url: `https://getidealoh.com/health/blog/${post.slug}` },
        ]}
      />

      <article style={{ padding: "4rem 0" }}>
        <div className="container" style={{ maxWidth: "780px", margin: "0 auto" }}>
          {/* Breadcrumb */}
          <nav style={{ marginBottom: "2rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>
            <Link href="/health" style={{ color: "var(--primary-blue)", textDecoration: "none" }}>Home</Link>
            {" / "}
            <Link href="/health/blog" style={{ color: "var(--primary-blue)", textDecoration: "none" }}>Blog</Link>
            {" / "}
            <span>{post.title}</span>
          </nav>

          {/* Header */}
          <header style={{ marginBottom: "3rem" }}>
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--primary-blue)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {post.category}
              </span>
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{post.readTime}</span>
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                {new Date(post.datePublished).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </span>
            </div>
            <h1 style={{ fontSize: "2.5rem", fontWeight: 800, lineHeight: 1.2, color: "var(--text-primary)", marginBottom: "1rem" }}>
              {post.title}
            </h1>
            <p style={{ fontSize: "1.2rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {post.description}
            </p>
          </header>

          {/* Body */}
          <div
            className="blog-content"
            style={{
              fontSize: "1.0625rem",
              lineHeight: 1.8,
              color: "var(--text-secondary)",
            }}
            dangerouslySetInnerHTML={{ __html: content }}
          />

          {/* CTA — editorial posts get a neutral "Related Reading" box; standard posts get a sales CTA */}
          {post.editorial ? (
            <div
              style={{
                marginTop: "3rem",
                padding: "2rem",
                borderRadius: "16px",
                background: "var(--glass-bg)",
                border: "1px solid var(--glass-border)",
                boxShadow: "var(--glass-shadow)",
              }}
            >
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "1rem" }}>
                Related Reading
              </h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {BLOG_POSTS.filter((p) => p.slug !== post.slug)
                  .slice(0, 3)
                  .map((p) => (
                    <li key={p.slug}>
                      <Link
                        href={`/health/blog/${p.slug}`}
                        style={{ color: "var(--primary-blue)", textDecoration: "none", fontSize: "0.95rem" }}
                      >
                        {p.title}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ) : (
            <div
              style={{
                marginTop: "3rem",
                padding: "2rem",
                borderRadius: "16px",
                background: "linear-gradient(135deg, rgba(0,102,204,0.08) 0%, rgba(20,184,166,0.06) 100%)",
                border: "1px solid rgba(0,102,204,0.15)",
                textAlign: "center",
              }}
            >
              <h3 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
                Ready to take control of your oral health?
              </h3>
              <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
                Plans start at $14.99/month with no waiting periods and no annual maximums.
              </p>
              <Link
                href="/health/plans"
                className="button button--primary"
              >
                View Plans & Pricing
              </Link>
            </div>
          )}

          {/* Back to blog */}
          <div style={{ marginTop: "2rem", textAlign: "center" }}>
            <Link href="/health/blog" style={{ color: "var(--primary-blue)", textDecoration: "none", fontSize: "0.95rem" }}>
              ← Back to all articles
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
