import Link from "next/link";
import {
  isEmailTemplateId,
  listEmailTemplates,
  renderSampleEmail,
} from "@/convex/lib/emailTemplates";

/**
 * Renders any registered email template as HTML, without sending it.
 * The send path lives at /debug/email-test.
 */
export default async function EmailPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const templates = listEmailTemplates();
  const requested = (await searchParams).template;
  const activeId = requested && isEmailTemplateId(requested) ? requested : templates[0].id;
  const active = templates.find((t) => t.id === activeId)!;
  const { subject, html } = renderSampleEmail(activeId, {
    firstName: "Test",
    lastName: "Member",
    email: "test.member@example.com",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div
        style={{
          background: "#1e1e1e",
          color: "#fff",
          padding: "10px 16px",
          fontFamily: "monospace",
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: "bold", color: "#facc15" }}>EMAIL PREVIEW</span>
        <span style={{ color: "#94a3b8" }}>
          Subject: <strong style={{ color: "#fff" }}>{subject}</strong>
        </span>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 10,
            fontSize: 10,
            fontWeight: 700,
            background: active.status === "live" ? "#166534" : "#92400e",
            color: "#fff",
          }}
        >
          {active.status === "live" ? "LIVE" : "NOT WIRED"}
        </span>
        <Link href="/debug/email-test" style={{ color: "#60a5fa", marginLeft: "auto" }}>
          Send a test →
        </Link>
      </div>

      <div style={{ background: "#111827", padding: "8px 16px", display: "flex", gap: 6, flexWrap: "wrap" }}>
        {templates.map((t) => (
          <Link
            key={t.id}
            href={`/debug/email-preview?template=${t.id}`}
            style={{
              padding: "4px 10px",
              borderRadius: 4,
              fontSize: 11,
              fontFamily: "monospace",
              textDecoration: "none",
              background: t.id === activeId ? "#2563eb" : "#1f2937",
              color: t.id === activeId ? "#fff" : "#9ca3af",
            }}
          >
            {t.id}
          </Link>
        ))}
      </div>

      <iframe
        srcDoc={html}
        title={`${active.label} preview`}
        style={{ flex: 1, width: "100%", border: "none", display: "block", background: "#fff" }}
      />
    </div>
  );
}
