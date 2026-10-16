/**
 * Single source of truth for who built this site. Every attribution surface
 * (visible footer credit, <meta name="author">, JSON-LD, humans.txt) reads
 * from here so the credit cannot drift between them.
 */
export const SITE_CREDIT = {
  name: "Ryze Nexus",
  url: "https://ryzenexus.com",
  label: "Website by Ryze Nexus",
} as const;
