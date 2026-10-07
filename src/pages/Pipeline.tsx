import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Search, GripVertical } from "lucide-react";
import { db } from "@/lib/db";
import { leadsRepo } from "@/lib/repos";
import { useApp } from "@/lib/app";
import { Button, Card, Select } from "@/components/ui/ui";
import { QuickActions } from "@/components/common/QuickActions";
import { PinButton, ScoreChip, TierBadge } from "@/components/leads/controls";
import {
  PIPELINE_COLUMNS_FULL,
  PIPELINE_COLUMNS_SIMPLE,
  normalizeStatus,
  type Lead,
  type LeadStatus,
  type PipelinePreset,
} from "@/lib/types";
import { formatETB } from "@/lib/utils";
import { toast } from "sonner";

const COLUMN_STYLE: Record<string, string> = {
  New: "bg-slate-400",
  Qualified: "bg-sky-500",
  "Prototype Ready": "bg-violet-500",
  "To Call": "bg-amber-500",
  "No Answer": "bg-orange-500",
  "In Talk": "bg-blue-500",
  Won: "bg-emerald-500",
  Passed: "bg-rose-400",
  // legacy
  Contacted: "bg-blue-500",
  Replied: "bg-cyan-500",
  Interested: "bg-violet-500",
  "Not Interested": "bg-rose-500",
  "Follow-up": "bg-amber-500",
  Meeting: "bg-indigo-500",
  Proposal: "bg-purple-500",
  Lost: "bg-red-500",
};

const CARD_HEIGHT = 96;

export function Pipeline() {
  const { openLead } = useApp();
  const [q, setQ] = useState("");
  const [tier, setTier] = useState("");
  const [niche, setNiche] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [batch, setBatch] = useState("");
  const [preset, setPreset] = useState<PipelinePreset>(() => {
    try {
      const s = localStorage.getItem("meridian:pipeline-preset");
      if (s === "simple" || s === "full") return s;
    } catch {
      /* ignore */
    }
    return "full";
  });

  const columns = preset === "simple" ? PIPELINE_COLUMNS_SIMPLE : PIPELINE_COLUMNS_FULL;

  const setPresetAndSave = (p: PipelinePreset) => {
    setPreset(p);
    try {
      localStorage.setItem("meridian:pipeline-preset", p);
    } catch {
      /* ignore */
    }
  };

  const leads = useLiveQuery(() => db.leads.toArray(), [], []);
  const batches = useLiveQuery(() => db.import_batches.toArray(), [], []);

  const niches = useMemo(
    () => Array.from(new Set((leads || []).map((l) => l.category).filter(Boolean))).sort() as string[],
    [leads],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (leads || []).filter((l) => {
      if (l.deleted_at) return false;
      if (l.is_archived) return false;
      if (needle && !`${l.business_name} ${l.phone} ${l.category} ${l.city}`.toLowerCase().includes(needle))
        return false;
      if (tier && String(l.tier) !== tier) return false;
      if (niche && l.category !== niche) return false;
      if (batch && l.import_batch_id !== batch) return false;
      if (pinnedOnly && !l.is_pinned) return false;
      return true;
    });
  }, [leads, q, tier, niche, batch, pinnedOnly]);

  const byStatus = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const c of columns) map[c] = [];
    for (const l of filtered) {
      const st = normalizeStatus(l.status);
      const key = map[st] ? st : map["New"] ? "New" : columns[0];
      map[key].push(l);
    }
    for (const arr of Object.values(map)) {
      arr.sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0));
    }
    return map;
  }, [filtered, columns]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const activeLead = useMemo(
    () => (leads || []).find((l) => l.id === activeId) || null,
    [leads, activeId],
  );

  const onDragStart = useCallback((e: DragStartEvent) => setActiveId(String(e.active.id)), []);
  const onDragEnd = useCallback(
    async (e: DragEndEvent) => {
      setActiveId(null);
      const overId = e.over?.id;
      if (!overId) return;
      const status = String(overId) as LeadStatus;
      const lead = (leads || []).find((l) => l.id === String(e.active.id));
      if (!lead || lead.status === status) return;
      await leadsRepo.update(lead.id, { status });
      toast.success(`${lead.business_name || "Lead"} → ${status}`);
    },
    [leads],
  );

  return (
    <div className="mx-auto w-full max-w-[1700px] px-4 py-5 md:px-7 md:py-7">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-white">Pipeline</h1>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            Drag cards between stages · changes save instantly, offline
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search pipeline…"
              className="h-9 w-[200px] rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[13px] outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>
          <Select
            className="w-[120px]"
            size="sm"
            value={tier}
            onChange={setTier}
            placeholder="All tiers"
            options={[1, 2, 3, 4, 5].map((t) => ({ value: String(t), label: `Tier ${t}` }))}
          />
          <Select
            className="w-[150px]"
            size="sm"
            value={niche}
            onChange={setNiche}
            placeholder="All niches"
            options={niches.map((n) => ({ value: n, label: n }))}
          />
          <Select
            className="w-[160px]"
            size="sm"
            value={batch}
            onChange={setBatch}
            placeholder="All batches"
            options={(batches || []).map((b) => ({ value: b.id, label: b.name }))}
          />
          <Button size="sm" variant={pinnedOnly ? "primary" : "outline"} onClick={() => setPinnedOnly((v) => !v)}>
            📌 Pinned
          </Button>
          <div className="flex items-center rounded-xl border border-slate-200 p-0.5 dark:border-white/10">
            <button
              type="button"
              onClick={() => setPresetAndSave("simple")}
              className={`rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition ${
                preset === "simple"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              Simple
            </button>
            <button
              type="button"
              onClick={() => setPresetAndSave("full")}
              className={`rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition ${
                preset === "full"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              Full
            </button>
          </div>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {columns.map((col) => {
            const items = byStatus[col] || [];
            const value = items.reduce((s, l) => s + (l.potential_value || 0), 0);
            return <Column key={col} status={col} items={items} value={value} onOpen={openLead} />;
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeLead ? (
            <div className="w-[260px] rotate-2 opacity-95">
              <CompactCard lead={activeLead} dragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({
  status,
  items,
  value,
  onOpen,
}: {
  status: LeadStatus;
  items: Lead[];
  value: number;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CARD_HEIGHT,
    overscan: 8,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-[272px] shrink-0 flex-col rounded-2xl border transition-colors ${
        isOver
          ? "border-slate-400 bg-slate-100/70 dark:border-white/30 dark:bg-white/[0.07]"
          : "border-slate-200/70 bg-slate-50/60 dark:border-white/[0.06] dark:bg-white/[0.02]"
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className={`h-2 w-2 rounded-full ${COLUMN_STYLE[status] || "bg-slate-400"}`} />
        <span className="text-[12.5px] font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
          {status}
        </span>
        <span className="rounded-full bg-white px-1.5 text-[11px] font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-300">
          {items.length}
        </span>
        {value > 0 && <span className="ml-auto text-[11px] font-medium text-slate-400">{formatETB(value)}</span>}
      </div>
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto px-2 pb-2"
        style={{ maxHeight: "calc(100vh - 260px)", minHeight: 120 }}
      >
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-[11.5px] text-slate-400 dark:border-white/10">
            Drop here
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
            {virtualizer.getVirtualItems().map((row) => {
              const lead = items[row.index];
              if (!lead) return null;
              return (
                <div
                  key={lead.id}
                  ref={virtualizer.measureElement}
                  data-index={row.index}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${row.start}px)`,
                    paddingBottom: 8,
                  }}
                >
                  <DraggableCard lead={lead} onOpen={onOpen} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const DraggableCard = memo(function DraggableCard({ lead, onOpen }: { lead: Lead; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        className="h-[88px] rounded-xl border border-dashed border-slate-300 dark:border-white/20"
      />
    );
  }
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className="touch-none">
      <CompactCard lead={lead} onOpen={onOpen} />
    </div>
  );
});

const CompactCard = memo(function CompactCard({
  lead,
  onOpen,
  dragging,
}: {
  lead: Lead;
  onOpen?: (id: string) => void;
  dragging?: boolean;
}) {
  return (
    <Card
      onClick={() => onOpen?.(lead.id)}
      className={`group cursor-pointer p-2.5 transition hover:border-slate-300 dark:hover:border-white/20 ${
        dragging ? "shadow-xl" : ""
      }`}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <span className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">
              {lead.business_name || "(unnamed)"}
            </span>
            <PinButton lead={lead} />
          </div>
          <div className="truncate text-[11px] text-slate-400">{lead.category || lead.city || "—"}</div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <TierBadge lead={lead} size="xs" />
            <ScoreChip lead={lead} />
            {lead.rating ? <span className="text-[11px] text-slate-400">⭐ {lead.rating}</span> : null}
            {lead.potential_value ? (
              <span className="ml-auto text-[10.5px] font-medium text-slate-400">{formatETB(lead.potential_value)}</span>
            ) : null}
          </div>
          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
            <QuickActions lead={lead} size="sm" show={["message", "copy"]} />
          </div>
        </div>
      </div>
    </Card>
  );
});


