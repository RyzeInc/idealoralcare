'use client';

/**
 * Phase configuration and automation controls for one drip campaign.
 *
 * A phase is automatable only once it has an email template — that is the
 * opt-in. A campaign with no configured phases keeps working exactly as it did
 * before the engine existed: a human moves people through, or a bound blast
 * does. That is why the start button refuses until at least one phase has a
 * template, rather than starting an engine that would find nothing to send.
 */

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Play, Pause, Hand, Clock, AlertTriangle } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { StatusBadge, useToast } from '@/components/admin/ui';

const AUTOMATION_TONE: Record<string, 'success' | 'warning' | 'neutral'> = {
  running: 'success',
  paused: 'warning',
  manual: 'neutral',
};

const AUTOMATION_LABEL: Record<string, string> = {
  running: 'Sending automatically',
  paused: 'Paused',
  manual: 'Manual',
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function PhaseRow({
  campaign, order, config, templates,
}: {
  campaign: Doc<'crmDripCampaigns'>;
  order: number;
  config: Doc<'crmDripPhases'> | undefined;
  templates: Doc<'crmEmailTemplates'>[];
}) {
  const toast = useToast();
  const savePhase = useMutation(api.crm.dripCampaigns.savePhase);
  const [label, setLabel] = useState(config?.label ?? '');
  const [delayDays, setDelayDays] = useState(String(config?.delayDays ?? 3));

  const save = async (patch: { label?: string; templateId?: Id<'crmEmailTemplates'>; delayDays?: number }) => {
    try {
      await savePhase({
        dripCampaignId: campaign._id,
        order,
        label: patch.label ?? label,
        templateId: 'templateId' in patch ? patch.templateId : config?.templateId,
        delayDays: patch.delayDays ?? (Number(delayDays) || 0),
      });
    } catch (err) {
      toast.fromError(err, 'Could not save that phase');
    }
  };

  return (
    <div className="grid grid-cols-12 gap-2 items-center py-2 border-b border-slate-100 last:border-0">
      <div className="col-span-1 text-xs font-semibold text-slate-500">#{order}</div>

      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => save({})}
        placeholder={campaign.phaseLabels?.[order - 1] ?? `Phase ${order}`}
        className="col-span-3 text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400"
      />

      <select
        value={config?.templateId ?? ''}
        onChange={(e) => save({ templateId: (e.target.value || undefined) as Id<'crmEmailTemplates'> | undefined })}
        className={`col-span-5 text-sm border rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 ${
          config?.templateId ? 'border-slate-200 text-slate-800' : 'border-dashed border-slate-300 text-slate-400'
        }`}
      >
        <option value="">— No template (manual phase) —</option>
        {templates.map((t) => (
          <option key={t._id} value={t._id}>{t.name}</option>
        ))}
      </select>

      <div className="col-span-3 flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          value={delayDays}
          onChange={(e) => setDelayDays(e.target.value)}
          onBlur={() => save({ delayDays: Number(delayDays) || 0 })}
          className="w-16 text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400"
        />
        <span className="text-[11px] text-slate-400">
          {order === 1 ? 'days after joining' : 'days after previous'}
        </span>
      </div>
    </div>
  );
}

export function DripPhasePanel({ campaign }: { campaign: Doc<'crmDripCampaigns'> }) {
  const toast = useToast();
  const phases = useQuery(api.crm.dripCampaigns.listPhases, { dripCampaignId: campaign._id });
  const templates = useQuery(api.crm.email.listTemplates, {});
  const setAutomation = useMutation(api.crm.dripCampaigns.setAutomation);
  const setSendWindow = useMutation(api.crm.dripCampaigns.setSendWindow);
  const [busy, setBusy] = useState(false);

  const byOrder = new Map((phases ?? []).map((p) => [p.order, p]));
  const automatable = (phases ?? []).some((p) => p.templateId);

  const changeAutomation = async (automation: 'manual' | 'running' | 'paused') => {
    setBusy(true);
    try {
      await setAutomation({ dripCampaignId: campaign._id, automation });
      toast.success(
        automation === 'running'
          ? 'Campaign started — due phases will send on the next sweep'
          : automation === 'paused'
            ? 'Campaign paused. Nobody loses their place.'
            : 'Campaign handed back to manual control',
      );
    } catch (err) {
      toast.fromError(err, 'Could not change automation');
    } finally {
      setBusy(false);
    }
  };

  const window = {
    start: campaign.sendWindowStartHour,
    end: campaign.sendWindowEndHour,
    days: campaign.sendDays ?? [],
  };

  const saveWindow = async (patch: Partial<{ start?: number; end?: number; days: number[] }>) => {
    try {
      await setSendWindow({
        dripCampaignId: campaign._id,
        sendWindowStartHour: 'start' in patch ? patch.start : window.start,
        sendWindowEndHour: 'end' in patch ? patch.end : window.end,
        sendDays: patch.days ?? window.days,
      });
    } catch (err) {
      toast.fromError(err, 'Could not save the sending window');
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Automation</h2>
          <StatusBadge
            status={campaign.automation}
            tone={AUTOMATION_TONE[campaign.automation]}
            label={AUTOMATION_LABEL[campaign.automation]}
          />
        </div>
        <div className="flex items-center gap-2">
          {campaign.automation !== 'running' && (
            <button
              type="button"
              onClick={() => changeAutomation('running')}
              disabled={busy || !automatable}
              title={automatable ? undefined : 'Give at least one phase an email template first'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40"
            >
              <Play size={13} /> Start sending
            </button>
          )}
          {campaign.automation === 'running' && (
            <button
              type="button"
              onClick={() => changeAutomation('paused')}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-50"
            >
              <Pause size={13} /> Pause
            </button>
          )}
          {campaign.automation !== 'manual' && (
            <button
              type="button"
              onClick={() => changeAutomation('manual')}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              <Hand size={13} /> Manual
            </button>
          )}
        </div>
      </div>

      {!automatable && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            No phase has an email template yet, so this campaign can only be moved by hand. Give a phase a
            template below to let it send on its own.
          </p>
        </div>
      )}

      <div>
        <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 pb-1">
          <div className="col-span-1">Phase</div>
          <div className="col-span-3">Name</div>
          <div className="col-span-5">Email template</div>
          <div className="col-span-3">Delay</div>
        </div>
        {Array.from({ length: campaign.phaseCount }, (_, i) => i + 1).map((order) => (
          <PhaseRow
            key={order}
            campaign={campaign}
            order={order}
            config={byOrder.get(order)}
            templates={templates ?? []}
          />
        ))}
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock size={13} className="text-slate-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sending window</h3>
          <span className="text-[11px] text-slate-400">UTC — leave blank to send at any hour</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={window.start ?? ''}
            onChange={(e) => saveWindow({ start: e.target.value === '' ? undefined : Number(e.target.value) })}
            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5"
          >
            <option value="">Any hour</option>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
          </select>
          <span className="text-xs text-slate-400">to</span>
          <select
            value={window.end ?? ''}
            onChange={(e) => saveWindow({ end: e.target.value === '' ? undefined : Number(e.target.value) })}
            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5"
          >
            <option value="">Any hour</option>
            {Array.from({ length: 24 }, (_, h) => <option key={h + 1} value={h + 1}>{String(h + 1).padStart(2, '0')}:00</option>)}
          </select>

          <div className="flex items-center gap-1 ml-2">
            {WEEKDAYS.map((name, day) => {
              const active = window.days.length === 0 || window.days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    const current = window.days.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : window.days;
                    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort();
                    // All seven selected is the same as no restriction — store
                    // it as "no restriction" so the intent stays legible.
                    saveWindow({ days: next.length === 7 ? [] : next });
                  }}
                  className={`px-1.5 py-1 text-[11px] rounded border ${
                    active ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-400'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
