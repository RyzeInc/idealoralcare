"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

export default function CatalogSeedPage() {
  const reseed = useMutation(api.catalog.mutations.reseedData);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleReseed = async () => {
    setLoading(true);
    try {
      const res = await reseed();
      setResult(res);
    } catch (err) {
      setResult({ error: String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Catalog Seed Admin</h1>
      
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
        <button
          onClick={handleReseed}
          disabled={loading}
          style={{
            padding: "10px 20px",
            background: loading ? "#ccc" : "#0066CC",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "1rem",
            fontWeight: "600",
          }}
        >
          {loading ? "Seeding..." : "Seed Catalog"}
        </button>
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

