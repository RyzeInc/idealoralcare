"use client";

import { Building2, CreditCard, Gift, MinusCircle } from "lucide-react";

/**
 * How a member is billed.
 *
 * Exists because a blank revenue cell was previously ambiguous: an
 * employer-billed member, a comped member, and a member with no billing record
 * at all all rendered as a grey em-dash, visually identical to a terminated
 * non-payer. The badge makes a $0 legible.
 */

export type BillingSource = "direct" | "list_bill" | "comp" | "none";

const STYLES: Record<
  BillingSource,
  { label: string; short: string; className: string; icon: typeof CreditCard; title: string }
> = {
  direct: {
    label: "Direct",
    short: "Direct",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    icon: CreditCard,
    title: "Pays us directly by card or bank transfer.",
  },
  list_bill: {
    label: "Employer-billed",
    short: "Employer",
    className: "bg-violet-50 text-violet-700 border-violet-200",
    icon: Building2,
    title: "Covered through their employer's payroll deduction; the employer is invoiced monthly.",
  },
  comp: {
    label: "Comped",
    short: "Comp",
    className: "bg-slate-50 text-slate-600 border-slate-200",
    icon: Gift,
    title: "Complimentary access — genuinely $0, not a missing record.",
  },
  none: {
    label: "No billing",
    short: "None",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: MinusCircle,
    title: "On the book but with no billing mechanism attached. Worth investigating.",
  },
};

export function BillingBadge({
  source,
  compact = false,
}: {
  source: BillingSource | undefined;
  compact?: boolean;
}) {
  const style = STYLES[source ?? "none"];
  const Icon = style.icon;
  return (
    <span
      title={style.title}
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${style.className}`}
    >
      <Icon size={11} aria-hidden />
      {compact ? style.short : style.label}
    </span>
  );
}

export const BILLING_SOURCE_LABEL: Record<BillingSource, string> = {
  direct: "Direct",
  list_bill: "Employer-billed",
  comp: "Comped",
  none: "No billing",
};
