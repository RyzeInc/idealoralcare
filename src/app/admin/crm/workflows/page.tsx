'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { Plus, Zap, Pause, Play } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';
import { Breadcrumbs, Modal, useToast } from '@/components/admin/ui';
import { formatDate } from '@/lib/admin-format';
import { TRIGGER_LABELS } from '@/components/admin/crm/workflowConstants';
import { CONTACT_STATUSES, CONTACT_STATUS_LABELS } from '@/components/admin/crm/constants';

type Entity = Doc<'crmWorkflows'>['entity'];
type TriggerType = Doc<'crmWorkflows'>['triggerType'];

function NewWorkflowModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const createWorkflow = useMutation(api.crm.workflows.createWorkflow);
  const stages = useQuery(api.crm.pipelines.listStages, {});
  const tagTree = useQuery(api.crm.tags.listTagTree, {});

  const [name, setName] = useState('');
  const [entity, setEntity] = useState<Entity>('contact');
  const [triggerType, setTriggerType] = useState<TriggerType>('contact_created');
  const [stageId, setStageId] = useState('');
  const [tagId, setTagId] = useState('');
  const [days, setDays] = useState('14');
  const [status, setStatus] = useState<string>('interested_qualified');
  const [saving, setSaving] = useState(false);

  // Which triggers make sense depends on the entity — a stage trigger on a
  // contact would never fire, so don't offer it.
  const triggersForEntity: Record<Entity, TriggerType[]> = {
    contact: ['contact_created', 'tag_applied', 'status_changed', 'no_activity_days', 'manual'],
    company: ['company_created', 'tag_applied', 'manual'],
    deal: ['deal_created', 'stage_entered', 'no_activity_days', 'manual'],
  };

  const handleEntityChange = (next: Entity) => {
    setEntity(next);
    setTriggerType(triggersForEntity[next][0]);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const id = await createWorkflow({
        name: name.trim(),
        entity,
        triggerType,
        triggerConfig: {
          stageId: triggerType === 'stage_entered' && stageId ? (stageId as Doc<'crmPipelineStages'>['_id']) : undefined,
          tagId: triggerType === 'tag_applied' && tagId ? (tagId as Doc<'crmTags'>['_id']) : undefined,
          days: triggerType === 'no_activity_days' ? Number(days) : undefined,
          status: triggerType === 'status_changed' ? status : undefined,
        },
      });
      onClose();
      router.push(`/admin/crm/workflows/${id}`);
    } catch (err) {
      toast.fromError(err, 'Could not create workflow');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Workflow" size="max-w-md">
      <div className="space-y-3">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Workflow name"
          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
        />

        <div>
          <p className="text-xs text-slate-500 mb-1">Applies to</p>
          <select value={entity} onChange={(e) => handleEntityChange(e.target.value as Entity)} className="w-full text-sm border border-slate-300 rounded-lg px-2 py-2">
            <option value="contact">Contacts</option>
            <option value="company">Companies</option>
            <option value="deal">Deals</option>
          </select>
        </div>

        <div>
          <p className="text-xs text-slate-500 mb-1">When</p>
          <select value={triggerType} onChange={(e) => setTriggerType(e.target.value as TriggerType)} className="w-full text-sm border border-slate-300 rounded-lg px-2 py-2">
            {triggersForEntity[entity].map((t) => (
              <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>
            ))}
          </select>
        </div>

        {triggerType === 'stage_entered' && (
          <select value={stageId} onChange={(e) => setStageId(e.target.value)} className="w-full text-sm border border-slate-300 rounded-lg px-2 py-2">
            <option value="">Any stage</option>
            {(stages ?? []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        )}

        {triggerType === 'tag_applied' && (
          <select value={tagId} onChange={(e) => setTagId(e.target.value)} className="w-full text-sm border border-slate-300 rounded-lg px-2 py-2">
            <option value="">Any tag</option>
            {(tagTree ?? []).flatMap((group) =>
              group.tags.map((tag) => (
                <option key={tag._id} value={tag._id}>{group.category.name} → {tag.name}</option>
              )),
            )}
          </select>
        )}

        {triggerType === 'no_activity_days' && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">No activity for</span>
            <input type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} className="w-20 text-sm border border-slate-300 rounded-lg px-2 py-2" />
            <span className="text-sm text-slate-600">days</span>
          </div>
        )}

        {triggerType === 'status_changed' && (
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full text-sm border border-slate-300 rounded-lg px-2 py-2">
            {CONTACT_STATUSES.map((s) => (
              <option key={s} value={s}>{CONTACT_STATUS_LABELS[s]}</option>
            ))}
          </select>
        )}

        <p className="text-xs text-slate-400">
          New workflows start paused. Add steps, then activate it.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={saving || !name.trim()} className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40">
            {saving ? 'Creating…' : 'Create Workflow'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function WorkflowsPage() {
  const router = useRouter();
  const toast = useToast();
  const workflows = useQuery(api.crm.workflows.listWorkflows, {});
  const setActive = useMutation(api.crm.workflows.setWorkflowActive);
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'CRM', href: '/admin/crm' }, { label: 'Workflows' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Workflows</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Automate follow-up: when something happens, run an ordered set of steps.
          </p>
        </div>
        <button type="button" onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus size={14} /> New Workflow
        </button>
      </div>

      {workflows === undefined && <p className="text-sm text-slate-400">Loading…</p>}

      {workflows && workflows.length === 0 && (
        <div className="border border-dashed border-slate-300 rounded-xl p-10 text-center">
          <Zap size={20} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-600">No workflows yet.</p>
          <p className="text-xs text-slate-400 mt-1">
            A good first one: when a deal enters Proposal, create a follow-up task in 3 days.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {(workflows ?? []).map(({ workflow, stepCount }) => (
          <div key={workflow._id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4">
            <button type="button" onClick={() => router.push(`/admin/crm/workflows/${workflow._id}`)} className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900">{workflow.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  workflow.isActive
                    ? 'text-green-700 bg-green-50 border-green-200'
                    : 'text-slate-600 bg-slate-50 border-slate-200'
                }`}>
                  {workflow.isActive ? 'Active' : 'Paused'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {workflow.entity} · {TRIGGER_LABELS[workflow.triggerType]} · {stepCount} step{stepCount === 1 ? '' : 's'}
                {workflow.lastRunAt ? ` · last run ${formatDate(workflow.lastRunAt)}` : ''}
                {workflow.runCount > 0 ? ` · ${workflow.runCount} runs` : ''}
              </p>
            </button>

            <button
              type="button"
              onClick={async () => {
                try {
                  await setActive({ workflowId: workflow._id, isActive: !workflow.isActive });
                } catch (err) {
                  toast.fromError(err, 'Could not change workflow state');
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              {workflow.isActive ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Activate</>}
            </button>
          </div>
        ))}
      </div>

      <NewWorkflowModal open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
}
