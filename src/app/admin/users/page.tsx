'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { useUser } from '@clerk/nextjs';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { UserPlus, Trash2, Shield, Users, Crown, AlertCircle, CheckCircle, Loader, Mail, RotateCw, XCircle, Clock, Search } from 'lucide-react';
import { Breadcrumbs, RequiredMark, SkeletonTable } from '@/components/admin/ui';

type Role = 'owner' | 'editor';

interface Notification {
  type: 'success' | 'error';
  message: string;
}

export default function UsersAdmin() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const [authTimeout, setAuthTimeout] = useState(false);
  
  const adminsRaw = useQuery(api.admin.adminUsers.getAll);
  const admins = adminsRaw ?? [];
  const isLoadingAdmins = adminsRaw === undefined;
  const invitesRaw = useQuery(api.admin.adminUsers.getAllInvites);
  const invites = invitesRaw ?? [];

  useEffect(() => {
    const t = setTimeout(() => setAuthTimeout(true), 5000);
    return () => clearTimeout(t);
  }, []);

  const updateRole = useMutation(api.admin.adminUsers.updateRole);
  const removeAdmin = useMutation(api.admin.adminUsers.remove);
  const initFirstAdmin = useMutation(api.admin.adminUsers.initializeFirstAdmin);
  const inviteAdmin = useAction(api.admin.adminUsers.inviteAdmin);
  const resendInvite = useAction(api.admin.adminUsers.resendAdminInvite);
  const cancelInvite = useMutation(api.admin.adminUsers.cancelAdminInvite);

  const addAdmin = useMutation(api.admin.adminUsers.add);

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showAddExisting, setShowAddExisting] = useState(false);
  const [showBootstrap, setShowBootstrap] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // ESC closes any open modal (modals also close on backdrop click)
  useEffect(() => {
    if (!showInviteForm && !showAddExisting && !showBootstrap) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (submitting) return;
      if (showInviteForm) setShowInviteForm(false);
      if (showAddExisting) setShowAddExisting(false);
      if (showBootstrap) setShowBootstrap(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showInviteForm, showAddExisting, showBootstrap, submitting]);

  // Invite form state (no Clerk ID needed!)
  const [form, setForm] = useState({ email: '', name: '', role: 'editor' as Role, departments: [] as string[] });

  // Add existing user state
  const [clerkSearch, setClerkSearch] = useState('');
  const [clerkResults, setClerkResults] = useState<{ id: string; email: string; name: string; imageUrl?: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [addExistingRole, setAddExistingRole] = useState<Role>('editor');
  const [addExistingDepts, setAddExistingDepts] = useState<string[]>([]);

  const DEPT_OPTIONS = [
    { value: 'admin', label: 'Admin' },
    { value: 'program_manager', label: 'Program Manager' },
    { value: 'fmo', label: 'FMO' },
    { value: 'broker', label: 'Broker' },
    { value: 'sales', label: 'Sales' },
    { value: 'hr', label: 'HR' },
    { value: 'executive', label: 'Executive' },
  ];

  const [bootstrapForm, setBootstrapForm] = useState({ clerkUserId: '', email: '', name: '' });

  if (!clerkLoaded && !authTimeout) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium bg-blue-50 text-blue-800 border border-blue-200">
          <Loader size={16} className="animate-spin" />
          Loading authentication...
        </div>
      </div>
    );
  }

  if (!clerkUser && !authTimeout) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium bg-red-50 text-red-800 border border-red-200">
          <AlertCircle size={16} />
          Not authenticated. Please log in first.
        </div>
      </div>
    );
  }

  function notify(type: 'success' | 'error', message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.trim() || !form.name.trim()) return;
    setSubmitting(true);
    try {
      const result = await inviteAdmin({
        email: form.email.trim(),
        name: form.name.trim(),
        role: form.role,
        departments: form.departments.length > 0 ? form.departments as any[] : ["admin"],
      });
      if (result.inviteSent) {
        notify('success', `Invitation sent to ${form.email}`);
      } else {
        notify('error', `Invite created but email failed: ${result.inviteError ?? 'Unknown error'}`);
      }
      setForm({ email: '', name: '', role: 'editor', departments: [] });
      setShowInviteForm(false);
    } catch (err: any) {
      notify('error', err?.message ?? 'Failed to send invite');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendInvite(inviteId: Id<'adminInvites'>) {
    setResendingId(inviteId);
    try {
      const result = await resendInvite({ inviteId });
      if (result.success) {
        notify('success', 'Invite resent successfully');
      } else {
        notify('error', result.error ?? 'Failed to resend invite');
      }
    } catch (err: any) {
      notify('error', err?.message ?? 'Failed to resend invite');
    } finally {
      setResendingId(null);
    }
  }

  async function handleCancelInvite(inviteId: Id<'adminInvites'>, name: string) {
    if (!confirm(`Cancel the invitation for ${name}? They will no longer be able to use the invite link.`)) return;
    try {
      await cancelInvite({ inviteId });
      notify('success', `Invitation for ${name} cancelled`);
    } catch (err: any) {
      notify('error', err?.message ?? 'Failed to cancel invite');
    }
  }

  async function handleRoleChange(id: Id<'adminUsers'>, role: Role) {
    try {
      await updateRole({ id, role });
      notify('success', 'Role updated');
    } catch (err: any) {
      notify('error', err?.message ?? 'Failed to update role');
    }
  }

  async function handleRemove(id: Id<'adminUsers'>, name: string) {
    if (!confirm(`Remove ${name} from admin access? They will lose all admin privileges immediately.`)) return;
    try {
      await removeAdmin({ id });
      notify('success', `${name} removed`);
    } catch (err: any) {
      notify('error', err?.message ?? 'Failed to remove admin');
    }
  }

  async function handleSearchClerkUsers(query: string) {
    setClerkSearch(query);
    if (query.trim().length < 2) { setClerkResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/clerk/users?search=${encodeURIComponent(query.trim())}&limit=10`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      // Filter out users already in the admin list
      const existingIds = new Set(admins.map((a) => a.clerkUserId));
      setClerkResults(
        (data.users || []).filter((u: { id: string }) => !existingIds.has(u.id))
      );
    } catch {
      setClerkResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleAddExistingUser(user: { id: string; email: string; name: string }) {
    setSubmitting(true);
    try {
      await addAdmin({
        clerkUserId: user.id,
        email: user.email,
        name: user.name || user.email.split('@')[0],
        role: addExistingRole,
        departments: addExistingDepts.length > 0 ? addExistingDepts as any[] : ['admin'],
      });
      notify('success', `${user.name || user.email} added as ${addExistingRole}`);
      setShowAddExisting(false);
      setClerkSearch('');
      setClerkResults([]);
      setAddExistingRole('editor');
      setAddExistingDepts([]);
    } catch (err: any) {
      notify('error', err?.message ?? 'Failed to add user');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBootstrap(e: React.FormEvent) {
    e.preventDefault();
    if (!bootstrapForm.clerkUserId.trim() || !bootstrapForm.email.trim() || !bootstrapForm.name.trim()) return;
    setSubmitting(true);
    try {
      const result = await initFirstAdmin({
        clerkUserId: bootstrapForm.clerkUserId.trim(),
        email: bootstrapForm.email.trim(),
        name: bootstrapForm.name.trim(),
      });
      if (result === null) {
        notify('error', 'Admins already exist — use Invite Admin instead');
      } else {
        setBootstrapForm({ clerkUserId: '', email: '', name: '' });
        setShowBootstrap(false);
        notify('success', `${bootstrapForm.name} initialized as owner`);
      }
    } catch (err: any) {
      notify('error', err?.message ?? 'Failed to initialize admin');
    } finally {
      setSubmitting(false);
    }
  }

  const roleIcon = (role: string) =>
    role === 'owner' ? <Crown size={14} className="text-amber-500" /> : <Shield size={14} className="text-blue-500" />;

  const roleBadge = (role: string) =>
    role === 'owner'
      ? 'bg-amber-50 text-amber-700 border border-amber-200'
      : 'bg-blue-50 text-blue-700 border border-blue-200';

  const pendingInvites = invites.filter((i) => i.inviteStatus === 'pending');
  const claimedInvites = invites.filter((i) => i.inviteStatus === 'claimed');

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Admin Users' }]} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Admin Users</h1>
          <p className="text-slate-500">Manage who can access the admin portal and what they can do</p>
        </div>
        <div className="flex gap-3">
          {admins.length === 0 && (
            <button
              onClick={() => setShowBootstrap(true)}
              className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium"
            >
              <Crown size={16} />
              Initialize First Admin
            </button>
          )}
          <button
            onClick={() => setShowAddExisting(true)}
            className="flex items-center gap-2 bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
          >
            <Search size={16} />
            Add Existing User
          </button>
          <button
            onClick={() => setShowInviteForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <UserPlus size={16} />
            Invite Admin
          </button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {notification.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {notification.message}
        </div>
      )}

      {/* Role Guide */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Crown size={18} className="text-amber-500" />
            <span className="font-semibold text-slate-900">Owner</span>
          </div>
          <p className="text-sm text-slate-500">Full access — can manage other admins, billing, site settings, and all platform data. Assign to founders and key team leads.</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={18} className="text-blue-500" />
            <span className="font-semibold text-slate-900">Editor</span>
          </div>
          <p className="text-sm text-slate-500">Operational access — can manage members, upload eligibility files, generate vendor files, and view billing. Good for support staff.</p>
        </div>
      </div>

      {/* Admin Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Users size={18} className="text-slate-500" />
          <h2 className="font-semibold text-slate-900">Current Admin Users</h2>
          <span className="ml-auto text-sm text-slate-400">{admins.length} user{admins.length !== 1 ? 's' : ''}</span>
        </div>

        {isLoadingAdmins ? (
          <SkeletonTable rows={4} cols={4} />
        ) : admins.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Users size={36} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No admin users yet</p>
            <p className="text-slate-400 text-sm mt-1">Use &quot;Initialize First Admin&quot; to bootstrap your first owner account, or invite someone via email</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {admins.map((admin) => (
                <tr key={admin._id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                        {admin.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-900 text-sm">{admin.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{admin.email}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${roleBadge(admin.role)}`}>
                        {roleIcon(admin.role)}
                        {admin.role.charAt(0).toUpperCase() + admin.role.slice(1)}
                      </span>
                      <select
                        defaultValue={admin.role}
                        onChange={(e) => handleRoleChange(admin._id, e.target.value as Role)}
                        className="text-xs border border-slate-200 rounded px-2 py-1 text-slate-600 bg-white hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="editor">Editor</option>
                        <option value="owner">Owner</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleRemove(admin._id, admin.name)}
                      className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors ml-auto"
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Mail size={18} className="text-amber-500" />
            <h2 className="font-semibold text-slate-900">Pending Invitations</h2>
            <span className="ml-auto text-sm text-slate-400">{pendingInvites.length} pending</span>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Expires</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingInvites.map((invite) => {
                const isExpired = invite.inviteExpiry < Date.now();
                const expiresIn = Math.ceil((invite.inviteExpiry - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <tr key={invite._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-600">
                          {invite.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900 text-sm">{invite.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{invite.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${roleBadge(invite.role)}`}>
                        {roleIcon(invite.role)}
                        {invite.role.charAt(0).toUpperCase() + invite.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 text-xs ${isExpired ? 'text-red-500' : 'text-slate-500'}`}>
                        <Clock size={12} />
                        {isExpired ? 'Expired' : `${expiresIn} days`}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => handleResendInvite(invite._id)}
                          disabled={resendingId === invite._id}
                          className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <RotateCw size={14} className={resendingId === invite._id ? 'animate-spin' : ''} />
                          Resend
                        </button>
                        <button
                          onClick={() => handleCancelInvite(invite._id, invite.name)}
                          className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <XCircle size={14} />
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
        <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <Mail size={16} />
          How Admin Invitations Work
        </h3>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Click <strong>Invite Admin</strong> and enter the person&apos;s name, email, and role</li>
          <li>They&apos;ll receive an email with a secure invite link</li>
          <li>They click the link and create their account (or sign in if they already have one)</li>
          <li>Their admin access is automatically activated — no manual Clerk ID entry needed</li>
        </ol>
      </div>

      {/* Invite Admin Modal */}
      {showInviteForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => { if (!submitting) setShowInviteForm(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-modal-title"
            className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="invite-modal-title" className="text-xl font-bold text-slate-900 mb-1">Invite Admin User</h2>
            <p className="text-sm text-slate-500 mb-6">Send an email invitation. They&apos;ll create their account when they accept.</p>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name<RequiredMark /></label>
                <input
                  type="text"
                  placeholder="Jane Smith"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email<RequiredMark /></label>
                <input
                  type="email"
                  placeholder="jane@idealhealth.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="editor">Editor — Operational access</option>
                  <option value="owner">Owner — Full access</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Departments</label>
                <div className="grid grid-cols-2 gap-2">
                  {DEPT_OPTIONS.map((dept) => (
                    <label key={dept.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.departments.includes(dept.value)}
                        onChange={(e) => {
                          setForm((f) => ({
                            ...f,
                            departments: e.target.checked
                              ? [...f.departments, dept.value]
                              : f.departments.filter((d) => d !== dept.value),
                          }));
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700">{dept.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader size={14} className="animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Mail size={14} />
                      Send Invitation
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Existing User Modal */}
      {showAddExisting && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddExisting(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-existing-modal-title"
            className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="add-existing-modal-title" className="text-xl font-bold text-slate-900 mb-1">Add Existing User</h2>
            <p className="text-sm text-slate-500 mb-6">Search for a Clerk user by name or email and add them as an admin.</p>

            {/* Search Input */}
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={clerkSearch}
                onChange={(e) => handleSearchClerkUsers(e.target.value)}
                className="w-full border border-slate-300 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              {searching && <Loader size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
            </div>

            {/* Search Results */}
            {clerkSearch.trim().length >= 2 && (
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg mb-4">
                {clerkResults.length === 0 && !searching ? (
                  <p className="text-sm text-slate-500 p-4 text-center">No matching users found</p>
                ) : (
                  clerkResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleAddExistingUser(u)}
                      disabled={submitting}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-100 last:border-b-0 disabled:opacity-50"
                    >
                      {u.imageUrl ? (
                        <img src={u.imageUrl} alt="" className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                          {(u.name || u.email).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{u.name || 'No name'}</p>
                        <p className="text-xs text-slate-500 truncate">{u.email}</p>
                      </div>
                      <span className="text-xs text-blue-600 font-medium shrink-0">Add →</span>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Role & Departments */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
                <select
                  value={addExistingRole}
                  onChange={(e) => setAddExistingRole(e.target.value as Role)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="editor">Editor — Operational access</option>
                  <option value="owner">Owner — Full access</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Departments</label>
                <div className="grid grid-cols-2 gap-2">
                  {DEPT_OPTIONS.map((dept) => (
                    <label key={dept.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addExistingDepts.includes(dept.value)}
                        onChange={(e) => {
                          setAddExistingDepts((prev) =>
                            e.target.checked
                              ? [...prev, dept.value]
                              : prev.filter((d) => d !== dept.value)
                          );
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700">{dept.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowAddExisting(false);
                setClerkSearch('');
                setClerkResults([]);
                setAddExistingRole('editor');
                setAddExistingDepts([]);
              }}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Bootstrap First Admin Modal */}
      {showBootstrap && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => { if (!submitting) setShowBootstrap(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bootstrap-modal-title"
            className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-1">
              <Crown size={22} className="text-amber-500" />
              <h2 id="bootstrap-modal-title" className="text-xl font-bold text-slate-900">Initialize First Admin</h2>
            </div>
            <p className="text-sm text-slate-500 mb-6">This can only be done once when no admins exist. The first user will become the <strong>Owner</strong>.</p>
            <form onSubmit={handleBootstrap} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Your Clerk User ID<RequiredMark /></label>
                <input
                  type="text"
                  placeholder="user_2abc123..."
                  value={bootstrapForm.clerkUserId}
                  onChange={(e) => setBootstrapForm((f) => ({ ...f, clerkUserId: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name<RequiredMark /></label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={bootstrapForm.name}
                  onChange={(e) => setBootstrapForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email<RequiredMark /></label>
                <input
                  type="email"
                  placeholder="you@idealhealth.com"
                  value={bootstrapForm.email}
                  onChange={(e) => setBootstrapForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBootstrap(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
                  disabled={submitting}
                >
                  {submitting ? 'Initializing…' : 'Initialize Owner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
