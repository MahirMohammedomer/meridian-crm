import React, { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  CalendarClock,
  Handshake,
  FolderKanban,
  CalendarDays,
  BarChart3,
  Upload,
  Settings as SettingsIcon,
  Menu,
  X,
  Search,
  Plus,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Download,
  KeyRound,
  Shield,
  Rocket,
  ListChecks,
  Layers,
  Phone,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { useApp, type Route } from "@/lib/app";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { Button, Dropdown, MenuItem, MenuLabel } from "@/components/ui/ui";
import { SyncIndicator } from "@/components/common/SyncIndicator";
import { onInstallPromptChange, promptInstall } from "@/lib/pwa";
import { exportAllData } from "@/lib/export";
import { toast } from "sonner";
import { DEFAULT_HIDDEN_NAV, getHiddenNavRoutes, isNavVisible, NAV_LABELS } from "@/lib/nav";

/** Order matches daily workflow */
const NAV: { route: Route; label: string; icon: any }[] = [
  { route: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { route: "callmode", label: "Call Mode", icon: Phone },
  { route: "startwork", label: "Work Mode", icon: Rocket },
  { route: "leads", label: "Leads", icon: Users },
  { route: "pipeline", label: "Pipeline", icon: KanbanSquare },
  { route: "followups", label: "Follow-ups", icon: CalendarClock },
  { route: "import", label: "Import", icon: Upload },
  { route: "analytics", label: "Analytics", icon: BarChart3 },
  { route: "clients", label: "Clients", icon: Handshake },
  { route: "projects", label: "Projects", icon: FolderKanban },
  { route: "tasks", label: "Tasks", icon: ListChecks },
  { route: "calendar", label: "Calendar", icon: CalendarDays },
];

const MOBILE_PRIMARY: Route[] = ["dashboard", "callmode", "leads", "followups", "pipeline"];

/** Meridian mark — abstract M / horizon mark, works light & dark */
function MeridianMark({ size = 26 }: { size?: number }) {
  return (
    <div
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] shadow-sm ring-1 ring-black/5 dark:ring-white/10"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <img
        src="/icons/meridian-mark.svg"
        width={size}
        height={size}
        className="block"
        alt=""
        aria-hidden="true"
      />
    </div>
  );
}

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const options: { value: ThemeMode; label: string; icon: any }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];
  return (
    <Dropdown
      trigger={({ toggle }) => (
        <Button variant="ghost" size="icon-sm" onClick={toggle} title="Theme">
          {mode === "dark" ? <Moon className="h-4 w-4" /> : mode === "light" ? <Sun className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
        </Button>
      )}
      panelClassName="w-40"
    >
      {({ close }) => (
        <>
          <MenuLabel>Appearance</MenuLabel>
          {options.map((o) => (
            <MenuItem
              key={o.value}
              icon={<o.icon className="h-4 w-4" />}
              className={mode === o.value ? "bg-slate-100 dark:bg-white/10" : ""}
              onClick={() => {
                setMode(o.value);
                close();
              }}
            >
              {o.label}
            </MenuItem>
          ))}
        </>
      )}
    </Dropdown>
  );
}

function UserMenu() {
  const { user, signOut, mode } = useAuth();
  const { navigate } = useApp();
  const [installable, setInstallable] = useState(false);

  useEffect(() => {
    const unsub = onInstallPromptChange((p) => setInstallable(Boolean(p)));
    return () => {
      unsub();
    };
  }, []);

  return (
    <Dropdown
      trigger={({ toggle }) => (
        <button
          onClick={toggle}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-[12px] font-semibold text-white shadow-sm transition hover:opacity-90 dark:from-white dark:to-slate-300 dark:text-slate-900"
          title={user?.email || "Account"}
        >
          {(user?.email || "O").slice(0, 1).toUpperCase()}
        </button>
      )}
      panelClassName="w-60"
    >
      {({ close }) => (
        <>
          <div className="px-2.5 py-2">
            <div className="truncate text-[13px] font-medium text-slate-900 dark:text-white">{user?.email || "Owner"}</div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <Shield className="h-3 w-3" />
              {mode === "supabase" ? "Private owner account" : "On-device owner lock"}
            </div>
          </div>
          <div className="my-1 h-px bg-slate-100 dark:bg-white/5" />
          <MenuItem
            icon={<SettingsIcon className="h-4 w-4" />}
            onClick={() => {
              navigate("settings");
              close();
            }}
          >
            Settings
          </MenuItem>
          <MenuItem
            icon={<Download className="h-4 w-4" />}
            onClick={() => {
              void exportAllData();
              toast.success("Full backup exported");
              close();
            }}
          >
            Export full backup
          </MenuItem>
          {installable && (
            <MenuItem
              icon={<Download className="h-4 w-4" />}
              onClick={async () => {
                const r = await promptInstall();
                if (r === "accepted") toast.success("Installing Meridian…");
                close();
              }}
            >
              Install app
            </MenuItem>
          )}
          <MenuItem
            icon={<KeyRound className="h-4 w-4" />}
            onClick={() => {
              navigate("settings");
              close();
            }}
          >
            Password / account
          </MenuItem>
          <div className="my-1 h-px bg-slate-100 dark:bg-white/5" />
          <MenuItem
            danger
            icon={<LogOut className="h-4 w-4" />}
            onClick={() => {
              void signOut();
              toast.success("Signed out — local data kept on this device");
              close();
            }}
          >
            Sign out
          </MenuItem>
        </>
      )}
    </Dropdown>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { route, navigate, setPaletteOpen, setQuickAdd, setQuickAddLeadId, sidebarOpen, setSidebarOpen } = useApp();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("meridian:sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });
  const [hiddenNav, setHiddenNav] = useState<Route[]>(DEFAULT_HIDDEN_NAV);

  useEffect(() => {
    void getHiddenNavRoutes().then(setHiddenNav);
    const onStorage = () => void getHiddenNavRoutes().then(setHiddenNav);
    window.addEventListener("meridian:nav-visibility", onStorage);
    return () => window.removeEventListener("meridian:nav-visibility", onStorage);
  }, []);

  const visibleNav = NAV.filter((n) => isNavVisible(n.route, hiddenNav));
  const mobileNav = MOBILE_PRIMARY.filter((r) => isNavVisible(r, hiddenNav)).slice(0, 5);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem("meridian:sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const go = (r: Route) => {
    navigate(r);
    setSidebarOpen(false);
  };

  return (
    <div className="app-frame flex h-dvh min-h-0 w-full">
      {/* Desktop sidebar — collapsible */}
      <aside
        className={`relative hidden shrink-0 flex-col border-r border-slate-200/80 bg-white/60 backdrop-blur-xl transition-[width] duration-200 ease-out md:flex dark:border-white/[0.07] dark:bg-white/[0.02] ${
          collapsed ? "w-[68px]" : "w-[236px]"
        }`}
      >
        <div className={`flex items-center py-[14px] ${collapsed ? "justify-center px-2" : "px-4"}`}>
          <button
            type="button"
            onClick={toggleCollapsed}
            className={`flex items-center gap-2.5 text-left transition hover:opacity-90 ${collapsed ? "" : "w-full"}`}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <MeridianMark />
            {!collapsed && (
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white">Meridian</div>
                <div className="text-[10.5px] uppercase tracking-[0.1em] text-slate-400">Click logo to collapse</div>
              </div>
            )}
          </button>
        </div>

        <nav className={`flex-1 space-y-0.5 overflow-y-auto py-1 ${collapsed ? "px-2" : "px-3"}`}>
          {visibleNav.map((n) => {
            const active = route === n.route;
            const isPrimary = n.route === "callmode";
            return (
              <button
                key={n.route}
                onClick={() => go(n.route)}
                title={n.label}
                className={`flex w-full items-center rounded-xl font-medium transition-all ${
                  collapsed ? "h-10 justify-center" : "gap-3 px-3 py-2 text-[13.5px]"
                } ${
                  active
                    ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                    : isPrimary
                      ? "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/[0.07] dark:hover:text-slate-100"
                }`}
              >
                <n.icon className="h-[17px] w-[17px] shrink-0" strokeWidth={active ? 2.2 : 1.9} />
                {!collapsed && n.label}
              </button>
            );
          })}
        </nav>

        <div className={`border-t border-slate-100 dark:border-white/5 ${collapsed ? "p-2" : "p-3"}`}>
          <button
            onClick={() => go("settings")}
            title="Settings"
            className={`flex w-full items-center rounded-xl font-medium transition-all ${
              collapsed ? "h-10 justify-center" : "gap-3 px-3 py-2 text-[13.5px]"
            } ${
              route === "settings"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/[0.07]"
            }`}
          >
            <SettingsIcon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.9} />
            {!collapsed && "Settings"}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[90] md:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[270px] max-w-[calc(100vw-1rem)] flex-col border-r border-slate-200 bg-white dark:border-white/10 dark:bg-[#0f1115]">
            <div className="flex items-center justify-between px-5 py-[18px]">
              <div className="flex items-center gap-2.5">
                <MeridianMark />
                <div className="text-[15px] font-semibold text-slate-900 dark:text-white">Meridian</div>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => setSidebarOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
              {visibleNav.map((n) => (
                <button
                  key={n.route}
                  onClick={() => go(n.route)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium ${
                    route === n.route
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <n.icon className="h-[18px] w-[18px]" />
                  {n.label}
                </button>
              ))}
              <button
                onClick={() => go("settings")}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium ${
                  route === "settings"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                <SettingsIcon className="h-[18px] w-[18px]" />
                Settings
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-topbar sticky top-0 z-40 flex h-[60px] shrink-0 items-center gap-2 border-b border-slate-200/70 bg-white/80 px-3 backdrop-blur-xl md:px-5 dark:border-white/[0.07] dark:bg-[#0b0c0f]/80">
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <button
            onClick={() => setPaletteOpen(true)}
            className="group flex h-9 min-w-0 max-w-md flex-1 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 text-left text-[13px] text-slate-400 transition hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">Search leads, projects, tasks…</span>
            <kbd className="hidden rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[10.5px] text-slate-400 sm:inline dark:border-white/10 dark:bg-white/5">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1.5">
            <SyncIndicator />
            <ThemeToggle />
            <Button
              variant="primary"
              size="icon-sm"
              className="md:hidden"
              onClick={() => {
                setQuickAddLeadId(null);
                setQuickAdd("lead");
              }}
              aria-label="Quick add"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="hidden md:inline-flex"
              onClick={() => {
                setQuickAddLeadId(null);
                setQuickAdd("lead");
              }}
            >
              <Plus className="h-4 w-4" /> Quick add
            </Button>
            <UserMenu />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overscroll-contain pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>

        {/* Mobile bottom tabs — max 5 + safe area */}
        <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden dark:border-white/10 dark:bg-[#0b0c0f]/95">
          {mobileNav.map((r) => {
            const item = NAV.find((n) => n.route === r);
            if (!item) return null;
            const active = route === r;
            return (
              <button
                key={r}
                onClick={() => go(r)}
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5 py-2.5 text-[10px] font-medium transition ${
                  active ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"
                }`}
              >
                <item.icon className="h-5 w-5" strokeWidth={active ? 2.3 : 1.8} />
                <span className="max-w-full truncate">{item.label.replace(" Mode", "")}</span>
              </button>
            );
          })}
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-slate-400 dark:text-slate-500"
          >
            <Menu className="h-5 w-5" strokeWidth={1.8} />
            More
          </button>
        </nav>
      </div>
    </div>
  );
}

export { MeridianMark };
