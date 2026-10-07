import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, FolderKanban, ListChecks, Users, Plus, Check } from "lucide-react";
import { db } from "@/lib/db";
import { useApp } from "@/lib/app";
import { followupsRepo } from "@/lib/repos";
import { Button, Card, Dialog, EmptyState, Field, Input, NativeSelect, Tabs } from "@/components/ui/ui";
import { TierBadge } from "@/components/leads/controls";
import { addDays, cn, dueLabel, formatDate, startOfDay, telHref, waHref } from "@/lib/utils";
import { toast } from "sonner";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type EvType = "followup" | "task" | "deadline" | "meeting";

interface CalEvent {
  id: string;
  type: EvType;
  date: Date;
  title: string;
  sub?: string;
  leadId?: string;
  projectId?: string;
  done?: boolean;
}

const META: Record<EvType, { label: string; dot: string; chip: string; icon: any }> = {
  followup: {
    label: "Follow-ups",
    dot: "bg-blue-500",
    chip: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
    icon: Clock,
  },
  task: {
    label: "Task deadlines",
    dot: "bg-orange-500",
    chip: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300",
    icon: ListChecks,
  },
  deadline: {
    label: "Project deadlines",
    dot: "bg-purple-500",
    chip: "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300",
    icon: FolderKanban,
  },
  meeting: {
    label: "Meetings",
    dot: "bg-emerald-500",
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
    icon: Users,
  },
};

export function CalendarPage() {
  const { openLead, openProject, navigate } = useApp();
  const [view, setView] = useState("month");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [createOpen, setCreateOpen] = useState(false);
  const [fu, setFu] = useState<any>({ lead_id: "", title: "", due: "" });

  const followups = useLiveQuery(async () => db.follow_ups.toArray(), [], []);
  const projects = useLiveQuery(async () => db.projects.toArray(), [], []);
  const tasks = useLiveQuery(async () => db.project_tasks.toArray(), [], []);
  const leads = useLiveQuery(async () => db.leads.toArray(), [], []);
  const activities = useLiveQuery(async () => db.lead_activities.toArray(), [], []);

  const leadMap = useMemo(() => new Map((leads || []).map((l) => [l.id, l])), [leads]);
  const projectMap = useMemo(() => new Map((projects || []).map((p) => [p.id, p])), [projects]);

  const events = useMemo<CalEvent[]>(() => {
    const out: CalEvent[] = [];
    (followups || []).forEach((f) => {
      const lead = leadMap.get(f.lead_id);
      out.push({
        id: f.id,
        type: "followup",
        date: new Date(f.due_date),
        title: lead?.business_name || f.title,
        sub: f.title,
        leadId: f.lead_id,
        done: f.status === "Done" || f.status === "Cancelled",
      });
    });
    (tasks || []).forEach((t) => {
      if (!t.due_date) return;
      out.push({
        id: t.id,
        type: "task",
        date: new Date(t.due_date),
        title: t.title,
        sub: projectMap.get(t.project_id)?.name,
        projectId: t.project_id,
        done: t.status === "Done",
      });
    });
    (projects || []).forEach((p) => {
      if (!p.deadline) return;
      out.push({
        id: p.id,
        type: "deadline",
        date: new Date(p.deadline),
        title: `${p.name} deadline`,
        projectId: p.id,
        done: p.stage === "Completed",
      });
    });
    (activities || []).forEach((a) => {
      if (a.type !== "Meeting") return;
      out.push({
        id: a.id,
        type: "meeting",
        date: new Date(a.created_at),
        title: a.content.slice(0, 60),
        sub: leadMap.get(a.lead_id)?.business_name,
        leadId: a.lead_id,
      });
    });
    return out;
  }, [followups, tasks, projects, activities, leadMap, projectMap]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    events.forEach((e) => {
      const k = startOfDay(e.date).toDateString();
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    });
    return map;
  }, [events]);

  const monthDays = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startDow = (first.getDay() + 6) % 7;
    const start = addDays(first, -startDow);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const weekDays = useMemo(() => {
    const dow = (selected.getDay() + 6) % 7;
    const start = addDays(selected, -dow);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selected]);

  const selectedEvents = eventsByDay.get(selected.toDateString()) || [];
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const move = (dir: number) => {
    if (view === "month") setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1));
    else {
      const d = new Date(selected);
      d.setDate(d.getDate() + dir * (view === "week" ? 7 : 1));
      setSelected(startOfDay(d));
      setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  };

  const openEvent = (e: CalEvent) => {
    if (e.type === "task" || e.type === "deadline") {
      if (e.projectId) openProject(e.projectId);
      else navigate("projects");
    } else if (e.leadId) openLead(e.leadId);
  };

  const DayCell = ({ d, compact }: { d: Date; compact?: boolean }) => {
    const evs = eventsByDay.get(d.toDateString()) || [];
    const isToday = d.toDateString() === new Date().toDateString();
    const isSel = d.toDateString() === selected.toDateString();
    return (
      <button
        onClick={() => setSelected(d)}
        onDoubleClick={() => {
          setSelected(d);
          const iso = new Date(d);
          iso.setHours(9, 0, 0, 0);
          setFu({ lead_id: "", title: "", due: iso.toISOString().slice(0, 16) });
          setCreateOpen(true);
        }}
        className={cn(
          "border-b border-r border-slate-100 p-1.5 text-left align-top transition dark:border-white/[0.05]",
          compact ? "min-h-[120px]" : "min-h-[86px]",
          isSel ? "bg-slate-100 dark:bg-white/10" : "hover:bg-slate-50 dark:hover:bg-white/[0.03]",
          d.getMonth() !== cursor.getMonth() && view === "month" && "opacity-40",
        )}
      >
        <div
          className={cn(
            "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-medium",
            isToday ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 dark:text-slate-300",
          )}
        >
          {d.getDate()}
        </div>
        <div className="space-y-0.5">
          {evs.slice(0, compact ? 6 : 3).map((e) => (
            <div
              key={e.id + e.type}
              className={cn("truncate rounded px-1 py-0.5 text-[10.5px]", META[e.type].chip, e.done && "opacity-50 line-through")}
            >
              {e.title}
            </div>
          ))}
          {evs.length > (compact ? 6 : 3) && <div className="px-1 text-[10px] text-slate-400">+{evs.length - (compact ? 6 : 3)} more</div>}
        </div>
      </button>
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-5 md:px-7 md:py-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-white">Calendar</h1>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            Follow-ups, task deadlines, project deadlines and meetings — all from your local database
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            className="w-[220px]"
            value={view}
            onChange={setView}
            tabs={[
              { value: "month", label: "Month" },
              { value: "week", label: "Week" },
              { value: "day", label: "Day" },
            ]}
          />
          <Button variant="outline" size="icon-sm" onClick={() => move(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[150px] text-center text-[14px] font-semibold text-slate-900 dark:text-white">
            {view === "day"
              ? selected.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
              : monthLabel}
          </span>
          <Button variant="outline" size="icon-sm" onClick={() => move(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const d = new Date();
              setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
              setSelected(startOfDay(d));
            }}
          >
            Today
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              const d = new Date(selected);
              d.setHours(9, 0, 0, 0);
              setFu({ lead_id: "", title: "", due: d.toISOString().slice(0, 16) });
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add event
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card className="overflow-hidden">
          {view === "month" && (
            <>
              <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60 dark:border-white/5 dark:bg-white/[0.03]">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthDays.map((d) => (
                  <DayCell key={d.toISOString()} d={d} />
                ))}
              </div>
            </>
          )}

          {view === "week" && (
            <>
              <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60 dark:border-white/5 dark:bg-white/[0.03]">
                {weekDays.map((d) => (
                  <div key={d.toISOString()} className="px-2 py-2 text-center">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {d.toLocaleDateString(undefined, { weekday: "short" })}
                    </div>
                    <div
                      className={cn(
                        "mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[12px]",
                        d.toDateString() === new Date().toDateString()
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                          : "text-slate-600 dark:text-slate-300",
                      )}
                    >
                      {d.getDate()}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {weekDays.map((d) => (
                  <DayCell key={d.toISOString()} d={d} compact />
                ))}
              </div>
            </>
          )}

          {view === "day" && (
            <div className="p-4">
              <div className="mb-3 text-[15px] font-semibold text-slate-900 dark:text-white">
                {selected.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </div>
              {selectedEvents.length === 0 ? (
                <EmptyState className="py-10" icon={<CalendarDays className="h-5 w-5" />} title="Nothing on this day" />
              ) : (
                <div className="space-y-2">
                  {selectedEvents
                    .slice()
                    .sort((a, b) => a.date.getTime() - b.date.getTime())
                    .map((e) => (
                      <EventRow key={e.id + e.type} e={e} onOpen={() => openEvent(e)} />
                    ))}
                </div>
              )}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="border-b border-slate-100 px-4 py-3 dark:border-white/5">
              <div className="text-[14px] font-semibold text-slate-900 dark:text-white">
                {selected.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </div>
              <div className="text-[12px] text-slate-400">{selectedEvents.length} item(s)</div>
            </div>
            {selectedEvents.length === 0 ? (
              <EmptyState className="py-8" icon={<CalendarDays className="h-5 w-5" />} title="Nothing scheduled" />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {selectedEvents.map((e) => (
                  <EventRow key={e.id + e.type} e={e} onOpen={() => openEvent(e)} />
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Legend</div>
            <div className="space-y-1.5">
              {(Object.keys(META) as EvType[]).map((t) => (
                <div key={t} className="flex items-center gap-2 text-[12.5px] text-slate-600 dark:text-slate-300">
                  <span className={cn("h-2 w-2 rounded-full", META[t].dot)} />
                  {META[t].label}
                  <span className="ml-auto text-[11.5px] text-slate-400">
                    {events.filter((e) => e.type === t).length}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-slate-400">
              Double-click any day to create a follow-up for that day.
            </p>
          </Card>
        </div>
      </div>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add follow-up"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!fu.lead_id) return toast.error("Pick a lead");
                const lead = leadMap.get(fu.lead_id);
                await followupsRepo.create({
                  lead_id: fu.lead_id,
                  title: fu.title.trim() || `Follow up with ${lead?.business_name || "lead"}`,
                  due_date: new Date(fu.due).toISOString(),
                });
                toast.success("Follow-up created");
                setCreateOpen(false);
              }}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Lead">
            <NativeSelect value={fu.lead_id} onChange={(e) => setFu({ ...fu, lead_id: e.target.value })}>
              <option value="">— select —</option>
              {(leads || []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.business_name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Title">
            <Input value={fu.title} onChange={(e) => setFu({ ...fu, title: e.target.value })} placeholder="Follow up with…" />
          </Field>
          <Field label="Date and time">
            <Input type="datetime-local" value={fu.due} onChange={(e) => setFu({ ...fu, due: e.target.value })} />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}

function EventRow({ e, onOpen }: { e: CalEvent; onOpen: () => void }) {
  const meta = META[e.type];
  const Icon = meta.icon;
  const lead = useLiveQuery(async () => (e.leadId ? db.leads.get(e.leadId) : undefined), [e.leadId]);
  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-2">
        <span className={cn("mt-0.5 h-2 w-2 shrink-0 rounded-full", meta.dot)} />
        <div className="min-w-0 flex-1">
          <button onClick={onOpen} className="truncate text-left text-[13.5px] font-medium text-slate-900 hover:underline dark:text-white">
            {e.title}
          </button>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-slate-400">
            <Icon className="h-3 w-3" />
            {meta.label.replace(/s$/, "")}
            <span>· {dueLabel(e.date.toISOString())}</span>
            {lead && <TierBadge lead={lead} size="xs" />}
          </div>
          {e.sub && <div className="mt-0.5 truncate text-[11.5px] text-slate-400">{e.sub}</div>}
        </div>
      </div>
      {e.type === "followup" && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-4">
          {!e.done && (
            <Button
              size="xs"
              variant="success"
              onClick={async () => {
                await followupsRepo.complete(e.id);
                toast.success("Marked done");
              }}
            >
              <Check className="h-3 w-3" /> Done
            </Button>
          )}
          {lead?.phone && (
            <>
              <a href={telHref(lead.phone)}>
                <Button size="xs" variant="outline">📞 Call</Button>
              </a>
              <a href={waHref(lead.phone)} target="_blank" rel="noreferrer">
                <Button size="xs" variant="outline">💬 WhatsApp</Button>
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export { formatDate };
