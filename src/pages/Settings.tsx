import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Palette,
  Cloud,
  Download,
  Upload,
  Trash2,
  KeyRound,
  LogOut,
  Smartphone,
  Database,
  ShieldCheck,
  RefreshCw,
  Monitor,
  Sun,
  Moon,
  Lock,
  Bookmark,
  Tag as TagIcon,
  X as XIcon,
  Info,
  Keyboard as KeyboardIcon,
  Layers,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getSetting, setSetting } from "@/lib/db";
import { tagsRepo, viewsRepo } from "@/lib/repos";
import { useAuth } from "@/lib/auth";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { subscribeSync, syncNow, retryFailed, initialPull, refreshCounts } from "@/lib/sync";
import { isSupabaseConfigured } from "@/lib/supabase";
import { exportAllData, importAllData } from "@/lib/export";
import { onInstallPromptChange, promptInstall, isInstalled } from "@/lib/pwa";
import { Button, Card, ConfirmDialog, Dialog, Field, Input, SectionTitle, Switch, Textarea } from "@/components/ui/ui";
import { cn, timeAgo } from "@/lib/utils";
import {
  BRIEF_PLACEHOLDERS,
  DEFAULT_WEBSITE_BRIEF_TEMPLATE,
  getWebsiteBriefTemplate,
  saveWebsiteBriefTemplate,
} from "@/lib/websiteBrief";
import {
  ALL_TOGGLEABLE_ROUTES,
  getHiddenNavRoutes,
  NAV_LABELS,
  setHiddenNavRoutes,
} from "@/lib/nav";
import type { Route } from "@/lib/app";

export function Settings() {
  const { user, signOut, mode, resetPassword } = useAuth();
  const { mode: themeMode, setMode } = useTheme();
  const [sync, setSync] = useState(() => ({
    pending: 0,
    failed: 0,
    lastSyncAt: null as string | null,
    phase: "idle" as string,
    message: null as string | null,
  }));
  const [installable, setInstallable] = useState(false);
  const [wipe, setWipe] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [resetEmail, setResetEmail] = useState(user?.email || "");
  const [lockOnExit, setLockOnExit] = useState(true);
  const [newTag, setNewTag] = useState("");
  const [keysOpen, setKeysOpen] = useState(false);
  const [storage, setStorage] = useState("—");
  const [briefTemplate, setBriefTemplate] = useState(DEFAULT_WEBSITE_BRIEF_TEMPLATE);
  const [briefSaving, setBriefSaving] = useState(false);
  const [hiddenNav, setHiddenNav] = useState<Route[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const savedViews = useLiveQuery(async () => db.saved_views.toArray(), [], []);
  const tags = useLiveQuery(async () => db.tags.toArray(), [], []);

  const addTag = async () => {
    if (!newTag.trim()) return;
    await tagsRepo.ensure(newTag.trim());
    setNewTag("");
    toast.success("Tag added");
  };

  useEffect(() => {
    void (async () => {
      try {
        const est = await navigator.storage?.estimate?.();
        if (est?.usage) setStorage(`${(est.usage / 1024 / 1024).toFixed(1)} MB used`);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    const unsub = subscribeSync((s) =>
      setSync({ pending: s.pending, failed: s.failed, lastSyncAt: s.lastSyncAt, phase: s.phase, message: s.message }),
    );
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    const unsub = onInstallPromptChange((p) => setInstallable(Boolean(p)));
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    void getWebsiteBriefTemplate().then(setBriefTemplate);
    void getHiddenNavRoutes().then(setHiddenNav);
  }, []);

  useEffect(() => {
    void getSetting<boolean>("lock_on_exit", true).then((v) => setLockOnExit(v !== false));
  }, []);

  const themeOptions: { value: ThemeMode; label: string; icon: any; desc: string }[] = [
    { value: "light", label: "Light", icon: Sun, desc: "Bright, high contrast" },
    { value: "dark", label: "Dark", icon: Moon, desc: "Easy on the eyes at night" },
    { value: "system", label: "System", icon: Monitor, desc: "Follow your device" },
  ];

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-5 md:px-7 md:py-7">
      <div className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-white">Settings</h1>
        <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
          Private single-owner workspace · local-first
        </p>
      </div>

      <div className="space-y-4">
        {/* Account */}
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-slate-400" />
            <SectionTitle>Account</SectionTitle>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[14px] font-medium text-slate-900 dark:text-white">{user?.email || "Owner"}</div>
              <div className="text-[12px] text-slate-400">
                {mode === "supabase" ? "Supabase Auth · private owner account" : "On-device owner lock (no cloud configured)"}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </Button>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-white/5">
            <SectionTitle>Password</SectionTitle>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@email.com"
                className="max-w-xs"
                type="email"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  if (!resetEmail) return toast.error("Enter your email");
                  const r = await resetPassword(resetEmail);
                  r.error ? toast.error(r.error) : toast.success("Password reset email sent");
                }}
              >
                <KeyRound className="h-3.5 w-3.5" /> Send reset email
              </Button>
            </div>
            {mode === "local" ? (
              <p className="mt-2 text-[11.5px] text-slate-400">
                Local mode has no email recovery. Sign out, then use “Forgot device password?” on the login screen to
                set a new on-device lock (your data stays).
              </p>
            ) : (
              <p className="mt-2 text-[11.5px] text-slate-400">
                Reset links use your deployed site URL. If the email still opens localhost, set{" "}
                <code className="text-[11px]">VITE_APP_URL</code> and add that URL under Supabase Auth → URL
                Configuration (Site URL + Redirect URLs).
              </p>
            )}
          </div>
        </Card>

        {/* Navigation visibility */}
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-slate-400" />
            <SectionTitle>Navigation tabs</SectionTitle>
          </div>
          <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
            Hide tabs you don’t use (Clients, Projects, Tasks…). They stay available if you open a link, but won’t
            clutter the sidebar or mobile menu.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {ALL_TOGGLEABLE_ROUTES.map((r) => {
              const on = !hiddenNav.includes(r);
              return (
                <label
                  key={r}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-white/10"
                >
                  <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100">
                    {NAV_LABELS[r] || r}
                  </span>
                  <Switch
                    checked={on}
                    onChange={async (v) => {
                      const next = v ? hiddenNav.filter((x) => x !== r) : [...hiddenNav, r];
                      setHiddenNav(next);
                      await setHiddenNavRoutes(next);
                      window.dispatchEvent(new Event("meridian:nav-visibility"));
                      toast.success(v ? `${NAV_LABELS[r]} shown` : `${NAV_LABELS[r]} hidden`);
                    }}
                  />
                </label>
              );
            })}
          </div>
        </Card>

        {/* Appearance */}
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-slate-400" />
            <SectionTitle>Appearance</SectionTitle>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {themeOptions.map((o) => (
              <button
                key={o.value}
                onClick={() => setMode(o.value)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                  themeMode === o.value
                    ? "border-slate-900 bg-slate-50 dark:border-white dark:bg-white/10"
                    : "border-slate-200 hover:border-slate-300 dark:border-white/10"
                }`}
              >
                <o.icon className="h-4 w-4 text-slate-500 dark:text-slate-300" />
                <div>
                  <div className="text-[13px] font-medium text-slate-900 dark:text-white">{o.label}</div>
                  <div className="text-[11px] text-slate-400">{o.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Sync */}
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-slate-400" />
            <SectionTitle>Cloud sync</SectionTitle>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Stat label="Status" value={sync.phase === "disabled" ? "Local only" : sync.phase} />
            <Stat label="Pending changes" value={String(sync.pending)} />
            <Stat label="Last sync" value={sync.lastSyncAt ? timeAgo(sync.lastSyncAt) : "never"} />
          </div>
          {sync.message && sync.phase === "error" && (
            <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-600 dark:bg-red-500/10 dark:text-red-400">
              {sync.message}
            </div>
          )}
          {!isSupabaseConfigured && (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[12.5px] leading-relaxed text-slate-500 dark:bg-white/5 dark:text-slate-400">
              Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (anon key only — never the
              service_role key) to enable Postgres sync, Auth and Storage. Meridian is fully usable without it.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => void syncNow()}>
              <RefreshCw className="h-3.5 w-3.5" /> Sync now
            </Button>
            {sync.failed > 0 && (
              <Button variant="outline" size="sm" onClick={() => void retryFailed()}>
                Retry {sync.failed} failed
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={!isSupabaseConfigured || pulling}
              onClick={async () => {
                setPulling(true);
                try {
                  const n = await initialPull();
                  toast.success(`Pulled ${n} records from the cloud`);
                  await refreshCounts();
                } catch (e: any) {
                  toast.error(e?.message || "Initial pull failed");
                }
                setPulling(false);
              }}
            >
              <Download className="h-3.5 w-3.5" /> {pulling ? "Pulling…" : "Full download from cloud"}
            </Button>
          </div>
        </Card>

        {/* Install */}
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-slate-400" />
            <SectionTitle>Install app</SectionTitle>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
            {isInstalled()
              ? "Meridian is installed on this device and works fully offline."
              : installable
                ? "Meridian can be installed for offline, full-screen use."
                : "Use your browser menu → “Install app” / “Add to Home Screen”. Chrome and Edge show an install button in the address bar."}
          </p>
          {installable && (
            <Button
              className="mt-3"
              variant="primary"
              size="sm"
              onClick={async () => {
                const r = await promptInstall();
                if (r === "accepted") toast.success("Installing…");
              }}
            >
              <Download className="h-3.5 w-3.5" /> Install Meridian
            </Button>
          )}
        </Card>

        {/* Data */}
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-slate-400" />
            <SectionTitle>Data &amp; backup</SectionTitle>
          </div>
          <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
            Your data lives in IndexedDB on this device. Export a full JSON backup regularly.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => void exportAllData()}>
              <Download className="h-3.5 w-3.5" /> Export full backup (JSON)
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Import backup
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const { imported } = await importAllData(f);
                  toast.success(`Imported ${imported} records`);
                } catch (err: any) {
                  toast.error(err?.message || "Import failed");
                }
              }}
            />
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-white/5">
            <label className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-slate-600 dark:text-slate-300">
                <Lock className="mr-1.5 inline h-3.5 w-3.5" />
                Require password after signing out
              </span>
              <Switch
                checked={lockOnExit}
                onChange={async (v) => {
                  setLockOnExit(v);
                  await setSetting("lock_on_exit", v);
                }}
              />
            </label>
          </div>
        </Card>

        {/* Saved views + tags */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-slate-400" />
                <SectionTitle>Saved views</SectionTitle>
              </div>
              <Button size="xs" variant="outline" onClick={() => (window.location.hash = "#/leads")}>
                Manage in Leads
              </Button>
            </div>
            <div className="mt-3 space-y-1.5">
              {(savedViews || []).length === 0 ? (
                <p className="text-[13px] text-slate-400">No saved views yet.</p>
              ) : (
                (savedViews || []).map((v) => (
                  <div key={v.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-white/5">
                    <span>{v.icon || "🔖"}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-slate-700 dark:text-slate-200">{v.name}</span>
                    <button
                      onClick={() => void db.saved_views.update(v.id, { pinned: !v.pinned })}
                      className={cn("text-[11px]", v.pinned ? "text-amber-500" : "text-slate-400")}
                    >
                      {v.pinned ? "Pinned" : "Pin"}
                    </button>
                    <button onClick={() => void viewsRepo.remove(v.id)} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <TagIcon className="h-4 w-4 text-slate-400" />
              <SectionTitle>Tags</SectionTitle>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(tags || []).length === 0 ? (
                <p className="text-[13px] text-slate-400">No tags created yet.</p>
              ) : (
                (tags || []).map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[12px] text-slate-600 dark:bg-white/10 dark:text-slate-300"
                  >
                    {t.name}
                    <button onClick={() => void tagsRepo.remove(t.id)} className="text-slate-400 hover:text-red-500">
                      <XIcon className="h-3 w-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="New tag name"
                onKeyDown={(e) => e.key === "Enter" && void addTag()}
              />
              <Button variant="secondary" size="sm" onClick={() => void addTag()}>
                Add
              </Button>
            </div>
          </Card>
        </div>

        {/* Website brief template (Arena / Vercel prompts) */}
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-slate-400" />
            <SectionTitle>Website brief template</SectionTitle>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
            Used by <strong className="font-medium text-slate-700 dark:text-slate-200">Copy website brief</strong> on
            leads and Start Work. Paste into Arena to generate a client site. Placeholders use{" "}
            <code className="text-[12px]">{"{{field}}"}</code> syntax.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {BRIEF_PLACEHOLDERS.map((p) => (
              <button
                key={p.key}
                type="button"
                title={p.label}
                onClick={() => {
                  setBriefTemplate((t) => t + `{{${p.key}}}`);
                }}
                className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
              >
                {`{{${p.key}}}`}
              </button>
            ))}
          </div>
          <Textarea
            className="mt-3 min-h-[220px] font-mono text-[12px] leading-relaxed"
            value={briefTemplate}
            onChange={(e) => setBriefTemplate(e.target.value)}
            spellCheck={false}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={briefSaving}
              onClick={async () => {
                setBriefSaving(true);
                try {
                  await saveWebsiteBriefTemplate(briefTemplate);
                  toast.success("Website brief template saved");
                } catch (e: any) {
                  toast.error(e?.message || "Could not save template");
                }
                setBriefSaving(false);
              }}
            >
              Save template
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBriefTemplate(DEFAULT_WEBSITE_BRIEF_TEMPLATE);
                toast.message("Reset to default — click Save to keep it");
              }}
            >
              Reset to default
            </Button>
          </div>
        </Card>

        {/* About */}
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-slate-400" />
            <SectionTitle>About</SectionTitle>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <AboutRow label="App" value="Meridian · Agency OS v1.1" />
            <AboutRow label="Build" value="Local-first · Dexie + Supabase" />
            <AboutRow label="Installed as app" value={isInstalled() ? "Yes (standalone)" : "No — running in browser"} />
            <AboutRow label="Offline ready" value="Yes — app shell cached" />
            <AboutRow label="Local storage used" value={storage} />
            <AboutRow label="Cloud sync" value={isSupabaseConfigured ? "Configured" : "Not configured"} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setKeysOpen(true)}>
              <KeyboardIcon className="h-3.5 w-3.5" /> Keyboard shortcuts
            </Button>
            <Button variant="outline" size="sm" onClick={() => (window.location.hash = "#/import")}>
              <Layers className="h-3.5 w-3.5" /> Manage imports
            </Button>
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-slate-400">
            Local data is stored unencrypted in your browser's IndexedDB. That's fine for personal use on a device you
            control — lock your device and sign out when sharing it.
          </p>
        </Card>

        {/* Danger */}
        <Card className="border-red-200/70 p-5 dark:border-red-500/20">
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-red-500" />
            <SectionTitle className="text-red-500">Danger zone</SectionTitle>
          </div>
          <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
            Erases the entire local database on this device. Cloud data (if sync is configured) is not deleted.
          </p>
          <Button variant="danger" size="sm" className="mt-3" onClick={() => setWipe(true)}>
            <Trash2 className="h-3.5 w-3.5" /> Erase local data
          </Button>
        </Card>
      </div>

      <Dialog open={keysOpen} onClose={() => setKeysOpen(false)} title="Keyboard shortcuts" size="sm">
        <div className="space-y-1.5 text-[13px]">
          {[
            ["Cmd / Ctrl + K", "Open command palette"],
            ["Cmd / Ctrl + N", "New lead"],
            ["← / →", "Previous / next lead in Start Work"],
            ["Enter", "Next lead in Start Work"],
            ["Space", "Copy all info"],
            ["C / W / T", "Call / WhatsApp / Telegram"],
            ["G / M", "Google search / Maps"],
            ["1 – 9 / 0", "Set lead status"],
            ["Esc", "Close drawer or modal"],
          ].map(([k, v]) => (
            <div
              key={k}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 odd:bg-slate-50 dark:odd:bg-white/5"
            >
              <kbd className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] dark:border-white/10">{k}</kbd>
              <span className="text-slate-600 dark:text-slate-300">{v}</span>
            </div>
          ))}
        </div>
      </Dialog>

      <ConfirmDialog
        open={wipe}
        onClose={() => setWipe(false)}
        title="Erase all local data?"
        message="Every lead, note, activity, follow-up, client and project on this device will be permanently deleted. This cannot be undone — export a backup first."
        confirmLabel="Erase everything"
        onConfirm={async () => {
          await db.delete();
          await db.open();
          toast.success("Local database erased");
          setTimeout(() => location.reload(), 600);
        }}
      />
    </div>
  );
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/[0.04]">
      <span className="text-[12.5px] text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-[12.5px] font-medium text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/[0.04]">
      <div className="text-[10.5px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-[14px] font-semibold capitalize text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}

export { Field };
