"use client";

import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

export default function CatalogSeedPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const reseed = useMutation(api.catalog.mutations.reseedData);
  const products = useQuery(api.catalog.queries.list);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleReseed = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await reseed();
      setResult(res);
    } catch (err: any) {
      setResult({ error: String(err), message: err?.message ?? String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "700px", margin: "0 auto" }}>
      <h1>Catalog Seed Admin</h1>

      {/* Auth status */}
      <div style={{ marginBottom: "1.5rem", padding: "0.75rem 1rem", background: "#f0f4ff", border: "1px solid #c0d0ff", borderRadius: "6px", fontSize: "0.85rem" }}>
        <strong>Convex Auth:</strong>{" "}
        {isLoading ? "⏳ Loading..." : isAuthenticated ? "✅ Authenticated" : "❌ NOT authenticated — sign in first"}
      </div>

      {/* Current catalog count */}
      <div style={{ marginBottom: "1.5rem", padding: "0.75rem 1rem", background: "#f5f5f5", border: "1px solid #ddd", borderRadius: "6px", fontSize: "0.85rem" }}>
        <strong>Current catalog products:</strong>{" "}
        {products === undefined ? "loading..." : products.length}
      </div>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
        <button
          onClick={handleReseed}
          disabled={loading || !isAuthenticated}
          style={{
            padding: "10px 20px",
            background: loading || !isAuthenticated ? "#ccc" : "#0066CC",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: loading || !isAuthenticated ? "not-allowed" : "pointer",
            fontSize: "1rem",
            fontWeight: "600",
          }}
        >
          {loading ? "Seeding..." : "Seed / Reseed Catalog"}
        </button>
      </div>

      {/* CLI fallback instructions */}
      <div style={{ marginBottom: "1.5rem", padding: "0.75rem 1rem", background: "#fffbe6", border: "1px solid #ffe58f", borderRadius: "6px", fontSize: "0.85rem" }}>
        <strong>If the button fails,</strong> run this in your terminal to seed without auth:
        <pre style={{ margin: "0.5rem 0 0", fontFamily: "monospace", fontSize: "0.8rem", background: "#fff8d6", padding: "0.5rem", borderRadius: "4px", overflowX: "auto" }}>
{`npx convex run catalog/mutations:reseedInternal --prod`}
        </pre>
      </div>

      {result && (
        <div
          style={{
            padding: "1rem",
            background: result.error ? "#fee" : "#efe",
            border: `1px solid ${result.error ? "#faa" : "#afa"}`,
            borderRadius: "4px",
            fontFamily: "monospace",
            fontSize: "0.9rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

