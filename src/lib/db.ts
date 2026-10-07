import Dexie, { type Table } from "dexie";
import type {
  AppSetting,
  Contact,
  FollowUp,
  ImportBatch,
  Lead,
  LeadActivity,
  LeadNote,
  Payment,
  Project,
  ProjectFileMeta,
  ProjectNote,
  ProjectTask,
  SavedView,
  SyncMeta,
  SyncQueueItem,
  Tag,
} from "./types";

export interface RecentlyViewed {
  id: string;
  lead_id: string;
  viewed_at: string;
}

/** Local blob cache so files open offline once downloaded or uploaded here. */
export interface FileCache {
  id: string; // same id as project_files_meta
  blob: Blob;
  cached_at: string;
}

/** Serious conflicts surfaced to the user instead of silently overwritten. */
export interface ConflictRecord {
  id: string;
  entity_type: string;
  entity_id: string;
  local: any;
  remote: any;
  created_at: string;
  resolved?: boolean;
}

export class MeridianDB extends Dexie {
  leads!: Table<Lead, string>;
  import_batches!: Table<ImportBatch, string>;
  lead_activities!: Table<LeadActivity, string>;
  lead_notes!: Table<LeadNote, string>;
  follow_ups!: Table<FollowUp, string>;
  contacts!: Table<Contact, string>;
  projects!: Table<Project, string>;
  project_tasks!: Table<ProjectTask, string>;
  project_notes!: Table<ProjectNote, string>;
  project_files_meta!: Table<ProjectFileMeta, string>;
  payments!: Table<Payment, string>;
  tags!: Table<Tag, string>;
  sync_queue!: Table<SyncQueueItem, string>;
  sync_meta!: Table<SyncMeta, string>;
  saved_views!: Table<SavedView, string>;
  app_settings!: Table<AppSetting, string>;
  recently_viewed!: Table<RecentlyViewed, string>;
  file_cache!: Table<FileCache, string>;
  conflicts!: Table<ConflictRecord, string>;

  constructor() {
    super("meridian-agency-os");
    this.version(1).stores({
      leads:
        "id, business_name, category, city, address, phone, email, status, tier, lead_score, website_status, google_maps_url, rating, reviews_count, is_pinned, is_archived, import_batch_id, research_status, last_contacted_at, next_followup_at, updated_at, created_at, *tags",
      import_batches: "id, name, created_at, updated_at",
      lead_activities: "id, lead_id, type, created_at, updated_at",
      lead_notes: "id, lead_id, created_at, updated_at",
      follow_ups: "id, lead_id, due_date, status, created_at, updated_at",
      contacts: "id, lead_id, name, is_primary, updated_at",
      projects: "id, client_lead_id, name, stage, payment_status, deadline, updated_at",
      project_tasks: "id, project_id, status, priority, due_date, updated_at",
      project_notes: "id, project_id, created_at, updated_at",
      project_files_meta: "id, project_id, created_at, updated_at",
      payments: "id, project_id, lead_id, date, updated_at",
      tags: "id, name, updated_at",
      sync_queue: "mutation_id, entity_type, entity_id, status, created_at",
      sync_meta: "id",
      saved_views: "id, name, updated_at",
      app_settings: "key",
      recently_viewed: "id, lead_id, viewed_at",
    });
    this.version(2).stores({
      file_cache: "id, cached_at",
      conflicts: "id, entity_type, entity_id, created_at",
    });
  }
}

export const db = new MeridianDB();

export async function getSetting<T = any>(key: string, fallback?: T): Promise<T | undefined> {
  const row = await db.app_settings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: any) {
  await db.app_settings.put({ key, value });
}

export async function markRecentlyViewed(leadId: string) {
  if (!leadId) return;
  await db.recently_viewed.put({ id: leadId, lead_id: leadId, viewed_at: new Date().toISOString() });
  const all = await db.recently_viewed.orderBy("viewed_at").reverse().offset(30).primaryKeys();
  if (all.length) await db.recently_viewed.bulkDelete(all as string[]);
}
