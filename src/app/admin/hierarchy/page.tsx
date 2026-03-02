'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import Link from 'next/link';
import { ChevronRight, Plus, Edit, Trash2 } from 'lucide-react';

/**
 * HIERARCHY ADMIN PAGE (Sites, Accounts, Groups)
 * 
 * CRUD interface for managing the organizational hierarchy
 */

type TabType = 'sites' | 'accounts' | 'groups';

export default function HierarchyAdmin() {
  const [activeTab, setActiveTab] = useState<TabType>('sites');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Query real data from Convex
  const sites = useQuery(api.admin.hierarchy.getSites) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Sites & Accounts & Groups</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          <Plus size={18} />
          Create New
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200">
        {(['sites', 'accounts', 'groups'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 border-b-2 font-semibold transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow">
        {activeTab === 'sites' && <SitesList sites={sites} />}
        {activeTab === 'accounts' && <AccountsList sites={sites} />}
        {activeTab === 'groups' && <GroupsList sites={sites} />}
      </div>

      {/* Modals would go here */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md">
            <h2 className="text-xl font-bold mb-4">Create New {activeTab.slice(0, -1)}</h2>
            <p className="text-slate-500 mb-6 text-sm">
              To create or modify sites, accounts, or groups, please contact your platform administrator.
            </p>
            <button
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 border border-slate-300 rounded hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SitesList({ sites }: { sites: any[] }) {
  return (
    <table className="w-full">
      <thead className="bg-slate-50 border-b border-slate-200">
        <tr>
          <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Name</th>
          <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Type</th>
          <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Domain</th>
          <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
          <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200">
        {sites.length === 0 ? (
          <tr>
            <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
              No sites found
            </td>
          </tr>
        ) : (
          sites.map((site) => (
            <tr key={site._id} className="hover:bg-slate-50">
              <td className="px-6 py-4 font-medium text-slate-900">{site.name}</td>
              <td className="px-6 py-4 text-slate-600">{site.type}</td>
              <td className="px-6 py-4 text-slate-600">{site.domain || '—'}</td>
              <td className="px-6 py-4">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                  {site.status}
                </span>
              </td>
              <td className="px-6 py-4 text-right flex gap-2 justify-end">
                <button className="p-1 hover:bg-slate-200 rounded">
                  <Edit size={16} />
                </button>
                <button className="p-1 hover:bg-red-100 rounded text-red-600">
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function AccountsList({ sites }: { sites: any[] }) {
  return (
    <div className="p-6 text-center text-slate-500">
      <p className="font-medium text-slate-600">No accounts configured yet</p>
      <p className="text-sm mt-1">Accounts will appear here once created during enrollment setup.</p>
    </div>
  );
}

function GroupsList({ sites }: { sites: any[] }) {
  return (
    <div className="p-6 text-center text-slate-500">
      <p className="font-medium text-slate-600">No groups configured yet</p>
      <p className="text-sm mt-1">Groups will appear here once created during enrollment setup.</p>
    </div>
  );
}
