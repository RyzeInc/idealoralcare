/**
 * JOB TITLE CLASSIFICATION
 *
 * Free-text job titles can't be segmented reliably ("VP People Ops" vs "Dir.,
 * Human Resources" are the same bucket, worded differently), so contacts keep
 * both: `jobTitle` verbatim for display and substring filters, and this
 * derived `{jobFunction, seniority}` pair for a clean facet in the filter
 * rail and saved segments.
 *
 * Pure, deterministic, no ctx — cheap to unit test and reusable from the CSV
 * import preview on the client before any row is committed.
 */

export type JobFunction =
  | "hr" | "benefits" | "finance" | "operations" | "executive" | "owner"
  | "broker_producer" | "broker_principal" | "office_manager" | "other";

export type Seniority =
  | "c_suite" | "vp" | "director" | "manager" | "individual_contributor" | "unknown";

const SENIORITY_RULES: Array<{ seniority: Seniority; pattern: RegExp }> = [
  { seniority: "c_suite", pattern: /\b(chief|ceo|cfo|coo|cto|chro|president|founder|principal)\b/i },
  { seniority: "vp", pattern: /\b(vp|v\.p\.|vice president)\b/i },
  { seniority: "director", pattern: /\b(director|dir\.?)\b/i },
  { seniority: "manager", pattern: /\b(manager|mgr\.?|supervisor|lead)\b/i },
  { seniority: "individual_contributor", pattern: /\b(coordinator|specialist|assistant|associate|admin|clerk|rep\.?|representative|analyst|agent)\b/i },
];

const FUNCTION_RULES: Array<{ fn: JobFunction; pattern: RegExp }> = [
  // Order matters — more specific patterns first.
  { fn: "broker_principal", pattern: /\b(broker[- ]?owner|agency principal|managing partner)\b/i },
  { fn: "broker_producer", pattern: /\b(broker|producer|insurance agent|benefits? consultant|benefits? advisor)\b/i },
  { fn: "benefits", pattern: /\b(benefits?|total rewards)\b/i },
  { fn: "hr", pattern: /\b(hr|human resources|people (ops|operations)|talent|people\s?&?\s?culture)\b/i },
  { fn: "finance", pattern: /\b(finance|financial|accounting|controller|payroll|treasury)\b/i },
  { fn: "office_manager", pattern: /\boffice manager\b/i },
  { fn: "owner", pattern: /\b(owner|founder|proprietor)\b/i },
  { fn: "executive", pattern: /\b(chief|ceo|cfo|coo|cto|chro|president)\b/i },
  { fn: "operations", pattern: /\b(operations|ops)\b/i },
];

export function classifyJobTitle(
  rawTitle: string | undefined | null,
): { jobFunction: JobFunction | undefined; seniority: Seniority | undefined } {
  const title = (rawTitle ?? "").trim();
  if (!title) return { jobFunction: undefined, seniority: undefined };

  const fn = FUNCTION_RULES.find((r) => r.pattern.test(title))?.fn ?? "other";
  const seniority = SENIORITY_RULES.find((r) => r.pattern.test(title))?.seniority ?? "unknown";

  return { jobFunction: fn, seniority };
}
