import { db } from "./db";
import { supabase, isSupabaseConfigured } from "./supabase";
import { queueMutation } from "./repos";
import { nowISO, uid } from "./utils";
import type { ProjectFileMeta } from "./types";

export const FILES_BUCKET = "agency-files";

export type FileKind = "Logo" | "Image" | "Document" | "Design" | "Content" | "Other";

export function fileKind(name: string, type = ""): FileKind {
  const n = name.toLowerCase();
  if (/logo/.test(n) || /\.(svg|ai|eps)$/.test(n)) return "Logo";
  if (/\.(png|jpe?g|gif|webp|avif|heic)$/.test(n) || type.startsWith("image/")) return "Image";
  if (/\.(psd|xd|fig|sketch)$/.test(n)) return "Design";
  if (/\.(docx?|txt|md|rtf|csv|xlsx?)$/.test(n)) return "Content";
  if (/\.(pdf|pptx?|key|zip|rar)$/.test(n)) return "Document";
  return "Other";
}

export function formatSize(bytes?: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Create metadata, cache the blob locally, and upload when possible. */
export async function attachFile(projectId: string, file: File): Promise<ProjectFileMeta> {
  const id = uid();
  const storagePath = `projects/${projectId}/${id}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
  const meta: ProjectFileMeta = {
    id,
    project_id: projectId,
    file_name: file.name,
    file_size: file.size,
    file_type: file.type || fileKind(file.name),
    storage_path: storagePath,
    is_cached_locally: true,
    cached_at: nowISO(),
    created_at: nowISO(),
    updated_at: nowISO(),
    deleted_at: null,
    sync_status: "pending",
    version: 1,
  };
  await db.project_files_meta.put(meta);
  await db.file_cache.put({ id, blob: file, cached_at: nowISO() });
  await queueMutation("files", "CREATE", id, { ...meta, __pending_upload: true });
  void tryUpload(meta.id);
  return meta;
}

/** Upload the blob to Supabase Storage when online; safe to call repeatedly. */
export async function tryUpload(metaId: string): Promise<"uploaded" | "queued" | "local"> {
  const meta = await db.project_files_meta.get(metaId);
  if (!meta) return "local";
  const blob = await db.file_cache.get(metaId);
  if (!supabase || !isSupabaseConfigured || !navigator.onLine || !blob) return "queued";

  try {
    const { error } = await supabase.storage.from(FILES_BUCKET).upload(meta.storage_path, blob.blob, {
      contentType: meta.file_type || "application/octet-stream",
      upsert: true,
    });
    if (error) throw error;
    const next = { ...meta, updated_at: nowISO(), version: (meta.version || 1) + 1, sync_status: "synced" as const };
    await db.project_files_meta.put(next);
    await queueMutation("files", "UPDATE", metaId, next);
    return "uploaded";
  } catch {
    return "queued";
  }
}

export async function processPendingUploads() {
  if (!navigator.onLine || !isSupabaseConfigured) return;
  const all = await db.project_files_meta.toArray();
  const pending = all.filter((m) => m.sync_status === "pending");
  for (const m of pending) {
    const cached = await db.file_cache.get(m.id);
    if (cached) await tryUpload(m.id);
  }
}

async function ensureBlob(meta: ProjectFileMeta): Promise<Blob | null> {
  const cached = await db.file_cache.get(meta.id);
  if (cached) return cached.blob;
  if (!supabase || !isSupabaseConfigured) return null;
  if (!navigator.onLine) return null;
  try {
    const { data, error } = await supabase.storage.from(FILES_BUCKET).download(meta.storage_path);
    if (error || !data) return null;
    await db.file_cache.put({ id: meta.id, blob: data, cached_at: nowISO() });
    if (!meta.is_cached_locally) {
      const next = { ...meta, is_cached_locally: true, cached_at: nowISO() };
      await db.project_files_meta.put(next);
    }
    return data;
  } catch {
    return null;
  }
}

export async function openFile(meta: ProjectFileMeta) {
  const blob = await ensureBlob(meta);
  if (!blob) {
    return {
      ok: false,
      message: navigator.onLine
        ? "Could not download this file from Supabase Storage."
        : "Needs internet to download — this file is not cached on this device.",
    };
  }
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return { ok: true };
}

export async function downloadFile(meta: ProjectFileMeta) {
  const blob = await ensureBlob(meta);
  if (!blob) {
    return {
      ok: false,
      message: navigator.onLine
        ? "Could not download this file."
        : "Needs internet to download — this file is not cached on this device.",
    };
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = meta.file_name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return { ok: true };
}

export async function deleteFile(meta: ProjectFileMeta) {
  if (supabase && isSupabaseConfigured && navigator.onLine) {
    try {
      await supabase.storage.from(FILES_BUCKET).remove([meta.storage_path]);
    } catch {
      /* ignore — local delete still happens */
    }
  }
  await db.file_cache.delete(meta.id);
  await db.project_files_meta.delete(meta.id);
  await queueMutation("files", "DELETE", meta.id, { id: meta.id, deleted_at: nowISO() });
}

export function isUploadPending(meta: ProjectFileMeta) {
  return meta.sync_status === "pending";
}
