import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Search,
  Plus,
  LayoutDashboard,
  Users,
  KanbanSquare,
  CalendarClock,
  Handshake,
  FolderKanban,
  CalendarDays,
  BarChart3,
  Upload,
  Settings,
  Sun,
  Moon,
  Download,
  Phone,
  ArrowRight,
  CornerDownLeft,
  Rocket,
  ListChecks,
  Layers,
} from "lucide-react";
import { db } from "@/lib/db";
import { useApp, type Route } from "@/lib/app";
import { useTheme } from "@/lib/theme";
import { exportAllData } from "@/lib/export";
import { cn, normalizeText } from "@/lib/utils";
import type { Lead } from "@/lib/types";

interface Item {
  id: string;
  group: "Leads" | "Projects" | "Tasks" | "Actions";
  label: string;
  sub?: string;
  icon: React.ReactNode;
  run: () => void;
}

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, navigate, openLead, setQuickAdd, setQuickAddLeadId, route } = useApp();
  const { resolved, setMode } = useTheme();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const leads = useLiveQuery(() => db.leads.toArray(), [], []);
  const projects = useLiveQuery(() => db.projects.toArray(), [], []);
  const tasks = useLiveQuery(() => db.project_tasks.toArray(), [], []);

  useEffect(() => {
    if (paletteOpen) {
      setQ("");
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [paletteOpen]);

  const navItems: Item[] = useMemo(
    () =>
      [
        { r: "startwork" as Route, l: "🚀 Start Work", i: <Rocket className="h-4 w-4" /> },
        { r: "dashboard" as Route, l: "Go to Dashboard", i: <LayoutDashboard className="h-4 w-4" /> },
        { r: "leads" as Route, l: "Go to Leads", i: <Users className="h-4 w-4" /> },
        { r: "pipeline" as Route, l: "Go to Pipeline", i: <KanbanSquare className="h-4 w-4" /> },
        { r: "followups" as Route, l: "Go to Follow-ups", i: <CalendarClock className="h-4 w-4" /> },
        { r: "clients" as Route, l: "Go to Clients", i: <Handshake className="h-4 w-4" /> },
        { r: "projects" as Route, l: "Go to Projects", i: <FolderKanban className="h-4 w-4" /> },
        { r: "tasks" as Route, l: "Go to Tasks", i: <ListChecks className="h-4 w-4" /> },
        { r: "calendar" as Route, l: "Go to Calendar", i: <CalendarDays className="h-4 w-4" /> },
        { r: "analytics" as Route, l: "Go to Analytics", i: <BarChart3 className="h-4 w-4" /> },
        { r: "batches" as Route, l: "Go to Import batches", i: <Layers className="h-4 w-4" /> },
        { r: "import" as Route, l: "Import leads", i: <Upload className="h-4 w-4" /> },
        { r: "settings" as Route, l: "Open Settings", i: <Settings className="h-4 w-4" /> },
      ].map((n) => ({
        id: `nav-${n.r}`,
        group: "Actions" as const,
        label: n.l,
        icon: n.i,
        run: () => navigate(n.r),
      })),
    [navigate],
  );

  const actionItems: Item[] = useMemo(
    () => [
      {
        id: "add-lead",
        group: "Actions" as const,
        label: "Add lead",
        icon: <Plus className="h-4 w-4" />,
        run: () => {
          setQuickAddLeadId(null);
          setQuickAdd("lead");
        },
      },
      {
        id: "add-followup",
        group: "Actions" as const,
        label: "Add follow-up",
        icon: <CalendarClock className="h-4 w-4" />,
        run: () => {
          setQuickAddLeadId(null);
          setQuickAdd("followup");
        },
      },
      {
        id: "add-task",
        group: "Actions" as const,
        label: "Add task",
        icon: <Plus className="h-4 w-4" />,
        run: () => {
          setQuickAddLeadId(null);
          setQuickAdd("task");
        },
      },
      {
        id: "add-project",
        group: "Actions" as const,
        label: "Add project",
        icon: <FolderKanban className="h-4 w-4" />,
        run: () => {
          setQuickAddLeadId(null);
          setQuickAdd("project");
        },
      },
      {
        id: "add-payment",
        group: "Actions" as const,
        label: "Record payment",
        icon: <Download className="h-4 w-4" />,
        run: () => {
          setQuickAddLeadId(null);
          setQuickAdd("payment");
        },
      },
      {
        id: "theme",
        group: "Actions" as const,
        label: `Switch to ${resolved === "dark" ? "light" : "dark"} theme`,
        icon: resolved === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
        run: () => setMode(resolved === "dark" ? "light" : "dark"),
      },
      {
        id: "backup",
        group: "Actions" as const,
        label: "Export full backup",
        icon: <Download className="h-4 w-4" />,
        run: () => void exportAllData(),
      },
    ],
    [resolved, setMode, setQuickAdd, setQuickAddLeadId],
  );

  const leadItems: Item[] = useMemo(() => {
    const needle = normalizeText(q);
    const source = (leads || []).filter((l) => !l.deleted_at);
    const matched = needle
      ? source.filter(
          (l) =>
            normalizeText(`${l.business_name} ${l.phone} ${l.category} ${l.city} ${l.email}`).includes(needle),
        )
      : source.slice(0, 8);
    return matched.slice(0, 30).map((l: Lead) => ({
      id: `lead-${l.id}`,
      group: "Leads" as const,
      label: l.business_name || "(unnamed)",
      sub: [l.category || l.city, l.phone].filter(Boolean).join(" · "),
      icon: l.phone ? <Phone className="h-4 w-4" /> : <Users className="h-4 w-4" />,
      run: () => openLead(l.id),
    }));
  }, [leads, q, openLead]);

  const projectItems: Item[] = useMemo(() => {
    const needle = normalizeText(q);
    if (!needle) return [];
    return (projects || [])
      .filter((p) => normalizeText(p.name).includes(needle))
      .slice(0, 8)
      .map((p) => ({
        id: `proj-${p.id}`,
        group: "Projects" as const,
        label: p.name,
        sub: p.stage,
        icon: <FolderKanban className="h-4 w-4" />,
        run: () => navigate("projects"),
      }));
  }, [projects, q, navigate]);

  const taskItems: Item[] = useMemo(() => {
    const needle = normalizeText(q);
    if (!needle) return [];
    return (tasks || [])
      .filter((t) => normalizeText(t.title).includes(needle))
      .slice(0, 8)
      .map((t) => ({
        id: `task-${t.id}`,
        group: "Tasks" as const,
        label: t.title,
        sub: t.status,
        icon: <ArrowRight className="h-4 w-4" />,
        run: () => navigate("projects"),
      }));
  }, [tasks, q, navigate]);

  const items = useMemo(() => {
    const needle = normalizeText(q);
    const actions = needle
      ? [...actionItems, ...navItems].filter((a) => normalizeText(a.label).includes(needle))
      : [...actionItems, ...navItems];
    return [...leadItems, ...projectItems, ...taskItems, ...actions].slice(0, 40);
  }, [q, leadItems, projectItems, taskItems, actionItems, navItems]);

  useEffect(() => setIdx(0), [q]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${idx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  if (!paletteOpen) return null;

  const runItem = (i: Item) => {
    setPaletteOpen(false);
    i.run();
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setPaletteOpen(false)} />
      <div className="relative w-full max-w-[620px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-scale-in dark:border-white/10 dark:bg-[#14171d]">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-white/5">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIdx((i) => Math.min(items.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIdx((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const item = items[idx];
                if (item) runItem(item);
              }
            }}
            placeholder="Search leads, projects, tasks or run a command…"
            className="h-14 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
          />
          <kbd className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10.5px] text-slate-400 dark:border-white/10">
            esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {items.length === 0 && (
            <div className="py-10 text-center text-[13px] text-slate-400">
              No results{route ? "" : ""} — try a business name or phone number
            </div>
          )}
          {items.map((item, i) => {
            const showGroup = i === 0 || items[i - 1].group !== item.group;
            return (
              <div key={item.id}>
                {showGroup && (
                  <div className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {item.group}
                  </div>
                )}
                <button
                  data-idx={i}
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => runItem(item)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition",
                    idx === i ? "bg-slate-100 dark:bg-white/10" : "hover:bg-slate-50 dark:hover:bg-white/5",
                  )}
                >
                  <span className="text-slate-400">{item.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-slate-900 dark:text-white">
                      {item.label}
                    </span>
                    {item.sub && (
                      <span className="block truncate text-[11.5px] text-slate-400">{item.sub}</span>
                    )}
                  </span>
                  {idx === i && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400 dark:border-white/5">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span className="ml-auto">Cmd+K to toggle</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
