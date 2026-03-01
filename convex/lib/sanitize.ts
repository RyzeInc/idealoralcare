/**
 * INPUT SANITIZATION UTILITIES
 *
 * Shared helpers for sanitizing user-supplied data before
 * interpolation into HTML, CSV, or other output formats.
 */

/**
 * Escape HTML entities to prevent HTML/XSS injection.
 * Use before interpolating user data into HTML templates (emails, PDFs, etc.)
 *
 * @example
 * const safe = escapeHtml(userInput);
 * const html = `<p>Hello ${safe}</p>`;
 */
export function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Sanitize a value for safe CSV output.
 * Prevents Excel/Sheets formula injection by prefixing dangerous
 * start characters with a single quote.
 *
 * Characters that trigger formulas: = + - @ | \t \r \n
 *
 * @example
 * const safe = sanitizeCsvValue(memberName);
 * csv += `"${safe}",`;
 */
export function sanitizeCsvValue(str: string): string {
  if (!str) return "";

  // First, escape double quotes for CSV (standard CSV escaping)
  let safe = str.replace(/"/g, '""');

  // Prefix with single quote if starts with a formula-triggering character
  // The single quote is invisible in most spreadsheet apps but prevents formula execution
  if (/^[=+\-@|\t\r\n]/.test(safe)) {
    safe = `'${safe}`;
  }

  return safe;
}

/**
 * Sanitize an object's string values for HTML context.
 * Useful for sanitizing all fields of an args object at once.
 *
 * @example
 * const safeArgs = sanitizeForHtml({ firstName: args.firstName, planName: args.planName });
 * const html = `<p>Hi ${safeArgs.firstName}, your plan: ${safeArgs.planName}</p>`;
 */
export function sanitizeForHtml<T extends Record<string, unknown>>(
  obj: T
): { [K in keyof T]: T[K] extends string ? string : T[K] } {
  const result = { ...obj } as any;
  for (const key of Object.keys(result)) {
    if (typeof result[key] === "string") {
      result[key] = escapeHtml(result[key]);
    }
  }
  return result;
}

/**
 * Sanitize an array of values for CSV output.
 * Returns a properly escaped and quoted CSV row.
 *
 * @example
 * const row = toCsvRow(["John", "=SUM(A1)", "john@example.com"]);
 * // Returns: "John","'=SUM(A1)","john@example.com"
 */
export function toCsvRow(values: string[]): string {
  return values.map((v) => `"${sanitizeCsvValue(v)}"`).join(",");
}
