"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, RefreshCw } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { hasConflictingPrograms } from "@/convex/lib/productSlugs";
import { Breadcrumbs } from "@/components/admin/ui";
import { calculateStripeFees, catalogUnitPriceCents, type BillingCadence, type FeeInputs, type PaymentMethod } from "@/lib/stripe-fee-calculator";

type LedgerEntry = {
  id: string;
  created: number;
  type: string;
  amountCents: number;
  feeCents: number;
  netCents: number;
  description: string;
  feeDetails: { amountCents: number; description: string }[];
};
type Ledger = { livemode: boolean; hasMore: boolean; entries: LedgerEntry[] };

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const toCents = (value: string) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
};

function NumberField({ label, value, onChange, suffix = "", step = "0.01" }: {
  label: string; value: string; onChange: (value: string) => void; suffix?: string; step?: string;
}) {
  return <label className="block text-sm font-medium text-slate-700">
    {label}
    <span className="mt-1 flex items-center rounded-lg border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-blue-500">
      <input type="number" min="0" step={step} value={value} onChange={(event) => onChange(event.target.value)}
        className="w-full min-w-0 rounded-lg bg-transparent px-3 py-2 text-slate-900 outline-none" />
      {suffix && <span className="pr-3 text-slate-500">{suffix}</span>}
    </span>
  </label>;
}

function ResultRow({ label, amount, strong = false }: { label: string; amount: number; strong?: boolean }) {
  return <div className={`flex justify-between gap-4 border-b border-slate-100 py-2 ${strong ? "font-bold text-slate-900" : "text-slate-700"}`}>
    <span>{label}</span><span className="tabular-nums">{money(amount)}</span>
  </div>;
}

export default function StripeFeeCalculatorPage() {
  const products = useQuery(api.catalog.queries.listForFeeCalculator, {});
  const [selected, setSelected] = useState<{ productId: string; quantity: number }[]>([]);
  const [selectionInitialized, setSelectionInitialized] = useState(false);
  const [cadence, setCadence] = useState<BillingCadence>("monthly");
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [separate, setSeparate] = useState(false);
  const [cardPercent, setCardPercent] = useState("2.9");
  const [cardFixed, setCardFixed] = useState("0.30");
  const [achPercent, setAchPercent] = useState("0.8");
  const [achCap, setAchCap] = useState("5.00");
  const [billingPercent, setBillingPercent] = useState("0.7");
  const [includeBilling, setIncludeBilling] = useState(true);
  const [outboundType, setOutboundType] = useState<"standard" | "instant" | "custom">("standard");
  const [outboundPercent, setOutboundPercent] = useState("0");
  const [outboundFixed, setOutboundFixed] = useState("0");
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [ledgerError, setLedgerError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!products || selectionInitialized) return;
    const first = products.find((product) => product.isVisible && product.pricing.monthlyCardCents > 0)
      ?? products.find((product) => product.pricing.monthlyCardCents > 0);
    if (first) setSelected([{ productId: first._id, quantity: 1 }]);
    setSelectionInitialized(true);
  }, [products, selectionInitialized]);

  const lineItems = useMemo(() => selected.flatMap((item) => {
    const product = products?.find((candidate) => candidate._id === item.productId);
    if (!product) return [];
    const unitPriceCents = catalogUnitPriceCents(product.pricing, cadence, method);
    return [{ ...item, product, unitPriceCents, totalCents: unitPriceCents * item.quantity }];
  }), [selected, products, cadence, method]);
  const pricedLineItems = useMemo(() => lineItems.filter((item) => item.unitPriceCents > 0), [lineItems]);
  const hasCheckoutConflict = hasConflictingPrograms(lineItems.map((item) => item.product.slug));

  const addProduct = () => {
    const next = products?.find((product) => !selected.some((item) => item.productId === product._id));
    if (next) setSelected((items) => [...items, { productId: next._id, quantity: 1 }]);
  };
  const canAddProduct = products?.some((product) => !selected.some((item) => item.productId === product._id)) ?? false;

  const loadLedger = async () => {
    setLoading(true);
    setLedgerError("");
    try {
      const response = await fetch("/api/admin/stripe-fees", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load Stripe entries");
      setLedger(data as Ledger);
    } catch (error) {
      setLedgerError(error instanceof Error ? error.message : "Could not load Stripe entries");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void loadLedger(); }, []);

  const inputs: FeeInputs = useMemo(() => ({
    amountsCents: pricedLineItems.map((item) => item.totalCents),
    paymentMethod: method,
    separateCharges: separate,
    cardPercent: Number(cardPercent) || 0,
    cardFixedCents: toCents(cardFixed),
    achPercent: Number(achPercent) || 0,
    achCapCents: toCents(achCap),
    billingPercent: includeBilling ? Number(billingPercent) || 0 : 0,
    payoutPercent: outboundType === "instant" ? 1.5 : outboundType === "custom" ? Number(outboundPercent) || 0 : 0,
    payoutFixedCents: outboundType === "custom" ? toCents(outboundFixed) : 0,
    payoutMinimumCents: outboundType === "instant" ? 50 : 0,
  }), [pricedLineItems, method, separate, cardPercent, cardFixed, achPercent, achCap, billingPercent, includeBilling, outboundType, outboundPercent, outboundFixed]);
  const result = calculateStripeFees(inputs);
  const comparison = calculateStripeFees({ ...inputs, separateCharges: !separate });
  const processingEntries = ledger?.entries.filter((entry) => (entry.type === "charge" || entry.type === "payment") && entry.amountCents > 0) ?? [];
  const billingEntries = ledger?.entries.filter((entry) => entry.type === "stripe_fee" && /Billing|usage/i.test(entry.description)) ?? [];
  const outboundEntries = ledger?.entries.filter((entry) => entry.type === "payout") ?? [];

  return <div className="mx-auto max-w-6xl space-y-6 pb-12">
    <Breadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Stripe Fee Calculator" }]} />
    <div>
      <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-900"><Calculator className="text-blue-600" /> Stripe Fee Calculator</h1>
      <p className="mt-2 text-slate-600">Build a scenario from your configured membership products, then compare estimated fees with Stripe’s recorded entries.</p>
    </div>

    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Product scenario</h2>
            <p className="text-sm text-slate-500">Prices come from the same catalog used by checkout.</p>
          </div>
          <button type="button" onClick={addProduct} disabled={!canAddProduct}
            className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50">
            Add product
          </button>
        </div>
        {products === undefined && <p className="text-sm text-slate-500">Loading catalog products…</p>}
        {products?.length === 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No membership products are configured in the catalog.</p>}
        {products && selected.length === 0 && products.length > 0 && <p className="text-sm text-slate-500">Add a product to start a scenario.</p>}
        <div className="space-y-3">
          {lineItems.map((item, index) => <div key={item.productId} className="rounded-lg border border-slate-200 p-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_auto] sm:items-end">
              <label className="text-sm font-medium text-slate-700">Product
                <select value={item.productId} onChange={(event) => {
                  const productId = event.target.value;
                  if (selected.some((other, otherIndex) => otherIndex !== index && other.productId === productId)) return;
                  setSelected((items) => items.map((current, currentIndex) => currentIndex === index ? { ...current, productId } : current));
                }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900">
                  {products?.map((product) => <option key={product._id} value={product._id}
                    disabled={selected.some((other, otherIndex) => otherIndex !== index && other.productId === product._id)}>
                    {product.name}{product.isVisible ? "" : " (hidden)"}
                  </option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">Quantity
                <input type="number" min="1" max="10000" step="1" value={item.quantity}
                  onChange={(event) => {
                    const quantity = Math.min(10000, Math.max(1, Math.trunc(Number(event.target.value) || 1)));
                    setSelected((items) => items.map((current, currentIndex) => currentIndex === index ? { ...current, quantity } : current));
                  }} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
              </label>
              <button type="button" onClick={() => setSelected((items) => items.filter((current) => current.productId !== item.productId))}
                className="rounded-lg px-3 py-2 text-sm text-red-700 hover:bg-red-50">Remove</button>
            </div>
            <p className={`mt-2 text-sm ${item.unitPriceCents > 0 ? "text-slate-600" : "text-amber-700"}`}>
              {item.unitPriceCents > 0
                ? `${money(item.unitPriceCents)} each · ${money(item.totalCents)} total`
                : `No ${cadence} ${method.toUpperCase()} price is configured; excluded from the estimate.`}
            </p>
          </div>)}
        </div>
        {hasCheckoutConflict && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Essentials already includes Balance for Life. Checkout will not sell those two products together; remove one for a realistic scenario.
        </p>}
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Billing cadence</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {(["monthly", "annual"] as const).map((option) => <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="billing-cadence" checked={cadence === option} onChange={() => setCadence(option)} />
              {option === "monthly" ? "Monthly invoice" : "Annual invoice"}
            </label>)}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Payment method</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {(["card", "ach"] as const).map((option) => <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="payment-method" checked={method === option} onChange={() => setMethod(option)} />
              {option === "card" ? "US domestic card" : "ACH debit"}
            </label>)}
          </div>
        </fieldset>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={separate} onChange={(event) => setSeparate(event.target.checked)} className="mt-1" />
          Model each selected product as a separate charge and invoice
        </label>
        <p className="text-xs text-slate-500">Combined checkout uses one charge for the selected line items. Separate purchases or billing dates can create separate charges. Quantity stays on one line item.</p>

        <details className="rounded-lg bg-slate-50 p-4">
          <summary className="cursor-pointer font-medium text-slate-800">Fee assumptions (editable)</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <NumberField label="Card percentage" value={cardPercent} onChange={setCardPercent} suffix="%" />
            <NumberField label="Card fixed fee ($ / charge)" value={cardFixed} onChange={setCardFixed} />
            <NumberField label="ACH percentage" value={achPercent} onChange={setAchPercent} suffix="%" />
            <NumberField label="ACH cap ($ / charge)" value={achCap} onChange={setAchCap} />
            <NumberField label="Stripe Billing percentage" value={billingPercent} onChange={setBillingPercent} suffix="%" />
          </div>
          <label className="mt-3 flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={includeBilling} onChange={(event) => setIncludeBilling(event.target.checked)} className="mt-1" />Include Stripe Billing fee</label>
          <p className="mt-3 text-xs text-slate-500">Defaults are Stripe’s published <a href="https://stripe.com/pricing" target="_blank" rel="noopener noreferrer" className="underline">US domestic card and ACH rates</a> and <a href="https://stripe.com/billing/pricing" target="_blank" rel="noopener noreferrer" className="underline">pay-as-you-go Billing rate</a>. Your Stripe contract may differ. Taxes, disputes, international cards, and currency conversion are excluded.</p>
        </details>

        <div className="border-t border-slate-200 pt-4">
          <h3 className="font-semibold text-slate-900">Outbound transfer to your bank (Stripe payout)</h3>
          <select value={outboundType} onChange={(event) => setOutboundType(event.target.value as "standard" | "instant" | "custom")}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
            <option value="standard">Standard bank payout (no fee)</option>
            <option value="instant">Instant US bank payout (1.5%, 50¢ minimum)</option>
            <option value="custom">Custom bank payout rate</option>
          </select>
          {outboundType === "custom" && <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <NumberField label="Outbound percentage" value={outboundPercent} onChange={setOutboundPercent} suffix="%" />
            <NumberField label="Outbound fixed fee ($)" value={outboundFixed} onChange={setOutboundFixed} />
          </div>}
          <p className="mt-2 text-xs text-slate-500">Stripe lists <a href="https://stripe.com/pricing" target="_blank" rel="noopener noreferrer" className="underline">standard payouts as free and US instant payouts at 1.5% with a 50¢ minimum</a>. Other fees may post as separate balance entries.</p>
        </div>
      </section>

      <section className="self-start rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Inbound and outbound estimate</h2>
        <p className="mt-1 text-sm text-slate-500">{result.chargeCount} charge{result.chargeCount === 1 ? "" : "s"} · {cadence} · {method === "card" ? "card" : "ACH"}</p>
        {lineItems.length > 0 && <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          {pricedLineItems.map((item) => <div key={item.productId} className="flex justify-between gap-3 py-1">
            <span>{item.product.name} × {item.quantity}</span><span className="shrink-0 tabular-nums">{money(item.totalCents)}</span>
          </div>)}
        </div>}
        <div className="mt-4">
          <h3 className="mb-1 text-sm font-semibold text-slate-800">Inbound customer payment</h3>
          <ResultRow label="Customer pays" amount={result.grossCents} />
          <ResultRow label="Payment processing" amount={-result.processingCents} />
          <ResultRow label="Inbound payment after processing" amount={result.grossCents - result.processingCents} strong />
          <ResultRow label="Stripe Billing usage" amount={-result.billingCents} />
          <ResultRow label="Available after inbound fees" amount={result.availableCents} strong />
          <h3 className="mb-1 mt-4 text-sm font-semibold text-slate-800">Outbound bank payout</h3>
          <ResultRow label="Amount available to send to bank" amount={result.availableCents} />
          <ResultRow label="Bank payout fee" amount={-result.payoutFeeCents} />
          <ResultRow label="Deposited to your bank" amount={result.takeHomeCents} strong />
        </div>
        <div className="mt-4 rounded-lg bg-blue-50 p-4 text-blue-950">
          <div className="text-sm font-medium">Estimated take-home</div>
          <div className="text-3xl font-bold tabular-nums">{money(result.takeHomeCents)}</div>
        </div>
        {pricedLineItems.length > 1 && <p className="mt-4 text-sm text-slate-600">
          {separate ? "Combining into one charge" : "Charging each product separately"} would produce {money(comparison.takeHomeCents)} with these assumptions.
        </p>}
        <p className="mt-4 text-xs text-slate-500">This is a forecast for one {cadence} invoice, rounded to cents. Billing is modeled once per invoice, including when line items share a charge. Exact fees appear below from Stripe’s balance transactions; Billing fees may post separately.</p>
      </section>
    </div>

    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold text-slate-900">Actual Stripe balance entries</h2>
          <p className="text-sm text-slate-500">Last 100 entries, USD only {ledger ? `· ${ledger.livemode ? "Live" : "Test"} account` : ""}{ledger?.hasMore ? " · older entries available in Stripe" : ""}</p></div>
        <button type="button" onClick={() => void loadLedger()} disabled={loading} className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      {ledgerError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{ledgerError}</p>}
      {loading && !ledger && <p className="mt-4 text-sm text-slate-500">Loading Stripe entries…</p>}
      {ledger && <div className="mt-4 grid gap-5 xl:grid-cols-3">
        {([
          ["Inbound payments", processingEntries],
          ["Billing usage fees", billingEntries],
          ["Outbound bank payouts", outboundEntries],
        ] as const).map(([title, entries]) => <div key={title} className="min-w-0">
          <h3 className="mb-2 font-medium text-slate-800">{title}</h3>
          {entries.length === 0 ? <p className="text-sm text-slate-500">No entries in this page of the ledger.</p> : <div className="max-h-80 space-y-2 overflow-auto pr-1">
            {entries.map((entry) => <div key={entry.id} className="rounded-lg border border-slate-200 p-3 text-xs text-slate-700">
              <div className="flex justify-between gap-2"><span>{new Date(entry.created * 1000).toLocaleDateString()}</span><span className="font-medium capitalize">{entry.type.replaceAll("_", " ")}</span></div>
              <div className="mt-1 break-words text-slate-500">{entry.description || entry.id}</div>
              <div className="mt-2 flex justify-between gap-2 tabular-nums"><span>Gross {money(entry.amountCents)}</span><span>Fee {money(entry.feeCents)}</span></div>
              <div className="mt-1 text-right font-semibold tabular-nums">Net {money(entry.netCents)}</div>
              {entry.feeDetails.length > 0 && <div className="mt-1 text-slate-500">{entry.feeDetails.map((detail) => `${detail.description || "Fee"}: ${money(detail.amountCents)}`).join(" · ")}</div>}
            </div>)}
          </div>}
        </div>)}
      </div>}
      <p className="mt-4 text-xs text-slate-500">A Billing usage fee can be posted as its own negative balance transaction. The ledger’s “Fee” field can still be $0 for that row; the negative gross amount is the charge. Payout amount is money leaving Stripe, not an additional expense.</p>
    </section>
  </div>;
}
