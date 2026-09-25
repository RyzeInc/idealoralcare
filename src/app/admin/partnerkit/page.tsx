'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Breadcrumbs, SkeletonTable, useToast } from '@/components/admin/ui';
import { formatDateTime } from '@/lib/admin-format';
import { BookUser, Package, Download, Plus, X, Loader2, Send, CheckCircle2, ArrowRight } from 'lucide-react';

// Status values a lead can be manually set to. `invited` and `converted` are
// pipeline-driven and shown as read-only badges, not manual options.
const STATUSES = ['new', 'contacted', 'closed'] as const;
type Status = (typeof STATUSES)[number];

// All statuses usable as a filter (includes pipeline-driven states).
const FILTER_STATUSES = ['new', 'contacted', 'invited', 'converted', 'closed'] as const;
type FilterStatus = (typeof FILTER_STATUSES)[number];

interface BulkLeadRow {
  name: string;
  business: string;
  email: string;
  phone: string;
}

const EMPTY_ROW: BulkLeadRow = {
  name: '',
  business: '',
  email: '',
  phone: '',
};

function exportCSV(rows: any[]) {
  const headers = ['Name', 'Email', 'Phone', 'Business', 'Wants Partner Kit', 'Status', 'Submitted'];
  const data = rows.map((r) => [
    r.name,
    r.email,
    r.phone,
    r.business,
    r.wantsPartnerKit ? 'Yes' : 'No',
    r.status,
    formatDateTime(r.createdAt),
  ]);
  const csv = [headers, ...data]
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'partner-kit-leads.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function PartnerKitPage() {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<FilterStatus | ''>('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkLeadRow[]>(Array(5).fill(EMPTY_ROW).map(() => ({ ...EMPTY_ROW })));
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

  const rows = useQuery(api.contacts.getPartnerRegistrations, {
    status: statusFilter || undefined,
  });
  const updateStatus = useMutation(api.contacts.updatePartnerRegistrationStatus);
  const bulkAddLeads = useMutation((api as any).contacts.bulkAddPartnerRegistrations);
  const sendApplicationInvite = useAction(api.partnerPipeline.sendApplicationInvite);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const isLoading = rows === undefined;
  const wantsKit = (rows ?? []).filter((r: any) => r.wantsPartnerKit).length;

  const handleStatusChange = async (id: Id<'partnerRegistrations'>, status: Status) => {
    setUpdatingId(id);
    try {
      await updateStatus({ id, status });
      toast.success('Status updated');
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSendInvite = async (id: Id<'partnerRegistrations'>) => {
    setInvitingId(id);
    try {
      const res = await sendApplicationInvite({ leadId: id });
      if (res.inviteSent) {
        toast.success('Application invite sent', 'The lead will receive a prefilled application link.');
      } else {
        toast.warning('Invite recorded, email failed', res.error ?? 'You can resend from this row.');
      }
    } catch (err) {
      toast.fromError(err, 'Failed to send invite');
    } finally {
      setInvitingId(null);
    }
  };

  const handleBulkRowChange = (index: number, field: keyof BulkLeadRow, value: string) => {
    const newRows = [...bulkRows];
    newRows[index] = { ...newRows[index], [field]: value };
    setBulkRows(newRows);
  };

  const handleSubmitBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = bulkRows.filter((row) => row.name && row.email && row.phone && row.business);

    if (validRows.length === 0) {
      toast.warning('No valid leads', 'Please fill in at least one complete row (Name, Business, Email, Phone).');
      return;
    }

    setIsSubmittingBulk(true);
    try {
      const result = await bulkAddLeads({
        leads: validRows,
      });
      toast.success('Leads added', `${result.count} partner lead${result.count !== 1 ? 's' : ''} created successfully.`);
      setShowBulkModal(false);
      setBulkRows(Array(5).fill(EMPTY_ROW).map(() => ({ ...EMPTY_ROW })));
    } catch (err) {
      toast.fromError(err, 'Failed to add leads');
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Partner Kit Leads' }]} />

      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BookUser size={22} className="text-blue-600" />
            Partner Kit Leads
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Agencies and companies that registered via <span className="font-mono text-slate-700">/register</span>.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Kit request count */}
          {!isLoading && (
            <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-lg">
              <Package size={13} />
              {wantsKit} requested kit
            </div>
          )}

          {/* Add Leads Button */}
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 transition"
          >
            <Plus size={13} />
            Add Leads
          </button>

          {/* CSV Export */}
          <button
            onClick={() => rows && exportCSV(rows)}
            disabled={isLoading || !rows?.length}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-end gap-4">
        <div className="min-w-[160px]">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FilterStatus | '')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          >
            <option value="">All statuses</option>
            {FILTER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
        {!isLoading && (
          <p className="text-sm text-slate-500 pb-1">
            {rows?.length ?? 0} result{rows?.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <SkeletonTable rows={6} cols={6} />
        ) : rows?.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            No registrations yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Business</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Contact</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600 text-xs uppercase tracking-wide">Partner Kit</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Submitted</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Application</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows?.map((row: any) => (
                  <tr key={row._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                      {row.name}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {row.business}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{row.email}</div>
                      <div className="text-xs text-slate-400">{row.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.wantsPartnerKit ? (
                        <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-medium px-2 py-0.5 rounded-full">
                          <Package size={11} />
                          Yes
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {row.status === 'converted' ? (
                        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 text-xs font-medium px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={11} /> Converted
                        </span>
                      ) : row.status === 'invited' ? (
                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium px-2 py-0.5 rounded-full">
                          <Send size={11} /> Invited
                        </span>
                      ) : (
                        <select
                          value={row.status}
                          onChange={(e) =>
                            handleStatusChange(row._id, e.target.value as Status)
                          }
                          disabled={updatingId === row._id}
                          className="text-xs border border-slate-300 rounded-md px-2 py-1 bg-white disabled:opacity-50 cursor-pointer"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.convertedToApplicationId ? (
                        <Link
                          href="/admin/partner-applications"
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900"
                        >
                          View application <ArrowRight size={12} />
                        </Link>
                      ) : (
                        <button
                          onClick={() => handleSendInvite(row._id)}
                          disabled={invitingId === row._id}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
                        >
                          {invitingId === row._id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Send size={12} />
                          )}
                          {row.status === 'invited' ? 'Resend invite' : 'Send invite'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk Add Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Add Partner Leads</h2>
              <button
                onClick={() => setShowBulkModal(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitBulk} className="p-6">
              <p className="text-sm text-slate-600 mb-4">
                Add up to 5 leads at a time. Complete at least one row to proceed.
              </p>

              {/* Table */}
              <div className="overflow-x-auto mb-6">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-3 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Name</th>
                      <th className="px-3 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Business</th>
                      <th className="px-3 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Email</th>
                      <th className="px-3 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Phone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bulkRows.map((row, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            placeholder="Full name"
                            value={row.name}
                            onChange={(e) => handleBulkRowChange(index, 'name', e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            placeholder="Business/Agency"
                            value={row.business}
                            onChange={(e) => handleBulkRowChange(index, 'business', e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="email"
                            placeholder="Email"
                            value={row.email}
                            onChange={(e) => handleBulkRowChange(index, 'email', e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="tel"
                            placeholder="Phone"
                            value={row.phone}
                            onChange={(e) => handleBulkRowChange(index, 'phone', e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Modal Footer */}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBulk}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                >
                  {isSubmittingBulk && <Loader2 size={14} className="animate-spin" />}
                  Add Leads
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
