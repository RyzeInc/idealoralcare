'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Plus, Edit, Trash2, X } from 'lucide-react';

type TabType = 'sites' | 'accounts' | 'groups';

export default function HierarchyAdmin() {
  const [activeTab, setActiveTab] = useState<TabType>('sites');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const sites = useQuery(api.admin.hierarchy.getSites) || [];
  const accounts = useQuery(api.admin.hierarchy.getAllAccounts) || [];
  const groups = useQuery(api.admin.hierarchy.getAllGroups) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Sites & Accounts & Groups</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          <Plus size={18} />
          Create {activeTab === 'sites' ? 'Site' : activeTab === 'accounts' ? 'Account' : 'Group'}
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
            {tab.charAt(0).toUpperCase() + tab.slice(1)} ({tab === 'sites' ? sites.length : tab === 'accounts' ? accounts.length : groups.length})
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
      {editingSite && <EditSiteModal site={editingSite} onClose={() => setEditingSite(null)} />}
    </>
  );
}

function AccountsList({ accounts, sites }: { accounts: any[]; sites: any[] }) {
  const removeAccount = useMutation(api.admin.hierarchy.removeAccount);
  const siteMap = Object.fromEntries(sites.map(s => [s._id, s.name]));

  return (
    <table className="w-full">
      <thead className="bg-slate-50 border-b border-slate-200">
        <tr>
          <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Slug</th>
          <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Site</th>
          <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Type</th>
          <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Billing</th>
          <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
          <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200">
        {accounts.length === 0 ? (
          <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No accounts yet. Create one to get started.</td></tr>
        ) : (
          accounts.map((acct: any) => (
            <tr key={acct._id} className="hover:bg-slate-50">
              <td className="px-6 py-4 font-mono text-sm font-medium">{acct.slug}</td>
              <td className="px-6 py-4 text-slate-600">{siteMap[acct.siteId] || '—'}</td>
              <td className="px-6 py-4 text-slate-600">{acct.accountType}</td>
              <td className="px-6 py-4 text-slate-600">{acct.billingModel}</td>
              <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold ${acct.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{acct.status}</span></td>
              <td className="px-6 py-4 text-right">
                <button onClick={() => { if (confirm(`Delete account "${acct.slug}"?`)) removeAccount({ accountId: acct._id }); }} className="p-1 hover:bg-red-100 rounded text-red-600"><Trash2 size={16} /></button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function GroupsList({ groups, accounts, sites }: { groups: any[]; accounts: any[]; sites: any[] }) {
  const removeGroup = useMutation(api.admin.hierarchy.removeGroup);
  const acctMap = Object.fromEntries(accounts.map(a => [a._id, a.slug]));

  return (
    <table className="w-full">
      <thead className="bg-slate-50 border-b border-slate-200">
        <tr>
          <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Name</th>
          <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Group Code</th>
          <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Account</th>
          <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
          <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200">
        {groups.length === 0 ? (
          <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No groups yet. Create one to start enrolling members.</td></tr>
        ) : (
          groups.map((grp: any) => (
            <tr key={grp._id} className="hover:bg-slate-50">
              <td className="px-6 py-4 font-medium text-slate-900">{grp.name || grp.slug}</td>
              <td className="px-6 py-4 font-mono text-sm">{grp.groupCode}</td>
              <td className="px-6 py-4 text-slate-600">{acctMap[grp.accountId] || '—'}</td>
              <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold ${grp.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{grp.status}</span></td>
              <td className="px-6 py-4 text-right">
                <button onClick={() => { if (confirm(`Delete group "${grp.groupCode}"?`)) removeGroup({ groupId: grp._id }); }} className="p-1 hover:bg-red-100 rounded text-red-600"><Trash2 size={16} /></button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

/* ─── Create / Edit modals ─── */

function CreateSiteModal({ onClose }: { onClose: () => void }) {
  const createSite = useMutation(api.admin.hierarchy.createSite);
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
      alert(`Error: ${err instanceof Error ? err.message : 'Failed'}`);
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

function EditSiteModal({ site, onClose }: { site: any; onClose: () => void }) {
  const updateSite = useMutation(api.admin.hierarchy.updateSite);
  const [form, setForm] = useState({ name: site.name, domain: site.domain || '', type: site.type });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSite({ siteId: site._id, name: form.name, domain: form.domain || undefined, type: form.type });
      onClose();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Failed'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper title={`Edit Site: ${site.name}`} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <Field label="Name" value={form.name} onChange={v => setForm({ ...form, name: v })} required />
        <Field label="Domain" value={form.domain} onChange={v => setForm({ ...form, domain: v })} />
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Save</button>
        </div>
      </form>
    </ModalWrapper>
  );
}

function CreateAccountModal({ sites, onClose }: { sites: any[]; onClose: () => void }) {
  const createAccount = useMutation(api.admin.hierarchy.createAccount);
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
      alert(`Error: ${err instanceof Error ? err.message : 'Failed'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper title="Create Account" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Site</label>
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
  const [form, setForm] = useState({ siteId: sites[0]?._id || '', accountId: accounts[0]?._id || '', slug: '', groupCode: '', name: '' });
  const [saving, setSaving] = useState(false);

  const filteredAccounts = accounts.filter((a: any) => !form.siteId || a.siteId === form.siteId);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.siteId || !form.accountId || !form.slug || !form.groupCode) return;
    setSaving(true);
    try {
      await createGroup({
        siteId: form.siteId as Id<'sites'>,
        accountId: form.accountId as Id<'accounts'>,
        slug: form.slug,
        groupCode: form.groupCode,
      });
      onClose();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Failed'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper title="Create Group" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Site</label>
          <select value={form.siteId} onChange={e => setForm({ ...form, siteId: e.target.value, accountId: '' })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
            {sites.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Account</label>
          <select value={form.accountId} onChange={e => setForm({ ...form, accountId: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
            <option value="">Select account...</option>
            {filteredAccounts.map((a: any) => <option key={a._id} value={a._id}>{a.slug}</option>)}
          </select>
        </div>
        <Field label="Name" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. ACME Default Group" />
        <Field label="Slug" value={form.slug} onChange={v => setForm({ ...form, slug: v })} required placeholder="e.g. acme-default" />
        <Field label="Group Code" value={form.groupCode} onChange={v => setForm({ ...form, groupCode: v })} required placeholder="e.g. ACME-2026" />
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={saving || !form.accountId} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Create</button>
        </div>
      </form>
    </ModalWrapper>
  );
}

/* ─── Shared helpers ─── */

function ModalWrapper({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, required, placeholder }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} required={required} placeholder={placeholder} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    </div>
  );
}
