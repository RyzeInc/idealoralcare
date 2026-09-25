'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SignaturePad } from '@/components/legal';

export interface W9SignData {
  legalName: string;
  businessName?: string;
  taxClassification: 'individual' | 'c_corp' | 's_corp' | 'partnership' | 'trust_estate' | 'llc' | 'other';
  llcTaxClassification?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  tinType: 'ssn' | 'ein';
  tin: string;
  signatureDataUrl: string;
}

interface W9SignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSigned: (data: W9SignData) => void;
  defaultLegalName?: string;
  defaultBusinessName?: string;
  defaultAddress?: string;
}

const inputClass =
  'w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white';

const initial = (defaults?: { legalName?: string; businessName?: string; address?: string }): W9SignData => ({
  legalName: defaults?.legalName ?? '',
  businessName: defaults?.businessName ?? '',
  taxClassification: 'individual',
  llcTaxClassification: '',
  address: defaults?.address ?? '',
  city: '',
  state: '',
  zip: '',
  tinType: 'ssn',
  tin: '',
  signatureDataUrl: '',
});

export function W9SignModal({
  isOpen,
  onClose,
  onSigned,
  defaultLegalName,
  defaultBusinessName,
  defaultAddress,
}: W9SignModalProps) {
  const [form, setForm] = useState<W9SignData>(() =>
    initial({ legalName: defaultLegalName, businessName: defaultBusinessName, address: defaultAddress })
  );
  const [certified, setCertified] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof W9SignData>(key: K, value: W9SignData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const tinDigitsOk = form.tin.replace(/\D/g, '').length === 9;
  const isComplete =
    !!form.legalName &&
    !!form.address &&
    !!form.city &&
    !!form.state &&
    !!form.zip &&
    tinDigitsOk &&
    certified &&
    hasSignature;

  function handleSign() {
    if (!isComplete) {
      setError('Please complete all required fields, certify, and sign before continuing.');
      return;
    }
    onSigned(form);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Sign Form W-9</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <p className="text-sm text-slate-600">
            This information is used to prepare your substitute Form W-9 for tax reporting on
            commission payments. It&apos;s encrypted in storage and viewable only by authorized admins.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block md:col-span-2">
              <span className="block text-sm font-medium text-slate-700 mb-1">Name (as shown on your tax return) *</span>
              <input className={inputClass} value={form.legalName} onChange={(e) => update('legalName', e.target.value)} />
            </label>
            <label className="block md:col-span-2">
              <span className="block text-sm font-medium text-slate-700 mb-1">Business name / disregarded entity name (if any)</span>
              <input className={inputClass} value={form.businessName} onChange={(e) => update('businessName', e.target.value)} />
            </label>
            <label className="block md:col-span-2">
              <span className="block text-sm font-medium text-slate-700 mb-1">Federal tax classification *</span>
              <select
                className={inputClass}
                value={form.taxClassification}
                onChange={(e) => update('taxClassification', e.target.value as W9SignData['taxClassification'])}
              >
                <option value="individual">Individual / sole proprietor or single-member LLC</option>
                <option value="c_corp">C Corporation</option>
                <option value="s_corp">S Corporation</option>
                <option value="partnership">Partnership</option>
                <option value="trust_estate">Trust/estate</option>
                <option value="llc">Limited liability company</option>
                <option value="other">Other</option>
              </select>
            </label>
            {form.taxClassification === 'llc' && (
              <label className="block md:col-span-2">
                <span className="block text-sm font-medium text-slate-700 mb-1">LLC tax classification (C, S, or P) *</span>
                <input className={inputClass} placeholder="C, S, or P" maxLength={1}
                  value={form.llcTaxClassification} onChange={(e) => update('llcTaxClassification', e.target.value.toUpperCase())} />
              </label>
            )}
            <label className="block md:col-span-2">
              <span className="block text-sm font-medium text-slate-700 mb-1">Address *</span>
              <input className={inputClass} value={form.address} onChange={(e) => update('address', e.target.value)} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">City *</span>
              <input className={inputClass} value={form.city} onChange={(e) => update('city', e.target.value)} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">State *</span>
              <input className={inputClass} value={form.state} onChange={(e) => update('state', e.target.value)} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">ZIP *</span>
              <input className={inputClass} value={form.zip} onChange={(e) => update('zip', e.target.value)} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">TIN type *</span>
              <select className={inputClass} value={form.tinType} onChange={(e) => update('tinType', e.target.value as W9SignData['tinType'])}>
                <option value="ssn">Social Security Number</option>
                <option value="ein">Employer Identification Number</option>
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="block text-sm font-medium text-slate-700 mb-1">
                {form.tinType === 'ssn' ? 'Social Security Number' : 'Employer Identification Number'} *
              </span>
              <input
                type="password"
                autoComplete="off"
                className={inputClass}
                placeholder={form.tinType === 'ssn' ? 'XXX-XX-XXXX' : 'XX-XXXXXXX'}
                value={form.tin}
                onChange={(e) => update('tin', e.target.value)}
              />
            </label>
          </div>

          <SignaturePad onChange={(dataUrl, has) => { update('signatureDataUrl', dataUrl); setHasSignature(has); }} />

          <div className="flex items-start gap-2">
            <Checkbox id="w9-certify" checked={certified} onCheckedChange={setCertified} />
            <label htmlFor="w9-certify" className="text-sm">
              Under penalties of perjury, I certify that the TIN shown is correct, I am not subject
              to backup withholding, I am a U.S. person, and any FATCA code entered is correct.
            </label>
          </div>

          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div>}
        </div>

        <div className="flex gap-2 justify-end pt-3 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSign} disabled={!isComplete} className="bg-blue-600 hover:bg-blue-700">
            Sign W-9
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
