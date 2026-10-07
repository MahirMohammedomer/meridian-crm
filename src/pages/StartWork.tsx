import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import {
  Rocket,
  X,
  Settings2,
  Keyboard,
  ChevronLeft,
  ChevronRight,
  Phone,
  MessageCircle,
  MapPin,
  Search,
  Copy,
  Check,
  Star,
  Clock3,
  Sparkles,
  ArrowRight,
  Flag,
} from "lucide-react";
import { db, getSetting, setSetting } from "@/lib/db";
import { useApp } from "@/lib/app";
import { activitiesRepo, followupsRepo, leadsRepo, notesRepo } from "@/lib/repos";
import { Button, Card, Dialog, Field, Input, NativeSelect, SectionTitle, Switch, Textarea } from "@/components/ui/ui";
import { QuickActions } from "@/components/common/QuickActions";
import { TierBadge } from "@/components/leads/controls";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/lib/types";
import { addDays, cn, copyAllInfo, copyText, formatETB, timeAgo } from "@/lib/utils";
import { copyWebsiteBrief } from "@/lib/websiteBrief";

type QueueKey = "tier1" | "tier12" | "view" | "new" | "overdue" | "today" | "all";
type SortKey = "score" | "reviews" | "rating" | "tier" | "oldest" | "random";

interface Setup {
  queue: QueueKey;
  viewId: string;
  sort: SortKey;
  limit: number;
  autoAdvance: boolean;
}

const DEFAULT_SETUP: Setup = {
  queue: "tier12",
  viewId: "",
  sort: "score",
  limit: 20,
  autoAdvance: true,
};

export function StartWork() {
  const { navigate, openLead } = useApp();
  const [setup, setSetup] = useState<Setup>(DEFAULT_SETUP);
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [queue, setQueue] = useState<Lead[]>([]);
  const [showKeys, setShowKeys] = useState(false);
  const [note, setNote] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [done, setDone] = useState(false);
  const [results, setResults] = useState<Record<string, number>>({});
  const [processed, setProcessed] = useState<string[]>([]);

  const leads = useLiveQuery(async () => db.leads.toArray(), [], []);
  const followups = useLiveQuery(async () => db.follow_ups.toArray(), [], []);
  const views = useLiveQuery(async () => db.saved_views.toArray(), [], []);

  useEffect(() => {
    void getSetting<Setup>("startwork_setup").then((s) => s && setSetup({ ...DEFAULT_SETUP, ...s }));
  }, []);

  const buildQueue = useCallback(
    (cfg: Setup): Lead[] => {
      const all = (leads || []).filter((l) => !l.deleted_at && !l.is_archived);
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = addDays(startOfToday, 1);
      const openFu = (followups || []).filter((f) => f.status === "Pending" || f.status === "Overdue");

      let base: Lead[] = [];
      switch (cfg.queue) {
        case "tier1":
          base = all.filter((l) => l.tier === 1);
          break;
        case "tier12":
          base = all.filter((l) => l.tier === 1 || l.tier === 2);
          break;
        case "new":
          base = all.filter((l) => l.status === "New");
          break;
        case "overdue":
          base = all.filter((l) =>
            openFu.some((f) => f.lead_id === l.id && new Date(f.due_date) < startOfToday),
          );
          break;
        case "today":
          base = all.filter((l) =>
            openFu.some((f) => f.lead_id === l.id && new Date(f.due_date) >= startOfToday && new Date(f.due_date) < endOfToday),
          );
          break;
        case "view": {
          const v = (views || []).find((x) => x.id === cfg.viewId);
          const f = v?.filters || {};
          base = all.filter((l) => {
            if (f.tiers?.length && !f.tiers.includes(l.tier)) return false;
            if (f.statuses?.length && !f.statuses.includes(l.status)) return false;
            if (f.categories?.length && !f.categories.includes(l.category || "Uncategorized")) return false;
            if (f.cities?.length && !f.cities.includes(l.city || "Unknown")) return false;
            if (f.tags?.length && !f.tags.some((t: string) => (l.tags || []).includes(t))) return false;
            if (f.website === "yes" && !(l.website_status === "has_website" && l.website)) return false;
            if (f.website === "no" && l.website_status === "has_website" && l.website) return false;
            if (f.hasPhone === "yes" && !l.phone) return false;
            if (f.pinned === "yes" && !l.is_pinned) return false;
            if (f.ratingMin && (l.rating || 0) < f.ratingMin) return false;
            if (f.scoreMin && (l.lead_score || 0) < f.scoreMin) return false;
            return true;
          });
          break;
        }
        default:
          base = all;
      }

      const sorted = [...base].sort((a, b) => {
        switch (cfg.sort) {
          case "reviews":
            return (b.reviews_count || 0) - (a.reviews_count || 0);
          case "rating":
            return (b.rating || 0) - (a.rating || 0);
          case "tier":
            return (a.tier || 5) - (b.tier || 5) || (b.lead_score || 0) - (a.lead_score || 0);
          case "oldest":
            return (
              new Date(a.last_contacted_at || a.created_at).getTime() -
              new Date(b.last_contacted_at || b.created_at).getTime()
            );
          case "random":
            return Math.random() - 0.5;
          default:
            return (b.lead_score || 0) - (a.lead_score || 0);
        }
      });
      return cfg.limit > 0 ? sorted.slice(0, cfg.limit) : sorted;
    },
    [leads, followups, views],
  );

  const preview = useMemo(() => buildQueue(setup), [buildQueue, setup]);

  // Queue holds ordered IDs; always read the live lead so status/notes update immediately in the UI
  const queueIds = useMemo(() => queue.map((l) => l.id), [queue]);
  const currentId = queueIds[index];
  const current = useMemo(() => {
    if (!currentId) return undefined;
    const live = (leads || []).find((l) => l.id === currentId);
    return live || queue[index];
  }, [leads, currentId, queue, index]);

  // Keep snapshot queue objects in sync when Dexie pushes updates (status, pin, etc.)
  useEffect(() => {
    if (!running || !leads?.length) return;
    setQueue((prev) => {
      if (!prev.length) return prev;
      let changed = false;
      const next = prev.map((snap) => {
        const live = leads.find((l) => l.id === snap.id);
        if (live && live.updated_at !== snap.updated_at) {
          changed = true;
          return live;
        }
        return snap;
      });
      return changed ? next : prev;
    });
  }, [leads, running]);

  const start = () => {
    const q = buildQueue(setup);
    if (!q.length) return toast.error("No leads match this queue");
    void setSetting("startwork_setup", setup);
    setQueue(q);
    setIndex(0);
    setProcessed([]);
    setResults({});
    setDone(false);
    setRunning(true);
  };

  const finish = () => {
    setRunning(false);
    setDone(true);
  };

  const goNext = useCallback(() => {
    setNote("");
    if (index + 1 >= queue.length) finish();
    else setIndex((i) => i + 1);
  }, [index, queue.length]);

  const goPrev = () => {
    setNote("");
    setIndex((i) => Math.max(0, i - 1));
  };

  // Load next_action into the field whenever the current lead changes
  useEffect(() => {
    setNextAction(current?.next_action || "");
  }, [current?.id, current?.next_action]);

  const setStatus = useCallback(
    async (status: LeadStatus) => {
      if (!current) return;
      await leadsRepo.update(current.id, { status });
      // Optimistic local patch so the chip highlights before Dexie live query returns
      setQueue((prev) =>
        prev.map((l) => (l.id === current.id ? { ...l, status, updated_at: new Date().toISOString() } : l)),
      );
      setResults((r) => ({ ...r, [status]: (r[status] || 0) + 1 }));
      if (!processed.includes(current.id)) setProcessed((p) => [...p, current.id]);
      if (status === "Contacted" || status === "Replied" || status === "Meeting") {
        await activitiesRepo.create(current.id, status === "Meeting" ? "Meeting" : "Call", `Status set to ${status} in Start Work`);
      }
      toast.success(`${current.business_name} → ${status}`);
      if (setup.autoAdvance && status !== "Won" && status !== "Lost") {
        setTimeout(goNext, 900);
      }
    },
    [current, setup.autoAdvance, goNext, processed],
  );

  const addFollowUp = async (days: number) => {
    if (!current) return;
    await followupsRepo.create({
      lead_id: current.id,
      title: `Follow up with ${current.business_name}`,
      due_date: addDays(new Date(), days).toISOString(),
    });
    setResults((r) => ({ ...r, Followup: (r.Followup || 0) + 1 }));
    toast.success(`Follow-up set for ${days === 1 ? "tomorrow" : days === 3 ? "3 days" : "next week"}`);
  };

  const saveNote = async () => {
    if (!current || !note.trim()) return;
    await notesRepo.create(current.id, note.trim());
    setNote("");
    toast.success("Note saved");
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!running || showKeys) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName)) return;
      const k = e.key;
      if (k === "ArrowRight" || k === "Enter") {
        e.preventDefault();
        goNext();
      } else if (k === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (k.toLowerCase() === "c") {
        if (current?.phone) window.location.href = `tel:${current.phone.replace(/[^\d+]/g, "")}`;
      } else if (k.toLowerCase() === "w") {
        if (current?.phone) window.open(`https://wa.me/${current.phone.replace(/[^\d]/g, "")}`, "_blank");
      } else if (k.toLowerCase() === "t") {
        const handle = current?.telegram_username?.replace(/^@/, "");
        if (handle) window.open(`https://t.me/${handle}`, "_blank");
        else if (current?.phone) window.open(`https://t.me/+${current.phone.replace(/[^\d]/g, "")}`, "_blank");
      } else if (k.toLowerCase() === "g") {
        if (current) window.open(`https://www.google.com/search?q=${encodeURIComponent(`${current.business_name} ${current.city || ""}`)}`, "_blank");
      } else if (k.toLowerCase() === "m") {
        if (current?.google_maps_url) window.open(current.google_maps_url, "_blank");
      } else if (k === " ") {
        e.preventDefault();
        if (current) void copyText(copyAllInfo(current)).then(() => toast.success("Copied all info"));
      } else if (/^[0-9]$/.test(k)) {
        const idx = k === "0" ? 9 : Number(k) - 1;
        const st = LEAD_STATUSES[idx];
        if (st) void setStatus(st);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, current, goNext, setStatus, showKeys]);

  /* ------------------------------ render ------------------------------ */

  if (running && current) {
    const total = queue.length;
    const pct = ((index + 1) / total) * 100;
    return (
      <div className="fixed inset-0 z-[80] flex flex-col bg-[#f6f7f9] dark:bg-[#0b0c0f]">
        {/* Top bar */}
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/80 px-3 backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#0b0c0f]/80 md:px-5">
          <Button variant="ghost" size="sm" onClick={finish}>
            <X className="h-3.5 w-3.5" /> Exit Start Work
          </Button>
          <div className="mx-auto flex min-w-0 flex-1 items-center justify-center gap-3">
            <span className="whitespace-nowrap text-[13px] font-semibold text-slate-900 dark:text-white">
              LEAD {index + 1} OF {total}
            </span>
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-200 sm:w-56 dark:bg-white/10">
              <div className="h-full rounded-full bg-slate-900 transition-all dark:bg-white" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Auto-advance"
            onClick={async () => {
              const next = !setup.autoAdvance;
              setSetup({ ...setup, autoAdvance: next });
              await setSetting("startwork_setup", { ...setup, autoAdvance: next });
              toast.success(next ? "Auto-advance on" : "Auto-advance off");
            }}
          >
            <Settings2 className={cn("h-4 w-4", setup.autoAdvance && "text-emerald-500")} />
          </Button>
          <Button variant="ghost" size="icon-sm" title="Keyboard shortcuts" onClick={() => setShowKeys(true)}>
            <Keyboard className="h-4 w-4" />
          </Button>
        </div>

        {/* Focus card */}
        <div className="flex-1 overflow-y-auto px-3 py-4 md:px-6 md:py-6">
          <div className="mx-auto max-w-3xl">
            <Card className="overflow-hidden">
              <div className="border-b border-slate-100 p-5 dark:border-white/5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-slate-900 dark:text-white">
                      {current.business_name || "(unnamed)"}
                    </h1>
                    <p className="mt-1 text-[14px] text-slate-500 dark:text-slate-400">
                      {[current.category, current.city || current.address].filter(Boolean).join(" · ") || "No category"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TierBadge lead={current} />
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200">
                      Score {current.lead_score ?? 0}
                    </span>
                    {current.is_pinned && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13.5px] text-slate-600 dark:text-slate-300">
                  {current.rating ? (
                    <span>
                      ⭐ {current.rating}
                      {current.reviews_count ? ` · ${current.reviews_count} reviews` : ""}
                    </span>
                  ) : null}
                  <span className={current.website_status === "has_website" ? "text-emerald-600" : "text-red-500"}>
                    {current.website_status === "has_website" ? "✅ Has website" : "❌ No website"}
                  </span>
                  {current.phone && <span>📞 {current.phone}</span>}
                  <span className="inline-flex items-center gap-1 text-slate-400">
                    <Clock3 className="h-3.5 w-3.5" />
                    Last: {current.last_contacted_at ? timeAgo(current.last_contacted_at) : "never"}
                  </span>
                  {current.potential_value ? <span>💰 {formatETB(current.potential_value)}</span> : null}
                </div>

                {current.why_scored && (
                  <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[13px] text-slate-600 dark:bg-white/5 dark:text-slate-300">
                    <b>Why:</b> {current.why_scored}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <QuickActions
                    lead={current}
                    size="md"
                    show={["message", "research", "copy"]}
                    className="gap-2"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    title="Copy website build prompt for Arena"
                    onClick={async () => {
                      try {
                        const { missing } = await copyWebsiteBrief(current, { markProposal: false });
                        // Reflect stamp on current queue card
                        setQueue((prev) =>
                          prev.map((l) =>
                            l.id === current.id
                              ? {
                                  ...l,
                                  custom_fields: {
                                    ...(l.custom_fields || {}),
                                    last_brief_copied_at: new Date().toISOString(),
                                  },
                                  updated_at: new Date().toISOString(),
                                }
                              : l,
                          ),
                        );
                        if (missing.length) {
                          toast.success(`Brief copied — missing: ${missing.join(", ")}`);
                        } else {
                          toast.success("Website brief copied — paste into Arena");
                        }
                      } catch (e: any) {
                        toast.error(e?.message || "Copy failed");
                      }
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Website brief
                  </Button>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Next action">
                    <div className="flex gap-2">
                      <Input
                        value={nextAction}
                        onChange={(e) => setNextAction(e.target.value)}
                        placeholder="Call owner Friday"
                        onBlur={async () => {
                          if (nextAction !== (current.next_action || "")) {
                            await leadsRepo.update(current.id, { next_action: nextAction });
                            setQueue((prev) =>
                              prev.map((l) =>
                                l.id === current.id
                                  ? { ...l, next_action: nextAction, updated_at: new Date().toISOString() }
                                  : l,
                              ),
                            );
                          }
                        }}
                      />
                      <Button
                        variant="secondary"
                        onClick={async () => {
                          await leadsRepo.update(current.id, { next_action: nextAction });
                          setQueue((prev) =>
                            prev.map((l) =>
                              l.id === current.id
                                ? { ...l, next_action: nextAction, updated_at: new Date().toISOString() }
                                : l,
                            ),
                          );
                          toast.success("Next action saved");
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  </Field>
                  <Field label="Add note">
                    <div className="flex gap-2">
                      <Input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Owner asked for portfolio…"
                        onKeyDown={(e) => e.key === "Enter" && saveNote()}
                      />
                      <Button variant="secondary" onClick={saveNote}>
                        Add
                      </Button>
                    </div>
                  </Field>
                </div>

                <div>
                  <SectionTitle className="mb-2">Set status</SectionTitle>
                  <div className="flex flex-wrap gap-1.5">
                    {LEAD_STATUSES.map((st, i) => (
                      <button
                        key={st}
                        onClick={() => void setStatus(st)}
                        className={cn(
                          "rounded-xl border px-3 py-1.5 text-[13px] font-medium transition",
                          current.status === st
                            ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                            : st === "Won"
                              ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-400"
                              : st === "Lost" || st === "Not Interested"
                                ? "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400"
                                : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10",
                        )}
                      >
                        {st}
                        <span className="ml-1.5 text-[10px] opacity-50">{i === 9 ? "0" : i + 1}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <SectionTitle className="mb-2">Schedule follow-up</SectionTitle>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "Tomorrow", days: 1 },
                      { label: "In 3 days", days: 3 },
                      { label: "Next week", days: 7 },
                    ].map((o) => (
                      <Button key={o.label} variant="outline" size="sm" onClick={() => void addFollowUp(o.days)}>
                        <Clock3 className="h-3.5 w-3.5" /> {o.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t border-slate-100 pt-4 dark:border-white/5">
                  <Button variant="outline" onClick={goPrev} disabled={index === 0}>
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </Button>
                  <Button variant="ghost" onClick={goNext}>
                    Skip <ArrowRight className="h-4 w-4" />
                  </Button>
                  <div className="ml-auto flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openLead(current.id)}>
                      Open full profile
                    </Button>
                    <Button variant="primary" onClick={goNext}>
                      {index + 1 >= total ? "Finish" : "Next lead"} <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <Dialog
          open={showKeys}
          onClose={() => setShowKeys(false)}
          title="Keyboard shortcuts"
          size="sm"
        >
          <div className="space-y-1.5 text-[13px]">
            {[
              ["→ / Enter", "Next lead"],
              ["←", "Previous lead"],
              ["Space", "Copy all info"],
              ["C", "Call"],
              ["W", "WhatsApp"],
              ["T", "Telegram"],
              ["G", "Google search"],
              ["M", "Google Maps"],
              ["1 – 9 / 0", "Set status"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded-lg px-2 py-1.5 odd:bg-slate-50 dark:odd:bg-white/5">
                <kbd className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] dark:border-white/10">{k}</kbd>
                <span className="text-slate-600 dark:text-slate-300">{v}</span>
              </div>
            ))}
          </div>
        </Dialog>
      </div>
    );
  }

  if (done) {
    const totalProcessed = processed.length;
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <Card className="p-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
            <Check className="h-7 w-7" />
          </div>
          <h2 className="text-[20px] font-semibold text-slate-900 dark:text-white">Session complete</h2>
          <p className="mt-1 text-[13.5px] text-slate-500 dark:text-slate-400">
            You processed {totalProcessed} lead{totalProcessed === 1 ? "" : "s"} from a queue of {queue.length}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(results).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                <div className="text-[17px] font-semibold text-slate-900 dark:text-white">{v}</div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">{k}</div>
              </div>
            ))}
            {Object.keys(results).length === 0 && (
              <div className="col-span-full rounded-xl bg-slate-50 p-4 text-[13px] text-slate-400 dark:bg-white/5">
                No status changes this session
              </div>
            )}
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button
              variant="primary"
              onClick={() => {
                setDone(false);
                setRunning(false);
              }}
            >
              <Rocket className="h-4 w-4" /> Start another queue
            </Button>
            <Button variant="outline" onClick={() => navigate("dashboard")}>
              Back to dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  /* ------------------------------ setup ------------------------------ */

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
          <Rocket className="h-7 w-7" />
        </div>
        <h1 className="text-[24px] font-semibold tracking-tight text-slate-900 dark:text-white">Start Work</h1>
        <p className="mt-1 text-[13.5px] text-slate-500 dark:text-slate-400">
          Process leads one by one, distraction free. Works fully offline.
        </p>
      </div>

      <Card className="p-5">
        <div className="space-y-4">
          <Field label="Queue">
            <NativeSelect value={setup.queue} onChange={(e) => setSetup({ ...setup, queue: e.target.value as QueueKey })}>
              <option value="tier12">Tier 1 + Tier 2</option>
              <option value="tier1">Tier 1 only</option>
              <option value="new">All New leads</option>
              <option value="today">Today's follow-ups</option>
              <option value="overdue">Overdue follow-ups</option>
              <option value="view">Saved view…</option>
              <option value="all">All leads</option>
            </NativeSelect>
          </Field>

          {setup.queue === "view" && (
            <Field label="Saved view">
              <NativeSelect value={setup.viewId} onChange={(e) => setSetup({ ...setup, viewId: e.target.value })}>
                <option value="">— select a view —</option>
                {(views || []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Sort by">
              <NativeSelect value={setup.sort} onChange={(e) => setSetup({ ...setup, sort: e.target.value as SortKey })}>
                <option value="score">Score (high → low)</option>
                <option value="reviews">Reviews (high → low)</option>
                <option value="rating">Rating (high → low)</option>
                <option value="tier">Tier (1 first)</option>
                <option value="oldest">Oldest contact first</option>
                <option value="random">Random</option>
              </NativeSelect>
            </Field>
            <Field label="Limit">
              <NativeSelect value={String(setup.limit)} onChange={(e) => setSetup({ ...setup, limit: Number(e.target.value) })}>
                <option value="10">10 leads</option>
                <option value="20">20 leads</option>
                <option value="50">50 leads</option>
                <option value="100">100 leads</option>
                <option value="0">All</option>
              </NativeSelect>
            </Field>
          </div>

          <label className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-white/5">
            <span className="text-[13px] text-slate-600 dark:text-slate-300">Auto-advance after status change</span>
            <Switch checked={setup.autoAdvance} onChange={(v) => setSetup({ ...setup, autoAdvance: v })} />
          </label>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 dark:border-white/10">
            <span className="text-[13px] text-slate-600 dark:text-slate-300">
              <Flag className="mr-1.5 inline h-3.5 w-3.5" />
              {preview.length} leads match
            </span>
            <Button variant="primary" onClick={start} disabled={!preview.length}>
              <Rocket className="h-4 w-4" /> Start
            </Button>
          </div>

          {preview.length > 0 && (
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {preview.slice(0, 8).map((l) => (
                <div key={l.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] odd:bg-slate-50 dark:odd:bg-white/5">
                  <TierBadge lead={l} size="xs" />
                  <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{l.business_name}</span>
                  <span className="tabular-nums text-slate-400">{l.lead_score ?? 0}</span>
                </div>
              ))}
              {preview.length > 8 && (
                <div className="px-2 py-1 text-[11.5px] text-slate-400">+{preview.length - 8} more…</div>
              )}
            </div>
          )}
        </div>
      </Card>

      <div className="mt-4 text-center">
        <Button variant="ghost" size="sm" onClick={() => navigate("dashboard")}>
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
