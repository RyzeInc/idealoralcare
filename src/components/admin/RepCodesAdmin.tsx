'use client';

import { useState, Fragment } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Doc } from '@/convex/_generated/dataModel';
import { Plus, Loader2, Check, XCircle, RefreshCw, Tag, Trash2, ChevronDown, ChevronRight, Users, Pencil } from 'lucide-react';
import { UserSelector } from './UserSelector';
import { useToast } from './ui';
import styles from './RepCodesAdmin.module.css';

interface ClerkUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
}

type RepCodeWithRate = Doc<'brokerTrackingCodes'> & {
  commissionRate: number | null;
  // Available after `npx convex dev` regenerates types from updated schema
  slug?: string;
  productHint?: 'essentials' | 'oralcare' | 'plans';
};

// Local interface for distributionPartners (not yet in generated types until npx convex dev runs)
interface DistributionPartner {
  _id: string;
  name: string;
  type: 'program_manager' | 'fmo' | 'agency';
}

function generateCode(): string {
  // Omit 0/O/1/I to avoid confusion in printed codes
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `REP-${rand}`;
}

function EnrollmentDrillDown({ code }: { code: string }) {
  const enrollments = useQuery(api.admin.repCodes.getEnrollmentsByCode, { code });

  if (enrollments === undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', color: '#64748b' }}>
        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
        Loading enrollments…
      </div>
    );
  }
  if (enrollments.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', color: '#94a3b8' }}>
        <Users size={14} />
        No enrollments recorded for this code.
      </div>
    );
  }
  return (
    <div style={{ padding: '8px 16px 12px 32px' }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>
        Enrollments ({enrollments.length})
      </p>
      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ color: '#94a3b8', textAlign: 'left' }}>
            <th style={{ padding: '4px 8px', fontWeight: 500 }}>Member</th>
            <th style={{ padding: '4px 8px', fontWeight: 500 }}>Email</th>
            <th style={{ padding: '4px 8px', fontWeight: 500 }}>Status</th>
            <th style={{ padding: '4px 8px', fontWeight: 500 }}>Date</th>
          </tr>
        </thead>
        <tbody>
          {enrollments.map((e) => (
            <tr key={e._id}>
              <td style={{ padding: '4px 8px' }}>{e.memberName ?? '—'}</td>
              <td style={{ padding: '4px 8px', color: '#64748b' }}>{e.memberEmail ?? '—'}</td>
              <td style={{ padding: '4px 8px' }}>
                <span style={{
                  display: 'inline-block',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontSize: 11,
                  background: e.status === 'completed' ? '#dcfce7' : '#fef9c3',
                  color: e.status === 'completed' ? '#166534' : '#854d0e',
                }}>{e.status}</span>
              </td>
              <td style={{ padding: '4px 8px', color: '#64748b' }}>{new Date(e._creationTime).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RepCodesAdmin() {
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [useExistingUser, setUseExistingUser] = useState(true);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    brokerId: '',
    agencyId: '',
    code: '',
    slug: '',
    productHint: '',
    notes: '',
  });

  const allCodes = useQuery(api.admin.repCodes.getAllWithRates) as RepCodeWithRate[] | undefined;
  const allPartners = useQuery(api.admin.distributionPartners.getAll) as DistributionPartner[] | undefined;
  const agencies = (allPartners ?? []).filter((p) => p.type === 'fmo' || p.type === 'agency');

  const createCode = useMutation(api.admin.repCodes.create);
  const revokeCode = useMutation(api.admin.repCodes.revoke);
  const reactivateCode = useMutation(api.admin.repCodes.reactivate);
  const removeCode = useMutation(api.admin.repCodes.remove);
  const updateCode = useMutation(api.admin.repCodes.update);
  const backfillSlugsAction = useMutation(api.admin.repCodes.backfillSlugs);

  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState({ slug: '', productHint: '' });

  const resetForm = () => {
    setFormData({ brokerId: '', agencyId: '', code: '', slug: '', productHint: '', notes: '' });
    setShowForm(false);
    setUseExistingUser(true);
  };

  const handleSelectUser = (user: ClerkUser) => {
    setFormData((prev) => ({ ...prev, brokerId: user.id }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.brokerId) {
      toast.warning('Agent required', 'Select a user or paste a Clerk User ID for the agent.');
      return;
    }
    if (!formData.code) {
      toast.warning('Rep code required', 'Enter or generate a rep code before saving.');
      return;
    }
    try {
      await createCode({
        brokerId: formData.brokerId,
        agencyId: formData.agencyId || undefined,
        code: formData.code.toUpperCase(),
        slug: formData.slug || undefined,
        productHint: (formData.productHint || undefined) as 'essentials' | 'oralcare' | 'plans' | undefined,
        notes: formData.notes || undefined,
      });
      resetForm();
      toast.success('Rep code created', formData.code.toUpperCase());
    } catch (error: unknown) {
      toast.fromError(error, 'Could not create rep code');
    }
  };

  const handleRevoke = async (code: Doc<'brokerTrackingCodes'>) => {
    if (!confirm(`Revoke code "${code.code}"? It will no longer accept new enrollments.`)) return;
    try {
      await revokeCode({ id: code._id });
      toast.success('Code revoked', code.code);
    } catch (error) {
      toast.fromError(error, 'Could not revoke code');
    }
  };

  const handleReactivate = async (code: Doc<'brokerTrackingCodes'>) => {
    try {
      await reactivateCode({ id: code._id });
      toast.success('Code reactivated', code.code);
    } catch (error) {
      toast.fromError(error, 'Could not reactivate code');
    }
  };

  const handleDelete = async (code: Doc<'brokerTrackingCodes'>) => {
    if (!confirm(`Permanently delete code "${code.code}"? This cannot be undone.`)) return;
    try {
      await removeCode({ id: code._id });
      toast.success('Code deleted', code.code);
    } catch (error) {
      toast.fromError(error, 'Could not delete code');
    }
  };

  const handleSaveEdit = async (code: RepCodeWithRate) => {
    try {
      await updateCode({
        id: code._id,
        slug: editFields.slug || undefined,
        productHint: (editFields.productHint || undefined) as 'essentials' | 'oralcare' | 'plans' | undefined,
      });
      setEditingCodeId(null);
      toast.success('Updated', 'URL slug saved.');
    } catch (error) {
      toast.fromError(error, 'Could not update slug');
    }
  };

  const handleBackfill = async () => {
    if (!confirm("Auto-generate URL slugs for all codes that don't have one yet? Derives slug from the agent's name.")) return;
    try {
      const result = await backfillSlugsAction({}) as { updated: number };
      toast.success('Slugs backfilled', `${result.updated} code(s) updated.`);
    } catch (error) {
      toast.fromError(error, 'Could not backfill slugs');
    }
  };

  const getAgencyName = (agencyId?: string): string | null => {
    if (!agencyId) return null;
    return allPartners?.find((p) => p._id === agencyId)?.name ?? null;
  };

  if (allCodes === undefined || allPartners === undefined) {
    return (
      <div className={styles.loadingState}>
        <Loader2 size={32} className={styles.spinner} />
        <p>Loading rep codes...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Rep Codes</h1>
          <p>
            Agent tracking codes used at enrollment checkout — the &ldquo;Rep Code&rdquo; field.
            Each code links a sale to a specific agent and their agency for commission attribution.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleBackfill}
            className={styles.addButton}
            style={{ background: '#475569' }}
            title="Auto-generate URL slugs for codes that don't have one"
          >
            <RefreshCw size={18} />
            Backfill Slugs
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className={styles.addButton}
          >
            <Plus size={18} />
            {showForm ? 'Cancel' : 'Add Rep Code'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Codes</span>
          <span className={styles.statValue}>{allCodes.length}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Active</span>
          <span className={styles.statValue} style={{ color: '#059669' }}>
            {allCodes.filter((c) => c.status === 'active').length}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Uses</span>
          <span className={styles.statValue}>
            {allCodes.reduce((sum, c) => sum + c.usageCount, 0)}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Revoked</span>
          <span className={styles.statValue} style={{ color: '#dc2626' }}>
            {allCodes.filter((c) => c.status === 'revoked').length}
          </span>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className={styles.formCard}>
          <h2>Add New Rep Code</h2>
          <form onSubmit={handleSubmit}>
            <div className={styles.modeToggle}>
              <label className={styles.modeLabel}>Agent</label>
              <div className={styles.radioGroup}>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    checked={useExistingUser}
                    onChange={() => {
                      setUseExistingUser(true);
                      setFormData((prev) => ({ ...prev, brokerId: '' }));
                    }}
                  />
                  <span>Select from Existing Users</span>
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    checked={!useExistingUser}
                    onChange={() => {
                      setUseExistingUser(false);
                      setFormData((prev) => ({ ...prev, brokerId: '' }));
                    }}
                  />
                  <span>Manual Entry (Clerk User ID)</span>
                </label>
              </div>
            </div>

            {useExistingUser ? (
              <div className={styles.formGroup}>
                <UserSelector
                  onSelectUser={handleSelectUser}
                  selectedUserId={formData.brokerId}
                  label="Select Agent"
                  placeholder="Search by name or email..."
                />
              </div>
            ) : (
              <div className={styles.formGroup}>
                <label>Agent Clerk User ID *</label>
                <input
                  type="text"
                  value={formData.brokerId}
                  onChange={(e) => setFormData({ ...formData, brokerId: e.target.value })}
                  placeholder="user_xxxxxxxxxxxxx"
                />
              </div>
            )}

            <div className={styles.formGroup}>
              <label>Agency / FMO (Optional)</label>
              <select
                value={formData.agencyId}
                onChange={(e) => setFormData({ ...formData, agencyId: e.target.value })}
                className={styles.select}
              >
                <option value="">— Unaffiliated —</option>
                {agencies.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name} ({a.type === 'fmo' ? 'FMO' : 'Agency'})
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Rep Code *</label>
              <div className={styles.codeInputRow}>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. REP-ABC123"
                  style={{ textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: '0.5px' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, code: generateCode() })}
                  className={styles.generateButton}
                >
                  <RefreshCw size={14} />
                  Generate
                </button>
              </div>
              <p className={styles.hint}>
                Must be unique. This is what the agent gives to customers to enter at checkout.
              </p>
            </div>

            <div className={styles.formGroup}>
              <label>Notes (Optional)</label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="e.g. American Fidelity Q1 2026 campaign"
              />
            </div>

            <div className={styles.formGroup}>
              <label>URL Slug (Optional)</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                placeholder="e.g. allenjackson (leave blank to use rep code)"
                style={{ fontFamily: 'monospace' }}
              />
              <p className={styles.hint}>
                Vanity URL: getidealoh.com/&lt;slug&gt;. The rep code itself always works too (getidealoh.com/230001).
              </p>
            </div>

            <div className={styles.formGroup}>
              <label>Default Landing Page (Optional)</label>
              <select
                value={formData.productHint}
                onChange={(e) => setFormData({ ...formData, productHint: e.target.value })}
                className={styles.select}
              >
                <option value="">— Default (Plans page) —</option>
                <option value="essentials">Essentials</option>
                <option value="oralcare">Oral Care</option>
                <option value="plans">Plans</option>
              </select>
              <p className={styles.hint}>
                Where the vanity URL redirects. Can always be overridden with ?to= in the URL.
              </p>
            </div>

            <div className={styles.formActions}>
              <button type="submit" className={styles.submitButton}>
                Create Rep Code
              </button>
              <button type="button" onClick={resetForm} className={styles.cancelButton}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Codes Table */}
      {allCodes.length === 0 ? (
        <div className={styles.emptyState}>
          <Tag size={48} color="#94a3b8" />
          <p>No rep codes created yet.</p>
          <button onClick={() => setShowForm(true)} className={styles.emptyAddButton}>
            <Plus size={18} />
            Create First Rep Code
          </button>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>Code</th>
                <th>URL Slug</th>
                <th>Agent (Clerk ID)</th>
                <th>Agency / FMO</th>
                <th>Uses</th>
                <th>Commission</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allCodes.map((code) => (
                <Fragment key={code._id}>
                  <tr>
                    <td>
                      <button
                        onClick={() => setExpandedCode(expandedCode === code.code ? null : code.code)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 2, display: 'flex' }}
                        title={expandedCode === code.code ? 'Hide enrollments' : 'View enrollments'}
                      >
                        {expandedCode === code.code ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </button>
                    </td>
                    <td>
                      <span className={styles.codeTag}>{code.code}</span>
                    </td>
                    <td>
                      {code.slug ? (
                        <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#f0f9ff', padding: '2px 6px', borderRadius: 4, color: '#0369a1' }}>
                          /{code.slug}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td className={styles.clerkIdCell} title={code.brokerId}>
                      {code.brokerId.length > 22
                        ? `${code.brokerId.slice(0, 22)}…`
                        : code.brokerId}
                    </td>
                    <td>
                      {getAgencyName(code.agencyId) ?? (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td className={styles.usageCell}>{code.usageCount}</td>
                    <td>
                      {code.commissionRate != null ? (
                        <span style={{ fontWeight: 600, color: '#059669' }}>{code.commissionRate}%</span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${styles[`status_${code.status}` as keyof typeof styles]}`}
                      >
                        {code.status}
                      </span>
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          onClick={() => {
                            setEditingCodeId(editingCodeId === code._id ? null : code._id);
                            setEditFields({ slug: code.slug ?? '', productHint: code.productHint ?? '' });
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}
                          title="Edit URL slug / landing page"
                        >
                          <Pencil size={15} />
                        </button>
                        {code.status === 'active' ? (
                          <button
                            onClick={() => handleRevoke(code)}
                            className={styles.revokeButton}
                            title="Revoke code"
                          >
                            <XCircle size={15} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(code)}
                            className={styles.reactivateButton}
                            title="Reactivate code"
                          >
                            <Check size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(code)}
                          className={styles.deleteButton}
                          title="Delete permanently"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedCode === code.code && (
                    <tr>
                      <td colSpan={9} style={{ background: '#f8fafc', padding: 0, borderBottom: '2px solid #e2e8f0' }}>
                        <EnrollmentDrillDown code={code.code} />
                      </td>
                    </tr>
                  )}
                  {editingCodeId === code._id && (
                    <tr>
                      <td colSpan={9} style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                        <div style={{ padding: '12px 16px', display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                              URL Slug
                            </label>
                            <input
                              type="text"
                              value={editFields.slug}
                              onChange={(e) => setEditFields((prev) => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                              placeholder="e.g. allenjackson"
                              style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, width: 200, fontFamily: 'monospace' }}
                            />
                            <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>
                              getidealoh.com/{editFields.slug || code.code.toLowerCase()}
                            </p>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                              Default Landing
                            </label>
                            <select
                              value={editFields.productHint}
                              onChange={(e) => setEditFields((prev) => ({ ...prev, productHint: e.target.value }))}
                              style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                            >
                              <option value="">— Default (Plans) —</option>
                              <option value="essentials">Essentials</option>
                              <option value="oralcare">Oral Care</option>
                              <option value="plans">Plans</option>
                            </select>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={() => handleSaveEdit(code)}
                              style={{ padding: '6px 14px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingCodeId(null)}
                              style={{ padding: '6px 14px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
