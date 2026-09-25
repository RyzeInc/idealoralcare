/**
 * Post-sign-in return paths (`?redirect_url=`).
 *
 * Two sides have to agree on the shape of this parameter: whatever puts a
 * visitor in front of the sign-in page, and the sign-in page that sends them
 * onward afterwards. They did not agree. src/proxy.ts wrote the whole request
 * URL ("http://host/partner") while the sign-in page accepted only values
 * starting with "/", so it rejected every proxy-issued return path and sent
 * the visitor to /health/dashboard instead of the page they actually asked
 * for. Producers now emit paths; this normalizes whatever still arrives.
 *
 * The check stays strict rather than being loosened to "any absolute URL",
 * because `redirect_url` is attacker-supplied: it arrives on a link a visitor
 * can be handed, and it decides where a *freshly authenticated* session lands.
 * Note that a leading "/" alone proves nothing — "//evil.example" is
 * protocol-relative and leaves the origin, as does "/\evil.example" once a
 * browser normalizes the backslash.
 */

/**
 * Normalize a caller-supplied return path to one that is safe to navigate to,
 * falling back whenever it would leave this origin.
 */
export function safeReturnPath(
  raw: string | null | undefined,
  fallback: string,
): string {
  if (!raw) return fallback;

  let candidate = raw.trim();
  if (!candidate) return fallback;

  // An absolute URL is kept only if it points back at this same origin, and
  // only its path survives. On the server there is nothing to compare against,
  // so it is refused outright.
  if (/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    if (typeof window === "undefined") return fallback;
    try {
      const url = new URL(candidate);
      if (url.origin !== window.location.origin) return fallback;
      candidate = `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return fallback;
    }
  }

  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) return fallback;

  return candidate;
}
