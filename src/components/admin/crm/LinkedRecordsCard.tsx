'use client';

/**
 * LINKED RECORDS — inline summaries of the member / partner / group worlds a
 * CRM record points at.
 *
 * This replaced a bare "View member record →" hyperlink. The link was
 * technically correct and practically useless: a rep about to dial someone
 * needs to know *before* clicking that this person is already an active member,
 * or that their agency is a suspended partner — leaving the CRM to find that
 * out means it doesn't get checked.
 *
 * Read-only by design. Everything here is a display projection; nothing on this
 * card grants access to, or edits, the underlying member/partner record.
 */

import Link from 'next/link';
import { useQuery } from 'convex/react';
import { Link2, ShieldCheck, Users, Download } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { formatCurrency, formatDate, humanize } from '@/lib/admin-format';
import { Card, SectionHeader } from './primitives';
import { StatusBadge, Tooltip, type StatusTone } from '@/components/admin/ui';

const MEMBER_TONE: Record<string, StatusTone> = {
  active: 'success',
  inactive: 'neutral',
  suspended: 'warning',
  terminated: 'danger',
};

const PARTNER_TONE: Record<string, StatusTone> = {
  active: 'success',
  inactive: 'neutral',
  suspended: 'danger',
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-xs text-slate-700 text-right">{children}</span>
    </div>
  );
}

export function ContactLinkedRecordsCard({ contactId }: { contactId: Id<'crmContacts'> }) {
  const data = useQuery(api.crm.linkedRecords.contactLinkedRecords, { contactId });
  if (!data) return null;

  const { member, partner, leader, commissions, recentDownloads } = data;
  if (!member && !partner) return null;

  return (
    <Card>
      <SectionHeader icon={Link2} title="Linked Records" />
      <div className="space-y-4">
        {member && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                <ShieldCheck size={11} className="text-slate-400" /> Member
              </span>
              <StatusBadge status={member.status} tone={MEMBER_TONE[member.status] ?? 'neutral'} />
            </div>
            <Row label="Member ID">
              <span className="font-mono">{member.memberId}</span>
            </Row>
            {member.tierCode && <Row label="Tier">{member.tierCode}</Row>}
            <Row label="Since">{formatDate(member.memberSince)}</Row>
            <Link href={`/admin/members/${member.id}`} className="text-xs text-blue-600 hover:underline block pt-0.5">
              Open member record →
            </Link>
          </div>
        )}

        {partner && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                <Users size={11} className="text-slate-400" /> Partner
              </span>
              <StatusBadge status={partner.status} tone={PARTNER_TONE[partner.status] ?? 'neutral'} />
            </div>
            <Row label="Agency">{partner.name}</Row>
            <Row label="Type">{humanize(partner.type)}</Row>
            {partner.agencyCode && (
              <Row label="Agency code"><span className="font-mono">{partner.agencyCode}</span></Row>
            )}
            {leader?.title && <Row label="Role">{leader.title}</Row>}

            {commissions && (commissions.approvedCents > 0 || commissions.pendingCents > 0) && (
              <>
                <Row label="Commission paid">{formatCurrency(commissions.approvedCents / 100)}</Row>
                {commissions.pendingCents > 0 && (
                  <Row label="Pending">{formatCurrency(commissions.pendingCents / 100)}</Row>
                )}
              </>
            )}
            {commissions && commissions.excludedLegacyRows > 0 && (
              <Tooltip text="Legacy commission rows keyed by tracking code rather than leader ID are excluded — their stored rate is not trustworthy to report on.">
                <p className="text-xs text-amber-600 cursor-help">
                  {commissions.excludedLegacyRows} legacy row{commissions.excludedLegacyRows === 1 ? '' : 's'} excluded
                </p>
              </Tooltip>
            )}
            {recentDownloads > 0 && (
              <Row label="Resource activity">
                <span className="inline-flex items-center gap-1">
                  <Download size={10} className="text-slate-400" /> {recentDownloads} recent
                </span>
              </Row>
            )}
            <Link href={`/admin/hierarchy`} className="text-xs text-blue-600 hover:underline block pt-0.5">
              Open in hierarchy →
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}

export function CompanyLinkedRecordsCard({ companyId }: { companyId: Id<'crmCompanies'> }) {
  const data = useQuery(api.crm.linkedRecords.companyLinkedRecords, { companyId });
  if (!data) return null;

  const { account, group, partner } = data;
  if (!account && !group && !partner) return null;

  return (
    <Card>
      <SectionHeader icon={Link2} title="Linked Records" />
      <div className="space-y-4">
        {group && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-slate-600">Enrolled group</span>
            <Row label="Group">{group.name}</Row>
            {/* The number that makes a deal honest: quoted lives vs actual. */}
            <Row label="Active members">{group.enrolledMembers.toLocaleString()}</Row>
            <Link href={`/admin/hierarchy`} className="text-xs text-blue-600 hover:underline block pt-0.5">
              Open group →
            </Link>
          </div>
        )}

        {account && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-slate-600">Account</span>
            <Row label="Name">{account.name}</Row>
          </div>
        )}

        {partner && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">Distribution partner</span>
              <StatusBadge status={partner.status} tone={PARTNER_TONE[partner.status] ?? 'neutral'} />
            </div>
            <Row label="Name">{partner.name}</Row>
            <Row label="Type">{humanize(partner.type)}</Row>
          </div>
        )}
      </div>
    </Card>
  );
}
