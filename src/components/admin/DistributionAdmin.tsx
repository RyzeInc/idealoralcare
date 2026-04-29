'use client';

import { useState } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Plus, Pencil, Trash2, Loader2, Mail, Phone, ChevronRight, Building2, Send, CheckCircle2, Clock, Users, X, UserPlus } from 'lucide-react';
import { useToast } from './ui';
import styles from './DistributionAdmin.module.css';

type PartnerType = 'program_manager' | 'fmo' | 'agency';
type PartnerStatus = 'active' | 'inactive' | 'suspended';

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

interface PartnerLeader {
  _id: string;
  partnerId: string;
  name: string;
  email: string;
  phone?: string;
  title?: string;
  isPrimary: boolean;
  clerkUserId?: string;
  inviteStatus?: 'pending' | 'claimed';
  createdAt: number;
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
  contactTitle: '',
  overrideRate: '',
  parentId: '',
  status: 'active' as PartnerStatus,
  notes: '',
  subType: 'fmo' as 'fmo' | 'agency',
};

const EMPTY_LEADER_FORM = { name: '', email: '', phone: '', title: '' };

export function DistributionAdmin() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'program_managers' | 'fmos'>('program_managers');
  const [showForm, setShowForm] = useState(false);
  const [editingPartner, setEditingPartner] = useState<DistributionPartner | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  // Per-partner leaders panel
  const [expandedLeaders, setExpandedLeaders] = useState<Set<string>>(new Set());
  const [addingLeaderFor, setAddingLeaderFor] = useState<string | null>(null);
  const [leaderForm, setLeaderForm] = useState(EMPTY_LEADER_FORM);
  const [editingLeader, setEditingLeader] = useState<PartnerLeader | null>(null);

  // Invite status tracking
  const [invitingLeaderId, setInvitingLeaderId] = useState<string | null>(null);
  const [addingPartner, setAddingPartner] = useState(false);

  const allPartners = useQuery(api.admin.distributionPartners.getAllWithStats) as
    | (DistributionPartner & { completedEnrollments: number; activeMemberCount: number; repCodeCount: number; totalUsage: number })[]
    | undefined;

  const programManagers = (allPartners ?? []).filter((p) => p.type === 'program_manager');
  const fmosAndAgencies = (allPartners ?? []).filter((p) => p.type === 'fmo' || p.type === 'agency');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addPartnerAction = useAction((api as any).admin.distributionPartners.add);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addLeaderAction = useAction((api as any).admin.distributionPartners.addLeader);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sendLeaderInviteAction = useAction((api as any).admin.distributionPartners.sendLeaderInvite);
  const updatePartner = useMutation(api.admin.distributionPartners.update);
  const removePartner = useMutation(api.admin.distributionPartners.remove);
  const updateLeaderMutation = useMutation(api.admin.distributionPartners.updateLeader);
  const removeLeaderMutation = useMutation(api.admin.distributionPartners.removeLeader);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingPartner(null);
    setShowForm(false);
  };

  const resetLeaderForm = () => {
    setLeaderForm(EMPTY_LEADER_FORM);
    setEditingLeader(null);
    setAddingLeaderFor(null);
  };

  const toggleLeadersPanel = (partnerId: string) => {
    setExpandedLeaders((prev) => {
      const next = new Set(prev);
      if (next.has(partnerId)) next.delete(partnerId); else next.add(partnerId);
      return next;
    });
  };

  const handleSendLeaderInvite = async (leader: PartnerLeader) => {
    if (!confirm(`Send an invite email to ${leader.name} at ${leader.email}?`)) return;
    setInvitingLeaderId(leader._id);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await sendLeaderInviteAction({ leaderId: leader._id as any });
      if (result.success) {
        toast.success('Invite sent', `${leader.name} should receive their email shortly.`);
      } else {
        toast.error('Could not send invite', result.error ?? 'Unknown error');
      }
    } catch (err) {
      toast.fromError(err, 'Could not send invite');
    } finally {
      setInvitingLeaderId(null);
    }
  };

  const handleEditPartner = (partner: DistributionPartner) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      contactName: partner.contactName,
      contactEmail: partner.contactEmail,
      contactPhone: partner.contactPhone ?? '',
      contactTitle: '',
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
      toast.warning('Missing required fields', 'Organization Name, Contact Name, and Contact Email are required.');
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
        resetForm();
        toast.success('Partner updated', formData.name);
      } else {
        setAddingPartner(true);
        const result = await addPartnerAction({
          name: formData.name,
          type: partnerType,
          contactName: formData.contactName,
          contactEmail: formData.contactEmail,
          contactPhone: formData.contactPhone || undefined,
          contactTitle: formData.contactTitle || undefined,
          overrideRate: formData.overrideRate ? parseFloat(formData.overrideRate) : undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          parentId: formData.parentId ? (formData.parentId as any) : undefined,
          status: formData.status,
          notes: formData.notes || undefined,
        });
        resetForm();
        if (result.inviteSent) {
          toast.success('Partner added', `${formData.contactName} received an invite email.`);
        } else {
          toast.warning('Partner added — invite email failed', `${result.inviteError ?? 'Unknown error'}. You can resend from the partner card.`);
        }
      }
    } catch (err) {
      toast.fromError(err, 'Could not save partner');
    } finally {
      setAddingPartner(false);
    }
  };

  const handleDelete = async (partner: DistributionPartner) => {
    if (!confirm(`Are you sure you want to delete "${partner.name}"? This cannot be undone.`)) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await removePartner({ id: partner._id as any });
      toast.success('Partner removed', partner.name);
    } catch (err) {
      toast.fromError(err, 'Could not delete partner');
    }
  };

  const handleAddLeader = async (e: React.FormEvent, partnerId: string) => {
    e.preventDefault();
    if (!leaderForm.name || !leaderForm.email) {
      toast.warning('Missing required fields', 'Name and email are required.');
      return;
    }
    try {
      const result = await addLeaderAction({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        partnerId: partnerId as any,
        name: leaderForm.name,
        email: leaderForm.email,
        phone: leaderForm.phone || undefined,
        title: leaderForm.title || undefined,
      });
      resetLeaderForm();
      if (result.inviteSent) {
        toast.success('Leader added', `${leaderForm.name} received an invite email.`);
      } else {
        toast.warning('Leader added — invite email failed', `${result.inviteError ?? 'Unknown error'}. You can resend from the leaders panel.`);
      }
    } catch (err) {
      toast.fromError(err, 'Could not add leader');
    }
  };

  const handleUpdateLeader = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLeader) return;
    try {
      await updateLeaderMutation({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        leaderId: editingLeader._id as any,
        name: leaderForm.name || undefined,
        email: leaderForm.email || undefined,
        phone: leaderForm.phone || undefined,
        title: leaderForm.title || undefined,
      });
      resetLeaderForm();
      toast.success('Leader updated', leaderForm.name || editingLeader.name);
    } catch (err) {
      toast.fromError(err, 'Could not update leader');
    }
  };

  const handleDeleteLeader = async (leader: PartnerLeader) => {
    if (!confirm(`Remove ${leader.name} from this partner?`)) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await removeLeaderMutation({ leaderId: leader._id as any });
      toast.success('Leader removed', leader.name);
    } catch (err) {
      toast.fromError(err, 'Could not remove leader');
    }
  };

  const startEditLeader = (leader: PartnerLeader) => {
    setEditingLeader(leader);
    setLeaderForm({ name: leader.name, email: leader.email, phone: leader.phone ?? '', title: leader.title ?? '' });
    setAddingLeaderFor(leader.partnerId);
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

      {/* Add / Edit Partner Form */}
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

            {/* ── Primary Leader ── */}
            <div className={styles.sectionTitle}>
              {editingPartner ? 'Primary Contact' : 'Primary Leader'}
              {!editingPartner && (
                <span className={styles.sectionNote}> — an invite will be sent automatically</span>
              )}
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Full Name *</label>
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  placeholder="Jane Smith"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Email Address *</label>
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
                <label>Phone</label>
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
              {!editingPartner && (
                <div className={styles.formGroup}>
                  <label>Title / Role</label>
                  <input
                    type="text"
                    value={formData.contactTitle}
                    onChange={(e) => setFormData({ ...formData, contactTitle: e.target.value })}
                    placeholder="VP of Sales"
                  />
                </div>
              )}
            </div>

            {/* ── Settings ── */}
            <div className={styles.sectionTitle}>Settings</div>
            <div className={styles.formRow}>
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

            <div className={styles.formActions}>
              <button type="submit" className={styles.submitButton} disabled={addingPartner}>
                {addingPartner ? <><Loader2 size={14} className={styles.spinner} /> Adding…</> : (editingPartner ? 'Update' : `Add ${tabLabel} & Send Invite`)}
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
            <PartnerCard
              key={partner._id}
              partner={partner}
              programManagers={programManagers}
              expanded={expandedLeaders.has(partner._id)}
              onToggleLeaders={() => toggleLeadersPanel(partner._id)}
              onEdit={() => handleEditPartner(partner)}
              onDelete={() => handleDelete(partner)}
              addingLeaderFor={addingLeaderFor}
              leaderForm={leaderForm}
              editingLeader={editingLeader}
              onLeaderFormChange={setLeaderForm}
              onAddLeader={(e) => handleAddLeader(e, partner._id)}
              onUpdateLeader={handleUpdateLeader}
              onStartAddLeader={() => { setAddingLeaderFor(partner._id); setEditingLeader(null); setLeaderForm(EMPTY_LEADER_FORM); }}
              onCancelLeaderForm={resetLeaderForm}
              onSendLeaderInvite={handleSendLeaderInvite}
              onDeleteLeader={handleDeleteLeader}
              onEditLeader={startEditLeader}
              invitingLeaderId={invitingLeaderId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sub-component: PartnerCard ────────────────────────────────────────────────

interface PartnerCardProps {
  partner: DistributionPartner & { completedEnrollments: number; activeMemberCount: number; repCodeCount: number };
  programManagers: DistributionPartner[];
  expanded: boolean;
  onToggleLeaders: () => void;
  onEdit: () => void;
  onDelete: () => void;
  addingLeaderFor: string | null;
  leaderForm: typeof EMPTY_LEADER_FORM;
  editingLeader: PartnerLeader | null;
  onLeaderFormChange: (f: typeof EMPTY_LEADER_FORM) => void;
  onAddLeader: (e: React.FormEvent) => void;
  onUpdateLeader: (e: React.FormEvent) => void;
  onStartAddLeader: () => void;
  onCancelLeaderForm: () => void;
  onSendLeaderInvite: (leader: PartnerLeader) => void;
  onDeleteLeader: (leader: PartnerLeader) => void;
  onEditLeader: (leader: PartnerLeader) => void;
  invitingLeaderId: string | null;
}

function PartnerCard({
  partner, programManagers, expanded, onToggleLeaders,
  onEdit, onDelete,
  addingLeaderFor, leaderForm, editingLeader,
  onLeaderFormChange, onAddLeader, onUpdateLeader,
  onStartAddLeader, onCancelLeaderForm,
  onSendLeaderInvite, onDeleteLeader, onEditLeader,
  invitingLeaderId,
}: PartnerCardProps) {
  const leaders = useQuery(api.admin.distributionPartners.getLeadersByPartner, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    partnerId: partner._id as any,
  }) as PartnerLeader[] | undefined;

  const isAddingForThis = addingLeaderFor === partner._id;
  const isEditingForThis = editingLeader?.partnerId === partner._id;
  const showForm = isAddingForThis || isEditingForThis;

  return (
    <div className={styles.partnerCard}>
      <div className={styles.partnerHeader}>
        <div>
          <div className={styles.partnerTypeBadge} data-type={partner.type}>
            {TYPE_LABELS[partner.type].badge}
          </div>
          <h3>{partner.name}</h3>
        </div>
        <div className={styles.partnerActions}>
          <button onClick={onEdit} className={styles.editButton} title="Edit">
            <Pencil size={15} />
          </button>
          <button onClick={onDelete} className={styles.deleteButton} title="Delete">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className={styles.partnerInfo}>
        {partner.overrideRate !== undefined && (
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Override Rate:</span>
            <strong>{partner.overrideRate}%</strong>
          </div>
        )}
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Enrollments:</span>
          <strong>{partner.completedEnrollments ?? 0}</strong>
          <span className={styles.infoLabel} style={{ marginLeft: 8 }}>Members:</span>
          <strong>{partner.activeMemberCount ?? 0}</strong>
        </div>
      </div>

      {/* Leaders panel toggle */}
      <button className={styles.leadersToggle} onClick={onToggleLeaders}>
        <Users size={14} />
        <span>
          {leaders === undefined ? 'Leaders' : `${leaders.length} Leader${leaders.length !== 1 ? 's' : ''}`}
        </span>
        <span className={`${styles.leadersChevron} ${expanded ? styles.leadersChevronOpen : ''}`}>›</span>
      </button>

      {/* Leaders list */}
      {expanded && (
        <div className={styles.leadersPanel}>
          {leaders === undefined ? (
            <div className={styles.leadersLoading}><Loader2 size={14} className={styles.spinner} /></div>
          ) : leaders.length === 0 ? (
            <p className={styles.leadersEmpty}>No leaders yet.</p>
          ) : (
            <ul className={styles.leadersList}>
              {leaders.map((leader) => (
                <li key={leader._id} className={styles.leaderRow}>
                  <div className={styles.leaderInfo}>
                    <span className={styles.leaderName}>
                      {leader.name}
                      {leader.isPrimary && <span className={styles.primaryBadge}>Primary</span>}
                    </span>
                    {leader.title && <span className={styles.leaderTitle}>{leader.title}</span>}
                    <a href={`mailto:${leader.email}`} className={styles.leaderEmail}>
                      <Mail size={11} />{leader.email}
                    </a>
                    {leader.phone && (
                      <a href={`tel:${leader.phone}`} className={styles.leaderPhone}>
                        <Phone size={11} />{leader.phone}
                      </a>
                    )}
                  </div>
                  <div className={styles.leaderStatus}>
                    {leader.inviteStatus === 'claimed' || leader.clerkUserId ? (
                      <span className={styles.statusClaimed}><CheckCircle2 size={12} />Active</span>
                    ) : leader.inviteStatus === 'pending' ? (
                      <span className={styles.statusPending}><Clock size={12} />Pending</span>
                    ) : (
                      <span className={styles.statusNone}><Send size={12} />No invite</span>
                    )}
                  </div>
                  <div className={styles.leaderActions}>
                    {leader.inviteStatus !== 'claimed' && !leader.clerkUserId && (
                      <button
                        className={styles.iconBtn}
                        title={leader.inviteStatus === 'pending' ? 'Resend invite' : 'Send invite'}
                        onClick={() => onSendLeaderInvite(leader)}
                        disabled={invitingLeaderId === leader._id}
                      >
                        {invitingLeaderId === leader._id
                          ? <Loader2 size={13} className={styles.spinner} />
                          : <Send size={13} />}
                      </button>
                    )}
                    <button className={styles.iconBtn} title="Edit leader" onClick={() => onEditLeader(leader)}>
                      <Pencil size={13} />
                    </button>
                    <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} title="Remove leader" onClick={() => onDeleteLeader(leader)}>
                      <X size={13} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Add / Edit leader form */}
          {showForm ? (
            <form
              className={styles.leaderForm}
              onSubmit={isEditingForThis ? onUpdateLeader : onAddLeader}
            >
              <div className={styles.leaderFormTitle}>
                {isEditingForThis ? 'Edit Leader' : 'Add New Leader'}
              </div>
              <div className={styles.leaderFormRow}>
                <input
                  type="text"
                  placeholder="Full Name *"
                  value={leaderForm.name}
                  onChange={(e) => onLeaderFormChange({ ...leaderForm, name: e.target.value })}
                  required
                />
                <input
                  type="email"
                  placeholder="Email *"
                  value={leaderForm.email}
                  onChange={(e) => onLeaderFormChange({ ...leaderForm, email: e.target.value })}
                  required
                />
              </div>
              <div className={styles.leaderFormRow}>
                <input
                  type="tel"
                  placeholder="Phone"
                  value={leaderForm.phone}
                  onChange={(e) => onLeaderFormChange({ ...leaderForm, phone: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Title / Role"
                  value={leaderForm.title}
                  onChange={(e) => onLeaderFormChange({ ...leaderForm, title: e.target.value })}
                />
              </div>
              <div className={styles.leaderFormActions}>
                <button type="submit" className={styles.leaderFormSubmit}>
                  {isEditingForThis ? 'Save Changes' : <><UserPlus size={13} /> Add & Send Invite</>}
                </button>
                <button type="button" className={styles.leaderFormCancel} onClick={onCancelLeaderForm}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button className={styles.addLeaderBtn} onClick={onStartAddLeader}>
              <UserPlus size={14} />
              Add Leader
            </button>
          )}
        </div>
      )}

      <div className={styles.partnerFooter}>
        <span className={`${styles.statusBadge} ${styles[`status_${partner.status}` as keyof typeof styles]}`}>
          {partner.status}
        </span>
        {partner.parentId && (
          <span className={styles.parentLabel}>
            ↳ {programManagers.find((pm) => pm._id === partner.parentId)?.name ?? 'Parent PM'}
          </span>
        )}
      </div>
    </div>
  );
}

