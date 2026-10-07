import { Star, Clock3 } from "lucide-react";
import { toast } from "sonner";
import { PinButton, ScoreChip, StatusSelect, TierBadge, ValueEstimate, WebsiteCell } from "./controls";
import { QuickActions } from "@/components/common/QuickActions";
import { cn, dueLabel, timeAgo } from "@/lib/utils";
import type { Lead } from "@/lib/types";
import { useApp } from "@/lib/app";
import { leadsRepo } from "@/lib/repos";

export function LeadCard({ lead, onOpen }: { lead: Lead; onOpen?: () => void }) {
  const { openLead } = useApp();
  const today = new Date();
  const due = lead.next_followup_at ? new Date(lead.next_followup_at) : null;
  const dueToday = due && due.toDateString() === today.toDateString();
  const overdue = due && due.getTime() < Date.now() && !dueToday;

  return (
    <div
      onClick={() => (onOpen ? onOpen() : openLead(lead.id))}
      className="group cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:shadow-md active:scale-[0.995] dark:border-white/[0.08] dark:bg-white/[0.035] dark:hover:border-white/20"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {lead.is_pinned && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
            <h3 className="truncate text-[14.5px] font-semibold leading-tight text-slate-900 dark:text-white">
              {lead.business_name || "(unnamed)"}
            </h3>
          </div>
          <p className="mt-0.5 truncate text-[12px] text-slate-500 dark:text-slate-400">
            {lead.category || "Uncategorized"}
            {(lead.city || lead.address) && ` · ${lead.city || lead.address}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <PinButton lead={lead} />
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <TierBadge lead={lead} />
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 dark:bg-white/10 dark:text-slate-300">
          Score <ScoreChip lead={lead} className="p-0 text-[11px] hover:bg-transparent dark:hover:bg-transparent" />
        </span>
        <StatusSelect lead={lead} />
        <ValueEstimate lead={lead} />
        <WebsiteCell lead={lead} />
      </div>

      {(lead.next_followup_at || lead.last_contacted_at) && (
        <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-slate-500 dark:text-slate-400">
          <Clock3 className="h-3 w-3 shrink-0" />
          {lead.next_followup_at ? (
            <span className={cn(overdue ? "text-red-500" : dueToday ? "text-amber-600 dark:text-amber-400" : "")}>
              Follow-up {dueLabel(lead.next_followup_at)}
            </span>
          ) : (
            <span>Last contact {timeAgo(lead.last_contacted_at!)}</span>
          )}
        </div>
      )}

      {lead.tags && lead.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {lead.tags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-500 dark:bg-white/10 dark:text-slate-400"
            >
              {t}
            </span>
          ))}
          {lead.tags.length > 4 && (
            <span className="text-[10.5px] text-slate-400">+{lead.tags.length - 4}</span>
          )}
        </div>
      )}

      <div
        className="mt-3 border-t border-slate-100 pt-2.5 dark:border-white/[0.06]"
        onClick={(e) => e.stopPropagation()}
      >
        <QuickActions lead={lead} size="sm" show={["message", "research", "copy"]} className="justify-start" />
      </div>

      {lead.is_archived && (
        <button
          type="button"
          onClick={async (e) => {
            e.stopPropagation();
            await leadsRepo.update(lead.id, { is_archived: false });
            toast.success("Restored");
          }}
          className="mt-2 w-full rounded-lg bg-slate-100 py-1.5 text-[11.5px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300"
        >
          Archived · tap to restore
        </button>
      )}
    </div>
  );
}
