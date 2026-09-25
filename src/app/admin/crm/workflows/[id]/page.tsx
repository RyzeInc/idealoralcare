'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { Plus, Trash2, Zap, Play, Pause, ListChecks, History, ArrowDown } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { Breadcrumbs, Modal, StatusBadge, useToast } from '@/components/admin/ui';
import { formatDateTime } from '@/lib/admin-format';
import { Card, SectionHeader } from '@/components/admin/crm/primitives';
import { ACTION_LABELS, TRIGGER_LABELS, RUN_STATUS_TONE, formatDelay } from '@/components/admin/crm/workflowConstants';

type ActionType = Doc<'crmWorkflowSteps'>['actionType'];

const ACTIONS_FOR_ENTITY: Record<Doc<'crmWorkflows'>['entity'], ActionType[]> = {
  contact: ['create_task', 'apply_tag', 'remove_tag', 'send_email_template', 'add_note', 'notify_owner'],
  company: ['create_task', 'apply_tag', 'remove_tag', 'add_note', 'notify_owner'],
  deal: ['create_task', 'update_deal_stage', 'send_email_template', 'add_note', 'notify_owner'],
};

function AddStepModal({
  open,
  onClose,
  workflowId,
  entity,
}: {
  open: boolean;
  onClose: () => void;
  workflowId: Id<'crmWorkflows'>;
  entity: Doc<'crmWorkflows'>['entity'];
}) {
  const toast = useToast();
  const addStep = useMutation(api.crm.workflows.addStep);
  const stages = useQuery(api.crm.pipelines.listStages, {});
  const tagTree = useQuery(api.crm.tags.listTagTree, {});
  const templates = useQuery(api.crm.email.listTemplates, {});

  const available = ACTIONS_FOR_ENTITY[entity];
  const [actionType, setActionType] = useState<ActionType>(available[0]);
  const [delayValue, setDelayValue] = useState('0');
  const [delayUnit, setDelayUnit] = useState<'minutes' | 'hours' | 'days'>('days');
  const [taskTitle, setTaskTitle] = useState('');
  const [dueInDays, setDueInDays] = useState('1');
  const [tagId, setTagId] = useState('');
  const [stageId, setStageId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const delayMinutes = () => {
    const n = Number(delayValue) || 0;
    return delayUnit === 'minutes' ? n : delayUnit === 'hours' ? n * 60 : n * 60 * 24;
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await addStep({
        workflowId,
        actionType,
        delayMinutes: delayMinutes(),
        actionConfig: {
          taskTitle: actionType === 'create_task' ? taskTitle.trim() : undefined,
          taskType: actionType === 'create_task' ? 'follow_up' : undefined,
          dueInDays: actionType === 'create_task' ? Number(dueInDays) : undefined,
          assignTo: actionType === 'create_task' ? 'owner' : undefined,
          tagId: actionType === 'apply_tag' || actionType === 'remove_tag' ? (tagId as Id<'crmTags'>) : undefined,
          stageId: actionType === 'update_deal_stage' ? (stageId as Id<'crmPipelineStages'>) : undefined,
          templateId: actionType === 'send_email_template' ? (templateId as Id<'crmEmailTemplates'>) : undefined,
          message: actionType === 'add_note' || actionType === 'notify_owner' ? message.trim() : undefined,
        },
      });
      onClose();
      setTaskTitle('');
      setMessage('');
      setTagId('');
      setStageId('');
      setTemplateId('');
      setDelayValue('0');
    } catch (err) {
      toast.fromError(err, 'Could not add step');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Step" size="max-w-md">
      <div className="space-y-3">
        <div>
          <p className="text-xs text-slate-500 mb-1">Wait</p>
          <div className="flex gap-2">
            <input type="number" min={0} value={delayValue} onChange={(e) => setDelayValue(e.target.value)} className="w-24 text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
            <select value={delayUnit} onChange={(e) => setDelayUnit(e.target.value as typeof delayUnit)} className="text-sm border border-slate-300 rounded-lg px-2 py-2">
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
              <option value="days">days</option>
            </select>
          </div>
          <p className="text-xs text-slate-400 mt-1">0 runs immediately after the previous step.</p>
        </div>

        <div>
          <p className="text-xs text-slate-500 mb-1">Then</p>
          <select value={actionType} onChange={(e) => setActionType(e.target.value as ActionType)} className="w-full text-sm border border-slate-300 rounded-lg px-2 py-2">
            {available.map((a) => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
          </select>
        </div>

        {actionType === 'create_task' && (
          <>
            <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Task title" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Due in</span>
              <input type="number" min={0} value={dueInDays} onChange={(e) => setDueInDays(e.target.value)} className="w-20 text-sm border border-slate-300 rounded-lg px-2 py-2" />
              <span className="text-sm text-slate-600">days, assigned to the record owner</span>
            </div>
          </>
        )}

        {(actionType === 'apply_tag' || actionType === 'remove_tag') && (
          <select value={tagId} onChange={(e) => setTagId(e.target.value)} className="w-full text-sm border border-slate-300 rounded-lg px-2 py-2">
            <option value="">Select a tag…</option>
            {(tagTree ?? []).flatMap((group) =>
              group.tags.map((tag) => <option key={tag._id} value={tag._id}>{group.category.name} → {tag.name}</option>),
            )}
          </select>
        )}

        {actionType === 'update_deal_stage' && (
          <select value={stageId} onChange={(e) => setStageId(e.target.value)} className="w-full text-sm border border-slate-300 rounded-lg px-2 py-2">
            <option value="">Select a stage…</option>
            {(stages ?? []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        )}

        {actionType === 'send_email_template' && (
          <>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full text-sm border border-slate-300 rounded-lg px-2 py-2">
              <option value="">Select a template…</option>
              {(templates ?? []).map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Automated sends still honour opt-outs, bounce status, the suppression list and the
              daily send cap — a contact who cannot be emailed is skipped and logged, never mailed.
            </p>
          </>
        )}

        {(actionType === 'add_note' || actionType === 'notify_owner') && (
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Message" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={saving} className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40">
            {saving ? 'Adding…' : 'Add Step'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const workflowId = id as Id<'crmWorkflows'>;
  const router = useRouter();
  const toast = useToast();

  const data = useQuery(api.crm.workflows.getWorkflow, { workflowId });
  const runs = useQuery(api.crm.workflows.listRuns, { workflowId });
  const setActive = useMutation(api.crm.workflows.setWorkflowActive);
  const deleteStep = useMutation(api.crm.workflows.deleteStep);
  const deleteWorkflow = useMutation(api.crm.workflows.deleteWorkflow);
  const [showAddStep, setShowAddStep] = useState(false);

  if (data === undefined) return <p className="text-sm text-slate-400">Loading…</p>;
  if (data === null) return <p className="text-sm text-slate-500">Workflow not found.</p>;

  const { workflow, steps } = data;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'CRM', href: '/admin/crm' },
          { label: 'Workflows', href: '/admin/crm/workflows' },
          { label: workflow.name },
        ]}
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">{workflow.name}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${
              workflow.isActive ? 'text-green-700 bg-green-50 border-green-200' : 'text-slate-600 bg-slate-50 border-slate-200'
            }`}>
              {workflow.isActive ? 'Active' : 'Paused'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {workflow.entity} · {TRIGGER_LABELS[workflow.triggerType]}
            {workflow.triggerConfig.days ? ` (${workflow.triggerConfig.days} days)` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              try {
                await setActive({ workflowId, isActive: !workflow.isActive });
              } catch (err) {
                toast.fromError(err, 'Could not change workflow state');
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            {workflow.isActive ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Activate</>}
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!confirm(`Delete "${workflow.name}" and its run history? This cannot be undone.`)) return;
              try {
                await deleteWorkflow({ workflowId });
                router.push('/admin/crm/workflows');
              } catch (err) {
                toast.fromError(err, 'Could not delete workflow');
              }
            }}
            className="p-2 text-slate-400 hover:text-red-600 border border-slate-300 rounded-lg"
            aria-label="Delete workflow"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <SectionHeader
              icon={ListChecks}
              title="Steps"
              badge={
                <button type="button" onClick={() => setShowAddStep(true)} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800">
                  <Plus size={12} /> Add step
                </button>
              }
            />

            {steps.length === 0 ? (
              <div className="border border-dashed border-slate-200 rounded-lg p-6 text-center">
                <Zap size={18} className="mx-auto text-slate-300 mb-1.5" />
                <p className="text-sm text-slate-500">No steps yet — a workflow with no steps never runs.</p>
              </div>
            ) : (
              <ol className="space-y-2">
                {steps.map((step, i) => (
                  <li key={step._id}>
                    {i > 0 && (
                      <div className="flex justify-center py-1">
                        <ArrowDown size={12} className="text-slate-300" />
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-3 border border-slate-200 rounded-lg px-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{ACTION_LABELS[step.actionType]}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {formatDelay(step.delayMinutes)}
                          {step.actionConfig.taskTitle ? ` · "${step.actionConfig.taskTitle}"` : ''}
                          {step.actionConfig.message ? ` · "${step.actionConfig.message.slice(0, 60)}"` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteStep({ stepId: step._id }).catch((e) => toast.fromError(e, 'Could not delete step'))}
                        className="text-slate-300 hover:text-red-600 flex-shrink-0"
                        aria-label="Delete step"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div>
          <Card>
            <SectionHeader icon={History} title="Recent runs" />
            {runs === undefined && <p className="text-sm text-slate-400">Loading…</p>}
            {runs && runs.length === 0 && (
              <p className="text-sm text-slate-400">
                No runs yet. Runs appear here with a per-step outcome — including why a step was skipped.
              </p>
            )}
            <div className="space-y-3">
              {(runs ?? []).map((run) => (
                <div key={run._id} className="border-b border-slate-100 last:border-0 pb-3 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">{formatDateTime(run.firedAt)}</span>
                    <StatusBadge status={run.status.replace(/_/g, ' ')} tone={RUN_STATUS_TONE[run.status] ?? 'neutral'} />
                  </div>
                  {run.stepLog.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {run.stepLog.map((entry, i) => (
                        <li key={i} className="text-xs text-slate-500 flex items-start gap-1.5">
                          <span className={
                            entry.outcome === 'done' ? 'text-green-600'
                              : entry.outcome === 'skipped' ? 'text-amber-600'
                              : 'text-red-600'
                          }>
                            {entry.outcome === 'done' ? '✓' : entry.outcome === 'skipped' ? '⤼' : '✕'}
                          </span>
                          <span>
                            {ACTION_LABELS[entry.actionType] ?? entry.actionType}
                            {entry.detail ? ` — ${entry.detail}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {run.lastError && <p className="text-xs text-red-600 mt-1">{run.lastError}</p>}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <AddStepModal open={showAddStep} onClose={() => setShowAddStep(false)} workflowId={workflowId} entity={workflow.entity} />
    </div>
  );
}
