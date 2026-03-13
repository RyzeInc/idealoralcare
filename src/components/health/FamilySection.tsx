'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Users, UserPlus, Mail, Trash2, RefreshCw, CheckCircle, Clock } from 'lucide-react';

type Relationship = 'spouse' | 'child' | 'domestic_partner' | 'other';

const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  spouse: 'Spouse',
  child: 'Child',
  domestic_partner: 'Domestic Partner',
  other: 'Other',
};

function InviteStatusBadge({ status }: { status: string | undefined }) {
  if (status === 'claimed') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.625rem', background: '#dcfce7', color: '#15803d', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 600 }}>
        <CheckCircle size={11} /> Active
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.625rem', background: '#fef9c3', color: '#854d0e', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 600 }}>
      <Clock size={11} /> Invite Pending
    </span>
  );
}

export default function FamilySection() {
  // Use any-cast to avoid TypeScript deep instantiation limit on Convex generated union types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment
  // @ts-ignore – Convex generated types exceed TS instantiation depth; runtime is correct
  const convexApi = api; // intentionally untyped for the lines below
  const dependents = useQuery(convexApi.enrollment.dependents.getMyDependents) as any[] | undefined;
  const addDependent = useMutation(convexApi.enrollment.dependents.addDependent);
  const removeDependent = useMutation(convexApi.enrollment.dependents.removeDependent);
  const resendInvite = useMutation(convexApi.enrollment.dependents.resendDependentInvite);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', relationship: 'spouse' as Relationship });
  const [errors, setErrors] = useState<Partial<typeof form>>({});
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const validate = (): boolean => {
    const errs: Partial<typeof form> = {};
    if (!form.firstName.trim()) errs.firstName = 'Required';
    if (!form.lastName.trim()) errs.lastName = 'Required';
    if (!form.email.trim() || !/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) errs.email = 'Valid email required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAdd = async () => {
    if (!validate()) return;
    setAdding(true);
    setAddError(null);
    try {
      await addDependent({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        relationship: form.relationship,
      });
      setForm({ firstName: '', lastName: '', email: '', relationship: 'spouse' });
      setErrors({});
      setShowForm(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add family member');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (dependentId: string) => {
    setRemovingId(dependentId);
    try {
      await removeDependent({ dependentProfileId: dependentId as any });
    } finally {
      setRemovingId(null);
      setConfirmRemoveId(null);
    }
  };

  const handleResend = async (dependentId: string) => {
    setResendingId(dependentId);
    try {
      await resendInvite({ dependentProfileId: dependentId as any });
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="glass-card" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
          <Users size={24} color="#0066CC" />
          Family Members
        </h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.875rem', background: '#0066CC', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}
          >
            <UserPlus size={15} /> Add Member
          </button>
        )}
      </div>

      {/* Existing dependents */}
      {dependents === undefined ? (
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Loading…</p>
      ) : dependents.length === 0 && !showForm ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
          <Users size={28} color="#94a3b8" style={{ marginBottom: '0.75rem' }} />
          <p style={{ color: '#64748b', marginBottom: '1rem', fontSize: '0.9rem' }}>
            No family members added yet. Add a spouse, child, or dependent to share your plan benefits.
          </p>
          <button
            onClick={() => setShowForm(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', background: '#0066CC', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}
          >
            <UserPlus size={15} /> Add Family Member
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {dependents.map((dep: any) => (
            <div key={dep._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <div>
                <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.25rem' }}>
                  {dep.firstName} {dep.lastName}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'capitalize' }}>
                    {RELATIONSHIP_LABELS[dep.relationship as Relationship] ?? dep.relationship}
                  </span>
                  {dep.invitedEmail && (
                    <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <Mail size={12} /> {dep.invitedEmail}
                    </span>
                  )}
                  <InviteStatusBadge status={dep.inviteStatus} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {dep.inviteStatus !== 'claimed' && (
                  <button
                    onClick={() => handleResend(dep._id)}
                    disabled={resendingId === dep._id}
                    title="Resend invite email"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.625rem', background: 'transparent', border: '1px solid #d1d5db', borderRadius: '6px', color: '#6b7280', fontSize: '0.78rem', cursor: 'pointer' }}
                  >
                    <RefreshCw size={12} className={resendingId === dep._id ? 'spin' : ''} />
                    {resendingId === dep._id ? 'Sending…' : 'Resend'}
                  </button>
                )}
                {confirmRemoveId === dep._id ? (
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    <button
                      onClick={() => handleRemove(dep._id)}
                      disabled={removingId === dep._id}
                      style={{ padding: '0.375rem 0.625rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                      {removingId === dep._id ? 'Removing…' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setConfirmRemoveId(null)}
                      style={{ padding: '0.375rem 0.625rem', background: 'transparent', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer', color: '#6b7280' }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRemoveId(dep._id)}
                    title="Remove family member"
                    style={{ display: 'flex', alignItems: 'center', padding: '0.375rem 0.5rem', background: 'transparent', border: '1px solid #fca5a5', borderRadius: '6px', color: '#ef4444', cursor: 'pointer' }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add dependent form */}
      {showForm && (
        <div style={{ marginTop: dependents && dependents.length > 0 ? '1rem' : '0', padding: '1.25rem', border: '1px solid #d1d5db', borderRadius: '10px', background: 'white' }}>
          <h4 style={{ fontWeight: 600, color: '#0f172a', marginBottom: '1rem', marginTop: 0 }}>Add Family Member</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>First Name *</label>
              <input
                value={form.firstName}
                onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))}
                placeholder="Jane"
                style={{ width: '100%', padding: '0.5rem 0.625rem', border: `1px solid ${errors.firstName ? '#ef4444' : '#d1d5db'}`, borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
              {errors.firstName && <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{errors.firstName}</span>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Last Name *</label>
              <input
                value={form.lastName}
                onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))}
                placeholder="Doe"
                style={{ width: '100%', padding: '0.5rem 0.625rem', border: `1px solid ${errors.lastName ? '#ef4444' : '#d1d5db'}`, borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
              {errors.lastName && <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{errors.lastName}</span>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Email Address *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="jane@example.com"
                style={{ width: '100%', padding: '0.5rem 0.625rem', border: `1px solid ${errors.email ? '#ef4444' : '#d1d5db'}`, borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
              {errors.email && <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{errors.email}</span>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Relationship</label>
              <select
                value={form.relationship}
                onChange={e => setForm(p => ({ ...p, relationship: e.target.value as Relationship }))}
                style={{ width: '100%', padding: '0.5rem 0.625rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', background: 'white', boxSizing: 'border-box' }}
              >
                <option value="spouse">Spouse</option>
                <option value="child">Child</option>
                <option value="domestic_partner">Domestic Partner</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          {addError && <p style={{ color: '#dc2626', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{addError}</p>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleAdd}
              disabled={adding}
              style={{ padding: '0.5rem 1.25rem', background: '#0066CC', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 600, cursor: adding ? 'not-allowed' : 'pointer', opacity: adding ? 0.7 : 1 }}
            >
              {adding ? 'Adding…' : 'Add Member'}
            </button>
            <button
              onClick={() => { setShowForm(false); setErrors({}); setAddError(null); setForm({ firstName: '', lastName: '', email: '', relationship: 'spouse' }); }}
              style={{ padding: '0.5rem 1rem', background: 'transparent', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.75rem', marginBottom: 0 }}>
            They&apos;ll receive an email invitation to create their own login and access the plan benefits.
          </p>
        </div>
      )}
    </div>
  );
}
