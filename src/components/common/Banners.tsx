import { useEffect, useState } from "react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CloudOff, AlertTriangle, Check } from "lucide-react";
import { db } from "@/lib/db";
import { subscribeSync, getSyncState, getConflicts, resolveConflict } from "@/lib/sync";
import { Button, Dialog } from "@/components/ui/ui";
import { toast } from "sonner";

export function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const pending = useLiveQuery(async () => db.sync_queue.where("status").anyOf("pending", "syncing").count(), [], 0);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500/10 px-4 py-1.5 text-[12.5px] font-medium text-amber-700 dark:text-amber-400">
      <CloudOff className="h-3.5 w-3.5" />
      You're offline
      {pending ? ` · ${pending} change${pending === 1 ? "" : "s"} waiting` : ""} — everything keeps working locally
    </div>
  );
}

export function ConflictBanner() {
  const [state, setState] = useState(getSyncState());
  const conflicts = useLiveQuery(async () => getConflicts(), [state.lastSyncAt], []);
  const [open, setOpen] = useState<any>(null);

  useEffect(() => {
    const unsub = subscribeSync(setState);
    return () => {
      unsub();
    };
  }, []);

  if (!conflicts || conflicts.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-2 bg-red-500/10 px-4 py-1.5 text-[12.5px] font-medium text-red-700 dark:text-red-400">
        <AlertTriangle className="h-3.5 w-3.5" />
        {conflicts.length} sync conflict{conflicts.length === 1 ? "" : "s"} — choose which version to keep
        <button onClick={() => setOpen(conflicts[0])} className="underline underline-offset-2">
          Resolve now
        </button>
      </div>

      <Dialog
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title="Resolve sync conflict"
        description="This record changed both here and in the cloud. Pick the version to keep — nothing is lost until you choose."
        size="lg"
      >
        {open && (
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { key: "local" as const, label: "This device", data: open.local },
              { key: "remote" as const, label: "Cloud", data: open.remote },
            ].map((side) => (
              <div key={side.key} className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-slate-900 dark:text-white">{side.label}</span>
                  <Button
                    size="xs"
                    variant={side.key === "local" ? "secondary" : "primary"}
                    onClick={async () => {
                      await resolveConflict(open.id, side.key);
                      toast.success(`Kept ${side.label.toLowerCase()} version`);
                      setOpen(null);
                    }}
                  >
                    <Check className="h-3 w-3" /> Keep this
                  </Button>
                </div>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[11.5px] leading-relaxed text-slate-600 dark:bg-white/5 dark:text-slate-300">
                  {Object.entries(side.data || {})
                    .filter(([k]) =>
                      [
                        "business_name",
                        "name",
                        "status",
                        "tier",
                        "lead_score",
                        "phone",
                        "stage",
                        "progress",
                        "value",
                        "paid",
                        "notes",
                        "content",
                        "title",
                        "updated_at",
                      ].includes(k),
                    )
                    .map(([k, v]) => `${k}: ${String(v)}`)
                    .join("\n")}
                </pre>
              </div>
            ))}
          </div>
        )}
      </Dialog>
    </>
  );
}

interface EBProps {
  children: ReactNode;
}

export class ErrorBoundary extends Component<EBProps, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Meridian crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-500/10">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h1 className="text-[18px] font-semibold text-slate-900 dark:text-white">Something went wrong</h1>
          <p className="max-w-md text-[13.5px] leading-relaxed text-slate-500">
            Your data is safe in the local database. Reload to continue — or export a backup from Settings first.
          </p>
          <pre className="max-w-lg overflow-auto rounded-xl bg-slate-100 p-3 text-left text-[11.5px] text-slate-600 dark:bg-white/5 dark:text-slate-300">
            {this.state.error.message}
          </pre>
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => location.reload()}>
              Reload app
            </Button>
            <Button variant="outline" onClick={() => this.setState({ error: null })}>
              Try to continue
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
