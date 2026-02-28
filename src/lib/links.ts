export function normalizeExternalLink(link?: string): string | undefined {
  if (!link) return undefined
  const trimmed = link.trim()
  if (!trimmed) return undefined
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith("//")) return `https:${trimmed}`
  return `https://${trimmed}`
}
