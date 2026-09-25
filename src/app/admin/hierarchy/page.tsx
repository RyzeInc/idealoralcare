'use client';

import { useState, Fragment } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useConvex } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Plus, Edit, Trash2, X, Info, Users, ChevronDown, ChevronRight, Palette, Settings, Plug, Building2, Upload } from 'lucide-react';
import { useToast, Breadcrumbs, RequiredMark, Tooltip } from '@/components/admin/ui';
import { useEffect, useRef } from 'react';
import { PROVIDER_GROUP_CODE } from '@/lib/constants';
import {
  PROMO_PLACEMENTS,
  PROMO_PLACEMENT_LABELS,
  type PromoPlacement,
} from '@/convex/lib/promoLinks';

type TabType = 'sites' | 'accounts' | 'groups';

/** Editor row for a site promo link. Empty strings stand in for unset optionals. */
type PromoLinkForm = {
  text: string;
  ctaText: string;
  url: string;
  disclosure: string;
  placements: PromoPlacement[];
  enabled: boolean;
};

export default function HierarchyAdmin() {
  const [activeTab, setActiveTab] = useState<TabType>('sites');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const sites = useQuery(api.admin.hierarchy.getSites) || [];
  const accounts = useQuery(api.admin.hierarchy.getAllAccounts) || [];
  const groups = useQuery(api.admin.hierarchy.getAllGroups) || [];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Sites, Accounts & Organizations' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Sites, Accounts &amp; Organizations</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          <Plus size={18} />
          Create {activeTab === 'sites' ? 'Site (Carrier)' : activeTab === 'accounts' ? 'Account' : 'Organization'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200">
        {(['sites', 'accounts', 'groups'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setShowCreateModal(false); }}
            className={`px-4 py-2 border-b-2 font-semibold transition-colors ${
              activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {(tab === 'sites' ? 'Sites (Carrier)' : tab === 'accounts' ? 'Accounts' : 'Organizations')}
            {' '}({tab === 'sites' ? sites.length : tab === 'accounts' ? accounts.length : groups.length})
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow">
        {activeTab === 'sites' && <SitesList sites={sites} />}
        {activeTab === 'accounts' && <AccountsList accounts={accounts} sites={sites} />}
        {activeTab === 'groups' && <GroupsList groups={groups} accounts={accounts} sites={sites} />}
      </div>

      {/* Create Modals */}
      {showCreateModal && activeTab === 'sites' && (
        <CreateSiteModal onClose={() => setShowCreateModal(false)} />
      )}
      {showCreateModal && activeTab === 'accounts' && (
        <CreateAccountModal sites={sites} onClose={() => setShowCreateModal(false)} />
      )}
      {showCreateModal && activeTab === 'groups' && (
        <CreateGroupModal sites={sites} accounts={accounts} onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

function SitesList({ sites }: { sites: any[] }) {
  const updateSite = useMutation(api.admin.hierarchy.updateSite);
  const removeSite = useMutation(api.admin.hierarchy.removeSite);
  const [editingSite, setEditingSite] = useState<any | null>(null);

  const handleToggleStatus = async (site: any) => {
    const newStatus = site.status === 'active' ? 'suspended' : 'active';
    await updateSite({ siteId: site._id, status: newStatus });
  };

  const handleDelete = async (site: any) => {
    if (!confirm(`Delete site "${site.name}"? This cannot be undone.`)) return;
    await removeSite({ siteId: site._id });
  };

  return (
    <>
      <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Name</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Slug</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Type</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Domain</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {sites.length === 0 ? (
            <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No sites found</td></tr>
          ) : (
            sites.map((site) => (
              <tr key={site._id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-900">{site.name}</td>
                <td className="px-6 py-4 text-slate-600 font-mono text-sm">{site.slug}</td>
                <td className="px-6 py-4 text-slate-600">{site.type}</td>
                <td className="px-6 py-4 text-slate-600">{site.domain || '—'}</td>
                <td className="px-6 py-4">
                  <button onClick={() => handleToggleStatus(site)} className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${site.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {site.status}
                  </button>
                </td>
                <td className="px-6 py-4 text-right flex gap-1 justify-end">
                  <button onClick={() => setEditingSite(site)} className="p-1 hover:bg-slate-200 rounded"><Edit size={16} /></button>
                  <button onClick={() => handleDelete(site)} className="p-1 hover:bg-red-100 rounded text-red-600"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
      {editingSite && <EditSiteModal site={editingSite} onClose={() => setEditingSite(null)} />}
    </>
  );
}

function AccountsList({ accounts, sites }: { accounts: any[]; sites: any[] }) {
  const removeAccount = useMutation(api.admin.hierarchy.removeAccount);
  const siteMap = Object.fromEntries(sites.map(s => [s._id, s.name]));
  const [editingAccount, setEditingAccount] = useState<any | null>(null);
  const [search, setSearch] = useState('');

  const filtered = accounts.filter((a: any) =>
    !search || (a.slug || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="px-4 py-3 border-b border-slate-200">
        <input
          type="text"
          placeholder="Search brokers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Name / Slug</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Carrier</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Type</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Billing</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {filtered.length === 0 ? (
            <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No brokers yet. Create one to get started.</td></tr>
          ) : (
            filtered.map((acct: any) => (
              <tr key={acct._id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">{acct.name || acct.slug}</div>
                  {acct.name && <div className="text-xs font-mono text-slate-400">{acct.slug}</div>}
                </td>
                <td className="px-6 py-4 text-slate-600">{siteMap[acct.siteId] || '—'}</td>
                <td className="px-6 py-4 text-slate-600">{acct.accountType}</td>
                <td className="px-6 py-4 text-slate-600">{acct.billingModel}</td>
                <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold ${acct.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{acct.status}</span></td>
                <td className="px-6 py-4 text-right">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => setEditingAccount(acct)} className="p-1 hover:bg-slate-200 rounded" title="Edit"><Edit size={16} /></button>
                    <button onClick={() => { if (confirm(`Delete broker "${acct.slug}"?`)) removeAccount({ accountId: acct._id }); }} className="p-1 hover:bg-red-100 rounded text-red-600"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
      {editingAccount && <EditAccountModal account={editingAccount} onClose={() => setEditingAccount(null)} />}
    </>
  );
}

function GroupsList({ groups, accounts, sites }: { groups: any[]; accounts: any[]; sites: any[] }) {
  const removeGroup = useMutation(api.admin.hierarchy.removeGroup);
  const acctMap = Object.fromEntries(accounts.map(a => [a._id, a.slug]));
  const memberCounts = useQuery(api.admin.members.getMemberCountsByGroup, {}) || {};
  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [expandedMembersId, setExpandedMembersId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = groups.filter((g: any) =>
    !search || (g.name || g.slug || '').toLowerCase().includes(search.toLowerCase()) ||
    (g.groupCode || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="px-4 py-3 border-b border-slate-200">
        <input
          type="text"
          placeholder="Search organizations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Name</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Org Code (Subscriber ID)</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Provider Group Code</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Account</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Members</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {filtered.length === 0 ? (
            <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">No organizations yet. Create one to start enrolling members.</td></tr>
          ) : (
            filtered.map((grp: any) => {
              const counts = (memberCounts as any)[grp._id] || { total: 0, active: 0 };
              const isExpanded = expandedMembersId === grp._id;
              return (
                <Fragment key={grp._id}>
                  <tr className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{grp.name || grp.slug}</td>
                    <td className="px-6 py-4 font-mono text-sm">{grp.organizationCode || <span className="text-slate-400">—</span>}</td>
                    <td className="px-6 py-4 font-mono text-sm">{grp.groupCode}</td>
                    <td className="px-6 py-4 text-slate-600">{acctMap[grp.accountId] || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <button
                        type="button"
                        onClick={() => setExpandedMembersId(isExpanded ? null : grp._id)}
                        className="inline-flex items-center gap-1.5 hover:underline text-left"
                        title="Inspect member breakdown"
                      >
                        {isExpanded ? <ChevronDown size={13} className="text-slate-400" /> : <ChevronRight size={13} className="text-slate-400" />}
                        <Users size={13} className="text-slate-400" />
                        <span className="font-medium text-slate-900">{counts.total}</span> · <span className="text-green-700">{counts.active} active</span>
                      </button>
                    </td>
                    <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold ${grp.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{grp.status}</span></td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setEditingGroup(grp)} className="p-1 hover:bg-slate-200 rounded" title="Edit"><Edit size={16} /></button>
                        <button onClick={() => { if (confirm(`Delete organization "${grp.name || grp.groupCode}"?`)) removeGroup({ groupId: grp._id }); }} className="p-1 hover:bg-red-100 rounded text-red-600"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-slate-50/70">
                      <td colSpan={7} className="px-6 py-4 border-b border-slate-200">
                        <MemberBreakdownPanel groupId={grp._id} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
      </div>
      {editingGroup && <EditGroupModal group={editingGroup} accounts={accounts} onClose={() => setEditingGroup(null)} />}
    </>
  );
}

/* ─── Create / Edit modals ─── */

function CreateSiteModal({ onClose }: { onClose: () => void }) {
  const createSite = useMutation(api.admin.hierarchy.createSite);
  const toast = useToast();
  const [form, setForm] = useState({ slug: '', name: '', type: 'primary' as const, domain: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.slug || !form.name) return;
    setSaving(true);
    try {
      await createSite({
        slug: form.slug,
        name: form.name,
        type: form.type,
        domain: form.domain || undefined,
      });
      onClose();
    } catch (err) {
      toast.fromError(err, 'Could not create site');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper title="Create Site" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <Field label="Name" value={form.name} onChange={v => setForm({ ...form, name: v })} required />
        <Field label="Slug" value={form.slug} onChange={v => setForm({ ...form, slug: v })} required placeholder="e.g. ideal-oral-health" />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
            <option value="primary">Primary</option>
            <option value="whitelabel">White-label</option>
            <option value="channel">Channel</option>
          </select>
        </div>
        <Field label="Domain (optional)" value={form.domain} onChange={v => setForm({ ...form, domain: v })} placeholder="e.g. acme-dental.com" />
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Create</button>
        </div>
      </form>
    </ModalWrapper>
  );
}

async function resizeImageBlob(file: File | Blob, maxW: number, maxH: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > maxW || height > maxH) {
        const r = Math.min(maxW / width, maxH / height);
        width = Math.round(width * r);
        height = Math.round(height * r);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(objUrl);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png', 0.92);
    };
    img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error('Failed to load image')); };
    img.src = objUrl;
  });
}

function EditSiteModal({ site, onClose }: { site: any; onClose: () => void }) {
  const updateSite = useMutation(api.admin.hierarchy.updateSite);
  const upsertIntegrations = useMutation(api.admin.integrations.upsertSiteIntegrations);
  const generateUploadUrl = useMutation(api.admin.fileStorage.generateUploadUrl);
  const existingIntg = useQuery(api.admin.integrations.getSiteIntegrations, { siteId: site._id });
  const convex = useConvex();
  const toast = useToast();
  const [uploading, setUploading] = useState({ logo: false, favicon: false });

  type WizardTab = 'identity' | 'branding' | 'enrollment' | 'integrations';
  const [activeTab, setActiveTab] = useState<WizardTab>('identity');
  const [saving, setSaving] = useState(false);

  const [identity, setIdentity] = useState({
    name: site.name || '',
    domain: site.domain || '',
    type: site.type || 'whitelabel',
    status: site.status || 'onboarding',
  });

  const [branding, setBranding] = useState({
    logoUrl: site.branding?.logoUrl || '',
    logoWidth: site.branding?.logoWidth || 260,
    faviconUrl: site.branding?.faviconUrl || '',
    primaryColor: site.branding?.primaryColor || '#1e3a5f',
    secondaryColor: site.branding?.secondaryColor || '#14b8a6',
    accentColor: site.branding?.accentColor || '#0ea5e9',
    heroHeadline: site.branding?.heroHeadline || '',
    heroSubtext: site.branding?.heroSubtext || '',
    footerText: site.branding?.footerText || '',
    customCSS: site.branding?.customCSS || '',
  });

  // Third-party offers rendered on this brand's public pages. Stored on the
  // site so one partner's vendor link never reaches another brand — the shared
  // page components carry no links of their own.
  const [promoLinks, setPromoLinks] = useState<PromoLinkForm[]>(
    (site.promoLinks ?? []).map((p: Partial<PromoLinkForm>) => ({
      text: p.text || '',
      ctaText: p.ctaText || '',
      url: p.url || '',
      disclosure: p.disclosure || '',
      placements: p.placements ?? [],
      enabled: p.enabled ?? true,
    }))
  );

  const patchPromo = (i: number, patch: Partial<PromoLinkForm>) =>
    setPromoLinks(list => list.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const togglePromoPlacement = (i: number, placement: PromoPlacement) =>
    setPromoLinks(list => list.map((p, idx) => idx !== i ? p : {
      ...p,
      placements: p.placements.includes(placement)
        ? p.placements.filter(x => x !== placement)
        : [...p.placements, placement],
    }));

  const [enrollment, setEnrollment] = useState({
    supportEmail: site.enrollmentDefaults?.supportEmail || '',
    supportPhone: site.enrollmentDefaults?.supportPhone || '',
    welcomeMessage: site.enrollmentDefaults?.welcomeMessage || '',
    requireGroupCode: site.enrollmentDefaults?.requireGroupCode ?? false,
    allowSelfEnrollment: site.enrollmentDefaults?.allowSelfEnrollment ?? true,
    requirePayment: site.enrollmentDefaults?.requirePayment ?? true,
    autoActivate: site.enrollmentDefaults?.autoActivate ?? false,
    collectDependents: site.enrollmentDefaults?.collectDependents ?? true,
    termsDocumentUrl: site.enrollmentDefaults?.termsDocumentUrl || '',
    privacyPolicyUrl: site.enrollmentDefaults?.privacyPolicyUrl || '',
  });

  const [intg, setIntg] = useState({
    toothlensCompany: '',
    toothlensAccessKey: '',
    emailFromName: '',
    emailFromAddress: '',
    emailReplyTo: '',
    careingtonGroupCode: '',
    dialcareGroupCode: '',
    legalEntityName: '',
    legalAddress: '',
    carrierName: '',
  });

  useEffect(() => {
    if (existingIntg) {
      setIntg({
        toothlensCompany: existingIntg.toothlensCompany || '',
        toothlensAccessKey: existingIntg.toothlensAccessKey || '',
        emailFromName: existingIntg.emailFromName || '',
        emailFromAddress: existingIntg.emailFromAddress || '',
        emailReplyTo: existingIntg.emailReplyTo || '',
        careingtonGroupCode: existingIntg.careingtonGroupCode || '',
        dialcareGroupCode: existingIntg.dialcareGroupCode || '',
        legalEntityName: existingIntg.legalEntityName || '',
        legalAddress: existingIntg.legalAddress || '',
        carrierName: existingIntg.carrierName || '',
      });
    }
  }, [existingIntg]);

  const uploadRaw = async (file: File | Blob): Promise<string> => {
    const uploadUrl = await generateUploadUrl();
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'image/png' },
      body: file,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
    const { storageId } = await res.json();
    const url = await convex.query(api.admin.fileStorage.getFileUrl, { storageId });
    if (!url) throw new Error('Could not resolve storage URL');
    return url;
  };

  const uploadImage = async (file: File | Blob, maxW: number, maxH: number): Promise<string> => {
    const blob = await resizeImageBlob(file, maxW, maxH);
    const uploadUrl = await generateUploadUrl();
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: blob,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
    const { storageId } = await res.json();
    const url = await convex.query(api.admin.fileStorage.getFileUrl, { storageId });
    if (!url) throw new Error('Could not resolve storage URL');
    return url;
  };

  const handleLogoUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(s => ({ ...s, logo: true }));
    try {
      const logoUrl = await uploadRaw(file);
      setBranding(s => ({ ...s, logoUrl }));
      // Auto-generate favicon from the same file if none exists
      if (!branding.faviconUrl) {
        setUploading(s => ({ ...s, favicon: true }));
        try {
          const faviconUrl = await uploadImage(file, 64, 64);
          setBranding(s => ({ ...s, faviconUrl }));
        } finally {
          setUploading(s => ({ ...s, favicon: false }));
        }
      }
    } catch (err) {
      toast.fromError(err, 'Logo upload failed');
    } finally {
      setUploading(s => ({ ...s, logo: false }));
    }
  };

  const handleFaviconUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(s => ({ ...s, favicon: true }));
    try {
      const faviconUrl = await uploadImage(file, 64, 64);
      setBranding(s => ({ ...s, faviconUrl }));
    } catch (err) {
      toast.fromError(err, 'Favicon upload failed');
    } finally {
      setUploading(s => ({ ...s, favicon: false }));
    }
  };

  const handleAutoFavicon = async () => {
    if (!branding.logoUrl) return;
    setUploading(s => ({ ...s, favicon: true }));
    try {
      const res = await fetch(branding.logoUrl);
      const blob = await res.blob();
      const faviconUrl = await uploadImage(blob, 64, 64);
      setBranding(s => ({ ...s, faviconUrl }));
    } catch (err) {
      toast.fromError(err, 'Could not generate favicon from logo');
    } finally {
      setUploading(s => ({ ...s, favicon: false }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSite({
        siteId: site._id,
        name: identity.name,
        domain: identity.domain || undefined,
        type: identity.type,
        status: identity.status,
        branding: {
          logoUrl: branding.logoUrl || undefined,
          logoWidth: branding.logoWidth || undefined,
          faviconUrl: branding.faviconUrl || undefined,
          primaryColor: branding.primaryColor || undefined,
          secondaryColor: branding.secondaryColor || undefined,
          accentColor: branding.accentColor || undefined,
          heroHeadline: branding.heroHeadline || undefined,
          heroSubtext: branding.heroSubtext || undefined,
          footerText: branding.footerText || undefined,
          customCSS: branding.customCSS || undefined,
        },
        // Blank rows are how an admin clears a promo, so drop them rather than
        // persisting a link with no text or destination.
        promoLinks: promoLinks
          .filter(p => p.text.trim() && p.ctaText.trim() && p.url.trim())
          .map(p => ({
            text: p.text.trim(),
            ctaText: p.ctaText.trim(),
            url: p.url.trim(),
            disclosure: p.disclosure.trim() || undefined,
            placements: p.placements,
            enabled: p.enabled,
          })),
        enrollmentDefaults: {
          supportEmail: enrollment.supportEmail || undefined,
          supportPhone: enrollment.supportPhone || undefined,
          welcomeMessage: enrollment.welcomeMessage || undefined,
          requireGroupCode: enrollment.requireGroupCode,
          allowSelfEnrollment: enrollment.allowSelfEnrollment,
          requirePayment: enrollment.requirePayment,
          autoActivate: enrollment.autoActivate,
          collectDependents: enrollment.collectDependents,
          requireEligibilityMatch: site.enrollmentDefaults?.requireEligibilityMatch ?? false,
          collectAddress: site.enrollmentDefaults?.collectAddress ?? true,
          collectPhone: site.enrollmentDefaults?.collectPhone ?? true,
          collectEmployeeId: site.enrollmentDefaults?.collectEmployeeId ?? false,
          termsDocumentUrl: enrollment.termsDocumentUrl || undefined,
          privacyPolicyUrl: enrollment.privacyPolicyUrl || undefined,
        },
      });
      await upsertIntegrations({
        siteId: site._id,
        toothlensCompany: intg.toothlensCompany || undefined,
        toothlensAccessKey: intg.toothlensAccessKey || undefined,
        emailFromName: intg.emailFromName || undefined,
        emailFromAddress: intg.emailFromAddress || undefined,
        emailReplyTo: intg.emailReplyTo || undefined,
        careingtonGroupCode: intg.careingtonGroupCode || undefined,
        dialcareGroupCode: intg.dialcareGroupCode || undefined,
        legalEntityName: intg.legalEntityName || undefined,
        legalAddress: intg.legalAddress || undefined,
        carrierName: intg.carrierName || undefined,
      });
      onClose();
    } catch (err) {
      toast.fromError(err, 'Could not save brand configuration');
    } finally {
      setSaving(false);
    }
  };

  const TABS: { id: WizardTab; label: string; Icon: React.ElementType }[] = [
    { id: 'identity', label: 'Identity', Icon: Building2 },
    { id: 'branding', label: 'Branding', Icon: Palette },
    { id: 'enrollment', label: 'Enrollment', Icon: Settings },
    { id: 'integrations', label: 'Integrations', Icon: Plug },
  ];

  return (
    <ModalWrapper title={`Brand Config: ${site.name}`} onClose={onClose} wide="2xl">
      <div className="flex gap-1 border-b border-slate-200 -mx-6 px-6 mb-5">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {activeTab === 'identity' && (
          <>
            <Field label="Brand Name" value={identity.name} onChange={v => setIdentity(s => ({ ...s, name: v }))} required />
            <div>
              <LabelRow label="Type" />
              <select value={identity.type} onChange={e => setIdentity(s => ({ ...s, type: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="primary">Primary (your main brand)</option>
                <option value="whitelabel">White-label (partner brand)</option>
                <option value="channel">Channel (distribution partner)</option>
              </select>
            </div>
            <Field label="Custom Domain" value={identity.domain} onChange={v => setIdentity(s => ({ ...s, domain: v }))} placeholder="e.g. acme-dental.com" tooltip="Leave blank to use path-based routing (/{slug}/...)." />
            <div>
              <LabelRow label="Status" />
              <select value={identity.status} onChange={e => setIdentity(s => ({ ...s, status: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="onboarding">Onboarding</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
          </>
        )}

        {activeTab === 'branding' && (
          <>
            {/* Logo upload */}
            <div>
              <LabelRow label="Logo" tooltip="PNG or SVG. Resized to max 400×150. A 64×64 favicon is auto-generated from this if none is set." />
              <div className="flex items-center gap-3 mt-1">
                {branding.logoUrl && (
                  <img src={branding.logoUrl} alt="Logo preview" className="h-10 max-w-[120px] object-contain border rounded p-1 bg-white" />
                )}
                <label className={`flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm cursor-pointer hover:bg-slate-50 ${uploading.logo ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Upload size={14} />
                  {uploading.logo ? 'Uploading…' : branding.logoUrl ? 'Replace' : 'Upload Logo'}
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleLogoUpload(e.target.files?.[0])} />
                </label>
                {branding.logoUrl && (
                  <button type="button" onClick={() => setBranding(s => ({ ...s, logoUrl: '' }))} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                )}
              </div>
              {branding.logoUrl && (
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-slate-500 w-24 shrink-0">Width: {branding.logoWidth}px</span>
                  <input
                    type="range"
                    min={40}
                    max={400}
                    step={5}
                    value={branding.logoWidth}
                    onChange={e => setBranding(s => ({ ...s, logoWidth: Number(e.target.value) }))}
                    className="flex-1"
                  />
                  <div
                    className="border rounded p-1 bg-white shrink-0 overflow-hidden flex items-center justify-center"
                    style={{ width: 128, height: 48 }}
                  >
                    <img
                      src={branding.logoUrl}
                      alt="Logo preview"
                      style={{
                        width: branding.logoWidth,
                        height: 'auto',
                        zoom: Math.min(1, 128 / branding.logoWidth),
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Favicon upload */}
            <div>
              <LabelRow label="Favicon" tooltip="Resized to 64×64. Auto-generated from your logo if left blank." />
              <div className="flex items-center gap-3 mt-1">
                {branding.faviconUrl && (
                  <img src={branding.faviconUrl} alt="Favicon preview" className="h-8 w-8 object-contain border rounded p-0.5 bg-white" />
                )}
                <label className={`flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm cursor-pointer hover:bg-slate-50 ${uploading.favicon ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Upload size={14} />
                  {uploading.favicon ? 'Uploading…' : branding.faviconUrl ? 'Replace' : 'Upload Favicon'}
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleFaviconUpload(e.target.files?.[0])} />
                </label>
                {branding.faviconUrl && (
                  <button type="button" onClick={() => setBranding(s => ({ ...s, faviconUrl: '' }))} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                )}
                {branding.logoUrl && !branding.faviconUrl && !uploading.favicon && (
                  <button type="button" onClick={handleAutoFavicon} className="text-xs text-blue-600 hover:text-blue-800 underline">
                    Auto-generate from logo
                  </button>
                )}
              </div>
            </div>
            <div>
              <LabelRow label="Brand Colors" />
              <div className="grid grid-cols-3 gap-2 mt-1">
                {([
                  ['Primary', 'primaryColor', 'Buttons & CTAs'] as const,
                  ['Secondary', 'secondaryColor', 'Accents'] as const,
                  ['Accent', 'accentColor', 'Highlights'] as const,
                ]).map(([label, key, tip]) => (
                  <div key={key}>
                    <p className="text-xs text-slate-500 mb-1">{label} <span className="text-slate-400">— {tip}</span></p>
                    <div className="flex gap-1">
                      <input type="color" value={branding[key]} onChange={e => setBranding(s => ({ ...s, [key]: e.target.value }))} className="h-9 w-10 rounded border border-slate-300 cursor-pointer p-0.5" />
                      <input type="text" value={branding[key]} onChange={e => setBranding(s => ({ ...s, [key]: e.target.value }))} className="flex-1 px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono" placeholder="#000000" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Field label="Hero Headline" value={branding.heroHeadline} onChange={v => setBranding(s => ({ ...s, heroHeadline: v }))} placeholder="e.g. Oral Health Savings Made Simple" tooltip="Main heading on the brand's landing page." />
            <Field label="Hero Subtext" value={branding.heroSubtext} onChange={v => setBranding(s => ({ ...s, heroSubtext: v }))} placeholder="e.g. AI scanning, teledentistry, and dental discounts." />
            <Field label="Footer Address / Text" value={branding.footerText} onChange={v => setBranding(s => ({ ...s, footerText: v }))} placeholder="e.g. 123 Main St, City, ST 00000" tooltip="Replaces the default office address in the footer." />
            <div>
              <LabelRow label="Custom CSS" tooltip="Advanced. Injected on all brand pages." />
              <textarea value={branding.customCSS} onChange={e => setBranding(s => ({ ...s, customCSS: e.target.value }))} rows={3} placeholder=":root { --brand-primary: #007bff; }" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
            </div>

            <div className="pt-2 border-t border-slate-200">
              <LabelRow label="Promo Links" tooltip="Third-party offers shown on this brand's public pages. Only this brand sees them." />
              <p className="text-xs text-slate-500 mb-2">
                A sentence with one linked phrase — e.g. &ldquo;Interested in Exploring Vision?&rdquo; + &ldquo;Click Here!&rdquo;. Opens in a new tab.
              </p>

              {promoLinks.length === 0 ? (
                <p className="text-xs text-slate-400 mb-2">No promo links on this brand.</p>
              ) : (
                <div className="space-y-3 mb-2">
                  {promoLinks.map((promo, i) => (
                    <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={promo.enabled}
                            onChange={() => patchPromo(i, { enabled: !promo.enabled })}
                          />
                          Enabled
                        </label>
                        <button
                          type="button"
                          onClick={() => setPromoLinks(list => list.filter((_, idx) => idx !== i))}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={promo.text}
                          onChange={e => patchPromo(i, { text: e.target.value })}
                          placeholder="Interested in Exploring Vision?"
                          className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm"
                        />
                        <input
                          type="text"
                          value={promo.ctaText}
                          onChange={e => patchPromo(i, { ctaText: e.target.value })}
                          placeholder="Click Here!"
                          className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>

                      <input
                        type="url"
                        value={promo.url}
                        onChange={e => patchPromo(i, { url: e.target.value })}
                        placeholder="https://www.example.com/partner/welcome"
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm font-mono"
                      />

                      <input
                        type="text"
                        value={promo.disclosure}
                        onChange={e => patchPromo(i, { disclosure: e.target.value })}
                        placeholder="Optional fine print — e.g. offered by a third party, not part of your plan"
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />

                      <div className="flex flex-wrap gap-3">
                        {PROMO_PLACEMENTS.map(placement => (
                          <label key={placement} className="flex items-center gap-1.5 text-xs text-slate-600">
                            <input
                              type="checkbox"
                              checked={promo.placements.includes(placement)}
                              onChange={() => togglePromoPlacement(i, placement)}
                            />
                            {PROMO_PLACEMENT_LABELS[placement]}
                          </label>
                        ))}
                      </div>

                      {promo.placements.length === 0 && (
                        <p className="text-xs text-amber-600">Pick at least one page, or this won&apos;t appear anywhere.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setPromoLinks(list => [...list, {
                  text: '', ctaText: '', url: '', disclosure: '',
                  placements: [...PROMO_PLACEMENTS], enabled: true,
                }])}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + Add promo link
              </button>
            </div>
          </>
        )}

        {activeTab === 'enrollment' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Support Email" value={enrollment.supportEmail} onChange={v => setEnrollment(s => ({ ...s, supportEmail: v }))} placeholder="support@yourbrand.com" />
              <Field label="Support Phone" value={enrollment.supportPhone} onChange={v => setEnrollment(s => ({ ...s, supportPhone: v }))} placeholder="(800) 000-0000" />
            </div>
            <div>
              <LabelRow label="Welcome Message" tooltip="Shown to members at the top of the enrollment flow." />
              <textarea value={enrollment.welcomeMessage} onChange={e => setEnrollment(s => ({ ...s, welcomeMessage: e.target.value }))} rows={2} placeholder="Shown at the start of enrollment…" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <Field label="Terms of Service URL" value={enrollment.termsDocumentUrl} onChange={v => setEnrollment(s => ({ ...s, termsDocumentUrl: v }))} placeholder="https://..." tooltip="Leave blank to use the platform default terms." />
            <Field label="Privacy Policy URL" value={enrollment.privacyPolicyUrl} onChange={v => setEnrollment(s => ({ ...s, privacyPolicyUrl: v }))} placeholder="https://..." />
            <div className="border-t border-slate-200 pt-3 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Enrollment Rules</p>
              {([
                ['requireGroupCode', 'Require group code to enroll'] as const,
                ['allowSelfEnrollment', 'Allow self-enrollment (direct-to-consumer)'] as const,
                ['requirePayment', 'Require payment at checkout'] as const,
                ['autoActivate', 'Auto-activate membership on enrollment'] as const,
                ['collectDependents', 'Collect dependent information'] as const,
              ]).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={enrollment[key]} onChange={e => setEnrollment(s => ({ ...s, [key]: e.target.checked }))} className="rounded" />
                  <span className="text-sm text-slate-700">{label}</span>
                </label>
              ))}
            </div>
          </>
        )}

        {activeTab === 'integrations' && (
          <>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pb-1">Toothlens (AI Oral Scanning)</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Company Slug" value={intg.toothlensCompany} onChange={v => setIntg(s => ({ ...s, toothlensCompany: v }))} placeholder="e.g. idealhealth" tooltip="Lowercase slug registered with Toothlens for this brand." />
              <Field label="Access Key" value={intg.toothlensAccessKey} onChange={v => setIntg(s => ({ ...s, toothlensAccessKey: v }))} placeholder="API key from Toothlens" />
            </div>
            <div className="border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2">Email Sender</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="From Name" value={intg.emailFromName} onChange={v => setIntg(s => ({ ...s, emailFromName: v }))} placeholder="e.g. Acme Dental Benefits" />
                <Field label="From Address" value={intg.emailFromAddress} onChange={v => setIntg(s => ({ ...s, emailFromAddress: v }))} placeholder="noreply@yourbrand.com" tooltip="Must be a verified Resend sender domain." />
              </div>
              <div className="mt-3">
                <Field label="Reply-To Address" value={intg.emailReplyTo} onChange={v => setIntg(s => ({ ...s, emailReplyTo: v }))} placeholder="support@yourbrand.com" />
              </div>
            </div>
            <div className="border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2">Vendor Groups</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Careington Group Code" value={intg.careingtonGroupCode} onChange={v => setIntg(s => ({ ...s, careingtonGroupCode: v }))} placeholder="e.g. RYZEDO" tooltip="Leave blank to use the platform-wide default." />
                <Field label="DialCare Group Code" value={intg.dialcareGroupCode} onChange={v => setIntg(s => ({ ...s, dialcareGroupCode: v }))} placeholder="e.g. RYZEDO" />
              </div>
            </div>
            <div className="border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2">Legal Entity</p>
              <Field label="Legal Entity Name" value={intg.legalEntityName} onChange={v => setIntg(s => ({ ...s, legalEntityName: v }))} placeholder="e.g. Acme Benefits LLC" tooltip="Used in membership agreements and legal disclosures." />
              <div className="mt-3">
                <Field label="Legal Address" value={intg.legalAddress} onChange={v => setIntg(s => ({ ...s, legalAddress: v }))} placeholder="123 Main St, City, ST 00000" />
              </div>
              <div className="mt-3">
                <Field label="Carrier / Plan Name" value={intg.carrierName} onChange={v => setIntg(s => ({ ...s, carrierName: v }))} placeholder="e.g. Acme Oral Savings Plan" tooltip="Plan name used in legal docs and membership cards." />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex gap-2 pt-4 border-t border-slate-200 mt-4">
        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm">Cancel</button>
        <button type="button" onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
          {saving ? 'Saving…' : 'Save Brand Config'}
        </button>
      </div>
    </ModalWrapper>
  );
}

function CreateAccountModal({ sites, onClose }: { sites: any[]; onClose: () => void }) {
  const createAccount = useMutation(api.admin.hierarchy.createAccount);
  const toast = useToast();
  const [form, setForm] = useState({ siteId: sites[0]?._id || '', slug: '', accountType: 'employer' as const, billingModel: 'per_member' as const });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.siteId || !form.slug) return;
    setSaving(true);
    try {
      await createAccount({
        siteId: form.siteId as Id<'sites'>,
        slug: form.slug,
        accountType: form.accountType,
        billingModel: form.billingModel,
        contacts: [],
      });
      onClose();
    } catch (err) {
      toast.fromError(err, 'Could not create broker');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper title="Create Account" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Carrier (Site)</label>
          <select value={form.siteId} onChange={e => setForm({ ...form, siteId: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
            {sites.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>
        <Field label="Slug" value={form.slug} onChange={v => setForm({ ...form, slug: v })} required placeholder="e.g. acme-corp" />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Account Type</label>
          <select value={form.accountType} onChange={e => setForm({ ...form, accountType: e.target.value as any })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
            {['owner','employer','broker','franchisee','partner','individual'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Billing Model</label>
          <select value={form.billingModel} onChange={e => setForm({ ...form, billingModel: e.target.value as any })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
            {['per_member','flat_rate','direct','subsidized','tiered'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={saving || sites.length === 0} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Create</button>
        </div>
      </form>
    </ModalWrapper>
  );
}

function CreateGroupModal({ sites, accounts, onClose }: { sites: any[]; accounts: any[]; onClose: () => void }) {
  const createGroup = useMutation(api.admin.hierarchy.createGroup);
  const toast = useToast();
  const [form, setForm] = useState({ siteId: sites[0]?._id || '', accountId: accounts[0]?._id || '', slug: '', groupCode: PROVIDER_GROUP_CODE as string, organizationCode: '', name: '', description: '', maxMembers: '', effectiveDate: '', terminationDate: '', brokerId: '', brokerTrackingCode: '' });
  const [saving, setSaving] = useState(false);

  const filteredAccounts = accounts.filter((a: any) => !form.siteId || a.siteId === form.siteId);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.siteId || !form.accountId || !form.slug || !form.groupCode) return;
    if (!form.organizationCode.trim()) {
      toast.warning('Organization Code required', 'Set the Subscriber ID before creating the organization. Members enrolled here will be missing their Subscriber ID without it.');
      return;
    }
    setSaving(true);
    try {
      await createGroup({
        siteId: form.siteId as Id<'sites'>,
        accountId: form.accountId as Id<'accounts'>,
        slug: form.slug,
        groupCode: form.groupCode,
        organizationCode: form.organizationCode.trim(),
        name: form.name || undefined,
        description: form.description || undefined,
        maxMembers: form.maxMembers ? Number(form.maxMembers) : undefined,
        effectiveDate: form.effectiveDate ? new Date(form.effectiveDate).getTime() : undefined,
        terminationDate: form.terminationDate ? new Date(form.terminationDate).getTime() : undefined,
        brokerId: form.brokerId || undefined,
        brokerTrackingCode: form.brokerTrackingCode || undefined,
      });
      onClose();
    } catch (err) {
      toast.fromError(err, 'Could not create organization');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper title="Create Organization" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div>
          <label className="block">
            <LabelRow label="Carrier (Site)" tooltip="Which platform/carrier this organization sits under (e.g. Ideal Health vs. a white-label site). Determines branding and which brokers appear below." />
          </label>
          <select value={form.siteId} onChange={e => setForm({ ...form, siteId: e.target.value, accountId: '' })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
            {sites.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block">
            <LabelRow label="Account" tooltip="The Account that owns this organization. Controls billing model and reporting rollups." />
          </label>
          <select value={form.accountId} onChange={e => setForm({ ...form, accountId: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
            <option value="">Select account...</option>
            {filteredAccounts.map((a: any) => <option key={a._id} value={a._id}>{a.slug}</option>)}
          </select>
        </div>
        <Field label="Organization Name" tooltip="Display name shown to admins and on invoices (e.g. 'ACME Corp' or 'Ideal Direct Consumer'). Not shown to members." value={form.name} onChange={v => {
          // Auto-suggest organizationCode from name if user hasn't typed one yet
          setForm(f => {
            const slugCode = v.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 12);
            const suggest = slugCode ? `${slugCode}-0001` : '';
            return { ...f, name: v, organizationCode: f.organizationCode ? f.organizationCode : suggest };
          });
        }} placeholder="e.g. ACME Corp / Ideal Direct Consumer" />
        <Field label="Description" tooltip="Optional internal note about this organization. Not shown to members or on any documents." value={form.description} onChange={v => setForm({ ...form, description: v })} />
        <Field label="Slug" tooltip="A URL-friendly identifier used internally (and in enrollment links) to reference this organization. Lowercase letters, numbers, and dashes only." value={form.slug} onChange={v => setForm({ ...form, slug: v })} required placeholder="e.g. acme / ideal-direct-consumer" />
        <Field label="Organization Code (Subscriber ID)" tooltip="Becomes the Subscriber ID on every member's ID card and eligibility file for this organization. Required — without it, enrolled members won't have a valid Subscriber ID." value={form.organizationCode} onChange={v => setForm({ ...form, organizationCode: v })} required placeholder="e.g. ACME-0042 or IDC-0001" />
        <Field label="Provider Group Code" tooltip="The vendor-required group code (Careington/DialCare) printed on ID cards and sent in vendor eligibility files. Defaults to the standard Ideal Health code — only change if this organization uses a different provider network." value={form.groupCode} onChange={v => setForm({ ...form, groupCode: v })} required placeholder={`e.g. ${PROVIDER_GROUP_CODE} (Careington/DialCare-required)`} />
        <Field label="Max Members" tooltip="Caps how many members can enroll in this organization. Leave blank to allow unlimited enrollments." value={form.maxMembers} onChange={v => setForm({ ...form, maxMembers: v })} placeholder="Leave blank for unlimited" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block">
              <LabelRow label="Effective Date" tooltip="The date coverage/eligibility for this organization begins. Optional — leave blank if not yet determined." />
            </label>
            <input type="date" value={form.effectiveDate} onChange={e => setForm({ ...form, effectiveDate: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block">
              <LabelRow label="Termination Date" tooltip="The date this organization's coverage ends. Optional — set later if/when the group is cancelled." />
            </label>
            <input type="date" value={form.terminationDate} onChange={e => setForm({ ...form, terminationDate: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
        </div>
        <RepSelect value={form.brokerId} trackingCode={form.brokerTrackingCode} onChange={(id, code) => setForm({ ...form, brokerId: id, brokerTrackingCode: code })} tooltip="Attributes this organization to a broker rep/agent for commission tracking. Choose 'No representative' if this is a direct/house account." />
        <Field label="Representative Tracking Code" tooltip="Auto-filled from the selected representative's code. Used to attribute enrollments in this organization back to that rep for commissions." value={form.brokerTrackingCode} onChange={v => setForm({ ...form, brokerTrackingCode: v })} />
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={saving || !form.accountId} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Create</button>
        </div>
      </form>
    </ModalWrapper>
  );
}

function EditAccountModal({ account, onClose }: { account: any; onClose: () => void }) {
  const updateAccount = useMutation(api.admin.hierarchy.updateAccount);
  const toast = useToast();
  const [form, setForm] = useState({
    name: account.name || '',
    slug: account.slug || '',
    billingModel: account.billingModel || 'per_member',
    perMemberRateCents: String(account.billingDetails?.perMemberRateCents ?? ''),
    flatRateCents: String(account.billingDetails?.flatRateCents ?? ''),
    subsidyPercentage: String(account.billingDetails?.subsidyPercentage ?? ''),
    contractStartDate: account.contractStartDate ? new Date(account.contractStartDate).toISOString().slice(0, 10) : '',
    contractEndDate: account.contractEndDate ? new Date(account.contractEndDate).toISOString().slice(0, 10) : '',
    status: account.status || 'active',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateAccount({
        accountId: account._id,
        name: form.name || undefined,
        slug: form.slug || undefined,
        billingModel: form.billingModel,
        billingDetails: {
          perMemberRateCents: form.perMemberRateCents ? Number(form.perMemberRateCents) : undefined,
          flatRateCents: form.flatRateCents ? Number(form.flatRateCents) : undefined,
          subsidyPercentage: form.subsidyPercentage ? Number(form.subsidyPercentage) : undefined,
        },
        contractStartDate: form.contractStartDate ? new Date(form.contractStartDate).getTime() : undefined,
        contractEndDate: form.contractEndDate ? new Date(form.contractEndDate).getTime() : undefined,
        status: form.status,
      });
      onClose();
    } catch (err) {
      toast.fromError(err, 'Could not update broker');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper title={`Edit Broker: ${account.slug}`} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
        <Field label="Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Display name" />
        <Field label="Slug" value={form.slug} onChange={(v) => setForm((f) => ({ ...f, slug: v }))} />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Billing Model</label>
          <select value={form.billingModel} onChange={(e) => setForm((f) => ({ ...f, billingModel: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
            {['per_member', 'flat_rate', 'direct', 'subsidized', 'tiered'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Per Member Rate (¢)" value={form.perMemberRateCents} onChange={(v) => setForm((f) => ({ ...f, perMemberRateCents: v }))} placeholder="e.g. 1500" />
          <Field label="Flat Rate (¢)" value={form.flatRateCents} onChange={(v) => setForm((f) => ({ ...f, flatRateCents: v }))} placeholder="e.g. 50000" />
        </div>
        <Field label="Subsidy %" value={form.subsidyPercentage} onChange={(v) => setForm((f) => ({ ...f, subsidyPercentage: v }))} placeholder="0–100" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contract Start</label>
            <input type="date" value={form.contractStartDate} onChange={(e) => setForm((f) => ({ ...f, contractStartDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contract End</label>
            <input type="date" value={form.contractEndDate} onChange={(e) => setForm((f) => ({ ...f, contractEndDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Save</button>
        </div>
      </form>
    </ModalWrapper>
  );
}

function EditGroupModal({ group, accounts, onClose }: { group: any; accounts: any[]; onClose: () => void }) {
  const updateGroup = useMutation(api.admin.hierarchy.updateGroup);
  const toast = useToast();
  const [form, setForm] = useState({
    name: group.name || '',
    description: group.description || '',
    groupCode: group.groupCode || '',
    organizationCode: group.organizationCode || '',
    maxMembers: String(group.maxMembers ?? ''),
    effectiveDate: group.effectiveDate ? new Date(group.effectiveDate).toISOString().slice(0, 10) : '',
    terminationDate: group.terminationDate ? new Date(group.terminationDate).toISOString().slice(0, 10) : '',
    brokerId: group.brokerId || '',
    brokerTrackingCode: group.brokerTrackingCode || '',
    status: group.status || 'active',
    listBillEnabled: group.listBill?.enabled === true,
    listBillPaymentMethod: (group.listBill?.paymentMethod as 'check' | 'ach') ?? 'check',
    listBillDueDay: String(group.listBill?.paymentDueDayOfMonth ?? '1'),
    listBillContactEmail: group.listBill?.employerContactEmail ?? '',
    listBillNotes: group.listBill?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateGroup({
        groupId: group._id,
        name: form.name || undefined,
        description: form.description || undefined,
        groupCode: form.groupCode || undefined,
        organizationCode: form.organizationCode || undefined,
        maxMembers: form.maxMembers ? Number(form.maxMembers) : undefined,
        effectiveDate: form.effectiveDate ? new Date(form.effectiveDate).getTime() : undefined,
        terminationDate: form.terminationDate ? new Date(form.terminationDate).getTime() : undefined,
        brokerId: form.brokerId || undefined,
        brokerTrackingCode: form.brokerTrackingCode || undefined,
        status: form.status || undefined,
        listBill: form.listBillEnabled
          ? {
              enabled: true,
              paymentMethod: form.listBillPaymentMethod,
              paymentDueDayOfMonth: Number(form.listBillDueDay) || 1,
              employerContactEmail: form.listBillContactEmail || undefined,
              notes: form.listBillNotes || undefined,
            }
          : { enabled: false, paymentMethod: 'check' as const },
      } as any);
      onClose();
    } catch (err) {
      toast.fromError(err, 'Could not update organization');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper title={`Edit Organization: ${group.name || group.groupCode}`} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
        <Field label="Organization Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
        <Field label="Description" value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} />
        <Field label="Organization Code (Subscriber ID)" value={form.organizationCode} onChange={(v) => setForm((f) => ({ ...f, organizationCode: v }))} placeholder="e.g. ACME-0042 or IDC-0001" />
        <Field label="Provider Group Code" value={form.groupCode} onChange={(v) => setForm((f) => ({ ...f, groupCode: v }))} placeholder={`e.g. ${PROVIDER_GROUP_CODE}`} />
        <Field label="Max Members" value={form.maxMembers} onChange={(v) => setForm((f) => ({ ...f, maxMembers: v }))} placeholder="Leave blank for unlimited" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Effective Date</label>
            <input type="date" value={form.effectiveDate} onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Termination Date</label>
            <input type="date" value={form.terminationDate} onChange={(e) => setForm((f) => ({ ...f, terminationDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
        </div>
        <RepSelect value={form.brokerId} trackingCode={form.brokerTrackingCode} onChange={(id, code) => setForm((f) => ({ ...f, brokerId: id, brokerTrackingCode: code }))} />
        <Field label="Representative Tracking Code" value={form.brokerTrackingCode} onChange={(v) => setForm((f) => ({ ...f, brokerTrackingCode: v }))} />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>

        {/* List-Bill Configuration */}
        <div className="border-t border-slate-200 pt-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.listBillEnabled}
              onChange={(e) => setForm((f) => ({ ...f, listBillEnabled: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm font-medium text-slate-700">Enable List-Bill (FT Payroll Deduction)</span>
          </label>
          {form.listBillEnabled && (
            <div className="mt-3 space-y-3 pl-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Employer Payment Method</label>
                <select
                  value={form.listBillPaymentMethod}
                  onChange={(e) => setForm((f) => ({ ...f, listBillPaymentMethod: e.target.value as 'check' | 'ach' }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="check">Check</option>
                  <option value="ach">ACH / Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Due Day of Month</label>
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={form.listBillDueDay}
                  onChange={(e) => setForm((f) => ({ ...f, listBillDueDay: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Employer Billing Contact Email</label>
                <input
                  type="email"
                  value={form.listBillContactEmail}
                  onChange={(e) => setForm((f) => ({ ...f, listBillContactEmail: e.target.value }))}
                  placeholder="billing@employer.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={form.listBillNotes}
                  onChange={(e) => setForm((f) => ({ ...f, listBillNotes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Save</button>
        </div>
      </form>
    </ModalWrapper>
  );
}

/* ─── Member breakdown (inspect members within an organization) ─── */

const MEMBER_STATUS_META: Record<string, { label: string; color: string; description: string }> = {
  lead: { label: 'Lead', color: 'bg-slate-100 text-slate-700', description: 'Prospect — not yet matched to an eligibility file or enrolled.' },
  eligible: { label: 'Eligible', color: 'bg-blue-100 text-blue-700', description: 'Matched to an eligibility file; entitled to coverage but hasn\u2019t activated yet.' },
  enrolling: { label: 'Enrolling', color: 'bg-amber-100 text-amber-700', description: 'Currently in the enrollment flow — started but not finished.' },
  active: { label: 'Active', color: 'bg-green-100 text-green-700', description: 'Enrolled and currently active on the plan.' },
  inactive: { label: 'Inactive', color: 'bg-gray-100 text-gray-700', description: 'No active plans right now.' },
  terminated: { label: 'Terminated', color: 'bg-red-100 text-red-700', description: 'Removed from the plan.' },
  declined: { label: 'Declined', color: 'bg-orange-100 text-orange-700', description: 'Declined enrollment.' },
};

function MemberBreakdownPanel({ groupId }: { groupId: string }) {
  const breakdown = useQuery(api.admin.members.getGroupMemberBreakdown, { groupId: groupId as Id<'groups'> });
  const [expanded, setExpanded] = useState<string | null>(null);

  if (breakdown === undefined) {
    return <p className="text-sm text-slate-500 py-2">Loading…</p>;
  }
  if (breakdown.total === 0) {
    return <p className="text-sm text-slate-500 py-2">No members in this organization yet.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">
        <span className="font-semibold text-slate-900">{breakdown.total}</span> total member{breakdown.total === 1 ? '' : 's'} — click a status to see who&apos;s in it.
      </p>
      {Object.entries(breakdown.byStatus).map(([status, count]) => {
        if ((count as number) === 0) return null;
        const meta = MEMBER_STATUS_META[status] || { label: status, color: 'bg-slate-100 text-slate-700', description: '' };
        const list = breakdown.detailsByStatus[status] || [];
        const isOpen = expanded === status;
        return (
          <div key={status} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : status)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-slate-50 text-left"
            >
              <span className="flex items-center gap-2 min-w-0">
                {isOpen ? <ChevronDown size={12} className="shrink-0 text-slate-400" /> : <ChevronRight size={12} className="shrink-0 text-slate-400" />}
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                <span className="text-xs text-slate-500 truncate">{meta.description}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-slate-900">{count as number}</span>
            </button>
            {isOpen && (
              <div className="border-t border-slate-100 divide-y divide-slate-100 bg-slate-50/50">
                {list.map((m: any) => (
                  <Link
                    key={m.id}
                    href={`/admin/members/${m.id}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-blue-50"
                  >
                    <span className="text-slate-900 truncate">{m.name}{m.email ? <span className="text-slate-400"> — {m.email}</span> : null}</span>
                    <span className="shrink-0 text-xs text-slate-400 font-mono">{m.memberId}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Shared helpers ─── */

function ModalWrapper({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean | '2xl' }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    // Auto-focus first focusable element
    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      'input,select,textarea,button:not([aria-label="Close dialog"])'
    );
    focusable?.focus();
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);
  const widthClass = wide === '2xl' ? 'max-w-2xl' : wide ? 'max-w-xl' : 'max-w-md';
  return (
    <div
      className="fixed inset-0 bg-slate-900/10 flex items-center justify-center z-50"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={`bg-white rounded-lg p-6 w-full mx-4 shadow-2xl ring-1 ring-slate-200 ${widthClass}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="modal-title" className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded" aria-label="Close dialog"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function LabelRow({ label, required, tooltip }: { label: string; required?: boolean; tooltip?: string }) {
  return (
    <span className="flex items-center gap-1.5 mb-1">
      <span className="text-sm font-medium text-slate-700">{label}{required && <RequiredMark />}</span>
      {tooltip && (
        <Tooltip text={tooltip} width="md">
          <Info size={13} className="text-slate-400 cursor-help" />
        </Tooltip>
      )}
    </span>
  );
}

function Field({ label, value, onChange, required, placeholder, tooltip }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string; tooltip?: string }) {
  return (
    <div>
      <label className="block">
        <LabelRow label={label} required={required} tooltip={tooltip} />
      </label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} required={required} placeholder={placeholder} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    </div>
  );
}

// Clerk-free rep selector. Stores partnerLeaders._id in `value` and reports the
// rep's tracking code so the caller can keep brokerTrackingCode in sync.
function RepSelect({
  value,
  trackingCode,
  onChange,
  tooltip,
}: {
  value: string;
  trackingCode: string;
  onChange: (repLeaderId: string, repCode: string) => void;
  tooltip?: string;
}) {
  const agents = useQuery(api.enrollment.agents.listPublicAgents) || [];
  return (
    <div>
      <label className="block">
        <LabelRow label="Representative" tooltip={tooltip} />
      </label>
      <select
        value={value}
        onChange={(e) => {
          const id = e.target.value;
          const agent = agents.find((a: any) => a.id === id);
          onChange(id, agent?.repCode ?? '');
        }}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="">No representative</option>
        {agents.map((a: any) => (
          <option key={a.id} value={a.id}>
            {a.name}{a.repCode ? ` — ${a.repCode}` : ''}{a.groupName ? ` (${a.groupName})` : ''}
          </option>
        ))}
      </select>
      {value && !agents.some((a: any) => a.id === value) && (
        <p className="text-xs text-amber-600 mt-1">
          Current value isn&apos;t a known rep ID{trackingCode ? ` (code ${trackingCode})` : ''}. Re-select to update.
        </p>
      )}
    </div>
  );
}
