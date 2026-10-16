import { SITE_CREDIT } from "@/lib/site-credit";

/**
 * Visible developer credit. Deliberately a plain, crawlable link (no
 * rel="nofollow") so the backlink counts and "who built this site" searches
 * resolve to the developer.
 */
export function SiteCredit({
  color = "inherit",
  style,
}: {
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <a
      href={SITE_CREDIT.url}
      target="_blank"
      rel="noopener author"
      style={{ color, textDecoration: "none", ...style }}
    >
      {SITE_CREDIT.label}
    </a>
  );
}
