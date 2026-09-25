'use client';

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useMutation, useQuery } from 'convex/react';
import { Plus, Check } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { tagColorClass } from './constants';

interface TagPickerProps {
  contactId?: Id<'crmContacts'>;
  companyId?: Id<'crmCompanies'>;
  currentTagIds: Id<'crmTags'>[];
  /** Scope the picker to one category (e.g. TagsColumn's per-category "+ Add"). Omit to browse all categories. */
  categoryId?: Id<'crmTagCategories'>;
}

export function TagPicker({ contactId, companyId, currentTagIds, categoryId }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const tree = useQuery(api.crm.tags.listTagTree, {});
  const applyTags = useMutation(api.crm.tags.applyTags);
  const removeTags = useMutation(api.crm.tags.removeTags);
  const createTag = useMutation(api.crm.tags.createTag);

  const groups = (tree ?? []).filter((g) => !categoryId || g.category._id === categoryId);

  const toggle = async (tagId: Id<'crmTags'>, isApplied: boolean) => {
    if (isApplied) {
      await removeTags({ contactId, companyId, tagIds: [tagId] });
    } else {
      await applyTags({ contactId, companyId, tagIds: [tagId] });
    }
  };

  const handleCreate = async (catId: Id<'crmTagCategories'>) => {
    if (!newTagName.trim()) return;
    const tagId = await createTag({ categoryId: catId, name: newTagName.trim() });
    await applyTags({ contactId, companyId, tagIds: [tagId] });
    setNewTagName('');
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-0.5 rounded-full border border-dashed border-slate-300 hover:border-slate-400"
        >
          <Plus size={11} /> Add
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          className="z-50 w-72 max-h-96 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg p-3 space-y-3"
        >
          {groups.length === 0 && <p className="text-xs text-slate-400">No tag categories yet.</p>}
          {groups.map(({ category, tags }) => (
            <div key={category._id}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{category.name}</p>
              <div className="space-y-0.5">
                {tags.map((tag) => {
                  const applied = currentTagIds.includes(tag._id);
                  return (
                    <button
                      key={tag._id}
                      type="button"
                      onClick={() => toggle(tag._id, applied)}
                      className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded text-sm hover:bg-slate-50 text-left"
                    >
                      <span className={`inline-block w-2 h-2 rounded-full ${tagColorClass(tag.color ?? category.color).split(' ')[1]}`} />
                      <span className="flex-1 text-slate-700">{tag.name}</span>
                      {applied && <Check size={13} className="text-blue-600" />}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(category._id); }}
                  placeholder={`New ${category.name.toLowerCase()} tag…`}
                  className="flex-1 text-xs px-2 py-1 border border-slate-200 rounded outline-none focus:border-blue-400"
                />
                <button
                  type="button"
                  onClick={() => handleCreate(category._id)}
                  className="text-xs text-blue-600 hover:text-blue-800 px-1.5"
                >
                  Add
                </button>
              </div>
            </div>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
