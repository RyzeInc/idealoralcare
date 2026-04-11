import Link from "next/link";
import HealthHeader from "@/components/health/HealthHeader";
import { BLOG_POSTS } from "./posts";

export default function BlogIndexPage() {
  return (
    <div className="health-landing">
      <HealthHeader />

      <section className="section" style={{ padding: "4rem 0" }}>
        <div className="container" style={{ maxWidth: "960px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <h1 style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: "1rem" }}>
              Oral Health Blog
            </h1>
            <p style={{ fontSize: "1.125rem", color: "#64748b", maxWidth: "600px", margin: "0 auto" }}>
              Expert advice on affordable dental care, dental discount plans,
              teledentistry, and keeping your smile healthy without breaking the bank.
            </p>
          </div>

          <div style={{ display: "grid", gap: "2rem" }}>
            {BLOG_POSTS.map((post) => (
              <Link
                key={post.slug}
                href={`/health/blog/${post.slug}`}
                style={{
                  display: "block",
                  padding: "2rem",
                  borderRadius: "16px",
                  border: "1px solid var(--glass-border)",
                  background: "var(--glass-bg)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  boxShadow: "var(--glass-shadow)",
                  textDecoration: "none",
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}
              >
                <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--primary-blue)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {post.category}
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {post.readTime}
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {new Date(post.datePublished).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <h2
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    marginBottom: "0.5rem",
                    lineHeight: 1.3,
                  }}
                >
                  {post.title}
                </h2>
                <p style={{ fontSize: "1rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {post.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
