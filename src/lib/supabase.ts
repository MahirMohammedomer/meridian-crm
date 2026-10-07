import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

export const isSupabaseConfigured = Boolean(url && anon && /^https?:\/\//.test(url));

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Required so password-reset / magic-link tokens in the URL become a real session
        detectSessionInUrl: true,
        flowType: "pkce",
        storageKey: "meridian-auth",
      },
    })
  : null;

export const SUPABASE_TABLES = [
  "leads",
  "import_batches",
  "lead_activities",
  "lead_notes",
  "follow_ups",
  "contacts",
  "projects",
  "project_tasks",
  "project_notes",
  "project_files_meta",
  "payments",
  "tags",
  "saved_views",
] as const;

export type SupabaseTable = (typeof SUPABASE_TABLES)[number];

/** Human readable reason the cloud is unavailable (shown in the sync panel). */
export const cloudStatus = isSupabaseConfigured
  ? null
  : "Supabase not configured — running fully local. Add VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY to enable sync.";
