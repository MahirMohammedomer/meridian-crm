import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Flame,
  CalendarClock,
  AlertTriangle,
  MessageSquareReply,
  FolderKanban,
  Wallet,
  Star,
  ArrowRight,
  Upload,
  Phone,
  MessageCircle,
  Check,
  Clock,
  Users,
  Trophy,
  TrendingUp,
  Sparkles,
  Rocket,
  Users2,
  ListChecks,
  Plus,
  ExternalLink,
} from "lucide-react";
import { db } from "@/lib/db";
import { useApp } from "@/lib/app";
import { followupsRepo, tasksRepo } from "@/lib/repos";
import { Button, Card, EmptyState, Progress, SectionTitle } from "@/components/ui/ui";
import { TelegramButton } from "@/components/common/QuickActions";
import { PinButton, ScoreChip, TierBadge } from "@/components/leads/controls";
import {
  addDays,
  cn,
  dueLabel,
  formatDate,
  formatETB,
  greeting,
  STAGE_STYLES,
  telHref,
  timeAgo,
  waHref,
} from "@/lib/utils";
import { toast } from "sonner";
import type { Lead } from "@/lib/types";

export function Dashboard() {
  const { navigate, openLead, openProject, setQuickAdd, setQuickAddLeadId } = useApp();

  const leads = useLiveQuery(async () => db.leads.toArray(), [], []);
  const followups = useLiveQuery(async () => db.follow_ups.toArray(), [], []);
  const projects = useLiveQuery(async () => db.projects.toArray(), [], []);
  const tasks = useLiveQuery(async () => db.project_tasks.toArray(), [], []);
  const payments = useLiveQuery(async () => db.payments.toArray(), [], []);
  const activities = useLiveQuery(async () => db.lead_activities.toArray(), [], []);
  const recent = useLiveQuery(async () => db.recently_viewed.orderBy("viewed_at").reverse().limit(10).toArray(), [], []);
  const views = useLiveQuery(async () => db.saved_views.toArray(), [], []);

  const stats = useMemo(() => {
    const active = (leads || []).filter((l) => !l.deleted_at && !l.is_archived);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = addDays(startOfToday, 1);
    const pendingFu = (followups || []).filter((f) => f.status === "Pending" || f.status === "Overdue");
    const dueToday = pendingFu
      .filter((f) => {
        const d = new Date(f.due_date);
        return d >= startOfToday && d < endOfToday;
      })
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    const overdue = pendingFu
      .filter((f) => new Date(f.due_date) < startOfToday)
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    const weekAgo = addDays(new Date(), -7);
    const replied = active.filter((l) => l.status === "Replied" && l.updated_at && new Date(l.updated_at) >= weekAgo);
    const meetings = (activities || []).filter((a) => {
      const d = new Date(a.created_at);
      return a.type === "Meeting" && d >= startOfToday && d < endOfToday;
    });

    const openTasks = (tasks || []).filter((t) => t.status !== "Done");
    const tasksDueToday = openTasks.filter((t) => {
      if (!t.due_date) return false;
      const d = new Date(t.due_date);
      return d >= startOfToday && d < endOfToday;
    });
    const tasksOverdue = openTasks.filter((t) => t.due_date && new Date(t.due_date) < startOfToday);
    const tasksDone = (tasks || []).filter((t) => t.status === "Done").length;

    const activeProjects = (projects || []).filter((p) => p.stage !== "Completed");
    const outstanding = activeProjects.reduce((s, p) => s + Math.max(0, (p.value || 0) - (p.paid || 0)), 0);
    const clients = active.filter((l) => l.status === "Won");
    const potential = active.reduce((s, l) => s + (l.potential_value || 0), 0);
    const wonValue = clients.reduce((s, l) => s + (l.potential_value || 0), 0);
    const paid = (projects || []).reduce((s, p) => s + (p.paid || 0), 0);

    const owing = activeProjects
      .map((p) => ({ project: p, lead: active.find((l) => l.id === p.client_lead_id), due: Math.max(0, (p.value || 0) - (p.paid || 0)) }))
      .filter((x) => x.due > 0)
      .sort((a, b) => b.due - a.due)
      .slice(0, 5);

    return {
      total: active.length,
      tier1: active.filter((l) => l.tier === 1).length,
      priority: active.filter((l) => l.tier === 1 && (l.status === "New" || l.status === "Contacted")).length,
      new: active.filter((l) => l.status === "New").length,
      contacted: active.filter((l) => l.status === "Contacted").length,
      won: clients.length,
      dueToday,
      overdue,
      replied: replied.length,
      meetings: meetings.length,
      activeProjects: activeProjects.length,
      tasksDueToday,
      tasksOverdue,
      tasksDone,
      outstanding,
      potential,
      wonValue,
      paid,
      owing,
      pinned: active.filter((l) => l.is_pinned).sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0)),
      fresh: active
        .filter((l) => (l.tier === 1 || l.tier === 2) && l.status === "New")
        .sort((a, b) => (a.tier || 5) - (b.tier || 5) || (b.lead_score || 0) - (a.lead_score || 0))
        .slice(0, 6),
      nextUp: active
        .filter((l) => l.status === "New" || l.status === "Contacted" || l.status === "Follow-up")
        .sort((a, b) => (a.tier || 5) - (b.tier || 5) || (b.lead_score || 0) - (a.lead_score || 0))
        .slice(0, 5),
      activeProjectList: activeProjects
        .slice()
        .sort((a, b) => new Date(a.deadline || 9e15).getTime() - new Date(b.deadline || 9e15).getTime())
        .slice(0, 4),
    };
  }, [leads, followups, projects, tasks, payments, activities]);

  const recentLeads = useMemo(() => {
    const map = new Map((leads || []).map((l) => [l.id, l]));
    return (recent || []).map((r) => map.get(r.lead_id)).filter(Boolean) as Lead[];
  }, [recent, leads]);

  const pinnedViews = (views || []).filter((v) => (v as any).pinned);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-5 md:px-7 md:py-7">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-slate-900 dark:text-white">
            {greeting()}, owner
          </h1>
          <p className="mt-1 text-[13.5px] text-slate-500 dark:text-slate-400">
            {stats.dueToday.length + stats.overdue.length > 0
              ? `You have ${stats.dueToday.length} follow-up${stats.dueToday.length === 1 ? "" : "s"} today and ${stats.overdue.length} overdue.`
              : "Nothing urgent. Time to find the next client."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate("import")}>
            <Upload className="h-4 w-4" /> Import leads
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setQuickAddLeadId(null);
              setQuickAdd("lead");
            }}
          >
            <Plus className="h-4 w-4" /> Add lead
          </Button>
          <Button variant="primary" onClick={() => navigate("startwork")}>
            <Rocket className="h-4 w-4" /> Start Work
          </Button>
        </div>
      </div>

      {/* Attention needed */}
      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
        <Attention icon={<Flame className="h-4 w-4" />} label="Priority leads" value={stats.priority} tone="red" onClick={() => navigate("leads")} />
        <Attention icon={<CalendarClock className="h-4 w-4" />} label="Follow-ups today" value={stats.dueToday.length} tone="amber" onClick={() => navigate("followups")} />
        <Attention icon={<AlertTriangle className="h-4 w-4" />} label="Overdue" value={stats.overdue.length} tone="red" onClick={() => navigate("followups")} />
        <Attention icon={<MessageSquareReply className="h-4 w-4" />} label="Replies (7d)" value={stats.replied} tone="cyan" onClick={() => navigate("pipeline")} />
        <Attention icon={<Users2 className="h-4 w-4" />} label="Meetings today" value={stats.meetings} tone="emerald" onClick={() => navigate("calendar")} />
        <Attention icon={<FolderKanban className="h-4 w-4" />} label="Active projects" value={stats.activeProjects} tone="violet" onClick={() => navigate("projects")} />
        <Attention icon={<ListChecks className="h-4 w-4" />} label="Tasks due today" value={stats.tasksDueToday.length + stats.tasksOverdue.length} tone="amber" onClick={() => navigate("tasks")} />
        <Attention icon={<Wallet className="h-4 w-4" />} label="Outstanding" value={formatETB(stats.outstanding)} tone="emerald" onClick={() => navigate("projects")} />
      </div>

      {pinnedViews.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-slate-400">Quick views:</span>
          {pinnedViews.map((v) => (
            <button
              key={v.id}
              onClick={() => {
                window.location.hash = "#/leads";
                toast.success(`View "${v.name}" — open Leads and pick it from Views`);
              }}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-medium text-slate-600 transition hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
            >
              {(v as any).icon || "🔖"} {v.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Follow-ups */}
          <Card>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/5">
              <SectionTitle>Follow-ups due today</SectionTitle>
              <Button size="xs" variant="ghost" onClick={() => navigate("followups")}>
                All follow-ups <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {stats.dueToday.length === 0 && stats.overdue.length === 0 && (
                <EmptyState
                  className="py-8"
                  icon={<Check className="h-5 w-5" />}
                  title="Nothing due today"
                  description="Schedule follow-ups from any lead profile to build your daily list."
                />
              )}
              {[...stats.overdue, ...stats.dueToday].slice(0, 8).map((f) => {
                const lead = (leads || []).find((l) => l.id === f.lead_id);
                const overdue = new Date(f.due_date) < new Date(new Date().setHours(0, 0, 0, 0));
                return (
                  <div key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => lead && openLead(lead.id)}
                        className="truncate text-[13.5px] font-semibold text-slate-900 hover:underline dark:text-white"
                      >
                        {lead?.business_name || f.title}
                      </button>
                      <div className="mt-0.5 flex items-center gap-2 text-[11.5px]">
                        <span className={overdue ? "font-medium text-red-500" : "text-slate-400"}>
                          <Clock className="mr-1 inline h-3 w-3" />
                          {dueLabel(f.due_date)}
                        </span>
                        {lead?.phone && <span className="text-slate-400">{lead.phone}</span>}
                      </div>
                    </div>
                    {lead && <TierBadge lead={lead} size="xs" />}
                    <div className="flex gap-1">
                      <a href={lead?.phone ? telHref(lead.phone) : undefined}>
                        <MiniAction title="Call" disabled={!lead?.phone}>
                          <Phone className="h-3.5 w-3.5" />
                        </MiniAction>
                      </a>
                      <a href={lead?.phone ? waHref(lead.phone) : undefined} target="_blank" rel="noreferrer">
                        <MiniAction title="WhatsApp" disabled={!lead?.phone}>
                          <MessageCircle className="h-3.5 w-3.5" />
                        </MiniAction>
                      </a>
                      {lead && <TelegramButton lead={lead} size="sm" />}
                      <MiniAction
                        title="Mark done"
                        onClick={async () => {
                          await followupsRepo.complete(f.id);
                          toast.success("Follow-up done");
                        }}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </MiniAction>
                      <MiniAction
                        title="Reschedule tomorrow"
                        onClick={async () => {
                          await followupsRepo.update(f.id, {
                            due_date: addDays(new Date(), 1).toISOString(),
                            status: "Pending",
                          });
                          toast.success("Rescheduled to tomorrow");
                        }}
                      >
                        <Clock className="h-3.5 w-3.5" />
                      </MiniAction>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Priority queue — Next Up */}
          <Card>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/5">
              <SectionTitle>Next up · priority queue</SectionTitle>
              <Button size="xs" variant="ghost" onClick={() => navigate("startwork")}>
                Start Work <Rocket className="h-3 w-3" />
              </Button>
            </div>
            {stats.nextUp.length === 0 ? (
              <EmptyState className="py-7" icon={<Flame className="h-5 w-5" />} title="Queue is empty" />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {stats.nextUp.map((l, i) => (
                  <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-4 text-center text-[12px] font-semibold text-slate-300">{i + 1}</span>
                    <PinButton lead={l} />
                    <button onClick={() => openLead(l.id)} className="min-w-0 flex-1 text-left">
                      <div className="truncate text-[13.5px] font-medium text-slate-900 dark:text-white">
                        {l.business_name}
                      </div>
                      <div className="truncate text-[11.5px] text-slate-400">
                        {[l.category, l.city].filter(Boolean).join(" · ") || "—"}
                        {l.rating ? ` · ⭐ ${l.rating}` : ""}
                      </div>
                    </button>
                    <TierBadge lead={l} size="xs" />
                    <ScoreChip lead={l} />
                    <div className="flex gap-1">
                      <a href={l.phone ? telHref(l.phone) : undefined}>
                        <MiniAction title="Call" disabled={!l.phone}>
                          <Phone className="h-3.5 w-3.5" />
                        </MiniAction>
                      </a>
                      <a href={l.phone ? waHref(l.phone) : undefined} target="_blank" rel="noreferrer">
                        <MiniAction title="WhatsApp" disabled={!l.phone}>
                          <MessageCircle className="h-3.5 w-3.5" />
                        </MiniAction>
                      </a>
                      <TelegramButton lead={l} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Tasks due today */}
          <Card>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/5">
              <SectionTitle>Tasks due today</SectionTitle>
              <Button size="xs" variant="ghost" onClick={() => navigate("tasks")}>
                All tasks <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
            {stats.tasksDueToday.length + stats.tasksOverdue.length === 0 ? (
              <EmptyState className="py-7" icon={<ListChecks className="h-5 w-5" />} title="No tasks due" />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {[...stats.tasksOverdue, ...stats.tasksDueToday].slice(0, 6).map((t) => {
                  const project = (projects || []).find((p) => p.id === t.project_id);
                  const overdue = t.due_date && new Date(t.due_date) < new Date(new Date().setHours(0, 0, 0, 0));
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                      <button
                        onClick={async () => {
                          await tasksRepo.update(t.id, { status: "Done" });
                          toast.success("Task completed");
                        }}
                        className="flex h-5 w-5 items-center justify-center rounded-md border border-slate-300 transition hover:border-slate-900 dark:border-white/20"
                        title="Complete"
                      >
                        <Check className="h-3 w-3 opacity-0 transition hover:opacity-100" />
                      </button>
                      <button onClick={() => project && openProject(project.id)} className="min-w-0 flex-1 text-left">
                        <div className="truncate text-[13.5px] text-slate-900 dark:text-white">{t.title}</div>
                        <div className="truncate text-[11.5px] text-slate-400">
                          {project?.name || "No project"}
                          {t.due_date && (
                            <span className={overdue ? "ml-1.5 font-medium text-red-500" : "ml-1.5"}>
                              · {formatDate(t.due_date)}
                            </span>
                          )}
                        </div>
                      </button>
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[10.5px] font-medium",
                          t.priority === "Urgent"
                            ? "bg-red-500/12 text-red-600 dark:text-red-400"
                            : t.priority === "High"
                              ? "bg-orange-500/12 text-orange-600 dark:text-orange-400"
                              : t.priority === "Medium"
                                ? "bg-blue-500/12 text-blue-600 dark:text-blue-400"
                                : "bg-slate-500/12 text-slate-500",
                        )}
                      >
                        {t.priority}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Active projects */}
          <Card>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/5">
              <SectionTitle>Active projects</SectionTitle>
              <Button size="xs" variant="ghost" onClick={() => navigate("projects")}>
                All projects <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
            {stats.activeProjects === 0 ? (
              <EmptyState className="py-7" icon={<FolderKanban className="h-5 w-5" />} title="No active projects" />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {stats.activeProjectList.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => openProject(p.id)}
                        className="truncate text-[13.5px] font-semibold text-slate-900 hover:underline dark:text-white"
                      >
                        {p.name}
                      </button>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-slate-400">
                        <span className={cn("rounded-md px-1.5 py-0.5 font-medium", STAGE_STYLES[p.stage])}>{p.stage}</span>
                        {p.deadline && <span>· Due {formatDate(p.deadline)}</span>}
                        <span>
                          · {formatETB(p.paid)} / {formatETB(p.value)}
                        </span>
                      </div>
                      <Progress value={p.progress} className="mt-2" />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openProject(p.id)}>
                      Continue <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Pinned leads */}
          <Card>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/5">
              <SectionTitle>Pinned leads</SectionTitle>
              <Star className="h-3.5 w-3.5 text-amber-400" />
            </div>
            {stats.pinned.length === 0 ? (
              <EmptyState
                className="py-7"
                icon={<Star className="h-5 w-5" />}
                title="No pinned leads"
                description="Pin the leads you're actively chasing — they show up here."
              />
            ) : (
              <div className="grid gap-2 p-3 sm:grid-cols-2">
                {stats.pinned.slice(0, 6).map((l) => (
                  <button
                    key={l.id}
                    onClick={() => openLead(l.id)}
                    className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2.5 text-left transition hover:border-slate-300 dark:border-white/5 dark:hover:border-white/20"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">
                        {l.business_name}
                      </div>
                      <div className="truncate text-[11.5px] text-slate-400">{l.category || l.city || "—"}</div>
                    </div>
                    <TierBadge lead={l} size="xs" />
                    <ScoreChip lead={l} />
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <Card className="p-4">
            <SectionTitle>Pipeline snapshot</SectionTitle>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniStat icon={<Users className="h-3.5 w-3.5" />} label="Total leads" value={stats.total} />
              <MiniStat icon={<Flame className="h-3.5 w-3.5" />} label="Tier 1" value={stats.tier1} />
              <MiniStat icon={<Sparkles className="h-3.5 w-3.5" />} label="New" value={stats.new} />
              <MiniStat icon={<MessageCircle className="h-3.5 w-3.5" />} label="Contacted" value={stats.contacted} />
              <MiniStat icon={<Trophy className="h-3.5 w-3.5" />} label="Clients won" value={stats.won} />
              <MiniStat icon={<FolderKanban className="h-3.5 w-3.5" />} label="Projects" value={(projects || []).length} />
              <MiniStat icon={<TrendingUp className="h-3.5 w-3.5" />} label="Pipeline value" value={formatETB(stats.potential)} />
              <MiniStat icon={<Wallet className="h-3.5 w-3.5" />} label="Won value" value={formatETB(stats.wonValue)} />
              <MiniStat icon={<Check className="h-3.5 w-3.5" />} label="Tasks done" value={stats.tasksDone} />
              <MiniStat icon={<Wallet className="h-3.5 w-3.5" />} label="Collected" value={formatETB(stats.paid)} />
            </div>
          </Card>

          {/* Outstanding */}
          <Card>
            <div className="border-b border-slate-100 px-4 py-3 dark:border-white/5">
              <SectionTitle>Who owes money</SectionTitle>
            </div>
            {stats.owing.length === 0 ? (
              <EmptyState className="py-6" icon={<Wallet className="h-5 w-5" />} title="Nothing outstanding" />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {stats.owing.map((o) => (
                  <button
                    key={o.project.id}
                    onClick={() => openProject(o.project.id)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-slate-900 dark:text-white">
                        {o.lead?.business_name || o.project.name}
                      </div>
                      <div className="truncate text-[11.5px] text-slate-400">{o.project.name}</div>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold text-amber-600 dark:text-amber-400">
                      {formatETB(o.due)}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="border-t border-slate-100 px-4 py-2.5 dark:border-white/5">
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-slate-500">Total outstanding</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatETB(stats.outstanding)}</span>
              </div>
            </div>
          </Card>

          {/* Recent */}
          <Card>
            <div className="border-b border-slate-100 px-4 py-3 dark:border-white/5">
              <SectionTitle>Continue where you left off</SectionTitle>
            </div>
            {recentLeads.length === 0 ? (
              <EmptyState className="py-6" icon={<Clock className="h-5 w-5" />} title="No recent leads" />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {recentLeads.slice(0, 8).map((l) => {
                  const rv = (recent || []).find((r) => r.lead_id === l.id);
                  return (
                    <button
                      key={l.id}
                      onClick={() => openLead(l.id)}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-slate-900 dark:text-white">
                          {l.business_name}
                        </div>
                        <div className="truncate text-[11px] text-slate-400">
                          {l.status} · viewed {rv ? timeAgo(rv.viewed_at) : ""}
                        </div>
                      </div>
                      <TierBadge lead={l} size="xs" />
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <SectionTitle>Quick actions</SectionTitle>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="primary" onClick={() => navigate("startwork")} className="col-span-2">
                <Rocket className="h-4 w-4" /> Start Work
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("import")}>
                <Upload className="h-3.5 w-3.5" /> Import
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuickAddLeadId(null);
                  setQuickAdd("lead");
                }}
              >
                Add lead
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuickAddLeadId(null);
                  setQuickAdd("followup");
                }}
              >
                Follow-up
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("clients")}>
                <Trophy className="h-3.5 w-3.5" /> Clients
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Attention({
  icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone: "red" | "amber" | "cyan" | "violet" | "emerald";
  onClick: () => void;
}) {
  const tones: Record<string, string> = {
    red: "text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400",
    amber: "text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400",
    cyan: "text-cyan-600 bg-cyan-50 dark:bg-cyan-500/10 dark:text-cyan-400",
    violet: "text-violet-600 bg-violet-50 dark:bg-violet-500/10 dark:text-violet-400",
    emerald: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400",
  };
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-slate-200/80 bg-white p-3 text-left transition hover:border-slate-300 hover:shadow-sm dark:border-white/[0.08] dark:bg-white/[0.035]"
    >
      <div className={cn("mb-2 flex h-7 w-7 items-center justify-center rounded-lg", tones[tone])}>{icon}</div>
      <div className="text-[20px] font-semibold leading-none text-slate-900 dark:text-white">{value}</div>
      <div className="mt-1 truncate text-[11.5px] text-slate-500 dark:text-slate-400">{label}</div>
    </button>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-white/[0.04]">
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-0.5 text-[16px] font-semibold text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}

function MiniAction({
  children,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:pointer-events-none disabled:opacity-25 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/10"
    >
      {children}
    </button>
  );
}
