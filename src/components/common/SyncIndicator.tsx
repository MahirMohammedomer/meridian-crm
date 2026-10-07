import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, RefreshCw, CloudOff, AlertTriangle, X, RotateCw, Trash2 } from "lucide-react";
import { subscribeSync, syncNow, retryFailed, clearFailed, getPendingDetail, getSyncState } from "@/lib/sync";
import type { SyncQueueItem } from "@/lib/types";
import { Button, Dropdown, EmptyState } from "@/components/ui/ui";
import { timeAgo } from "@/lib/utils";

function useRelative(iso: string | null) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 20000);
    return () => clearInterval(t);
  }, []);
  return iso ? timeAgo(iso) : "never";
}

export function SyncIndicator() {
  const [state, setState] = useState(getSyncState());
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<{ pending: SyncQueueItem[]; failed: SyncQueueItem[] }>({
    pending: [],
    failed: [],
  });

  useEffect(() => {
    const unsub = subscribeSync(setState);
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    if (open) void getPendingDetail().then(setDetail);
  }, [open, state.pending, state.failed]);

  const ago = useRelative(state.lastSyncAt);

  let color = "text-emerald-600 dark:text-emerald-400";
  let dot = "bg-emerald-500";
  let Icon: any = CheckCircle2;
  let text = `Synced · ${ago}`;

  if (state.phase === "syncing") {
    color = "text-sky-600 dark:text-sky-400";
    dot = "bg-sky-500 animate-pulse";
    Icon = RefreshCw;
    text = state.pushing ? `Syncing ${state.pushing} change${state.pushing === 1 ? "" : "s"}…` : "Syncing…";
  } else if (state.phase === "offline") {
    color = "text-amber-600 dark:text-amber-500";
    dot = "bg-amber-500";
    Icon = CloudOff;
    text = state.pending ? `Offline · ${state.pending} waiting` : "Offline";
  } else if (state.phase === "error") {
    color = "text-red-600 dark:text-red-400";
    dot = "bg-red-500";
    Icon = AlertTriangle;
    text = state.failed ? `Sync error · ${state.failed} failed` : "Sync error";
  } else if (state.phase === "disabled") {
    color = "text-slate-500 dark:text-slate-400";
    dot = "bg-slate-400";
    Icon = CloudOff;
    text = "Local only";
  } else if (state.pending > 0) {
    color = "text-amber-600 dark:text-amber-500";
    dot = "bg-amber-500";
    Icon = RefreshCw;
    text = `${state.pending} change${state.pending === 1 ? "" : "s"} waiting`;
  }

  return (
    <Dropdown
      trigger={({ toggle }) => (
        <button
          onClick={toggle}
          title="Sync status"
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 text-[12px] font-medium transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          <span className={`sync-label ${color}`}>{text}</span>
        </button>
      )}
      panelClassName="w-[340px] p-0"
      align="right"
    >
      {({ close }) => (
        <div>
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3.5 py-3 dark:border-white/5">
            <div>
              <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-900 dark:text-white">
                <Icon className={`h-4 w-4 ${color}`} />
                {state.phase === "syncing"
                  ? "Syncing"
                  : state.phase === "offline"
                    ? "Offline"
                    : state.phase === "error"
                      ? "Sync error"
                      : state.phase === "disabled"
                        ? "Local-only mode"
                        : "Up to date"}
              </div>
              <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
                Last synced {ago}
                {state.online ? "" : " · network unavailable"}
              </p>
            </div>
            <button
              onClick={() => setOpen((v) => !v)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {state.message && state.phase === "error" && (
            <div className="border-b border-slate-100 bg-red-50/60 px-3.5 py-2 text-[11.5px] text-red-700 dark:border-white/5 dark:bg-red-500/10 dark:text-red-300">
              {state.message}
            </div>
          )}

          {state.phase === "disabled" && (
            <div className="border-b border-slate-100 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-slate-500 dark:border-white/5 dark:text-slate-400">
              Supabase is not configured, so Meridian is running entirely on your local device database. Everything
              works offline. Add <code className="text-[11px]">VITE_SUPABASE_URL</code> and{" "}
              <code className="text-[11px]">VITE_SUPABASE_ANON_KEY</code> to enable cloud sync.
            </div>
          )}

          <div className="max-h-56 overflow-y-auto px-2 py-2">
            {detail.pending.length === 0 && detail.failed.length === 0 ? (
              <EmptyState
                className="py-6"
                icon={<CheckCircle2 className="h-5 w-5" />}
                title="Nothing pending"
                description="All local changes are saved on this device."
              />
            ) : (
              <>
                {detail.failed.length > 0 && (
                  <>
                    <div className="px-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-red-500">
                      Failed ({detail.failed.length})
                    </div>
                    {detail.failed.slice(0, 12).map((i) => (
                      <div
                        key={i.mutation_id}
                        className="rounded-lg px-2 py-1.5 text-[11.5px] text-slate-600 dark:text-slate-300"
                      >
                        <span className="font-medium">{i.operation}</span> {i.entity_type.replace(/_/g, " ")}
                        <div className="truncate text-[10.5px] text-red-500">{i.error || "unknown error"}</div>
                      </div>
                    ))}
                  </>
                )}
                {detail.pending.length > 0 && (
                  <>
                    <div className="px-1.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Pending ({detail.pending.length})
                    </div>
                    {detail.pending.slice(0, 12).map((i) => (
                      <div
                        key={i.mutation_id}
                        className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[11.5px] text-slate-600 dark:text-slate-300"
                      >
                        <span>
                          <span className="font-medium">{i.operation}</span> {i.entity_type.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10.5px] text-slate-400">{timeAgo(i.created_at)}</span>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2.5 dark:border-white/5">
            <Button
              size="xs"
              variant="secondary"
              onClick={() => {
                void syncNow();
                close();
              }}
            >
              <RotateCw className="h-3 w-3" /> Sync now
            </Button>
            {state.failed > 0 && (
              <>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    void retryFailed();
                    toast.success("Retrying failed changes");
                  }}
                >
                  Retry failed
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    void clearFailed();
                    toast.success("Failed changes cleared");
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </Dropdown>
  );
}
