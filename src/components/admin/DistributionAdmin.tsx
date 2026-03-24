'use client';

import { useState } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Plus, Pencil, Trash2, Loader2, Mail, Phone, ChevronRight, Building2, Send, CheckCircle2, Clock } from 'lucide-react';
import styles from './DistributionAdmin.module.css';

type PartnerType = 'program_manager' | 'fmo' | 'agency';
type PartnerStatus = 'active' | 'inactive' | 'suspended';

// Local interface — matches the distributionPartners schema.
// Doc<'distributionPartners'> will be available after running npx convex dev.
interface DistributionPartner {
  _id: string;
  _creationTime: number;
  name: string;
  type: PartnerType;
  parentId?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  clerkUserId?: string;
  inviteStatus?: 'pending' | 'claimed';
  overrideRate?: number;
  status: PartnerStatus;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
}

const TYPE_LABELS: Record<PartnerType, { label: string; badge: string }> = {
  program_manager: { label: 'Program Manager', badge: 'PM' },
  fmo: { label: 'FMO', badge: 'FMO' },
  agency: { label: 'Agency', badge: 'AGY' },
};

const TABS = [
  { key: 'program_managers' as const, label: 'Program Managers', type: 'program_manager' as PartnerType },
  { key: 'fmos' as const, label: 'FMOs & Agencies', type: 'fmo' as PartnerType },
];

const EMPTY_FORM = {
  name: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  overrideRate: '',
  parentId: '',
  status: 'active' as PartnerStatus,
  notes: '',
  subType: 'fmo' as 'fmo' | 'agency',
};

export function DistributionAdmin() {
  const [activeTab, setActiveTab] = useState<'program_managers' | 'fmos'>('program_managers');
  const [showForm, setShowForm] = useState(false);
  const [editingPartner, setEditingPartner] = useState<DistributionPartner | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<Record<string, 'sent' | 'error'>>({});

  const allPartners = useQuery(api.admin.distributionPartners.getAllWithStats) as (DistributionPartner & { completedEnrollments: number; activeMemberCount: number; repCodeCount: number; totalUsage: number })[] | undefined;
  const programManagers = (allPartners ?? []).filter((p) => p.type === 'program_manager');
  const fmosAndAgencies = (allPartners ?? []).filter((p) => p.type === 'fmo' || p.type === 'agency');

  const addPartner = useMutation(api.admin.distributionPartners.add);
  const updatePartner = useMutation(api.admin.distributionPartners.update);
  const removePartner = useMutation(api.admin.distributionPartners.remove);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sendInviteAction = useAction((api as any).admin.distributionPartners.sendInvite);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingPartner(null);
    setShowForm(false);
  };

  const handleSendInvite = async (partner: DistributionPartner) => {
    if (!confirm(`Send an invite email to ${partner.contactName} at ${partner.contactEmail}?`)) return;
    setInvitingId(partner._id);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await sendInviteAction({ partnerId: partner._id as any });
      setInviteResult((prev) => ({ ...prev, [partner._id]: result.success ? 'sent' : 'error' }));
      if (!result.success) alert(`Failed to send invite: ${result.error}`);
    } catch {
      setInviteResult((prev) => ({ ...prev, [partner._id]: 'error' }));
      alert('Error sending invite. Please try again.');
    } finally {
      setInvitingId(null);
    }
  };

  const handleEditPartner = (partner: DistributionPartner) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      contactName: partner.contactName,
      contactEmail: partner.contactEmail,
      contactPhone: partner.contactPhone ?? '',
      overrideRate: partner.overrideRate?.toString() ?? '',
      parentId: partner.parentId ?? '',
      status: partner.status,
      notes: partner.notes ?? '',
      subType: partner.type === 'agency' ? 'agency' : 'fmo',
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.contactName || !formData.contactEmail) {
      alert('Please fill in Organization Name, Contact Name, and Contact Email');
      return;
    }

    const isPmTab = activeTab === 'program_managers';
    const partnerType: PartnerType = isPmTab ? 'program_manager' : formData.subType;

    try {
      if (editingPartner) {
        await updatePartner({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          id: editingPartner._id as any,
          name: formData.name,
          contactName: formData.contactName,
          contactEmail: formData.contactEmail,
          contactPhone: formData.contactPhone || undefined,
          overrideRate: formData.overrideRate ? parseFloat(formData.overrideRate) : undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          parentId: formData.parentId ? (formData.parentId as any) : undefined,
          status: formData.status,
          notes: formData.notes || undefined,
        });
      } else {
        await addPartner({
          name: formData.name,
          type: partnerType,
          contactName: formData.contactName,
          contactEmail: formData.contactEmail,
          contactPhone: formData.contactPhone || undefined,
          overrideRate: formData.overrideRate ? parseFloat(formData.overrideRate) : undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          parentId: formData.parentId ? (formData.parentId as any) : undefined,
          status: formData.status,
          notes: formData.notes || undefined,
        });
      }
      resetForm();
    } catch {
      alert('Error saving partner. Please try again.');
    }
  };

  const handleDelete = async (partner: DistributionPartner) => {
    if (!confirm(`Are you sure you want to delete "${partner.name}"? This cannot be undone.`)) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await removePartner({ id: partner._id as any });
    } catch {
      alert('Error deleting partner. Please try again.');
    }
  };

  if (allPartners === undefined) {
    return (
      <div className={styles.loadingState}>
        <Loader2 size={32} className={styles.spinner} />
        <p>Loading distribution partners...</p>
      </div>
    );
  }

  const activePartners = activeTab === 'program_managers' ? programManagers : fmosAndAgencies;
  const tabLabel = activeTab === 'program_managers' ? 'Program Manager' : 'FMO / Agency';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Distribution Management</h1>
          <p>Manage Program Managers and FMOs / Agencies in the sales distribution chain</p>
        </div>
        <button
          onClick={() => (editingPartner ? resetForm() : setShowForm(!showForm))}
          className={styles.addButton}
        >
          <Plus size={18} />
          {showForm && !editingPartner ? 'Cancel' : `Add ${tabLabel}`}
        </button>
      </div>

      {/* Pay-chain reference banner */}
      <div className={styles.chainBanner}>
        <div className={styles.chainStep}>
          <span className={styles.chainBadge} style={{ background: '#7c3aed' }}>Carrier</span>
          <span className={styles.chainDesc}>Keeps premium (Ryze Nexus)</span>
        </div>
        <ChevronRight size={14} className={styles.chainArrow} />
        <div className={styles.chainStep}>
          <span className={styles.chainBadge} style={{ background: '#1d4ed8' }}>PM</span>
          <span className={styles.chainDesc}>Management fee — Ideal Health</span>
        </div>
        <ChevronRight size={14} className={styles.chainArrow} />
        <div className={styles.chainStep}>
          <span className={styles.chainBadge} style={{ background: '#0891b2' }}>FMO</span>
          <span className={styles.chainDesc}>Override — manages agents</span>
        </div>
        <ChevronRight size={14} className={styles.chainArrow} />
        <div className={styles.chainStep}>
          <span className={styles.chainBadge} style={{ background: '#059669' }}>Rep</span>
          <span className={styles.chainDesc}>Street-level commission (Rep Codes)</span>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); resetForm(); }}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
          >
            {tab.label}
            <span className={styles.tabBadge}>
              {tab.key === 'program_managers' ? programManagers.length : fmosAndAgencies.length}
            </span>
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className={styles.formCard}>
          <h2>{editingPartner ? `Edit ${tabLabel}` : `Add New ${tabLabel}`}</h2>
          <form onSubmit={handleSave}>

            {/* ── Organization ── */}
            <div className={styles.sectionTitle}>Organization</div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Organization Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Acme Insurance FMO"
                  required
                />
              </div>
              {activeTab === 'fmos' && (
                <div className={styles.formGroup}>
                  <label>Type *</label>
                  <select
                    value={formData.subType}
                    onChange={(e) => setFormData({ ...formData, subType: e.target.value as 'fmo' | 'agency' })}
                    className={styles.select}
                  >
                    <option value="fmo">FMO (Field Marketing Organization)</option>
                    <option value="agency">Agency</option>
                  </select>
                </div>
              )}
            </div>

            {activeTab === 'fmos' && (
              <div className={styles.formGroup}>
                <label>Parent Program Manager (Optional)</label>
                <select
                  value={formData.parentId}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                  className={styles.select}
                >
                  <option value="">— Independent (no parent PM) —</option>
                  {programManagers.map((pm) => (
                    <option key={pm._id} value={pm._id}>{pm.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* ── Primary Contact ── */}
            <div className={styles.sectionTitle}>Primary Contact</div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Contact Name *</label>
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  placeholder="Jane Smith"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Contact Email *</label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  placeholder="jane@agency.com"
                  required
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Contact Phone</label>
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Override / Management Fee Rate (%)</label>
                <input
                  type="number"
                  value={formData.overrideRate}
                  onChange={(e) => setFormData({ ...formData, overrideRate: e.target.value })}
                  placeholder="5.0"
                  step="0.1"
                  min="0"
                  max="100"
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as PartnerStatus })}
                  className={styles.select}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Notes</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional notes"
                />
              </div>
            </div>

            <div className={styles.formActions}>
              <button type="submit" className={styles.submitButton}>
                {editingPartner ? 'Update' : 'Add'} {tabLabel}
              </button>
              <button type="button" onClick={resetForm} className={styles.cancelButton}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Partners list */}
      {activePartners.length === 0 ? (
        <div className={styles.emptyState}>
          <Building2 size={48} color="#94a3b8" />
          <p>No {tabLabel}s added yet.</p>
          <button onClick={() => setShowForm(true)} className={styles.emptyAddButton}>
            <Plus size={18} />
            Add Your First {tabLabel}
          </button>
        </div>
      ) : (
        <div className={styles.partnerGrid}>
          {activePartners.map((partner) => (
            <div key={partner._id} className={styles.partnerCard}>
              <div className={styles.partnerHeader}>
                <div>
                  <div className={styles.partnerTypeBadge} data-type={partner.type}>
                    {TYPE_LABELS[partner.type].badge}
                  </div>
                  <h3>{partner.name}</h3>
                </div>
                <div className={styles.partnerActions}>
                  <button
                    onClick={() => handleEditPartner(partner)}
                    className={styles.editButton}
                    title="Edit"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(partner)}
                    className={styles.deleteButton}
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className={styles.partnerInfo}>
                <div className={styles.infoRow}>
                  <Mail size={13} />
                  <a href={`mailto:${partner.contactEmail}`}>
                    {partner.contactName} — {partner.contactEmail}
                  </a>
                </div>
                {partner.contactPhone && (
                  <div className={styles.infoRow}>
                    <Phone size={13} />
                    <a href={`tel:${partner.contactPhone}`}>{partner.contactPhone}</a>
                  </div>
                )}
                {partner.overrideRate !== undefined && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Override Rate:</span>
                    <strong>{partner.overrideRate}%</strong>
                  </div>
                )}
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Enrollments:</span>
                  <strong>{(partner as any).completedEnrollments ?? 0}</strong>
                  <span className={styles.infoLabel} style={{ marginLeft: 8 }}>Members:</span>
                  <strong>{(partner as any).activeMemberCount ?? 0}</strong>
                  <span className={styles.infoLabel} style={{ marginLeft: 8 }}>Rep Codes:</span>
                  <strong>{(partner as any).repCodeCount ?? 0}</strong>
                </div>
                {/* Invite status */}
                <div className={styles.infoRow} style={{ marginTop: 4 }}>
                  {partner.inviteStatus === 'claimed' || partner.clerkUserId ? (
                    <><CheckCircle2 size={13} style={{ color: '#16a34a' }} /><span style={{ fontSize: 12, color: '#16a34a' }}>Access active</span></>
                  ) : partner.inviteStatus === 'pending' ? (
                    <><Clock size={13} style={{ color: '#d97706' }} /><span style={{ fontSize: 12, color: '#d97706' }}>Invite sent — awaiting signup</span></>
                  ) : (
                    <><Send size={13} style={{ color: '#94a3b8' }} /><span style={{ fontSize: 12, color: '#94a3b8' }}>No invite sent yet</span></>
                  )}
                </div>
              </div>

              <div className={styles.partnerFooter}>
                <span className={`${styles.statusBadge} ${styles[`status_${partner.status}` as keyof typeof styles]}`}>
                  {partner.status}
                </span>
                {partner.parentId && (
                  <span className={styles.parentLabel}>
                    ↳ {programManagers.find((pm) => pm._id === partner.parentId)?.name ?? 'Parent PM'}
                  </span>
                )}
                {/* Send / Resend invite button */}
                {partner.inviteStatus !== 'claimed' && !partner.clerkUserId && (
                  <button
                    onClick={() => handleSendInvite(partner)}
                    disabled={invitingId === partner._id}
                    className={styles.editButton}
                    title="Send invite email"
                    style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                  >
                    {invitingId === partner._id ? (
                      <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <Send size={13} />
                    )}
                    {inviteResult[partner._id] === 'sent' ? 'Resend Invite' : partner.inviteStatus === 'pending' ? 'Resend Invite' : 'Send Invite'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
