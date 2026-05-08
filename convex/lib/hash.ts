/**
 * SHA-256 helper for canonical-JSON hashing.
 * Used by the invoice calculator to stamp an immutable payload hash on
 * every closed period (spec §11.5).
 *
 * Convex runs on a Web-standard runtime, so `crypto.subtle.digest` is
 * available. We canonicalize JSON by sorting object keys recursively.
 */

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k]));
  return "{" + parts.join(",") + "}";
}

function bufferToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

/** Returns hex SHA-256 of the canonical JSON of `payload`. */
export async function sha256OfCanonicalJson(payload: unknown): Promise<string> {
  const text = canonicalize(payload);
  const enc = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", enc);
  return bufferToHex(digest);
}
