import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Filter, X, Check, Bookmark, BookmarkX, Pin } from "lucide-react";
import { Button, Dropdown, MenuLabel, MenuItem, Select } from "@/components/ui/ui";
import { db } from "@/lib/db";
import { viewsRepo } from "@/lib/repos";
import { TIER_META, cn } from "@/lib/utils";
import { LEAD_STATUSES, type ResearchStatus } from "@/lib/types";
import type { LeadFilters, SortState, Tri } from "@/lib/filters";
import { SORT_OPTIONS } from "@/lib/filters";

function MultiSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = options.filter((o) => o.toLowerCase().includes(q.toLowerCase()));
  if (!options.length) return null;
  return (
    <div>
      <MenuLabel>{label}</MenuLabel>
      {options.length > 8 && (
        <div className="px-1.5 pb-1">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter…"
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[12px] outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
        </div>
      )}
      <div className="max-h-48 overflow-y-auto">
        {filtered.map((o) => {
          const active = value.includes(o);
          return (
            <button
              key={o}
              onClick={() => onChange(active ? value.filter((v) => v !== o) : [...value, o])}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
            >
              <span
                className={cn(
                  "flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border",
                  active
                    ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                    : "border-slate-300 dark:border-white/20",
                )}
              >
                {active && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
              </span>
              <span className="truncate">{o}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TriToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Tri;
  onChange: (v: Tri) => void;
}) {
  const opts: Tri[] = ["any", "yes", "no"];
  return (
    <div>
      <MenuLabel>{label}</MenuLabel>
      <div className="flex gap-1 px-1.5 pb-2">
        {opts.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={cn(
              "flex-1 rounded-lg px-2 py-1 text-[12px] font-medium capitalize transition",
              value === o
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300",
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FilterBar({
  filters,
  setFilters,
  sort,
  setSort,
  activeCount,
}: {
  filters: LeadFilters;
  setFilters: (f: LeadFilters) => void;
  sort: SortState;
  setSort: (s: SortState) => void;
  activeCount: number;
}) {
  const facets = useLiveQuery(async () => {
    const [leads, batches, tags] = await Promise.all([db.leads.toArray(), db.import_batches.toArray(), db.tags.toArray()]);
    const categories = Array.from(new Set(leads.map((l) => l.category || "Uncategorized"))).sort();
    const cities = Array.from(new Set(leads.map((l) => l.city || "Unknown"))).sort();
    const tagSet = new Set<string>();
    leads.forEach((l) => (l.tags || []).forEach((t) => tagSet.add(t)));
    tags.forEach((t) => tagSet.add(t.name));
    return { categories, cities, tags: Array.from(tagSet).sort(), batches };
  }, []);

  const savedViews = useLiveQuery(() => db.saved_views.toArray(), []);
  const [viewName, setViewName] = useState("");
  const [viewIcon, setViewIcon] = useState("🔥");
  const [viewPinned, setViewPinned] = useState(false);

  const patch = (p: Partial<LeadFilters>) => setFilters({ ...filters, ...p });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Dropdown
        trigger={({ toggle }) => (
          <Button variant="outline" size="sm" onClick={toggle}>
            <Filter className="h-3.5 w-3.5" />
            Filters
            {activeCount > 0 && (
              <span className="ml-0.5 rounded-full bg-slate-900 px-1.5 text-[10px] font-semibold text-white dark:bg-white dark:text-slate-900">
                {activeCount}
              </span>
            )}
          </Button>
        )}
        panelClassName="w-[300px] max-h-[70vh] overflow-y-auto"
        align="left"
      >
        {() => (
          <>
            <MultiSelect
              label="Tier"
              options={["1", "2", "3", "4", "5"]}
              value={filters.tiers.map(String)}
              onChange={(v) => patch({ tiers: v.map(Number) })}
            />
            <MultiSelect
              label="Status"
              options={LEAD_STATUSES}
              value={filters.statuses}
              onChange={(v) => patch({ statuses: v })}
            />
            <MultiSelect
              label="Niche / category"
              options={facets?.categories || []}
              value={filters.categories}
              onChange={(v) => patch({ categories: v })}
            />
            <MultiSelect
              label="Location / city"
              options={facets?.cities || []}
              value={filters.cities}
              onChange={(v) => patch({ cities: v })}
            />
            <MultiSelect label="Tags" options={facets?.tags || []} value={filters.tags} onChange={(v) => patch({ tags: v })} />
            <MultiSelect
              label="Research status"
              options={["Not Researched", "Researching", "Researched"]}
              value={filters.research}
              onChange={(v) => patch({ research: v as ResearchStatus[] })}
            />
            <MultiSelect
              label="Import batch"
              options={(facets?.batches || []).map((b) => b.id)}
              value={filters.batchIds}
              onChange={(v) => patch({ batchIds: v })}
            />
            <TriToggle label="Has website" value={filters.website} onChange={(v) => patch({ website: v })} />
            <TriToggle label="Has phone" value={filters.hasPhone} onChange={(v) => patch({ hasPhone: v })} />
            <TriToggle label="Has social" value={filters.hasSocial} onChange={(v) => patch({ hasSocial: v })} />
            <TriToggle label="Pinned" value={filters.pinned} onChange={(v) => patch({ pinned: v })} />
            <TriToggle label="Archived" value={filters.archived} onChange={(v) => patch({ archived: v })} />

            <MenuLabel>Minimum rating</MenuLabel>
            <div className="px-2.5 pb-2">
              <input
                type="range"
                min={0}
                max={5}
                step={0.1}
                value={filters.ratingMin}
                onChange={(e) => patch({ ratingMin: Number(e.target.value) })}
              />
              <div className="mt-1 text-[11.5px] text-slate-500">{filters.ratingMin ? `≥ ${filters.ratingMin} ★` : "Any"}</div>
            </div>

            <MenuLabel>Minimum reviews</MenuLabel>
            <div className="px-2.5 pb-2">
              <input
                type="range"
                min={0}
                max={1000}
                step={10}
                value={filters.reviewsMin}
                onChange={(e) => patch({ reviewsMin: Number(e.target.value) })}
              />
              <div className="mt-1 text-[11.5px] text-slate-500">
                {filters.reviewsMin ? `≥ ${filters.reviewsMin} reviews` : "Any"}
              </div>
            </div>

            <MenuLabel>Score range</MenuLabel>
            <div className="flex items-center gap-2 px-2.5 pb-2">
              <input
                type="number"
                min={0}
                max={100}
                value={filters.scoreMin}
                onChange={(e) => patch({ scoreMin: Number(e.target.value) })}
                className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-[12px] dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
              <span className="text-slate-400">–</span>
              <input
                type="number"
                min={0}
                max={100}
                value={filters.scoreMax}
                onChange={(e) => patch({ scoreMax: Number(e.target.value) })}
                className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-[12px] dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>

            <div className="sticky bottom-0 mt-1 border-t border-slate-100 bg-white p-1.5 dark:border-white/5 dark:bg-[#181b21]">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setFilters({ ...filters, ...CLEARED })}
              >
                <X className="h-3.5 w-3.5" /> Clear all filters
              </Button>
            </div>
          </>
        )}
      </Dropdown>

      <Select
        className="w-[168px]"
        size="sm"
        value={`${sort.key}:${sort.dir}`}
        onChange={(v) => {
          const [key, dir] = v.split(":");
          setSort({ key: key as SortState["key"], dir: dir as "asc" | "desc" });
        }}
        options={SORT_OPTIONS.map((o) => ({ value: `${o.value}:${o.dir}`, label: o.label }))}
      />

      <Dropdown
        trigger={({ toggle }) => (
          <Button variant="outline" size="sm" onClick={toggle}>
            <Bookmark className="h-3.5 w-3.5" /> Views
          </Button>
        )}
        panelClassName="w-[280px]"
        align="left"
      >
        {({ close }) => (
          <>
            <MenuLabel>Save current view</MenuLabel>
            <div className="flex gap-1.5 px-2 pb-2">
              <select
                value={viewIcon}
                onChange={(e) => setViewIcon(e.target.value)}
                className="w-12 rounded-lg border border-slate-200 bg-white px-1 text-center text-[14px] outline-none dark:border-white/10 dark:bg-white/5"
              >
                {["🔥", "📞", "⏰", "🏨", "🪑", "🌐", "📌", "🗃️", "📦", "⭐", "🏗️", "☕"].map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
              <input
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="e.g. Tier 1 No Website Addis"
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2 px-2 pb-2">
              <label className="flex flex-1 items-center gap-1.5 text-[12px] text-slate-500 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={viewPinned}
                  onChange={(e) => setViewPinned(e.target.checked)}
                  className="h-3.5 w-3.5 rounded"
                />
                Pin to dashboard
              </label>
              <Button
                size="sm"
                variant="primary"
                onClick={async () => {
                  if (!viewName.trim()) return;
                  await viewsRepo.create(viewName.trim(), filters, sort, { icon: viewIcon, pinned: viewPinned });
                  setViewName("");
                  setViewPinned(false);
                  close();
                }}
              >
                Save view
              </Button>
            </div>
            <MenuLabel>Saved views</MenuLabel>
            {(savedViews || []).length === 0 && (
              <div className="px-2.5 pb-2 text-[12px] text-slate-400">No saved views yet.</div>
            )}
            {(savedViews || []).map((v) => (
              <div key={v.id} className="flex items-center gap-1">
                <MenuItem
                  className="flex-1"
                  onClick={() => {
                    setFilters({ ...filters, ...(v.filters || {}) });
                    setSort(v.sort || sort);
                    close();
                  }}
                >
                  <span className="flex items-center gap-2">
                    <span>{v.icon || "🔖"}</span>
                    {v.name}
                    {v.pinned && <Pin className="h-3 w-3 text-slate-400" />}
                  </span>
                </MenuItem>
                <button
                  onClick={() => void db.saved_views.update(v.id, { pinned: !v.pinned })}
                  className={cn(
                    "rounded-md p-1.5 transition hover:bg-slate-100 dark:hover:bg-white/10",
                    v.pinned ? "text-amber-500" : "text-slate-300",
                  )}
                  title={v.pinned ? "Unpin from dashboard" : "Pin to dashboard"}
                >
                  <Pin className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => void viewsRepo.remove(v.id)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                  title="Delete view"
                >
                  <BookmarkX className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </>
        )}
      </Dropdown>

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={() => setFilters({ ...filters, ...CLEARED })}>
          Clear
        </Button>
      )}
    </div>
  );
}

const CLEARED = {
  tiers: [],
  statuses: [],
  categories: [],
  cities: [],
  tags: [],
  batchIds: [],
  research: [],
  website: "any" as Tri,
  hasPhone: "any" as Tri,
  hasSocial: "any" as Tri,
  pinned: "any" as Tri,
  archived: "no" as Tri,
  ratingMin: 0,
  reviewsMin: 0,
  scoreMin: 0,
  scoreMax: 100,
};

export function ActiveFilterChips({
  filters,
  setFilters,
}: {
  filters: LeadFilters;
  setFilters: (f: LeadFilters) => void;
}) {
  const chips: { key: string; label: string; clear: () => void }[] = [];
  const patch = (p: Partial<LeadFilters>) => setFilters({ ...filters, ...p });

  filters.tiers.forEach((t) =>
    chips.push({
      key: `t${t}`,
      label: TIER_META[t as 1].short,
      clear: () => patch({ tiers: filters.tiers.filter((x) => x !== t) }),
    }),
  );
  filters.statuses.forEach((s) =>
    chips.push({ key: `s${s}`, label: s, clear: () => patch({ statuses: filters.statuses.filter((x) => x !== s) }) }),
  );
  filters.categories.forEach((c) =>
    chips.push({
      key: `c${c}`,
      label: c,
      clear: () => patch({ categories: filters.categories.filter((x) => x !== c) }),
    }),
  );
  filters.cities.forEach((c) =>
    chips.push({ key: `city${c}`, label: c, clear: () => patch({ cities: filters.cities.filter((x) => x !== c) }) }),
  );
  filters.tags.forEach((t) =>
    chips.push({ key: `tag${t}`, label: `#${t}`, clear: () => patch({ tags: filters.tags.filter((x) => x !== t) }) }),
  );
  if (filters.website !== "any")
    chips.push({ key: "web", label: `Website: ${filters.website}`, clear: () => patch({ website: "any" }) });
  if (filters.hasPhone !== "any")
    chips.push({ key: "ph", label: `Phone: ${filters.hasPhone}`, clear: () => patch({ hasPhone: "any" }) });
  if (filters.hasSocial !== "any")
    chips.push({ key: "soc", label: `Social: ${filters.hasSocial}`, clear: () => patch({ hasSocial: "any" }) });
  if (filters.pinned !== "any")
    chips.push({ key: "pin", label: `Pinned: ${filters.pinned}`, clear: () => patch({ pinned: "any" }) });
  if (filters.archived !== "no")
    chips.push({ key: "arch", label: filters.archived === "yes" ? "Archived" : "Not archived", clear: () => patch({ archived: "no" }) });
  if (filters.ratingMin > 0)
    chips.push({ key: "rat", label: `≥ ${filters.ratingMin}★`, clear: () => patch({ ratingMin: 0 }) });
  if (filters.reviewsMin > 0)
    chips.push({ key: "rev", label: `≥ ${filters.reviewsMin} reviews`, clear: () => patch({ reviewsMin: 0 }) });
  if (filters.scoreMin > 0 || filters.scoreMax < 100)
    chips.push({
      key: "score",
      label: `Score ${filters.scoreMin}–${filters.scoreMax}`,
      clear: () => patch({ scoreMin: 0, scoreMax: 100 }),
    });
  filters.research.forEach((r) =>
    chips.push({
      key: `r${r}`,
      label: r,
      clear: () => patch({ research: filters.research.filter((x) => x !== r) }),
    }),
  );

  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <button
          key={c.key}
          onClick={c.clear}
          className="group inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
        >
          {c.label}
          <X className="h-3 w-3 opacity-40 group-hover:opacity-100" />
        </button>
      ))}
    </div>
  );
}

export function useDebounced<T>(value: T, delay = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
