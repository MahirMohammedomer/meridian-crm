import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster } from "sonner";
import { useLiveQuery } from "dexie-react-hooks";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { AppStateProvider, useApp } from "@/lib/app";
import { AppShell } from "@/components/layout/AppShell";
import { Login } from "@/pages/Login";
import { CommandPalette } from "@/components/common/CommandPalette";
import { QuickAdd } from "@/components/common/QuickAdd";
import { ConflictBanner, ErrorBoundary, OfflineBanner } from "@/components/common/Banners";
import { startSyncEngine, initialSyncIfEmpty } from "@/lib/sync";
import { registerServiceWorker } from "@/lib/pwa";
import { MeridianMark } from "@/components/layout/AppShell";
import { db, getSetting, setSetting } from "@/lib/db";
import { Button, Card, Dialog } from "@/components/ui/ui";
import { Upload, Sparkles } from "lucide-react";

/* Lazy-load heavy pages so initial shell is light */
const Dashboard = lazy(() => import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const Leads = lazy(() => import("@/pages/Leads").then((m) => ({ default: m.Leads })));
const Pipeline = lazy(() => import("@/pages/Pipeline").then((m) => ({ default: m.Pipeline })));
const FollowUps = lazy(() => import("@/pages/FollowUps").then((m) => ({ default: m.FollowUps })));
const Clients = lazy(() => import("@/pages/Clients").then((m) => ({ default: m.Clients })));
const Projects = lazy(() => import("@/pages/Projects").then((m) => ({ default: m.Projects })));
const ProjectDetailPage = lazy(() =>
  import("@/pages/ProjectDetail").then((m) => ({ default: m.ProjectDetailPage })),
);
const TasksPage = lazy(() => import("@/pages/Tasks").then((m) => ({ default: m.TasksPage })));
const CalendarPage = lazy(() => import("@/pages/Calendar").then((m) => ({ default: m.CalendarPage })));
const Analytics = lazy(() => import("@/pages/Analytics").then((m) => ({ default: m.Analytics })));
const Batches = lazy(() => import("@/pages/Batches").then((m) => ({ default: m.Batches })));
const ImportPage = lazy(() => import("@/pages/Import").then((m) => ({ default: m.ImportPage })));
const Settings = lazy(() => import("@/pages/Settings").then((m) => ({ default: m.Settings })));
const StartWork = lazy(() => import("@/pages/StartWork").then((m) => ({ default: m.StartWork })));
const CallMode = lazy(() => import("@/pages/CallMode").then((m) => ({ default: m.CallMode })));

function PageFallback() {
  return (
    <div className="flex h-full min-h-[40vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700 dark:border-white/20 dark:border-t-white" />
    </div>
  );
}

function Router() {
  const { route } = useApp();
  let page: React.ReactNode;
  switch (route) {
    case "dashboard":
      page = <Dashboard />;
      break;
    case "leads":
      page = <Leads />;
      break;
    case "pipeline":
      page = <Pipeline />;
      break;
    case "followups":
      page = <FollowUps />;
      break;
    case "clients":
      page = <Clients />;
      break;
    case "projects":
      page = <Projects />;
      break;
    case "project":
      page = <ProjectDetailPage />;
      break;
    case "tasks":
      page = <TasksPage />;
      break;
    case "calendar":
      page = <CalendarPage />;
      break;
    case "analytics":
      page = <Analytics />;
      break;
    case "batches":
      // Folded into Import page
      page = <ImportPage />;
      break;
    case "import":
      page = <ImportPage />;
      break;
    case "settings":
      page = <Settings />;
      break;
    case "startwork":
      page = <StartWork />;
      break;
    case "callmode":
      page = <CallMode />;
      break;
    default:
      page = <Dashboard />;
  }
  return <Suspense fallback={<PageFallback />}>{page}</Suspense>;
}

function Boot() {
  return (
    <div className="flex h-full min-h-screen flex-col items-center justify-center gap-4">
      <MeridianMark size={44} />
      <div className="text-[13px] text-slate-400">Opening your local database…</div>
    </div>
  );
}

function Onboarding() {
  const { navigate } = useApp();
  const [dismissed, setDismissed] = useState(true);
  const leads = useLiveQuery(async () => db.leads.count(), [], 0);

  useEffect(() => {
    void getSetting<boolean>("onboarded").then((v) => {
      if (!v) setDismissed(false);
    });
  }, []);

  const close = () => {
    setDismissed(true);
    void setSetting("onboarded", true);
  };

  return (
    <Dialog open={!dismissed} onClose={close} title="Welcome to Meridian" size="md">
      <div className="space-y-4">
        <p className="text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-300">
          Meridian is your personal agency command center. It runs on a local database on this device — so it works
          with or without internet. The cloud is only used for sync and backup.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { t: "1. Import", d: "Bring in a CSV or XLSX of businesses without websites." },
            { t: "2. Prioritise", d: "Set Tier and Score yourself — the app never guesses." },
            { t: "3. Start Work", d: "Process leads one by one, distraction free." },
          ].map((s) => (
            <div key={s.t} className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
              <div className="text-[12.5px] font-semibold text-slate-900 dark:text-white">{s.t}</div>
              <div className="mt-0.5 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">{s.d}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={() => {
              close();
              navigate("import");
            }}
          >
            <Upload className="h-4 w-4" /> Import leads
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              close();
              navigate("leads");
            }}
          >
            <Sparkles className="h-4 w-4" /> Explore with sample data
          </Button>
          <Button variant="ghost" onClick={close}>
            Skip
          </Button>
        </div>
        <p className="text-[11.5px] text-slate-400">
          {leads > 0 ? `${leads} leads already on this device.` : "No leads on this device yet."}
        </p>
      </div>
    </Dialog>
  );
}

function Shell() {
  const { user, ready, recoveryMode } = useAuth();

  useEffect(() => {
    registerServiceWorker();
    startSyncEngine();
    if (user && !recoveryMode) {
      void import("@/lib/migrateStatuses").then(({ migrateLeadStatusesOnce }) => migrateLeadStatusesOnce());
      void initialSyncIfEmpty().then((r) => {
        if (r === "pulled") void import("sonner").then(({ toast }) => toast.success("Cloud data downloaded — ready for offline use"));
      });
    }
  }, [user, recoveryMode]);

  if (!ready) return <Boot />;
  // Recovery link signs the user in temporarily — keep them on Login until they set a new password
  if (!user || recoveryMode) return <Login />;

  return (
    <ErrorBoundary>
      <AppShell>
        <OfflineBanner />
        <ConflictBanner />
        <Router />
        <CommandPalette />
        <QuickAdd />
        <Onboarding />
      </AppShell>
    </ErrorBoundary>
  );
}

export default function App() {
  useEffect(() => {
    document.getElementById("boot")?.remove();
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <AppStateProvider>
          <Shell />
          <Toaster
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast:
                  "!rounded-xl !border !border-slate-200 !bg-white !text-slate-900 !shadow-lg dark:!border-white/10 dark:!bg-[#181b21] dark:!text-white",
              },
            }}
          />
        </AppStateProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export { Card };
