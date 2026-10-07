import { memo, useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Checkbox } from "@/components/ui/ui";
import { PinButton, ScoreChip, StatusSelect, TierBadge, ValueEstimate, WebsiteCell } from "./controls";
import { QuickActions } from "@/components/common/QuickActions";
import { dueLabel, telHref, timeAgo } from "@/lib/utils";
import type { Lead } from "@/lib/types";

const ROW_H = 56;

/** 8 columns — enough info without breaking the row */
const COLS =
  "grid-cols-[36px_minmax(140px,1.6fr)_88px_72px_100px_72px_72px_minmax(108px,auto)]";

export function LeadTable({
  leads,
  selected,
  onToggle,
  onToggleAll,
  onOpen,
}: {
  leads: Lead[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onOpen: (id: string) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: leads.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
    getItemKey: (index) => leads[index]?.id ?? index,
  });

  const allSelected = leads.length > 0 && selected.size === leads.length;
  const someSelected = selected.size > 0 && !allSelected;
  const handleToggleAll = useCallback(() => onToggleAll(), [onToggleAll]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-white/[0.08] dark:bg-white/[0.02]">
      <div ref={parentRef} className="max-h-[calc(100dvh-280px)] min-h-[220px] overflow-auto">
        <div className="min-w-[720px]">
          <div
            className={`sticky top-0 z-10 grid ${COLS} items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-[#12141a] dark:text-slate-400`}
          >
            <Checkbox
              checked={allSelected}
              className={someSelected ? "opacity-60" : ""}
              onChange={handleToggleAll}
              aria-label="Select all"
            />
            <span>Business</span>
            <span>Status</span>
            <span>Score</span>
            <span>Phone</span>
            <span>Web</span>
            <span>Next</span>
            <span className="text-right">Actions</span>
          </div>

          {leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="text-[15px] font-medium text-slate-900 dark:text-white">No leads match</div>
              <p className="mt-1 text-[13px] text-slate-500">Adjust filters or import a new batch.</p>
            </div>
          ) : (
            <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
              {virtualizer.getVirtualItems().map((row) => {
                const lead = leads[row.index];
                if (!lead) return null;
                return (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    selected={selected.has(lead.id)}
                    onToggle={onToggle}
                    onOpen={onOpen}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: ROW_H,
                      transform: `translateY(${row.start}px)`,
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const LeadRow = memo(function LeadRow({
  lead,
  selected,
  onToggle,
  onOpen,
  style,
}: {
  lead: Lead;
  selected: boolean;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  style: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      onClick={() => onOpen(lead.id)}
      className={`grid ${COLS} cursor-pointer items-center gap-2 border-b border-slate-100 px-3 hover:bg-slate-50/90 dark:border-white/[0.04] dark:hover:bg-white/[0.03] ${
        selected ? "bg-slate-50 dark:bg-white/[0.05]" : ""
      }`}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={selected} onChange={() => onToggle(lead.id)} />
      </div>

      <div className="flex min-w-0 items-center gap-1.5">
        <div onClick={(e) => e.stopPropagation()}>
          <PinButton lead={lead} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">
            {lead.business_name || "(unnamed)"}
          </div>
          <div className="truncate text-[10.5px] text-slate-500 dark:text-slate-400">
            {lead.category || "—"}
            {lead.city ? ` · ${lead.city}` : ""}
          </div>
        </div>
      </div>

      <div onClick={(e) => e.stopPropagation()} className="min-w-0">
        <StatusSelect lead={lead} compact />
      </div>

      <div className="flex min-w-0 flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <ScoreChip lead={lead} />
          <TierBadge lead={lead} size="xs" />
        </div>
        <ValueEstimate lead={lead} />
      </div>

      <div className="truncate text-[12px]" onClick={(e) => e.stopPropagation()}>
        {lead.phone ? (
          <a href={telHref(lead.phone)} className="text-slate-700 hover:underline dark:text-slate-300">
            {lead.phone}
          </a>
        ) : (
          <span className="text-slate-300 dark:text-slate-600">—</span>
        )}
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        <WebsiteCell lead={lead} />
      </div>

      <div className="truncate text-[11px]">
        {lead.next_followup_at ? (
          <span
            className={
              new Date(lead.next_followup_at) < new Date() ? "text-red-500" : "text-slate-500 dark:text-slate-400"
            }
          >
            {dueLabel(lead.next_followup_at)}
          </span>
        ) : lead.last_contacted_at ? (
          <span className="text-slate-400" title="Last contact">
            {timeAgo(lead.last_contacted_at)}
          </span>
        ) : (
          <span className="text-slate-300 dark:text-slate-600">—</span>
        )}
      </div>

      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
        <QuickActions lead={lead} size="sm" show={["message", "research", "copy"]} />
      </div>
    </div>
  );
});
