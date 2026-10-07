import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";
import {
  Search,
  Download,
  X,
  Tag,
  Star,
  Archive,
  Trash2,
  CalendarClock,
  Upload,
  Users,
  Sparkles,
  LayoutList,
  LayoutGrid,
} from "lucide-react";
import { db } from "@/lib/db";
import { useApp } from "@/lib/app";
import { followupsRepo, leadsRepo } from "@/lib/repos";
import { exportLeads, downloadCSV } from "@/lib/export";
import { Button, Card, ConfirmDialog, Dropdown, EmptyState, MenuItem, MenuLabel, Select } from "@/components/ui/ui";
import { ActiveFilterChips, FilterBar, useDebounced } from "@/components/leads/FilterPanel";
import { LeadTable } from "@/components/leads/LeadTable";
import { LeadCard } from "@/components/leads/LeadCard";
import { LeadProfile } from "@/components/leads/LeadProfile";
import {
  applyFilters,
  countActiveFilters,
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  searchLeadIds,
  sortLeads,
  type LeadFilters,
  type SortState,
} from "@/lib/filters";
import { LEAD_STATUSES, type Tier } from "@/lib/types";
import { addDays, toLocalInputValue } from "@/lib/utils";

type ViewMode = "list" | "cards";

const SAMPLE: Partial<any>[] = [
  {
    business_name: "ABC Construction",
    category: "Construction",
    city: "Bole, Addis Ababa",
    phone: "+251 91 123 4567",
    rating: 4.8,
    reviews_count: 127,
    tier: 1,
    lead_score: 94,
    potential_value: 35000,
    why_scored: "High-end projects, 4.8 rating, no website",
  },
  {
    business_name: "Zemen Coffee Roasters",
    category: "Cafe",
    city: "Kazanchis, Addis Ababa",
    phone: "+251 93 445 7788",
    rating: 4.6,
    reviews_count: 312,
    tier: 1,
    lead_score: 88,
    potential_value: 28000,
  },
  {
    business_name: "Selam Real Estate",
    category: "Real Estate",
    city: "Sarbet, Addis Ababa",
    phone: "+251 11 667 8899",
    rating: 4.1,
    reviews_count: 48,
    website: "selamrealestate.com",
    tier: 2,
    lead_score: 71,
    potential_value: 45000,
  },
  {
    business_name: "Habesha Fashion House",
    category: "Fashion",
    city: "Shola, Addis Ababa",
    phone: "+251 92 334 5566",
    rating: 4.4,
    reviews_count: 96,
    tier: 2,
    lead_score: 76,
    potential_value: 22000,
  },
  {
    business_name: "Blue Nile Tours",
    category: "Travel & Tours",
    city: "Piazza, Addis Ababa",
    phone: "+251 91 777 2211",
    rating: 4.9,
    reviews_count: 204,
    tier: 1,
    lead_score: 91,
    potential_value: 40000,
  },
  {
    business_name: "Kaleb Dental Clinic",
    category: "Health",
    city: "Gerji, Addis Ababa",
    phone: "+251 94 118 2233",
    rating: 4.2,
    reviews_count: 61,
    tier: 3,
    lead_score: 58,
    potential_value: 18000,
  },
  {
    business_name: "Addis Auto Garage",
    category: "Automotive",
    city: "Megenagna, Addis Ababa",
    phone: "+251 90 556 1122",
    rating: 3.9,
    reviews_count: 33,
    tier: 4,
    lead_score: 42,
    potential_value: 15000,
  },
  {
    business_name: "Luna Event Planning",
    category: "Events",
    city: "Bole, Addis Ababa",
    phone: "+251 91 889 4455",
    rating: 4.7,
    reviews_count: 158,
    tier: 2,
    lead_score: 80,
    potential_value: 26000,
  },
  {
    business_name: "Yonas Law Office",
    category: "Legal",
    city: "Meskel Flower, Addis Ababa",
    phone: "+251 11 554 3311",
    rating: 4.5,
    reviews_count: 27,
    tier: 3,
    lead_score: 63,
    potential_value: 30000,
  },
  {
    business_name: "Rift Valley Honey",
    category: "Food & Retail",
    city: "CMC, Addis Ababa",
    phone: "+251 93 221 8899",
    rating: 4.3,
    reviews_count: 74,
    tier: 3,
    lead_score: 55,
    potential_value: 16000,
  },
];

async function seedSample() {
  for (const s of SAMPLE) {
    const lead = await leadsRepo.create({
      ...s,
      address: s.city,
      website_status: s.website ? "has_website" : "no_website",
      tags: s.tier === 1 ? ["Hot"] : [],
      research_status: "Not Researched",
      status: "New",
    });
    await followupsRepo.create({
      lead_id: lead.id,
      title: `Follow up with ${lead.business_name}`,
      due_date: addDays(new Date(), s.tier === 1 ? 0 : 3).toISOString(),
    });
  }
  toast.success(`${SAMPLE.length} sample leads added locally`);
}

export function Leads() {
  const { openLead, leadId, closeLead, navigate, isMobile, setQuickAdd, setQuickAddLeadId } = useApp();
  const [filters, setFiltersRaw] = useState<LeadFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bulkTag, setBulkTag] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem("meridian:leads-view");
      if (saved === "list" || saved === "cards") return saved;
    } catch {
      /* ignore */
    }
    return isMobile ? "cards" : "list";
  });

  const setFilters = (f: LeadFilters) => setFiltersRaw(f);
  const debouncedQ = useDebounced(filters.q, 180);

  const setView = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem("meridian:leads-view", mode);
    } catch {
      /* ignore */
    }
  };

  const allLeads = useLiveQuery(() => db.leads.toArray(), [], []);

  // Active (non-deleted) leads only — used for the total count
  const activeLeadsCount = useMemo(
    () => (allLeads || []).filter((l) => !l.deleted_at).length,
    [allLeads],
  );

  const searchIds = useLiveQuery(async () => {
    if (!debouncedQ.trim()) return null;
    const s = await searchLeadIds(debouncedQ);
    return Array.from(s || []);
  }, [debouncedQ], null);

  const results = useMemo(() => {
    const ids = searchIds ? new Set(searchIds) : null;
    const filtered = applyFilters(allLeads || [], { ...filters, q: debouncedQ }, ids);
    return sortLeads(filtered, sort);
  }, [allLeads, filters, debouncedQ, searchIds, sort]);

  const activeCount = countActiveFilters({ ...filters, q: debouncedQ });

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === results.length ? new Set() : new Set(results.map((l) => l.id)),
    );
  }, [results]);

  const selectedLeads = (allLeads || []).filter((l) => selected.has(l.id));

  const bulk = async (changes: Partial<any>, msg: string) => {
    if (!selected.size) return;
    await leadsRepo.bulkUpdate(Array.from(selected), changes);
    toast.success(msg);
    setSelected(new Set());
  };

  const bulkTagAction = async () => {
    const tag = bulkTag.trim();
    if (!tag || !selected.size) return;
    for (const l of selectedLeads) {
      const tags = Array.from(new Set([...(l.tags || []), tag]));
      await leadsRepo.update(l.id, { tags });
    }
    toast.success(`Tag "${tag}" added to ${selected.size} leads`);
    setBulkTag("");
    setSelected(new Set());
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-5 md:px-7 md:py-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-white">Leads</h1>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            {results.length.toLocaleString()} of {activeLeadsCount.toLocaleString()} businesses
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center rounded-xl border border-slate-200 p-0.5 dark:border-white/10">
            <button
              type="button"
              title="List view"
              onClick={() => setView("list")}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                viewMode === "list"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
              }`}
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Cards view"
              onClick={() => setView("cards")}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                viewMode === "cards"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("import")}>
            <Upload className="h-3.5 w-3.5" /> Import
          </Button>
          <Dropdown
            trigger={({ toggle }) => (
              <Button variant="outline" size="sm" onClick={toggle}>
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
            )}
            panelClassName="w-52"
          >
            {({ close }) => (
              <>
                <MenuLabel>Export</MenuLabel>
                <MenuItem
                  onClick={() => {
                    void exportLeads(results.length ? results : (allLeads || []), "csv", "leads");
                    close();
                    toast.success("CSV exported");
                  }}
                >
                  All results · CSV
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    void exportLeads(results.length ? results : (allLeads || []), "xlsx", "leads");
                    close();
                    toast.success("Excel exported");
                  }}
                >
                  All results · Excel
                </MenuItem>
                <MenuItem
                  disabled={!selected.size}
                  onClick={() => {
                    downloadCSV(
                      selectedLeads.map((l) => ({ ...l, tags: (l.tags || []).join("; ") })),
                      `leads-selected-${new Date().toISOString().slice(0, 10)}.csv`,
                    );
                    close();
                    toast.success(`${selected.size} leads exported`);
                  }}
                >
                  Selected ({selected.size}) · CSV
                </MenuItem>
              </>
            )}
          </Dropdown>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setQuickAddLeadId(null);
              setQuickAdd("lead");
            }}
          >
            Add lead
          </Button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            placeholder="Search name, phone, notes…"
            className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-[13px] outline-none transition focus:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
          {filters.q && (
            <button
              onClick={() => setFilters({ ...filters, q: "" })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <FilterBar filters={filters} setFilters={setFilters} sort={sort} setSort={setSort} activeCount={activeCount} />
      </div>

      <div className="mb-3">
        <ActiveFilterChips filters={filters} setFilters={setFilters} />
      </div>

      {selected.size > 0 && (
        <Card className="mb-3 flex flex-wrap items-center gap-2 bg-slate-50/80 px-3 py-2.5 dark:bg-white/[0.06]">
          <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{selected.size} selected</span>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Select
              className="w-[120px]"
              size="sm"
              value=""
              placeholder="Set tier"
              options={[1, 2, 3, 4, 5].map((t) => ({ value: String(t), label: `Tier ${t}` }))}
              onChange={(v) => v && bulk({ tier: Number(v) as Tier }, `Tier set for ${selected.size} leads`)}
            />
            <Select
              className="w-[140px]"
              size="sm"
              value=""
              placeholder="Set status"
              options={LEAD_STATUSES.map((s) => ({ value: s, label: s }))}
              onChange={(v) => v && bulk({ status: v }, `Status set for ${selected.size} leads`)}
            />
            <div className="flex items-center gap-1">
              <input
                value={bulkTag}
                onChange={(e) => setBulkTag(e.target.value)}
                placeholder="Add tag"
                className="h-8 w-[110px] rounded-lg border border-slate-200 bg-white px-2 text-[12px] outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
              <Button size="sm" variant="secondary" onClick={bulkTagAction} disabled={!bulkTag.trim()}>
                <Tag className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const due = toLocalInputValue(addDays(new Date(), 1).toISOString());
                for (const id of Array.from(selected)) {
                  void import("@/lib/repos").then(({ followupsRepo }) =>
                    followupsRepo.create({
                      lead_id: id,
                      title: `Follow up`,
                      due_date: new Date(due).toISOString(),
                    }),
                  );
                }
                toast.success(`Follow-ups scheduled for ${selected.size} leads`);
                setSelected(new Set());
              }}
            >
              <CalendarClock className="h-3.5 w-3.5" /> Follow-up
            </Button>
            <Button size="sm" variant="secondary" onClick={() => bulk({ is_pinned: true }, "Pinned")}>
              <Star className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="secondary" onClick={() => bulk({ is_archived: true }, "Archived")}>
              <Archive className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </Card>
      )}

      {activeLeadsCount === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No leads yet"
            description="Import a CSV or XLSX of Ethiopian businesses to start building your pipeline. Everything is stored locally and works offline."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" onClick={() => navigate("import")}>
                  <Upload className="h-4 w-4" /> Import leads
                </Button>
                <Button variant="outline" onClick={() => void seedSample()}>
                  <Sparkles className="h-4 w-4" /> Add sample leads
                </Button>
              </div>
            }
          />
        </Card>
      ) : viewMode === "cards" || isMobile ? (
        <VirtualizedCards leads={results} />
      ) : (
        <LeadTable
          leads={results}
          selected={selected}
          onToggle={toggle}
          onToggleAll={toggleAll}
          onOpen={openLead}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${selected.size} lead${selected.size === 1 ? "" : "s"}?`}
        message="This permanently removes the selected leads, their notes, activities and follow-ups from this device. They will also be deleted from the cloud on the next sync. Archiving is safer if you might need them later."
        confirmLabel="Delete permanently"
        onConfirm={async () => {
          for (const id of Array.from(selected)) await leadsRepo.remove(id);
          setSelected(new Set());
          toast.success("Leads deleted");
        }}
      />

      <LeadProfile leadId={leadId} onClose={closeLead} />
    </div>
  );
}

/** Card row estimate after simplified actions (Message / Search / Copy only) */
const CARD_ROW_EST = 200;

const VirtualizedCards = memo(function VirtualizedCards({ leads }: { leads: import("@/lib/types").Lead[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(() =>
    typeof window !== "undefined" ? (window.innerWidth >= 1280 ? 3 : window.innerWidth >= 640 ? 2 : 1) : 3,
  );

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setCols(w >= 1280 ? 3 : w >= 640 ? 2 : 1);
    };
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const rows = Math.ceil(leads.length / cols) || 0;
  const virtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CARD_ROW_EST,
    overscan: 2,
  });

  if (leads.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center dark:border-white/10">
        <div className="text-[15px] font-medium text-slate-900 dark:text-white">No leads match</div>
        <p className="mt-1 text-[13px] text-slate-500">Adjust filters or import a new batch.</p>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="max-h-[calc(100vh-280px)] min-h-[240px] overflow-y-auto pr-1">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualizer.getVirtualItems().map((vRow) => {
          const start = vRow.index * cols;
          const slice = leads.slice(start, start + cols);
          return (
            <div
              key={vRow.key}
              data-index={vRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vRow.start}px)`,
              }}
              className="grid grid-cols-1 gap-3 pb-3 sm:grid-cols-2 xl:grid-cols-3"
            >
              {slice.map((l) => (
                <LeadCard key={l.id} lead={l} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
});
