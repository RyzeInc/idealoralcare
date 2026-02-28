'use client';

import { useState } from 'react';
import { Search, Eye, Edit, Trash2, Filter } from 'lucide-react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

/**
 * MEMBERS ADMIN PAGE
 * 
 * Member roster, search, filtering, and status management
 */

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-800',
  enrolling: 'bg-blue-100 text-blue-800',
  eligible: 'bg-yellow-100 text-yellow-800',
  inactive: 'bg-gray-100 text-gray-800',
  terminated: 'bg-red-100 text-red-800',
  declined: 'bg-orange-100 text-orange-800',
  lead: 'bg-purple-100 text-purple-800',
};

export default function MembersAdmin() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);

  // Query real data from Convex
  const members = useQuery(api.admin.members.getAllMembers) || [];

  const filteredMembers = members.filter((member: any) => {
    const matchesSearch = (member.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (member.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (member.memberId || '').includes(searchQuery);

    const matchesStatus = !selectedStatus || member.memberType === selectedStatus;

    return matchesSearch && matchesStatus;
  });

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
          <option value="lead">Lead</option>
          <option value="eligible">Eligible</option>
          <option value="enrolling">Enrolling</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="terminated">Terminated</option>
          <option value="declined">Declined</option>
        </select>
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Email</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Member ID</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Join Date</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                  No members found
                </td>
              </tr>
            ) : (
              filteredMembers.map((member) => (
                <tr key={member._id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{member.firstName} {member.lastName}</td>
                  <td className="px-6 py-4 text-slate-600">{member.email}</td>
                  <td className="px-6 py-4 text-slate-600 font-mono text-sm">{member.memberId}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        STATUS_COLORS[member.memberType]
                      }`}
                    >
                      {member.memberType}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {member.enrolledAt ? new Date(member.enrolledAt).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-right flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setSelectedMember(member);
                        setShowDetailModal(true);
                      }}
                      className="p-2 hover:bg-blue-100 rounded text-blue-600"
                    >
                      <Eye size={16} />
                    </button>
                    <button className="p-2 hover:bg-slate-200 rounded">
                      <Edit size={16} />
                    </button>
                    <button className="p-2 hover:bg-red-100 rounded text-red-600">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Results count */}
      <div className="text-sm text-slate-600">
        Showing {filteredMembers.length} of {members.length} members
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md max-h-96 overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{selectedMember.firstName} {selectedMember.lastName}</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-slate-600">Email</dt>
                <dd className="font-medium">{selectedMember.email}</dd>
              </div>
              <div>
                <dt className="text-slate-600">Member ID</dt>
                <dd className="font-medium font-mono">{selectedMember.memberId}</dd>
              </div>
              <div>
                <dt className="text-slate-600">Status</dt>
                <dd className="font-medium">{selectedMember.memberType}</dd>
              </div>
              <div>
                <dt className="text-slate-600">Enrolled Date</dt>
                <dd className="font-medium">
                  {selectedMember.enrolledAt ? new Date(selectedMember.enrolledAt).toLocaleDateString() : 'N/A'}
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setShowDetailModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded hover:bg-slate-50"
              >
                Close
              </button>
              <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Edit Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
