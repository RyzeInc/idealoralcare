import { Info } from "lucide-react";
import { SHOP_DISCLOSURE } from "@/convex/shop/constants";

/**
 * FTC affiliate disclosure.
 *
 * Renders above the first product, on the same page as the links, always
 * expanded. A disclosure that needs a click, a hover, or a scroll to read is
 * not "clear and conspicuous" under the FTC Endorsement Guides — so this is
 * plain static markup with no toggle, and it must stay that way.
 *
 * See docs/internal/SHOP_DESIGN.md rule 5.
 */
export default function ShopDisclosure() {
  return (
    <aside
      className="glass-card"
      aria-label="Affiliate disclosure"
      style={{
        display: "flex",
        gap: "12px",
        alignItems: "flex-start",
        padding: "16px 20px",
        marginBottom: "32px",
        fontSize: "0.875rem",
        lineHeight: 1.6,
      }}
    >
      <Info size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: "2px" }} />
      <p style={{ margin: 0 }}>{SHOP_DISCLOSURE}</p>
    </aside>
  );
}
