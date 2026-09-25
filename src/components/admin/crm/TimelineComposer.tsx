'use client';

import { useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { StickyNote, Phone, Mail, ListChecks } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useToast } from '@/components/admin/ui';

type Tab = 'note' | 'call' | 'email' | 'task';

const TABS: { key: Tab; label: string; icon: typeof StickyNote }[] = [
  { key: 'note', label: 'Note', icon: StickyNote },
  { key: 'call', label: 'Log Call', icon: Phone },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'task', label: 'Task', icon: ListChecks },
];

export function TimelineComposer({ contactId }: { contactId: Id<'crmContacts'> }) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('note');
  const [noteText, setNoteText] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [saving, setSaving] = useState(false);

  const addNote = useMutation(api.crm.activities.addNote);
  const createTask = useMutation(api.crm.tasks.createTask);
  const templates = useQuery(api.crm.email.listTemplates, {});
  const sendOneOffEmail = useAction(api.crm.email.sendOneOffEmail);

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      await addNote({ contactId, content: noteText.trim() });
      setNoteText('');
    } finally {
      setSaving(false);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates?.find((t) => t._id === templateId);
    if (template) {
      setEmailSubject(template.subject);
      setEmailBody(template.bodyHtml);
    }
  };

  const handleSendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) return;
    setSaving(true);
    try {
      const result = await sendOneOffEmail({ contactId, subject: emailSubject.trim(), bodyHtml: emailBody.trim() });
      if (result.success) {
        toast.success('Email sent');
        setEmailSubject('');
        setEmailBody('');
        setSelectedTemplateId('');
      } else {
        toast.error('Could not send email', result.error);
      }
    } catch (err) {
      toast.fromError(err, 'Could not send email');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTask = async () => {
    if (!taskTitle.trim()) return;
    setSaving(true);
    try {
      await createTask({
        contactId, title: taskTitle.trim(), taskType: 'follow_up',
        dueAt: Date.now() + 24 * 60 * 60 * 1000,
      });
      setTaskTitle('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex border-b border-slate-100">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
              tab === t.key ? 'border-blue-500 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === 'note' && (
          <div className="space-y-2">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              placeholder="Add a note…"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 resize-none"
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddNote(); }}
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddNote}
                disabled={!noteText.trim() || saving}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40"
              >
                Add Note
              </button>
            </div>
          </div>
        )}

        {tab === 'call' && (
          <p className="text-sm text-slate-500">
            Use the <span className="font-medium text-slate-700">Call</span> button at the top of the page — it opens the
            call log automatically once you dial.
          </p>
        )}

        {tab === 'email' && (
          <div className="space-y-2">
            {templates && templates.length > 0 && (
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600"
              >
                <option value="">— Start from a template —</option>
                {templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
              </select>
            )}
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Subject"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
            />
            <textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={5}
              placeholder="Write your email… {{firstName}}, {{companyName}} and {{jobTitle}} will be filled in automatically."
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 resize-none"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={!emailSubject.trim() || !emailBody.trim() || saving}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40"
              >
                {saving ? 'Sending…' : 'Send Email'}
              </button>
            </div>
          </div>
        )}

        {tab === 'task' && (
          <div className="space-y-2">
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Follow up about…"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddTask(); }}
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddTask}
                disabled={!taskTitle.trim() || saving}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40"
              >
                Add Task (due tomorrow)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
