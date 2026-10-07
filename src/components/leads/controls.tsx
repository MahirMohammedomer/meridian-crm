import { useEffect, useRef, useState } from "react";
import { ChevronDown, Star } from "lucide-react";
import { Badge, Dropdown, MenuItem, MenuLabel } from "@/components/ui/ui";
import { leadsRepo } from "@/lib/repos";
import { TIER_META, cn } from "@/lib/utils";
import { LEAD_STATUSES, normalizeStatus, type Lead, type LeadStatus, type Tier } from "@/lib/types";

export function TierBadge({
  lead,
  size = "sm",
  editable = true,
  onChange,
}: {
  lead: Lead;
  size?: "xs" | "sm";
  editable?: boolean;
  onChange?: (t: Tier) => void;
}) {
  const meta = TIER_META[(lead.tier || 3) as Tier];
  const badge = (
    <Badge
      className={cn(
        "gap-1 font-semibold",
        meta.className,
        size === "xs" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.short}
    </Badge>
  );

  if (!editable) return badge;

  return (
    <Dropdown
      trigger={({ toggle }) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          className="rounded-full transition hover:opacity-80"
          title="Change tier (manual only)"
        >
          {badge}
        </button>
      )}
      panelClassName="w-52"
    >
      {({ close }) => (
        <>
          <MenuLabel>Lead tier</MenuLabel>
          {([1, 2, 3, 4, 5] as Tier[]).map((t) => (
            <MenuItem
              key={t}
              className={lead.tier === t ? "bg-slate-100 dark:bg-white/10" : ""}
              onClick={async () => {
                await leadsRepo.update(lead.id, { tier: t });
                onChange?.(t);
                close();
              }}
            >
              <span className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", TIER_META[t].dot)} />
                {TIER_META[t].label}
              </span>
            </MenuItem>
          ))}
        </>
      )}
    </Dropdown>
  );
}

export function ScoreChip({
  lead,
  editable = true,
  className,
}: {
  lead: Lead;
  editable?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(lead.lead_score ?? 0));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => setValue(String(lead.lead_score ?? 0)), [lead.lead_score]);
  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    const n = Math.max(0, Math.min(100, Number(value) || 0));
    if (n !== lead.lead_score) await leadsRepo.update(lead.id, { lead_score: n });
    else setValue(String(lead.lead_score ?? 0));
  };

  if (!editable) {
    return (
      <span className={cn("text-[12px] font-semibold tabular-nums text-slate-600 dark:text-slate-300", className)}>
        {lead.lead_score ?? 0}
      </span>
    );
  }

  if (editing) {
    return (
      <input
        ref={ref}
        type="number"
        min={0}
        max={100}
        value={value}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setEditing(false);
            setValue(String(lead.lead_score ?? 0));
          }
        }}
        className={cn(
          "w-12 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-center text-[12px] font-semibold tabular-nums outline-none dark:border-white/20 dark:bg-white/10 dark:text-white",
          className,
        )}
      />
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      title="Edit lead score (manual only)"
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[12px] font-semibold tabular-nums text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10",
        className,
      )}
    >
      {lead.lead_score ?? 0}
    </button>
  );
}

/** Deal estimate (ETB) on the lead — no project required */
export function ValueEstimate({
  lead,
  className,
}: {
  lead: Lead;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(lead.potential_value ?? ""));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(lead.potential_value != null ? String(lead.potential_value) : "");
  }, [lead.potential_value]);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    const n = value.trim() === "" ? null : Number(value);
    if (n !== null && (Number.isNaN(n) || n < 0)) {
      setValue(lead.potential_value != null ? String(lead.potential_value) : "");
      return;
    }
    if (n === (lead.potential_value ?? null)) return;
    await leadsRepo.update(lead.id, { potential_value: n });
  };

  if (editing) {
    return (
      <input
        ref={ref}
        type="number"
        min={0}
        step={1000}
        value={value}
        placeholder="ETB"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit();
          if (e.key === "Escape") {
            setEditing(false);
            setValue(lead.potential_value != null ? String(lead.potential_value) : "");
          }
        }}
        className={cn(
          "w-[88px] rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[11.5px] font-semibold tabular-nums outline-none dark:border-white/20 dark:bg-white/10 dark:text-white",
          className,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      title="Set deal estimate (no project needed)"
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold tabular-nums text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10",
        className,
      )}
    >
      {lead.potential_value != null && lead.potential_value > 0
        ? `ETB ${Number(lead.potential_value).toLocaleString()}`
        : "Set value"}
    </button>
  );
}

export function StatusSelect({
  lead,
  compact = false,
  className,
}: {
  lead: Lead;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Dropdown
      trigger={({ toggle }) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset transition hover:opacity-80",
            STATUS_RING[normalizeStatus(lead.status)] || STATUS_RING.New,
            className,
          )}
          title="Change status"
        >
          {normalizeStatus(lead.status)}
          {!compact && <ChevronDown className="h-3 w-3 opacity-60" />}
        </button>
      )}
      panelClassName="w-48"
    >
      {({ close }) => (
        <>
          <MenuLabel>Status</MenuLabel>
          {LEAD_STATUSES.map((s) => (
            <MenuItem
              key={s}
              className={normalizeStatus(lead.status) === s ? "bg-slate-100 dark:bg-white/10" : ""}
              onClick={async () => {
                await leadsRepo.update(lead.id, { status: s as LeadStatus });
                close();
              }}
            >
              {s}
            </MenuItem>
          ))}
        </>
      )}
    </Dropdown>
  );
}

const STATUS_RING: Record<string, string> = {
  New: "bg-slate-500/12 text-slate-600 ring-slate-500/25 dark:text-slate-300",
  Qualified: "bg-sky-500/12 text-sky-600 ring-sky-500/25 dark:text-sky-400",
  "Prototype Ready": "bg-violet-500/12 text-violet-600 ring-violet-500/25 dark:text-violet-400",
  "To Call": "bg-amber-500/12 text-amber-700 ring-amber-500/25 dark:text-amber-400",
  "No Answer": "bg-orange-500/12 text-orange-700 ring-orange-500/25 dark:text-orange-400",
  "In Talk": "bg-blue-500/12 text-blue-600 ring-blue-500/25 dark:text-blue-400",
  Won: "bg-emerald-500/12 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400",
  Passed: "bg-rose-500/12 text-rose-600 ring-rose-500/25 dark:text-rose-400",
};

export function PinButton({ lead, className }: { lead: Lead; className?: string }) {
  return (
    <button
      onClick={async (e) => {
        e.stopPropagation();
        await leadsRepo.update(lead.id, { is_pinned: !lead.is_pinned });
      }}
      className={cn(
        "rounded-md p-1 transition",
        lead.is_pinned
          ? "text-amber-500"
          : "text-slate-300 hover:bg-slate-100 hover:text-slate-500 dark:text-slate-600 dark:hover:bg-white/10",
        className,
      )}
      title={lead.is_pinned ? "Unpin" : "Pin"}
      aria-label="Pin"
    >
      <Star className="h-3.5 w-3.5" fill={lead.is_pinned ? "currentColor" : "none"} />
    </button>
  );
}

export function WebsiteCell({ lead }: { lead: Lead }) {
  const has = lead.website_status === "has_website" && lead.website;
  if (has) {
    const url = /^https?:\/\//i.test(lead.website!) ? lead.website! : `https://${lead.website}`;
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-[12px] text-emerald-600 hover:underline dark:text-emerald-400"
        title={url}
      >
        ✅ Yes
      </a>
    );
  }
  return (
    <span className="text-[12px] text-red-500/90 dark:text-red-400" title="No website">
      ❌ No
    </span>
  );
}
