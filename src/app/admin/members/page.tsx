'use client';

import { useState } from 'react';
import { Search, Eye, Edit, Trash2, X, Clock, Send, CreditCard } from 'lucide-react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { FunctionReference } from 'convex/server';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  enrolling: 'bg-blue-100 text-blue-800',
  eligible: 'bg-yellow-100 text-yellow-800',
  inactive: 'bg-gray-100 text-gray-800',
  terminated: 'bg-red-100 text-red-800',
  declined: 'bg-orange-100 text-orange-800',
  lead: 'bg-purple-100 text-purple-800',
};

const ALL_STATUSES = ['lead', 'eligible', 'enrolling', 'active', 'inactive', 'terminated', 'declined'] as const;

export default function MembersAdmin() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);
  const [selectedMemberId, setSelectedMemberId] = useState<Id<'memberProfiles'> | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusTarget, setStatusTarget] = useState<{ id: Id<'memberProfiles'>; name: string; current: string } | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState<string>('general');

  const members = useQuery(api.admin.members.getAllMembers) || [];
  const memberDetail = useQuery(
    api.admin.members.getMemberDetail,
    selectedMemberId ? { memberId: selectedMemberId } : 'skip'
  );
  const updateStatus = useMutation(api.admin.members.updateMemberStatus);
  const removeMember = useMutation(api.admin.members.removeMember);
  const addNote = useMutation(api.admin.members.addMemberNote);
  const generateIdCard = useAction(
    "admin/memberCards:generateMemberIdCardPdf" as unknown as FunctionReference<"action", "public", { memberId: Id<'memberProfiles'> }, any>
  );

  const filteredMembers = members.filter((member: any) => {
    const memberName = `${member.firstName || ''} ${member.lastName || ''}`.toLowerCase();
    const matchesSearch = memberName.includes(searchQuery.toLowerCase()) ||
      (member.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (member.memberId || '').includes(searchQuery);
    const matchesStatus = !selectedStatus || member.memberType === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = async () => {
    if (!statusTarget || !newStatus) return;
    try {
      await updateStatus({
        memberId: statusTarget.id,
        newStatus: newStatus as any,
        reason: statusReason || undefined,
      });
      setShowStatusModal(false);
      setStatusTarget(null);
      setNewStatus('');
      setStatusReason('');
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (id: Id<'memberProfiles'>, name: string) => {
    if (!confirm(`Terminate member "${name}"? This marks them as terminated.`)) return;
    try {
      await removeMember({ memberId: id, reason: 'Removed via admin panel' });
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleAddNote = async () => {
    if (!selectedMemberId || !noteContent.trim()) return;
    try {
      await addNote({
        memberId: selectedMemberId,
        content: noteContent.trim(),
        noteType: noteType as any,
      });
      setNoteContent('');
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Members</h1>
        <p className="text-slate-600">Manage member profiles and enrollment status</p>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-64 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search by name, email, or member ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={selectedStatus || ''}
          onChange={(e) => setSelectedStatus(e.target.value || undefined)}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      <div className="flex gap-6">
        {/* Members Table */}
        <div className={`bg-white rounded-lg shadow overflow-hidden ${selectedMemberId ? 'flex-1' : 'w-full'}`}>
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Member ID</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No members found</td>
                </tr>
              ) : (
                filteredMembers.map((member: any) => (
                  <tr key={member._id} className={`hover:bg-slate-50 cursor-pointer ${selectedMemberId === member._id ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedMemberId(member._id)}>
                    <td className="px-6 py-4 font-medium text-slate-900">{member.firstName} {member.lastName}</td>
                    <td className="px-6 py-4 text-slate-600 text-sm">{member.email}</td>
                    <td className="px-6 py-4 text-slate-600 font-mono text-sm">{member.memberId}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[member.memberType] || 'bg-gray-100'}`}>
                        {member.memberType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setSelectedMemberId(member._id)} className="p-2 hover:bg-blue-100 rounded text-blue-600" title="View">
                          <Eye size={16} />
                        </button>
                        <button onClick={() => {
                          setStatusTarget({ id: member._id, name: `${member.firstName} ${member.lastName}`, current: member.memberType });
                          setNewStatus('');
                          setShowStatusModal(true);
                        }} className="p-2 hover:bg-slate-200 rounded" title="Change Status">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(member._id, `${member.firstName} ${member.lastName}`)} className="p-2 hover:bg-red-100 rounded text-red-600" title="Terminate">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="px-6 py-3 border-t border-slate-200 text-sm text-slate-600">
            Showing {filteredMembers.length} of {members.length} members
          </div>
        </div>

        {/* Detail Drawer */}
        {selectedMemberId && memberDetail && (
          <div className="w-96 bg-white rounded-lg shadow overflow-y-auto max-h-[calc(100vh-200px)] flex-shrink-0">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-slate-900">Member Detail</h3>
              <button onClick={() => setSelectedMemberId(null)} className="p-1 hover:bg-slate-100 rounded">
                <X size={16} />
              </button>
            </div>

            {/* Profile */}
            <div className="px-6 py-4 border-b border-slate-100">
              <h4 className="text-lg font-semibold text-slate-900">
                {memberDetail.member.firstName} {memberDetail.member.lastName}
              </h4>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">Email</dt><dd className="font-medium">{memberDetail.member.email || '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Member ID</dt><dd className="font-mono font-medium">{memberDetail.member.memberId}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Status</dt><dd><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[memberDetail.member.memberType] || ''}`}>{memberDetail.member.memberType}</span></dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Phone</dt><dd>{memberDetail.member.phone || '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">DOB</dt><dd>{memberDetail.member.dateOfBirth || '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Enrolled</dt><dd>{memberDetail.member.enrolledAt ? new Date(memberDetail.member.enrolledAt).toLocaleDateString() : '—'}</dd></div>
              </dl>
              <button
                onClick={async () => {
                  try {
                    const result = await generateIdCard({ memberId: selectedMemberId! });
                    if (result?.htmlContent) {
                      const win = window.open('', '_blank');
                      if (win) { win.document.write(result.htmlContent); win.document.close(); }
                    }
                  } catch (err) {
                    alert(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                  }
                }}
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <CreditCard size={14} />
                Download ID Card
              </button>
            </div>

            {/* Entitlements */}
            {memberDetail.entitlements.length > 0 && (
              <div className="px-6 py-4 border-b border-slate-100">
                <h5 className="text-sm font-semibold text-slate-900 mb-2">Entitlements ({memberDetail.entitlements.length})</h5>
                <div className="space-y-1">
                  {memberDetail.entitlements.map((ent: any) => (
                    <div key={ent._id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-700">{ent.productId?.toString().slice(-6)}</span>
                      <span className={`px-2 py-0.5 rounded-full ${ent.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {ent.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="px-6 py-4 border-b border-slate-100">
              <h5 className="text-sm font-semibold text-slate-900 mb-2">Notes ({memberDetail.notes.length})</h5>
              {memberDetail.notes.length > 0 && (
                <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                  {memberDetail.notes.map((note: any) => (
                    <div key={note._id} className="p-2 bg-slate-50 rounded text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="font-medium text-slate-700">{note.authorName}</span>
                        <span className="text-slate-400">{new Date(note.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-slate-600">{note.content}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <select value={noteType} onChange={e => setNoteType(e.target.value)} className="px-2 py-1.5 text-xs border border-slate-300 rounded">
                  <option value="general">General</option>
                  <option value="enrollment">Enrollment</option>
                  <option value="billing">Billing</option>
                  <option value="support">Support</option>
                  <option value="follow_up">Follow Up</option>
                </select>
                <input
                  type="text"
                  placeholder="Add a note..."
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                  className="flex-1 px-2 py-1.5 text-xs border border-slate-300 rounded"
                />
                <button onClick={handleAddNote} disabled={!noteContent.trim()} className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40">
                  <Send size={12} />
                </button>
              </div>
            </div>

            {/* Activity Timeline */}
            <div className="px-6 py-4">
              <h5 className="text-sm font-semibold text-slate-900 mb-2">Activity Timeline ({memberDetail.activities.length})</h5>
              {memberDetail.activities.length === 0 ? (
                <p className="text-xs text-slate-400">No activity yet</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {memberDetail.activities.slice(0, 20).map((a: any) => (
                    <div key={a._id} className="flex items-start gap-2 text-xs">
                      <Clock size={12} className="text-slate-400 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-700 truncate">{a.title}</p>
                        <p className="text-slate-400">{new Date(a.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status Change Modal */}
      {showStatusModal && statusTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-bold mb-1">Change Status</h2>
            <p className="text-sm text-slate-500 mb-4">{statusTarget.name} — current: <span className="font-medium">{statusTarget.current}</span></p>
            <select
              value={newStatus}
              onChange={e => setNewStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-3"
            >
              <option value="">Select new status...</option>
              {ALL_STATUSES.filter(s => s !== statusTarget.current).map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Reason (optional)"
              value={statusReason}
              onChange={e => setStatusReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowStatusModal(false); setStatusTarget(null); }} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={handleStatusChange} disabled={!newStatus} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40">Update</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
