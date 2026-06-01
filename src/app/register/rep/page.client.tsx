'use client';

import { useState, useMemo } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { CheckCircle2, ShieldAlert, Loader2 } from 'lucide-react';

type SubmissionType = 'agency' | 'rep' | 'both';

interface FormState {
  submissionType: SubmissionType;
  // Agency
  agencyName: string;
  dba: string;
  ein: string;
  agencyNpn: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  programManager: string;
  physicalAddress: string;
  mailingAddress: string;
  agencyLicenses: string;
  eoCarrier: string;
  eoExpiration: string;
  commissionTier: string;
  agencyEffectiveDate: string;
  agencyStatus: string;
  w9Status: string;
  w9ReceivedDate: string;
  paymentMethod: string;
  achAuthorizationStatus: string;
  // Rep
  repFirstName: string;
  repLastName: string;
  repEmail: string;
  repPhone: string;
  repNpn: string;
  assignedAgency: string;
  repLicenses: string;
  repEffectiveDate: string;
  repStatus: string;
  writingNumber: string;
}

const initialState: FormState = {
  submissionType: 'agency',
  agencyName: '', dba: '', ein: '', agencyNpn: '',
  primaryContactName: '', primaryContactEmail: '', primaryContactPhone: '',
  programManager: '', physicalAddress: '', mailingAddress: '',
  agencyLicenses: '', eoCarrier: '', eoExpiration: '',
  commissionTier: '', agencyEffectiveDate: '', agencyStatus: 'pending',
  w9Status: 'pending', w9ReceivedDate: '',
  paymentMethod: '', achAuthorizationStatus: 'pending',
  repFirstName: '', repLastName: '', repEmail: '', repPhone: '',
  repNpn: '', assignedAgency: '', repLicenses: '',
  repEffectiveDate: '', repStatus: 'pending', writingNumber: '',
};

export default function RepRegistrationClient() {
  const submit = useMutation(api.repOnboarding.submit);
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const showAgency = useMemo(
    () => form.submissionType === 'agency' || form.submissionType === 'both',
    [form.submissionType],
  );
  const showRep = useMemo(
    () => form.submissionType === 'rep' || form.submissionType === 'both',
    [form.submissionType],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await submit(form);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err?.message ?? 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 py-16 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-10 text-center">
          <CheckCircle2 className="mx-auto mb-4 text-emerald-600" size={56} />
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Submission received</h1>
          <p className="text-slate-600 mb-6">
            Thank you. Our partnerships team will review your submission and reach out within 1–2 business days.
          </p>
          <button
            onClick={() => { setForm(initialState); setSubmitted(false); }}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Submit another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 text-white">
        <div className="max-w-4xl mx-auto px-4 py-14">
          <p className="text-sm uppercase tracking-wider text-blue-100 font-semibold mb-2">
            Broker · Agency · Front-Line Rep
          </p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Partner Registration</h1>
          <p className="text-lg text-blue-50 max-w-2xl">
            Submit your broker, agency, or front-line rep details. Our partnerships team will review
            and respond with onboarding next steps.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Security Notice */}
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
          <ShieldAlert className="flex-shrink-0 text-amber-600 mt-0.5" size={22} />
          <div>
            <p className="text-sm font-semibold text-amber-900">Secure submission</p>
            <p className="text-sm text-amber-800 mt-1">
              This form is reviewed by Ideal Oral Health staff. Do not include Social Security numbers,
              banking credentials, or any other sensitive information that is not explicitly requested below.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Submission Type */}
          <Section title="Submission Type" subtitle="Choose what you’re registering today.">
            <Field label="I am submitting" required>
              <select
                value={form.submissionType}
                onChange={(e) => update('submissionType', e.target.value as SubmissionType)}
                className={inputClass}
                required
              >
                <option value="agency">Broker / Agency Only</option>
                <option value="rep">Front-Line Rep Only</option>
                <option value="both">Both — Agency and Rep</option>
              </select>
            </Field>
          </Section>

          {/* Broker / Agency */}
          {showAgency && (
            <Section title="Broker / Agency Details" subtitle="Information about the agency or brokerage.">
              <Grid>
                <Field label="Agency Name" required>
                  <input className={inputClass} required={showAgency}
                    value={form.agencyName} onChange={(e) => update('agencyName', e.target.value)} />
                </Field>
                <Field label="DBA (if any)">
                  <input className={inputClass}
                    value={form.dba} onChange={(e) => update('dba', e.target.value)} />
                </Field>
                <Field label="EIN">
                  <input className={inputClass} placeholder="XX-XXXXXXX"
                    value={form.ein} onChange={(e) => update('ein', e.target.value)} />
                </Field>
                <Field label="Agency NPN">
                  <input className={inputClass}
                    value={form.agencyNpn} onChange={(e) => update('agencyNpn', e.target.value)} />
                </Field>
                <Field label="Primary Contact Name" required>
                  <input className={inputClass} required={showAgency}
                    value={form.primaryContactName} onChange={(e) => update('primaryContactName', e.target.value)} />
                </Field>
                <Field label="Primary Contact Email" required>
                  <input type="email" className={inputClass} required={showAgency}
                    value={form.primaryContactEmail} onChange={(e) => update('primaryContactEmail', e.target.value)} />
                </Field>
                <Field label="Primary Contact Phone">
                  <input type="tel" className={inputClass}
                    value={form.primaryContactPhone} onChange={(e) => update('primaryContactPhone', e.target.value)} />
                </Field>
                <Field label="Program Manager (if known)">
                  <input className={inputClass}
                    value={form.programManager} onChange={(e) => update('programManager', e.target.value)} />
                </Field>
                <Field label="Physical Address" full>
                  <input className={inputClass}
                    value={form.physicalAddress} onChange={(e) => update('physicalAddress', e.target.value)} />
                </Field>
                <Field label="Mailing Address (if different)" full>
                  <input className={inputClass}
                    value={form.mailingAddress} onChange={(e) => update('mailingAddress', e.target.value)} />
                </Field>
                <Field label="Agency Licenses (state — license #)" full>
                  <textarea className={inputClass} rows={2}
                    value={form.agencyLicenses} onChange={(e) => update('agencyLicenses', e.target.value)} />
                </Field>
                <Field label="E&O Carrier">
                  <input className={inputClass}
                    value={form.eoCarrier} onChange={(e) => update('eoCarrier', e.target.value)} />
                </Field>
                <Field label="E&O Expiration Date">
                  <input type="date" className={inputClass}
                    value={form.eoExpiration} onChange={(e) => update('eoExpiration', e.target.value)} />
                </Field>
                <Field label="Commission Tier (requested)">
                  <input className={inputClass} placeholder="e.g. Tier 2"
                    value={form.commissionTier} onChange={(e) => update('commissionTier', e.target.value)} />
                </Field>
                <Field label="Agency Effective Date">
                  <input type="date" className={inputClass}
                    value={form.agencyEffectiveDate} onChange={(e) => update('agencyEffectiveDate', e.target.value)} />
                </Field>
                <Field label="Agency Status">
                  <select className={inputClass}
                    value={form.agencyStatus} onChange={(e) => update('agencyStatus', e.target.value)}>
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </Field>
                <Field label="W-9 Status">
                  <select className={inputClass}
                    value={form.w9Status} onChange={(e) => update('w9Status', e.target.value)}>
                    <option value="pending">Pending</option>
                    <option value="received">Received</option>
                    <option value="not_required">Not required</option>
                  </select>
                </Field>
                <Field label="W-9 Received Date">
                  <input type="date" className={inputClass}
                    value={form.w9ReceivedDate} onChange={(e) => update('w9ReceivedDate', e.target.value)} />
                </Field>
                <Field label="Preferred Payment Method">
                  <select className={inputClass}
                    value={form.paymentMethod} onChange={(e) => update('paymentMethod', e.target.value)}>
                    <option value="">Select…</option>
                    <option value="ach">ACH / Direct Deposit</option>
                    <option value="check">Check</option>
                    <option value="wire">Wire</option>
                  </select>
                </Field>
                <Field label="ACH Authorization Status">
                  <select className={inputClass}
                    value={form.achAuthorizationStatus} onChange={(e) => update('achAuthorizationStatus', e.target.value)}>
                    <option value="pending">Pending</option>
                    <option value="signed">Signed</option>
                    <option value="not_applicable">N/A</option>
                  </select>
                </Field>
              </Grid>
            </Section>
          )}

          {/* Rep */}
          {showRep && (
            <Section title="Front-Line Rep Details" subtitle="Information about the licensed agent.">
              <Grid>
                <Field label="First Name" required>
                  <input className={inputClass} required={showRep}
                    value={form.repFirstName} onChange={(e) => update('repFirstName', e.target.value)} />
                </Field>
                <Field label="Last Name" required>
                  <input className={inputClass} required={showRep}
                    value={form.repLastName} onChange={(e) => update('repLastName', e.target.value)} />
                </Field>
                <Field label="Email" required>
                  <input type="email" className={inputClass} required={showRep}
                    value={form.repEmail} onChange={(e) => update('repEmail', e.target.value)} />
                </Field>
                <Field label="Phone">
                  <input type="tel" className={inputClass}
                    value={form.repPhone} onChange={(e) => update('repPhone', e.target.value)} />
                </Field>
                <Field label="Rep NPN">
                  <input className={inputClass}
                    value={form.repNpn} onChange={(e) => update('repNpn', e.target.value)} />
                </Field>
                <Field label="Assigned Agency">
                  <input className={inputClass}
                    value={form.assignedAgency} onChange={(e) => update('assignedAgency', e.target.value)} />
                </Field>
                <Field label="Rep Licenses (state — license #)" full>
                  <textarea className={inputClass} rows={2}
                    value={form.repLicenses} onChange={(e) => update('repLicenses', e.target.value)} />
                </Field>
                <Field label="Rep Effective Date">
                  <input type="date" className={inputClass}
                    value={form.repEffectiveDate} onChange={(e) => update('repEffectiveDate', e.target.value)} />
                </Field>
                <Field label="Rep Status">
                  <select className={inputClass}
                    value={form.repStatus} onChange={(e) => update('repStatus', e.target.value)}>
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </Field>
                <Field label="Writing Number">
                  <input className={inputClass}
                    value={form.writingNumber} onChange={(e) => update('writingNumber', e.target.value)} />
                </Field>
              </Grid>
            </Section>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
              {submitting ? 'Submitting…' : 'Submit Registration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  'w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white';

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        {subtitle ? <p className="text-sm text-slate-600 mt-1">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

function Field({
  label,
  children,
  required,
  full,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? 'md:col-span-2' : ''}`}>
      <span className="block text-sm font-medium text-slate-700 mb-1.5">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}
