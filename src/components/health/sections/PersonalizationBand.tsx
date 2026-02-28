"use client";

import { useState } from "react";
import { MapPin, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

interface PersonalizationBandProps {
  ctaText?: string;
}

export default function PersonalizationBand({
  ctaText = "Find Dentists Near Me",
}: PersonalizationBandProps) {
  const [zip, setZip] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (zip.length === 5) {
      // TODO: Integrate with provider search page or Convex query
      // For now, navigate to plans page with ZIP as query parameter
      router.push(`/health/plans?zip=${zip}`);
    }
  };

  return (
    <div className="personalization-band">
      <div className="container">
        <div className="personalization-band__content">
          <div className="personalization-band__text">
            <h3>
              <MapPin style={{ display: "inline", marginRight: "8px" }} />
              Ideal Oral Health Near You
            </h3>
            <p>Find participating dentists and see plan details for your area</p>
          </div>

          <form
            className="personalization-band__form"
            onSubmit={handleSubmit}
          >
            <input
              type="text"
              className="personalization-band__input"
              placeholder="Enter ZIP code"
              maxLength={5}
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
              pattern="\d{5}"
              required
            />
            <button
              type="submit"
              className="button button--white"
              style={{
                padding: "12px 24px",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "white",
                color: "#0066CC",
                border: "none",
                borderRadius: "8px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.3s ease",
              }}
            >
              {ctaText}
              <ChevronRight size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
