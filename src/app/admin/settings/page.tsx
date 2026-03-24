'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Save } from 'lucide-react';

export default function SiteSettingsPage() {
  const settings = useQuery(api.admin.siteSettings.get);
  const updateSettings = useMutation(api.admin.siteSettings.update);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    siteName: '',
    tagline: '',
    description: '',
    contactEmail: '',
    supportEmail: '',
    socialTwitter: '',
    socialLinkedin: '',
    socialGithub: '',
  });

  useEffect(() => {
    if (settings) {
      setForm({
        siteName: settings.siteName || '',
        tagline: settings.tagline || '',
        description: settings.description || '',
        contactEmail: settings.contactEmail || '',
        supportEmail: settings.supportEmail || '',
        socialTwitter: settings.socialTwitter || '',
        socialLinkedin: settings.socialLinkedin || '',
        socialGithub: settings.socialGithub || '',
      });
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Save failed'}`);
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = 'w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Site Settings</h1>
        <p className="text-slate-600">Manage global site configuration and branding</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <section className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 border-b pb-2">General</h2>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Site Name</label>
            <input type="text" value={form.siteName} onChange={e => setForm({ ...form, siteName: e.target.value })} className={fieldClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tagline</label>
            <input type="text" value={form.tagline} onChange={e => setForm({ ...form, tagline: e.target.value })} className={fieldClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className={fieldClass} />
          </div>
        </section>

        <section className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 border-b pb-2">Contact</h2>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contact Email</label>
            <input type="email" value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} className={fieldClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Support Email</label>
            <input type="email" value={form.supportEmail} onChange={e => setForm({ ...form, supportEmail: e.target.value })} className={fieldClass} />
          </div>
        </section>

        <section className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 border-b pb-2">Social Links</h2>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Twitter / X</label>
            <input type="url" value={form.socialTwitter} onChange={e => setForm({ ...form, socialTwitter: e.target.value })} className={fieldClass} placeholder="https://twitter.com/..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">LinkedIn</label>
            <input type="url" value={form.socialLinkedin} onChange={e => setForm({ ...form, socialLinkedin: e.target.value })} className={fieldClass} placeholder="https://linkedin.com/company/..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">GitHub</label>
            <input type="url" value={form.socialGithub} onChange={e => setForm({ ...form, socialGithub: e.target.value })} className={fieldClass} placeholder="https://github.com/..." />
          </div>
        </section>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold">
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {saved && <span className="text-green-600 font-medium self-center">Saved!</span>}
        </div>
      </form>
    </div>
  );
}
