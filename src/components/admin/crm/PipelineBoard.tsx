'use client';

/**
 * PIPELINE BOARD — drag-and-drop deal Kanban.
 *
 * Columns come from crmPipelineStages, never a hardcoded list, so renaming or
 * inserting a stage in settings changes the board with no deploy.
 *
 * The drag is optimistic through Convex's own `withOptimisticUpdate`: the card
 * moves the instant it is dropped, and the local store is reconciled when the
 * mutation lands. Waiting on a round trip before the card moves is what makes
 * a board feel broken, and rolling our own client cache to avoid that would be
 * re-solving something Convex already does correctly.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCorners,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Building2, Users, GripVertical } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { formatCurrency } from '@/lib/admin-format';
import { tagColorClass } from './constants';
import { useToast } from '@/components/admin/ui';

type BoardDeal = Doc<'crmDeals'> & { companyName: string };
type BoardColumn = {
  stage: Doc<'crmPipelineStages'>;
  deals: BoardDeal[];
  rollup: { count: number; grossCents: number; weightedCents: number; lives: number };
};

function DealCard({ deal, stageProbability, dragging }: { deal: BoardDeal; stageProbability: number; dragging?: boolean }) {
  const probability = deal.winProbability ?? stageProbability;
  const amount = deal.mrrCents ?? deal.amountCents ?? 0;

  return (
    <div
      className={`bg-white border border-slate-200 rounded-lg p-3 space-y-2 ${
        dragging ? 'shadow-lg rotate-1' : 'hover:border-slate-300'
      }`}
    >
      <p className="text-sm font-medium text-slate-900 leading-snug">{deal.name}</p>
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Building2 size={11} className="flex-shrink-0" />
        <span className="truncate">{deal.companyName}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">{amount > 0 ? formatCurrency(amount / 100) : '—'}</span>
        <span className="text-slate-400">{probability}%</span>
      </div>
      {deal.estimatedLives ? (
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Users size={11} /> {deal.estimatedLives} lives
        </div>
      ) : null}
    </div>
  );
}

function DraggableDeal({
  deal,
  stageProbability,
  onOpen,
}: {
  deal: BoardDeal;
  stageProbability: number;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal._id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      className="relative group"
    >
      {/* Drag handle is separate from the card body so clicking a card still
          opens it — a whole-card drag target makes the board unnavigable. */}
      <button
        type="button"
        {...listeners}
        {...attributes}
        aria-label={`Drag ${deal.name}`}
        className="absolute right-1 top-1 z-10 p-1 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-slate-500 cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={13} />
      </button>
      <button type="button" onClick={onOpen} className="w-full text-left">
        <DealCard deal={deal} stageProbability={stageProbability} />
      </button>
    </div>
  );
}

function StageColumn({
  column,
  onOpenDeal,
}: {
  column: BoardColumn;
  onOpenDeal: (id: Id<'crmDeals'>) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.stage._id });
  const tone = tagColorClass(column.stage.color);

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      <div className={`rounded-t-lg border px-3 py-2 ${tone}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{column.stage.name}</span>
          <span className="text-xs font-medium tabular-nums">{column.rollup.count}</span>
        </div>
        <div className="flex items-center justify-between text-xs mt-0.5 opacity-80">
          <span>{column.rollup.grossCents > 0 ? formatCurrency(column.rollup.grossCents / 100) : '—'}</span>
          {/* Weighted value — the column's real forecast contribution. */}
          <span title="Weighted by win probability">
            {column.rollup.weightedCents > 0 ? `~${formatCurrency(column.rollup.weightedCents / 100)}` : ''}
          </span>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[24rem] space-y-2 p-2 border border-t-0 rounded-b-lg transition-colors ${
          isOver ? 'bg-blue-50 border-blue-300' : 'bg-slate-50 border-slate-200'
        }`}
      >
        {column.deals.map((deal) => (
          <DraggableDeal
            key={deal._id}
            deal={deal}
            stageProbability={column.stage.probability}
            onOpen={() => onOpenDeal(deal._id)}
          />
        ))}
        {column.deals.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-6">No deals</p>
        )}
      </div>
    </div>
  );
}

export function PipelineBoard({ ownerClerkUserId }: { ownerClerkUserId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const board = useQuery(api.crm.deals.boardByStage, { ownerClerkUserId });
  const [activeId, setActiveId] = useState<Id<'crmDeals'> | null>(null);

  const moveDealStage = useMutation(api.crm.deals.moveDealStage).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.crm.deals.boardByStage, { ownerClerkUserId });
      if (!current) return;

      let moved: BoardDeal | undefined;
      const stripped = current.columns.map((col) => {
        const found = col.deals.find((d) => d._id === args.dealId);
        if (found) moved = found;
        return { ...col, deals: col.deals.filter((d) => d._id !== args.dealId) };
      });
      if (!moved) return;

      const columns = stripped.map((col) =>
        col.stage._id === args.stageId
          ? { ...col, deals: [...col.deals, { ...moved!, stageId: args.stageId }] }
          : col,
      );
      localStore.setQuery(api.crm.deals.boardByStage, { ownerClerkUserId }, { ...current, columns });
    },
  );

  const sensors = useSensors(
    // A small activation distance keeps a click on the handle from being read
    // as a zero-length drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const columns = useMemo(() => (board?.columns ?? []) as BoardColumn[], [board]);
  const activeDeal = useMemo(
    () => columns.flatMap((c) => c.deals).find((d) => d._id === activeId),
    [columns, activeId],
  );
  const activeStageProbability = useMemo(
    () => columns.find((c) => c.deals.some((d) => d._id === activeId))?.stage.probability ?? 0,
    [columns, activeId],
  );

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as Id<'crmDeals'>);

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const dealId = active.id as Id<'crmDeals'>;
    const stageId = over.id as Id<'crmPipelineStages'>;
    const sourceColumn = columns.find((c) => c.deals.some((d) => d._id === dealId));
    if (!sourceColumn || sourceColumn.stage._id === stageId) return;

    const target = columns.find((c) => c.stage._id === stageId);
    const last = target?.deals[target.deals.length - 1];

    try {
      await moveDealStage({ dealId, stageId, beforePosition: last?.boardPosition });
    } catch (err) {
      toast.fromError(err, 'Could not move deal');
    }
  };

  if (board === undefined) {
    return <div className="text-sm text-slate-400 py-12 text-center">Loading pipeline…</div>;
  }
  if (!board.pipelineId) {
    return (
      <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center">
        <p className="text-sm text-slate-600">No pipeline configured yet.</p>
        <p className="text-xs text-slate-400 mt-1">
          Set one up in <span className="font-medium">CRM → Settings → Pipeline</span>.
        </p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((column) => (
          <StageColumn
            key={column.stage._id}
            column={column}
            onOpenDeal={(id) => router.push(`/admin/crm/deals/${id}`)}
          />
        ))}
      </div>

      {/* Overlay follows the cursor so the card is visible above every column. */}
      <DragOverlay>
        {activeDeal ? <DealCard deal={activeDeal} stageProbability={activeStageProbability} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
