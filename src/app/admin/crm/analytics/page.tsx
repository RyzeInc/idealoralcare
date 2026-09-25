'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area, Cell,
} from 'recharts';
import { api } from '@/convex/_generated/api';
import { Breadcrumbs } from '@/components/admin/ui';
import { Card, SectionHeader } from '@/components/admin/crm/primitives';
import { STAGE_ORDER, STAGE_LABELS } from '@/components/admin/crm/constants';
import { formatCurrency } from '@/lib/admin-format';
import {
  SERIES_BLUE, SERIES_ORANGE, SERIES_AQUA, STATUS_GOOD, STATUS_WARNING, STATUS_CRITICAL, sequentialStep,
} from '@/lib/crm/vizColors';
import { TrendingUp, Filter, Clock3, Phone, BarChart3, Mail, Users } from 'lucide-react';

const AXIS_STYLE = { fontSize: 12, fill: '#94a3b8' };
const GRID_STYLE = { stroke: '#f1f5f9' };
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const CALL_OUTCOME_STATUS: Record<string, 'good' | 'warning' | 'critical'> = {
  connected: 'good',
  no_answer: 'warning', voicemail: 'warning', gatekeeper: 'warning', callback_requested: 'warning',
  wrong_number: 'critical', bad_number: 'critical', not_interested: 'critical', do_not_call: 'critical',
};
const STATUS_COLOR = { good: STATUS_GOOD, warning: STATUS_WARNING, critical: STATUS_CRITICAL };

function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function CrmAnalyticsPage() {
  const [windowDays, setWindowDays] = useState(90);
  // `from` is recomputed in the select's onChange (an event handler), not
  // derived from Date.now() in the render body — the window boundary only
  // needs to move when the user picks a new range, not on every re-render.
  const [from, setFrom] = useState(() => Date.now() - 90 * ONE_DAY_MS);

  const handleWindowChange = (days: number) => {
    setWindowDays(days);
    setFrom(Date.now() - days * ONE_DAY_MS);
  };

  const pipeline = useQuery(api.crm.analytics.pipelineSummary, {});
  const touches = useQuery(api.crm.analytics.touchesToConvert, { from });
  const funnel = useQuery(api.crm.analytics.funnelByStage, { from });
  const velocity = useQuery(api.crm.analytics.stageVelocity, { from });
  const leaderboard = useQuery(api.crm.analytics.activityLeaderboard, { from });
  const callOutcomes = useQuery(api.crm.analytics.callOutcomeBreakdown, { from });
  const campaigns = useQuery(api.crm.analytics.campaignPerformance, {});
  const activityOverTime = useQuery(api.crm.analytics.activityOverTime, { from });

  const pipelineByStage = STAGE_ORDER.map((stage) => {
    const row = pipeline?.find((p) => p.stage === stage);
    return {
      stage: STAGE_LABELS[stage],
      gross: (row?.grossMrrCents ?? 0) / 100,
      weighted: (row?.weightedMrrCents ?? 0) / 100,
      count: row?.count ?? 0,
    };
  });

  const funnelByStage = STAGE_ORDER.map((stage, i) => ({
    stage: STAGE_LABELS[stage],
    count: funnel?.find((f) => f.stage === stage)?.count ?? 0,
    fill: sequentialStep(i, STAGE_ORDER.length),
  }));

  const velocityByStage = STAGE_ORDER.map((stage, i) => ({
    stage: STAGE_LABELS[stage],
    medianDays: velocity?.find((v) => v.stage === stage)?.medianDays ?? 0,
    fill: sequentialStep(i, STAGE_ORDER.length),
  }));

  const activityOverTimeFormatted = (activityOverTime ?? []).map((w) => ({
    week: new Date(w.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    Calls: w.calls,
    Emails: w.emails,
  }));

  const outcomeChartData = (callOutcomes?.byOutcome ?? []).map((o) => ({
    outcome: o.outcome.replace(/_/g, ' '),
    count: o.count,
    fill: STATUS_COLOR[CALL_OUTCOME_STATUS[o.outcome] ?? 'warning'],
  }));

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'CRM', href: '/admin/crm' }, { label: 'Analytics' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
        <select value={windowDays} onChange={(e) => handleWindowChange(Number(e.target.value))} className="text-sm border border-slate-300 rounded-lg px-2 py-1.5">
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      {/* Touches to convert — median first, mean is easily dominated by one whale deal */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Median Emails to Convert" value={touches?.emails.median ?? 0} sub={`n=${touches?.emails.n ?? 0}, mean ${touches?.emails.mean.toFixed(1) ?? 0}`} />
        <StatTile label="Median Calls to Convert" value={touches?.calls.median ?? 0} sub={`n=${touches?.calls.n ?? 0}, mean ${touches?.calls.mean.toFixed(1) ?? 0}`} />
        <StatTile label="Median Days to Close" value={touches?.daysToClose.median ?? 0} sub={`p90 ${touches?.daysToClose.p90 ?? 0}`} />
        <StatTile label="Call Connect Rate" value={`${callOutcomes?.connectRate ?? 0}%`} sub={`of ${callOutcomes?.total ?? 0} calls`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionHeader icon={TrendingUp} title="Pipeline by Stage" badge={<span className="text-xs text-slate-400">Gross vs. weighted MRR</span>} />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={pipelineByStage} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid horizontal={false} stroke={GRID_STYLE.stroke} />
              <XAxis type="number" tick={AXIS_STYLE} tickFormatter={(v) => formatCurrency(v)} />
              <YAxis type="category" dataKey="stage" tick={AXIS_STYLE} width={80} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="gross" name="Gross MRR" fill={SERIES_BLUE} radius={[0, 4, 4, 0]} />
              <Bar dataKey="weighted" name="Weighted MRR" fill={SERIES_ORANGE} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionHeader icon={Filter} title="Funnel — Entries by Stage" />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={funnelByStage} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid horizontal={false} stroke={GRID_STYLE.stroke} />
              <XAxis type="number" tick={AXIS_STYLE} allowDecimals={false} />
              <YAxis type="category" dataKey="stage" tick={AXIS_STYLE} width={80} />
              <Tooltip />
              <Bar dataKey="count" name="Entered stage" radius={[0, 4, 4, 0]}>
                {funnelByStage.map((entry) => <Cell key={entry.stage} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionHeader icon={Clock3} title="Stage Velocity" badge={<span className="text-xs text-slate-400">Median days in stage</span>} />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={velocityByStage} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid horizontal={false} stroke={GRID_STYLE.stroke} />
              <XAxis type="number" tick={AXIS_STYLE} allowDecimals={false} />
              <YAxis type="category" dataKey="stage" tick={AXIS_STYLE} width={80} />
              <Tooltip />
              <Bar dataKey="medianDays" name="Median days" radius={[0, 4, 4, 0]}>
                {velocityByStage.map((entry) => <Cell key={entry.stage} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionHeader icon={Phone} title="Call Outcomes" />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={outcomeChartData} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid horizontal={false} stroke={GRID_STYLE.stroke} />
              <XAxis type="number" tick={AXIS_STYLE} allowDecimals={false} />
              <YAxis type="category" dataKey="outcome" tick={AXIS_STYLE} width={90} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {outcomeChartData.map((entry) => <Cell key={entry.outcome} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <SectionHeader icon={Mail} title="Activity Over Time" badge={<span className="text-xs text-slate-400">Weekly, outbound touches</span>} />
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={activityOverTimeFormatted}>
            <CartesianGrid stroke={GRID_STYLE.stroke} />
            <XAxis dataKey="week" tick={AXIS_STYLE} />
            <YAxis tick={AXIS_STYLE} allowDecimals={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="Calls" stackId="1" stroke={SERIES_BLUE} fill={SERIES_BLUE} fillOpacity={0.25} />
            <Area type="monotone" dataKey="Emails" stackId="1" stroke={SERIES_ORANGE} fill={SERIES_ORANGE} fillOpacity={0.25} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionHeader icon={Users} title="Rep Leaderboard" badge={<span className="text-xs text-slate-400">Touches this window</span>} />
          <ResponsiveContainer width="100%" height={Math.max(200, (leaderboard?.length ?? 0) * 36)}>
            <BarChart data={leaderboard ?? []} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid horizontal={false} stroke={GRID_STYLE.stroke} />
              <XAxis type="number" tick={AXIS_STYLE} allowDecimals={false} />
              <YAxis type="category" dataKey="actorName" tick={AXIS_STYLE} width={100} />
              <Tooltip />
              <Bar dataKey="total" name="Total touches" fill={SERIES_BLUE} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionHeader icon={BarChart3} title="Campaign Performance" />
          <ResponsiveContainer width="100%" height={Math.max(200, (campaigns?.length ?? 0) * 50)}>
            <BarChart data={campaigns ?? []} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid horizontal={false} stroke={GRID_STYLE.stroke} />
              <XAxis type="number" tick={AXIS_STYLE} unit="%" />
              <YAxis type="category" dataKey="name" tick={AXIS_STYLE} width={100} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="deliveredRate" name="Delivered %" fill={SERIES_BLUE} radius={[0, 4, 4, 0]} />
              <Bar dataKey="openRate" name="Open %" fill={SERIES_ORANGE} radius={[0, 4, 4, 0]} />
              <Bar dataKey="clickRate" name="Click %" fill={SERIES_AQUA} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {(campaigns ?? []).length === 0 && <p className="text-sm text-slate-400 text-center py-8">No campaigns sent yet.</p>}
        </Card>
      </div>
    </div>
  );
}
