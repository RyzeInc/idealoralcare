'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Phone, Ban, Plus, Trash2, GitBranch, Rocket, CheckCircle2, Circle } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { Breadcrumbs, useToast } from '@/components/admin/ui';
import { Card, SectionHeader } from '@/components/admin/crm/primitives';
import { tagColorClass } from '@/components/admin/crm/constants';
import { formatDate } from '@/lib/admin-format';

const DIAL_PROVIDERS: { value: string; label: string }[] = [
  { value: 'manual', label: 'Manual (copy number, no auto-dial)' },
  { value: 'tel', label: 'tel: link (cell phone / desktop softphone)' },
  { value: 'ringcentral', label: 'RingCentral' },
  { value: 'dialpad', label: 'Dialpad' },
  { value: 'zoom', label: 'Zoom Phone' },
  { value: 'twilio', label: 'In-browser calling (Twilio) — needs a Twilio account configured first' },
  { value: 'custom', label: 'Custom URI template' },
];

function DialSettingsCard() {
  const toast = useToast();
  const settings = useQuery(api.crm.settings.getMySettings, {});
  const updateSettings = useMutation(api.crm.settings.updateMySettings);
  const [dialProvider, setDialProvider] = useState('manual');
  const [dialUrlTemplate, setDialUrlTemplate] = useState('');
  const [signature, setSignature] = useState('');
  // Seed local editable state from the query result the moment it first
  // resolves — an "adjust state during render" pattern (React's own
  // recommended alternative to an effect for this), not a setState-in-effect:
  // guarded on object identity so it fires once per load, not every render.
  const [syncedSettings, setSyncedSettings] = useState(settings);
  if (settings !== syncedSettings && settings !== undefined) {
    setSyncedSettings(settings);
    setDialProvider(settings.dialProvider);
    setDialUrlTemplate(settings.dialUrlTemplate);
    setSignature(settings.emailSignatureHtml ?? '');
  }

  const handleSave = async () => {
    try {
      await updateSettings({ dialProvider: dialProvider as Parameters<typeof updateSettings>[0]['dialProvider'], dialUrlTemplate, emailSignatureHtml: signature || undefined, assignSelfOnCreate: true });
      toast.success('Settings saved');
    } catch (err) {
      toast.fromError(err, 'Could not save settings');
    }
  };

  return (
    <Card>
      <SectionHeader icon={Phone} title="Dialer" />
      <div className="space-y-3">
        <div>
          <p className="text-xs text-slate-500 mb-1">What do you dial with?</p>
          <select value={dialProvider} onChange={(e) => setDialProvider(e.target.value)} className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5">
            {DIAL_PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        {dialProvider === 'custom' && (
          <div>
            <p className="text-xs text-slate-500 mb-1">URI template — {'{e164}'} and {'{digits}'} are substituted</p>
            <input
              type="text"
              value={dialUrlTemplate}
              onChange={(e) => setDialUrlTemplate(e.target.value)}
              placeholder="myapp://call?number={e164}"
              className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5 font-mono"
            />
          </div>
        )}
        <div>
          <p className="text-xs text-slate-500 mb-1">Email signature (HTML)</p>
          <textarea
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            rows={4}
            className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5 font-mono"
          />
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={handleSave} className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">Save</button>
        </div>
      </div>
    </Card>
  );
}

function SuppressionsCard() {
  const toast = useToast();
  const suppressions = useQuery(api.crm.suppressions.listSuppressions, {});
  const addSuppression = useMutation(api.crm.suppressions.addSuppression);
  const removeSuppression = useMutation(api.crm.suppressions.removeSuppression);
  const [value, setValue] = useState('');
  const [scope, setScope] = useState<'email' | 'domain'>('email');

  const handleAdd = async () => {
    if (!value.trim()) return;
    try {
      await addSuppression({ value: value.trim(), scope, reason: 'manual' });
      setValue('');
      toast.success('Added to suppression list');
    } catch (err) {
      toast.fromError(err, 'Could not add suppression');
    }
  };

  return (
    <Card>
      <SectionHeader icon={Ban} title="Suppression List" badge={<span className="text-xs text-slate-400">{suppressions?.length ?? 0}</span>} />
      <div className="flex items-center gap-1.5 mb-3">
        <select value={scope} onChange={(e) => setScope(e.target.value as 'email' | 'domain')} className="text-xs border border-slate-300 rounded px-1.5 py-1">
          <option value="email">Email</option>
          <option value="domain">Domain</option>
        </select>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={scope === 'email' ? 'someone@example.com' : 'example.com'}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          className="flex-1 text-xs border border-slate-300 rounded px-2 py-1"
        />
        <button type="button" onClick={handleAdd} className="text-blue-600 hover:text-blue-800" aria-label="Add">
          <Plus size={14} />
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto space-y-1">
        {(suppressions ?? []).map((s) => (
          <div key={s._id} className="flex items-center justify-between text-sm py-1 border-b border-slate-50 last:border-0">
            <div>
              <span className="text-slate-700">{s.value}</span>
              <span className="text-xs text-slate-400 ml-2">{s.reason.replace(/_/g, ' ')} · {formatDate(s.createdAt)}</span>
            </div>
            <button type="button" onClick={() => removeSuppression({ suppressionId: s._id })} className="text-slate-300 hover:text-red-600" aria-label="Remove">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {(suppressions ?? []).length === 0 && <p className="text-xs text-slate-400">Nothing suppressed yet.</p>}
      </div>
    </Card>
  );
}

/**
 * Pipeline stage editor. Stages are configurable, but every stage must declare
 * the canonical value it rolls up into — that mapping is what keeps saved
 * segments, the company search index and the funnel working while the display
 * name, order, colour and probability stay editable.
 */
function PipelineStagesCard() {
  const toast = useToast();
  const stages = useQuery(api.crm.pipelines.listStages, {});
  const pipeline = useQuery(api.crm.pipelines.getDefaultPipeline, {});
  const seedPipeline = useMutation(api.crm.pipelines.seedDefaultPipeline);
  const updateStage = useMutation(api.crm.pipelines.updateStage);
  const createStage = useMutation(api.crm.pipelines.createStage);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftProbability, setDraftProbability] = useState('');

  const handleSave = async (stageId: string) => {
    const stage = (stages ?? []).find((s) => s._id === stageId);
    if (!stage) return;
    try {
      await updateStage({
        stageId: stage._id,
        name: draftName.trim() || stage.name,
        probability: Number(draftProbability),
        color: stage.color,
        isFolded: stage.isFolded,
      });
      setEditingId(null);
    } catch (err) {
      toast.fromError(err, 'Could not update stage');
    }
  };

  return (
    <Card>
      <SectionHeader
        icon={GitBranch}
        title="Pipeline stages"
        badge={
          pipeline && stages && stages.length > 0 ? (
            <button
              type="button"
              onClick={async () => {
                const name = prompt('New stage name?');
                if (!name?.trim()) return;
                const canonical = prompt(
                  'Which canonical stage does it roll up into?\n\nunqualified, prospect, contacted, engaged, proposal, verbal, won, lost, dormant',
                  'engaged',
                );
                if (!canonical?.trim()) return;
                try {
                  await createStage({
                    pipelineId: pipeline._id,
                    name: name.trim(),
                    canonicalStage: canonical.trim() as Parameters<typeof createStage>[0]['canonicalStage'],
                    probability: 50,
                    color: 'slate',
                  });
                } catch (err) {
                  toast.fromError(err, 'Could not add stage');
                }
              }}
              className="text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              + Add stage
            </button>
          ) : undefined
        }
      />

      {stages !== undefined && stages.length === 0 && (
        <div className="text-center py-4">
          <p className="text-sm text-slate-500 mb-2">No pipeline configured yet.</p>
          <button
            type="button"
            onClick={async () => {
              try {
                await seedPipeline({});
                toast.success('Default pipeline created');
              } catch (err) {
                toast.fromError(err, 'Could not create pipeline');
              }
            }}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Create default pipeline
          </button>
        </div>
      )}

      <div className="space-y-1">
        {(stages ?? []).map((stage) => (
          <div key={stage._id} className="flex items-center gap-2 py-1.5 border-b border-slate-50 last:border-0">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${tagColorClass(stage.color).split(' ')[1]}`} />
            {editingId === stage._id ? (
              <>
                <input value={draftName} onChange={(e) => setDraftName(e.target.value)} className="flex-1 text-sm border border-slate-300 rounded px-2 py-1" />
                <input type="number" min={0} max={100} value={draftProbability} onChange={(e) => setDraftProbability(e.target.value)} className="w-16 text-sm border border-slate-300 rounded px-2 py-1" />
                <button type="button" onClick={() => handleSave(stage._id)} className="text-xs font-medium text-blue-600">Save</button>
                <button type="button" onClick={() => setEditingId(null)} className="text-xs text-slate-400">Cancel</button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-slate-800">{stage.name}</span>
                <span className="text-xs text-slate-400" title="Rolls up to this canonical stage for segments and funnel reporting">
                  {stage.canonicalStage}
                </span>
                <span className="text-xs text-slate-500 tabular-nums w-10 text-right">{stage.probability}%</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(stage._id);
                    setDraftName(stage.name);
                    setDraftProbability(String(stage.probability));
                  }}
                  className="text-xs text-slate-400 hover:text-slate-700"
                >
                  Edit
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function StatusRow({ done, label, detail }: { done: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-2">
      {done
        ? <CheckCircle2 size={14} className="text-green-600 flex-shrink-0 mt-0.5" />
        : <Circle size={14} className="text-slate-300 flex-shrink-0 mt-0.5" />}
      <div className="min-w-0">
        <p className="text-sm text-slate-800">{label}</p>
        <p className="text-xs text-slate-400">{detail}</p>
      </div>
    </div>
  );
}

/**
 * One-time setup for the deal pipeline. Existing companies predate crmDeals,
 * so the board is empty until each one is given a primary deal mirroring the
 * stage it already had — this panel is how that gets run, and how you can see
 * whether it still needs running.
 */
function ExpansionSetupCard() {
  const toast = useToast();
  const status = useQuery(api.crm.setup.expansionStatus, {});
  const runSetup = useMutation(api.crm.setup.runExpansionSetup);
  const reconcile = useMutation(api.crm.setup.reconcileNow);
  const migrateStatuses = useMutation(api.crm.setup.migrateStatusesNow);
  const [running, setRunning] = useState(false);

  const handleRun = async () => {
    setRunning(true);
    try {
      const result = await runSetup({});
      toast.success(
        `Setup started — ${result.pipelineCreated ? 'pipeline created, ' : ''}${result.tagsCreated} tag(s) added. Backfilling deals in the background.`,
      );
    } catch (err) {
      toast.fromError(err, 'Could not run setup');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <SectionHeader icon={Rocket} title="Pipeline setup" />

      {status === undefined ? (
        <p className="text-sm text-slate-400">Checking…</p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <StatusRow
              done={status.pipelineReady}
              label="Default pipeline & stages"
              detail={status.pipelineReady ? `${status.stageCount} stages configured` : 'Not created yet'}
            />
            <StatusRow
              done={status.relationshipTagsReady}
              label="Relationship Type tags"
              detail={
                status.relationshipTagsReady
                  ? `${status.relationshipTagCount} tags available`
                  : `${status.relationshipTagCount} of ${status.expectedRelationshipTags} seeded`
              }
            />
            <StatusRow
              done={status.companiesMissingDeals === 0}
              label="Companies migrated to deals"
              detail={
                status.companiesMissingDeals === 0
                  ? `All ${status.companyCount} companies have a deal`
                  : `${status.companiesMissingDeals} of ${status.companyCount} companies still need one`
              }
            />
            <StatusRow
              done={status.statusMigrationReady}
              label="Contacts on the current statuses"
              detail={
                status.statusMigrationReady
                  ? `All ${status.contactCount} contacts migrated`
                  : `${status.contactsNeedingMigration} of ${status.contactCount} still on a legacy status`
              }
            />
          </div>

          {status.truncated && (
            <p className="text-xs text-amber-600">
              Counts are capped at 5,000 rows — re-run setup until this reports zero remaining.
            </p>
          )}

          {status.isComplete ? (
            <p className="text-xs text-slate-500">
              Setup is complete. Re-running is safe and will only pick up companies added since.
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              Creates the pipeline and tag taxonomy, then gives every existing company a primary deal
              matching the stage it already has. Safe to run more than once.
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleRun}
              disabled={running}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40"
            >
              {running ? 'Running…' : status.isComplete ? 'Re-run setup' : 'Run setup'}
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await migrateStatuses({});
                  toast.success('Status migration started', 'Rewrites legacy contact statuses in the background. Safe to run again.');
                } catch (err) {
                  toast.fromError(err, 'Could not start the status migration');
                }
              }}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Migrate statuses
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await reconcile({});
                  toast.success('Cache reconciliation started');
                } catch (err) {
                  toast.fromError(err, 'Could not start reconciliation');
                }
              }}
              className="px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Reconcile cache
            </button>
          </div>
          <p className="text-xs text-slate-400">
            The backfill runs in the background in batches — refresh this panel to watch it progress.
          </p>
        </div>
      )}
    </Card>
  );
}

export default function CrmSettingsPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'CRM', href: '/admin/crm' }, { label: 'Settings' }]} />
      <h1 className="text-2xl font-semibold text-slate-900">CRM Settings</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <ExpansionSetupCard />
        <PipelineStagesCard />
        <DialSettingsCard />
        <SuppressionsCard />
      </div>
    </div>
  );
}
