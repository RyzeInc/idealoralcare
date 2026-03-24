'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Doc } from '@/convex/_generated/dataModel';
import { Plus, Loader2, Check, XCircle, RefreshCw, Tag, Trash2 } from 'lucide-react';
import { UserSelector } from './UserSelector';
import styles from './RepCodesAdmin.module.css';

interface ClerkUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
}

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

export function RepCodesAdmin() {
  const [showForm, setShowForm] = useState(false);
  const [useExistingUser, setUseExistingUser] = useState(true);
  const [formData, setFormData] = useState({
    brokerId: '',
    agencyId: '',
    code: '',
    notes: '',
  });

  const allCodes = useQuery(api.admin.repCodes.getAll) as Doc<'brokerTrackingCodes'>[] | undefined;
  const allPartners = useQuery(api.admin.distributionPartners.getAll) as DistributionPartner[] | undefined;
  const agencies = (allPartners ?? []).filter((p) => p.type === 'fmo' || p.type === 'agency');

  const createCode = useMutation(api.admin.repCodes.create);
  const revokeCode = useMutation(api.admin.repCodes.revoke);
  const reactivateCode = useMutation(api.admin.repCodes.reactivate);
  const removeCode = useMutation(api.admin.repCodes.remove);

  const resetForm = () => {
    setFormData({ brokerId: '', agencyId: '', code: '', notes: '' });
    setShowForm(false);
    setUseExistingUser(true);
  };

  const handleSelectUser = (user: ClerkUser) => {
    setFormData((prev) => ({ ...prev, brokerId: user.id }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.brokerId) {
      alert('Please select or provide an agent (Clerk User ID)');
      return;
    }
    if (!formData.code) {
      alert('Please enter or generate a rep code');
      return;
    }
    try {
      await createCode({
        brokerId: formData.brokerId,
        agencyId: formData.agencyId || undefined,
        code: formData.code.toUpperCase(),
        notes: formData.notes || undefined,
      });
      resetForm();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error creating rep code. Please try again.';
      alert(message);
    }
  };

  const handleRevoke = async (code: Doc<'brokerTrackingCodes'>) => {
    if (!confirm(`Revoke code "${code.code}"? It will no longer accept new enrollments.`)) return;
    try {
      await revokeCode({ id: code._id });
    } catch {
      alert('Error revoking code. Please try again.');
    }
  };

  const handleReactivate = async (code: Doc<'brokerTrackingCodes'>) => {
    try {
      await reactivateCode({ id: code._id });
    } catch {
      alert('Error reactivating code. Please try again.');
    }
  };

  const handleDelete = async (code: Doc<'brokerTrackingCodes'>) => {
    if (!confirm(`Permanently delete code "${code.code}"? This cannot be undone.`)) return;
    try {
      await removeCode({ id: code._id });
    } catch {
      alert('Error deleting code. Please try again.');
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
        <button
          onClick={() => setShowForm(!showForm)}
          className={styles.addButton}
        >
          <Plus size={18} />
          {showForm ? 'Cancel' : 'Add Rep Code'}
        </button>
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
                <th>Code</th>
                <th>Agent (Clerk ID)</th>
                <th>Agency / FMO</th>
                <th>Uses</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allCodes.map((code) => (
                <tr key={code._id}>
                  <td>
                    <span className={styles.codeTag}>{code.code}</span>
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
                    <span
                      className={`${styles.statusBadge} ${styles[`status_${code.status}` as keyof typeof styles]}`}
                    >
                      {code.status}
                    </span>
                  </td>
                  <td>
                    <div className={styles.rowActions}>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
