import { db } from "./db";
import { supabase, isSupabaseConfigured, SUPABASE_TABLES } from "./supabase";
import { nowISO, uid } from "./utils";
import { queueMutation } from "./repos";
import { processPendingUploads } from "./files";
import type { SyncQueueItem } from "./types";

export type SyncPhase = "idle" | "syncing" | "offline" | "error" | "disabled";

export interface SyncState {
  phase: SyncPhase;
  pending: number;
  failed: number;
  lastSyncAt: string | null;
  message: string | null;
  online: boolean;
  pushing: number;
}

type Listener = (state: SyncState) => void;

const listeners = new Set<Listener>();

let state: SyncState = {
  phase: isSupabaseConfigured ? "idle" : "disabled",
  pending: 0,
  failed: 0,
  lastSyncAt: null,
  message: null,
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  pushing: 0,
};

export function getSyncState() {
  return state;
}

export function subscribeSync(fn: Listener) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

let started = false;
let pushTimer: number | null = null;
let intervalTimer: number | null = null;

const MAX_RETRIES = 6;

/** Debounced push scheduling (1s after a local mutation). */
export function scheduleSync(delay = 1000) {
  if (!isSupabaseConfigured) return;
  if (pushTimer) window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => {
    pushTimer = null;
    void syncNow();
  }, delay);
}

export async function refreshCounts() {
  const [pending, failed, meta] = await Promise.all([
    db.sync_queue.where("status").anyOf("pending", "syncing").count(),
    db.sync_queue.where("status").equals("failed").count(),
    db.sync_meta.get("main"),
  ]);
  const phase: SyncPhase = !isSupabaseConfigured
    ? "disabled"
    : !navigator.onLine
      ? "offline"
      : state.phase === "error"
        ? "error"
        : state.phase === "syncing"
          ? "syncing"
          : "idle";
  setState({ pending, failed, lastSyncAt: meta?.last_sync_at ?? null, phase, online: navigator.onLine });
}

export async function syncNow(opts: { silent?: boolean } = {}): Promise<void> {
  if (!isSupabaseConfigured) {
    setState({ phase: "disabled", message: "Cloud sync not configured" });
    await refreshCounts();
    return;
  }
  if (!navigator.onLine) {
    setState({ phase: "offline", online: false });
    await refreshCounts();
    return;
  }
  if (state.phase === "syncing") return;
  setState({ phase: "syncing", online: true, message: null });

  try {
    await pushQueue();
    await pullRemote();
    await processPendingUploads();
    await db.sync_meta.put({ id: "main", last_sync_at: nowISO() });
    setState({ phase: "idle", message: null });
  } catch (err: any) {
    if (!navigator.onLine) setState({ phase: "offline", message: "Offline — changes saved locally" });
    else setState({ phase: "error", message: err?.message || "Sync failed" });
  } finally {
    await refreshCounts();
  }
  if (opts.silent) {
    /* no-op */
  }
}

/* ------------------------------- PUSH ------------------------------- */

async function pushQueue() {
  if (!supabase) return;
  const items = await db.sync_queue
    .where("status")
    .anyOf("pending", "failed")
    .sortBy("created_at");
  const queue = items.filter((i) => i.retry_count < MAX_RETRIES);
  if (!queue.length) return;

  setState({ pushing: queue.length });

  for (const item of queue) {
    await db.sync_queue.update(item.mutation_id, { status: "syncing" });
    try {
      await applyPush(item);
      await db.sync_queue.delete(item.mutation_id);
    } catch (err: any) {
      const retry_count = item.retry_count + 1;
      await db.sync_queue.update(item.mutation_id, {
        status: retry_count >= MAX_RETRIES ? "failed" : "pending",
        retry_count,
        error: err?.message || "push failed",
      });
      if (!navigator.onLine) throw new Error("offline");
    }
  }
  setState({ pushing: 0 });
}

async function applyPush(item: SyncQueueItem) {
  if (!supabase) return;
  const table = item.entity_type;
  if (!SUPABASE_TABLES.includes(table as any)) return;

  if (item.operation === "DELETE") {
    const { error } = await supabase.from(table).upsert(item.payload, { onConflict: "id" });
    if (error) throw error;
    return;
  }

  // Last-write-wins guard: only push if our version/updated_at is newer
  const { data: remote, error: readErr } = await supabase
    .from(table)
    .select("id, updated_at, version")
    .eq("id", item.entity_id)
    .maybeSingle();
  if (readErr) throw readErr;

  if (remote && remote.updated_at) {
    const localTime = new Date(item.payload?.updated_at || 0).getTime();
    const remoteTime = new Date(remote.updated_at).getTime();
    if (remoteTime > localTime) {
      // remote wins for scalar fields — we will receive it on next pull; drop our mutation
      return;
    }
  }

  const payload = { ...item.payload, deleted_at: item.payload?.deleted_at ?? null };
  const { error } = await supabase.from(table).upsert(payload, { onConflict: "id" });
  if (error) throw error;
}

/* ------------------------------- PULL ------------------------------- */

const TABLE_MAP: Record<string, any> = {
  leads: db.leads,
  import_batches: db.import_batches,
  lead_activities: db.lead_activities,
  lead_notes: db.lead_notes,
  follow_ups: db.follow_ups,
  contacts: db.contacts,
  projects: db.projects,
  project_tasks: db.project_tasks,
  project_notes: db.project_notes,
  project_files_meta: db.project_files_meta,
  payments: db.payments,
  tags: db.tags,
  saved_views: db.saved_views,
};

async function pullRemote() {
  if (!supabase) return;
  const meta = await db.sync_meta.get("main");
  const since = meta?.last_sync_at || "1970-01-01T00:00:00.000Z";

  for (const table of SUPABASE_TABLES) {
    const store = TABLE_MAP[table];
    if (!store) continue;
    let from = 0;
    const PAGE = 1000;
    for (;;) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .gt("updated_at", since)
        .order("updated_at", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const row of data) await mergeRemote(table, row);
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }
}

const SCALAR_TABLES = ["leads", "projects", "contacts", "follow_ups", "tags", "import_batches", "saved_views"];

const TABLE_TO_ENTITY: Record<string, any> = {
  leads: "leads",
  import_batches: "batches",
  lead_activities: "activities",
  lead_notes: "notes",
  follow_ups: "followups",
  contacts: "contacts",
  projects: "projects",
  project_tasks: "tasks",
  project_notes: "projectNotes",
  payments: "payments",
  tags: "tags",
  saved_views: "views",
  project_files_meta: "files",
};

async function mergeRemote(table: string, row: any) {
  const store = TABLE_MAP[table];
  if (!store || !row?.id) return;

  // Remote soft-delete → hard-delete locally so deleted leads never reappear in the UI
  if (row.deleted_at) {
    await store.delete(row.id);
    return;
  }

  const local = await store.get(row.id);
  if (!local) {
    await store.put(row);
    return;
  }
  const localTime = new Date(local.updated_at || 0).getTime();
  const remoteTime = new Date(row.updated_at || 0).getTime();

  // Append-only history (notes/activities) is never overwritten — keep local copy
  if (table === "lead_notes" || table === "lead_activities" || table === "project_notes") return;

  if (remoteTime > localTime) {
    // Serious conflict: local has an unsynced edit AND remote changed too
    if (SCALAR_TABLES.includes(table)) {
      const pending = await db.sync_queue
        .where("entity_id")
        .equals(row.id)
        .and((i) => i.status === "pending" || i.status === "failed")
        .count();
      if (pending > 0 && Math.abs(remoteTime - localTime) < 1000 * 60 * 60 * 24) {
        await db.conflicts.put({
          id: uid(),
          entity_type: table,
          entity_id: row.id,
          local,
          remote: row,
          created_at: nowISO(),
          resolved: false,
        });
        setState({ message: `Sync conflict on ${row.business_name || row.name || row.id}` });
        return; // preserve both — user decides
      }
    }
    await store.put({ ...local, ...row });
  }
}

export async function getConflicts() {
  return db.conflicts.filter((c) => !c.resolved).toArray();
}

export async function resolveConflict(id: string, choice: "local" | "remote") {
  const c = await db.conflicts.get(id);
  if (!c) return;
  const store = TABLE_MAP[c.entity_type];
  if (store) {
    const winner = choice === "local" ? c.local : c.remote;
    await store.put({ ...winner, updated_at: nowISO(), version: (winner.version || 1) + 1 });
    await queueMutation(TABLE_TO_ENTITY[c.entity_type] || "leads", "UPDATE", winner.id, winner);
  }
  await db.conflicts.delete(id);
  await refreshCounts();
}

/* --------------------------- FULL DOWNLOAD --------------------------- */

export async function initialPull(onProgress?: (table: string, n: number) => void): Promise<number> {
  if (!supabase) throw new Error("Supabase not configured");
  let total = 0;
  for (const table of SUPABASE_TABLES) {
    const store = TABLE_MAP[table];
    if (!store) continue;
    let from = 0;
    const PAGE = 1000;
    for (;;) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || !data.length) break;
      for (const row of data) await mergeRemote(table, row);
      total += data.length;
      if (data.length < PAGE) break;
      from += PAGE;
    }
    onProgress?.(table, total);
  }
  await db.sync_meta.put({ id: "main", last_sync_at: nowISO() });
  await refreshCounts();
  return total;
}

/**
 * New device: if the local database is empty and the cloud has data,
 * download everything once so the app becomes ready for offline use.
 */
export async function initialSyncIfEmpty(): Promise<"pulled" | "skipped" | "empty"> {
  if (!isSupabaseConfigured || !navigator.onLine) return "skipped";
  const count = await db.leads.count();
  if (count > 0) return "skipped";
  try {
    const n = await initialPull();
    return n > 0 ? "pulled" : "empty";
  } catch {
    return "skipped";
  }
}

export async function retryFailed() {
  await db.sync_queue.where("status").equals("failed").modify({ status: "pending", retry_count: 0, error: "" });
  await refreshCounts();
  void syncNow();
}

export async function clearFailed() {
  await db.sync_queue.where("status").equals("failed").delete();
  await refreshCounts();
}

export async function getPendingDetail() {
  const [pending, failed] = await Promise.all([
    db.sync_queue.where("status").anyOf("pending", "syncing").sortBy("created_at"),
    db.sync_queue.where("status").equals("failed").sortBy("created_at"),
  ]);
  return { pending, failed };
}

/* ---------------------------- AUTO TRIGGERS ---------------------------- */

export function startSyncEngine() {
  if (started) return;
  started = true;

  const onOnline = () => {
    setState({ online: true });
    void syncNow();
  };
  const onOffline = () => {
    setState({ online: false, phase: isSupabaseConfigured ? "offline" : "disabled" });
  };
  const onVisible = () => {
    if (document.visibilityState === "visible" && navigator.onLine) void syncNow();
  };
  const onQueued = () => scheduleSync(1000);

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);
  window.addEventListener("meridian:sync-queued", onQueued);

  intervalTimer = window.setInterval(() => {
    if (navigator.onLine && document.visibilityState === "visible") void syncNow();
  }, 30000);

  void refreshCounts();
  if (isSupabaseConfigured && navigator.onLine) void syncNow();
}

export function stopSyncEngine() {
  window.clearInterval(intervalTimer ?? undefined);
  started = false;
}
