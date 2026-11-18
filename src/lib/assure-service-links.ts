/** Former service pages now live in sections on their membership page. */
export const MERGED_SERVICE_PAGES = {
  "virtual-care": "essentials",
  labs: "essentials",
  pharmacy: "essentials",
  "oral-health-scan": "oralcare",
  teledentistry: "oralcare",
  discount: "oralcare",
} as const;

export function assureServiceHref(key: string) {
  const parent = MERGED_SERVICE_PAGES[key as keyof typeof MERGED_SERVICE_PAGES];
  return typeof parent === "string"
    ? `/assurevantage/${parent}#${key}`
    : `/assurevantage/${key}`;
}
