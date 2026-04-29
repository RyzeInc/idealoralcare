/**
 * Shared formatting helpers for the Admin portal so dates, currency,
 * phone numbers, and IDs render consistently across pages.
 */

export function formatDate(
  input: string | number | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
): string {
  if (input === null || input === undefined || input === '') return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', opts);
}

export function formatDateTime(input: string | number | Date | null | undefined): string {
  if (input === null || input === undefined || input === '') return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatCurrency(
  amount: number | null | undefined,
  opts: { fromCents?: boolean; currency?: string } = {}
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  const value = opts.fromCents ? amount / 100 : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: opts.currency ?? 'USD',
  }).format(value);
}

/** Format a US-style phone number. Falls back to the raw value if it can't be parsed. */
export function formatPhone(input: string | null | undefined): string {
  if (!input) return '—';
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return input;
}

/** Truncate long Convex IDs for display (e.g., "k123abc...xyz"). */
export function shortenId(id: string | null | undefined, head = 4, tail = 4): string {
  if (!id) return '—';
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

/** Title-case a snake_case or camelCase token (e.g., "memberType" → "Member Type"). */
export function humanize(token: string | null | undefined): string {
  if (!token) return '';
  return token
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
