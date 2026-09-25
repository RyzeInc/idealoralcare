'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Plus, Pencil, Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Breadcrumbs, Modal, useToast } from '@/components/admin/ui';
import { TagChip } from '@/components/admin/crm/TagChip';
import { CRM_TAG_COLORS } from '@/components/admin/crm/constants';

function CategoryModal({ open, onClose, editing }: {
  open: boolean;
  onClose: () => void;
  editing: { _id: Id<'crmTagCategories'>; name: string; description?: string; color: string; isExclusive: boolean; isPrimaryFilter: boolean } | null;
}) {
  const toast = useToast();
  const createCategory = useMutation(api.crm.tags.createCategory);
  const updateCategory = useMutation(api.crm.tags.updateCategory);
  const [name, setName] = useState(editing?.name ?? '');
  const [color, setColor] = useState(editing?.color ?? 'blue');
  const [isExclusive, setIsExclusive] = useState(editing?.isExclusive ?? false);
  const [isPrimaryFilter, setIsPrimaryFilter] = useState(editing?.isPrimaryFilter ?? false);
  const [appliesTo, setAppliesTo] = useState<'contact' | 'company' | 'both'>('contact');

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      if (editing) {
        await updateCategory({ categoryId: editing._id, name: name.trim(), color, isExclusive, isPrimaryFilter });
      } else {
        await createCategory({ name: name.trim(), color, isExclusive, isPrimaryFilter, appliesTo });
      }
      toast.success(editing ? 'Category updated' : 'Category created');
      onClose();
    } catch (err) {
      toast.fromError(err, 'Could not save category');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Category' : 'New Tag Category'} size="max-w-md">
      <div className="space-y-3">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Location, Industry"
          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
        />
        <div>
          <p className="text-xs text-slate-500 mb-1.5">Color</p>
          <div className="flex gap-1.5 flex-wrap">
            {Object.keys(CRM_TAG_COLORS).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`px-2 py-1 rounded-full text-xs font-medium border ${CRM_TAG_COLORS[c]} ${color === c ? 'ring-2 ring-offset-1 ring-blue-300' : ''}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={isExclusive} onChange={(e) => setIsExclusive(e.target.checked)} className="rounded border-slate-300" />
          Single-select (applying a second tag replaces the first)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={isPrimaryFilter} onChange={(e) => setIsPrimaryFilter(e.target.checked)} className="rounded border-slate-300" />
          Show as a filter chip row on the contacts list
        </label>
        {!editing && (
          <div>
            <p className="text-xs text-slate-500 mb-1">Applies to</p>
            <select value={appliesTo} onChange={(e) => setAppliesTo(e.target.value as typeof appliesTo)} className="text-sm border border-slate-300 rounded-lg px-2 py-1.5">
              <option value="contact">Contacts</option>
              <option value="company">Companies</option>
              <option value="both">Both</option>
            </select>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          <button type="button" onClick={handleSave} disabled={!name.trim()} className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40">
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function TagsPage() {
  const toast = useToast();
  const tree = useQuery(api.crm.tags.listTagTree, { includeArchived: true });
  const createTag = useMutation(api.crm.tags.createTag);
  const archiveTag = useMutation(api.crm.tags.archiveTag);
  const deleteCategory = useMutation(api.crm.tags.deleteCategory);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Parameters<typeof CategoryModal>[0]['editing']>(null);
  const [newTagInputs, setNewTagInputs] = useState<Record<string, string>>({});

  const handleAddTag = async (categoryId: Id<'crmTagCategories'>) => {
    const name = newTagInputs[categoryId]?.trim();
    if (!name) return;
    await createTag({ categoryId, name });
    setNewTagInputs((prev) => ({ ...prev, [categoryId]: '' }));
  };

  const handleDeleteCategory = async (categoryId: Id<'crmTagCategories'>) => {
    try {
      await deleteCategory({ categoryId });
      toast.success('Category deleted');
    } catch (err) {
      toast.fromError(err, 'Could not delete category');
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'CRM', href: '/admin/crm' }, { label: 'Tags' }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tags</h1>
          <p className="text-sm text-slate-500 mt-0.5">Location and industry are the two Jon uses most for building lists.</p>
        </div>
        <button
          type="button"
          onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus size={14} /> New Category
        </button>
      </div>

      <div className="space-y-4">
        {(tree ?? []).map(({ category, tags }) => (
          <div key={category._id} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{category.name}</h2>
                {category.isExclusive && <p className="text-xs text-slate-400">Single-select</p>}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setEditingCategory(category); setShowCategoryModal(true); }} className="text-slate-400 hover:text-slate-700" aria-label="Edit category">
                  <Pencil size={13} />
                </button>
                <button type="button" onClick={() => handleDeleteCategory(category._id)} className="text-slate-400 hover:text-red-600" aria-label="Delete category">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map((tag) => (
                <div key={tag._id} className="flex items-center gap-1">
                  <TagChip name={`${tag.name} (${tag.contactCount})`} color={tag.color ?? category.color} />
                  <button
                    type="button"
                    onClick={() => archiveTag({ tagId: tag._id, archived: !tag.isArchived })}
                    className="text-slate-300 hover:text-slate-600"
                    title={tag.isArchived ? 'Restore' : 'Archive'}
                  >
                    {tag.isArchived ? <ArchiveRestore size={11} /> : <Archive size={11} />}
                  </button>
                </div>
              ))}
              {tags.length === 0 && <span className="text-xs text-slate-400">No tags yet.</span>}
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newTagInputs[category._id] ?? ''}
                onChange={(e) => setNewTagInputs((prev) => ({ ...prev, [category._id]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(category._id); }}
                placeholder={`New ${category.name.toLowerCase()} tag…`}
                className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400"
              />
              <button type="button" onClick={() => handleAddTag(category._id)} className="text-sm text-blue-600 hover:text-blue-800">Add</button>
            </div>
          </div>
        ))}
        {(tree ?? []).length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-sm">
            No tag categories yet. Create one to get started — Location and Industry are good places to start.
          </div>
        )}
      </div>

      <CategoryModal open={showCategoryModal} onClose={() => setShowCategoryModal(false)} editing={editingCategory} />
    </div>
  );
}
