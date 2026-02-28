"use client";

import dynamic from "next/dynamic";
import { Loader } from "lucide-react";

interface PlanCardProps {
  title?: string;
  description?: string;
}

// Dynamic import with loading state for Convex client-side rendering
const PlanCardContent = dynamic(() => import("./PlanCardContent"), {
  loading: () => (
    <section style={{ padding: "100px 0" }}>
      <div className="container" style={{ textAlign: "center" }}>
        <Loader
          className="animate-spin inline-block"
          size={32}
          color="#0066CC"
        />
        <p style={{ marginTop: "1rem", color: "#475569" }}>
          Loading plan details...
        </p>
      </div>
    </section>
  ),
  ssr: false,
});

export default function PlanCard({
  title = "Ideal Health Oral Plan",
  description = "Comprehensive oral health coverage with AI scanning, teledentistry, and nationwide provider discounts.",
}: PlanCardProps) {
  return <PlanCardContent title={title} description={description} />;
}
