'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useUser } from '@clerk/nextjs';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { UserPlus, Trash2, Shield, Users, Crown, AlertCircle, CheckCircle, Loader } from 'lucide-react';

type Role = 'owner' | 'editor';

interface Notification {
  type: 'success' | 'error';
  message: string;
}

export default function UsersAdmin() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const [authTimeout, setAuthTimeout] = useState(false);
  
  // Call all hooks unconditionally (before any early returns)
  const admins = useQuery(api.admin.adminUsers.getAll) ?? [];

  // Failsafe: if Clerk doesn't load within 5s, proceed anyway
  useEffect(() => {
    const t = setTimeout(() => setAuthTimeout(true), 5000);
    return () => clearTimeout(t);
  }, []);
  const addAdmin = useMutation(api.admin.adminUsers.add);
  const updateRole = useMutation(api.admin.adminUsers.updateRole);
  const removeAdmin = useMutation(api.admin.adminUsers.remove);
  const initFirstAdmin = useMutation(api.admin.adminUsers.initializeFirstAdmin);

  const [showAddForm, setShowAddForm] = useState(false);
  const [showBootstrap, setShowBootstrap] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Add form state
  const [form, setForm] = useState({ clerkUserId: '', email: '', name: '', role: 'editor' as Role });

  // Bootstrap form state
  const [bootstrapForm, setBootstrapForm] = useState({ clerkUserId: '', email: '', name: '' });

  // Show loading state while Clerk loads (with 5s timeout failsafe)
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

  // Show error if not authenticated (skip if Clerk timed out — server layout already verified admin)
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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clerkUserId.trim() || !form.email.trim() || !form.name.trim()) return;
    setSubmitting(true);
    try {
      await addAdmin({
        clerkUserId: form.clerkUserId.trim(),
        email: form.email.trim(),
        name: form.name.trim(),
        role: form.role,
        departments: ["admin"],
      });
      setForm({ clerkUserId: '', email: '', name: '', role: 'editor' });
      setShowAddForm(false);
      notify('success', `${form.name} added as ${form.role}`);
    } catch (err: any) {
      notify('error', err?.message ?? 'Failed to add admin');
    } finally {
      setSubmitting(false);
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
        notify('error', 'Admins already exist — use Add Admin instead');
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

  return (
    <div className="space-y-6">
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
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <UserPlus size={16} />
            Add Admin
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

        {admins.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Users size={36} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No admin users yet</p>
            <p className="text-slate-400 text-sm mt-1">Use "Initialize First Admin" to bootstrap your first owner account</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Clerk ID</th>
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
                    <code className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-mono">
                      {admin.clerkUserId.length > 20 ? `${admin.clerkUserId.slice(0, 20)}…` : admin.clerkUserId}
                    </code>
                  </td>
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
        )}
      </div>

      {/* How to Find Clerk ID Help */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
        <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <AlertCircle size={16} />
          How to find a user's Clerk ID
        </h3>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Go to your <strong>Clerk Dashboard</strong> at <a href="https://dashboard.clerk.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">dashboard.clerk.com</a></li>
          <li>Click <strong>Users</strong> in the left sidebar</li>
          <li>Find the user by email and click their name</li>
          <li>Copy the <strong>User ID</strong> shown at the top (it starts with <code className="bg-blue-100 px-1 rounded">user_</code>)</li>
          <li>Paste it into the Clerk User ID field below</li>
        </ol>
      </div>

      {/* Add Admin Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Add Admin User</h2>
            <p className="text-sm text-slate-500 mb-6">The user must already have a Clerk account before adding them here.</p>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Clerk User ID</label>
                <input
                  type="text"
                  placeholder="user_2abc123..."
                  value={form.clerkUserId}
                  onChange={(e) => setForm((f) => ({ ...f, clerkUserId: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
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
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
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
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  disabled={submitting}
                >
                  {submitting ? 'Adding…' : 'Add Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bootstrap First Admin Modal */}
      {showBootstrap && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-1">
              <Crown size={22} className="text-amber-500" />
              <h2 className="text-xl font-bold text-slate-900">Initialize First Admin</h2>
            </div>
            <p className="text-sm text-slate-500 mb-6">This can only be done once when no admins exist. The first user will become the <strong>Owner</strong>.</p>
            <form onSubmit={handleBootstrap} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Your Clerk User ID</label>
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
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
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
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
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
