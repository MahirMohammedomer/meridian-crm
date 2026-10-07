import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Route =
  | "dashboard"
  | "leads"
  | "pipeline"
  | "followups"
  | "clients"
  | "projects"
  | "project"
  | "tasks"
  | "calendar"
  | "analytics"
  | "batches"
  | "import"
  | "settings"
  | "startwork"
  | "callmode";

export type QuickAddType =
  | "lead"
  | "followup"
  | "note"
  | "activity"
  | "task"
  | "project"
  | "contact"
  | "payment"
  | null;

interface AppCtx {
  route: Route;
  navigate: (r: Route) => void;
  leadId: string | null;
  openLead: (id: string) => void;
  closeLead: () => void;
  projectId: string | null;
  openProject: (id: string) => void;
  closeProject: () => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  quickAdd: QuickAddType;
  setQuickAdd: (v: QuickAddType) => void;
  quickAddLeadId: string | null;
  setQuickAddLeadId: (v: string | null) => void;
  isMobile: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<Route>(() => {
    const h = typeof location !== "undefined" ? location.hash.replace(/^#\/?/, "") : "";
    if (/^leads\//.test(h)) return "leads";
    if (/^projects\//.test(h)) return "project";
    const valid: Route[] = [
      "dashboard",
      "leads",
      "pipeline",
      "followups",
      "clients",
      "projects",
      "tasks",
      "calendar",
      "analytics",
      "batches",
      "import",
      "settings",
      "startwork",
      "callmode",
    ];
    return (valid.includes(h as Route) ? h : "dashboard") as Route;
  });
  const [leadId, setLeadId] = useState<string | null>(() => {
    const h = typeof location !== "undefined" ? location.hash.replace(/^#\/?/, "") : "";
    const m = h.match(/^leads\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  });
  const [projectId, setProjectId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickAdd, setQuickAdd] = useState<QuickAddType>(null);
  const [quickAddLeadId, setQuickAddLeadId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const onHash = () => {
      const h = location.hash.replace(/^#\/?/, "");
      const leadMatch = h.match(/^leads\/(.+)$/);
      if (leadMatch) {
        setRoute("leads");
        setLeadId(leadMatch[1]);
        return;
      }
      const projMatch = h.match(/^projects\/(.+)$/);
      if (projMatch) {
        setRoute("project");
        setProjectId(projMatch[1]);
      }
    };
    window.addEventListener("hashchange", onHash);
    onHash();
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (r: Route) => {
    setRoute(r);
    setLeadId(null);
    setSidebarOpen(false);
    window.scrollTo({ top: 0 });
    if (location.hash !== `#/${r}`) history.pushState(null, "", `#/${r}`);
  };

  const openLead = (id: string) => {
    setLeadId(id);
    if (route !== "leads" && route !== "clients" && route !== "pipeline") setRoute("leads");
    history.pushState(null, "", `#/leads/${id}`);
  };

  const closeLead = () => {
    setLeadId(null);
    history.pushState(null, "", `#/${route}`);
  };

  const openProject = (id: string) => {
    setProjectId(id);
    setRoute("project");
    history.pushState(null, "", `#/projects/${id}`);
  };

  const closeProject = () => {
    setProjectId(null);
    setRoute("projects");
    history.pushState(null, "", "#/projects");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (meta && e.key.toLowerCase() === "n" && !e.shiftKey) {
        e.preventDefault();
        setQuickAddLeadId(null);
        setQuickAdd("lead");
      }
      if (e.key === "Escape") {
        setPaletteOpen(false);
        setQuickAdd(null);
        setSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo<AppCtx>(
    () => ({
      route,
      navigate,
      leadId,
      openLead,
      closeLead,
      projectId,
      openProject,
      closeProject,
      paletteOpen,
      setPaletteOpen,
      quickAdd,
      setQuickAdd,
      quickAddLeadId,
      setQuickAddLeadId,
      isMobile,
      sidebarOpen,
      setSidebarOpen,
    }),
    [route, leadId, projectId, paletteOpen, quickAdd, quickAddLeadId, isMobile, sidebarOpen],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp must be used within AppStateProvider");
  return c;
}
