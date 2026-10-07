/**
 * Statuses match the Firstform / Meridian real workflow:
 * research → qualify → build prototype → call queue → talk → close
 */
export type LeadStatus =
  | "New"
  | "Qualified"
  | "Prototype Ready"
  | "To Call"
  | "No Answer"
  | "In Talk"
  | "Won"
  | "Passed"
  // Legacy values still in IndexedDB — normalized on read
  | "Contacted"
  | "Replied"
  | "Interested"
  | "Not Interested"
  | "Follow-up"
  | "Meeting"
  | "Proposal"
  | "Lost";

/** Statuses you pick in the UI (no legacy clutter) */
export const LEAD_STATUSES: LeadStatus[] = [
  "New",
  "Qualified",
  "Prototype Ready",
  "To Call",
  "No Answer",
  "In Talk",
  "Won",
  "Passed",
];

export const STATUS_HELP: Record<string, string> = {
  New: "Not reviewed yet",
  Qualified: "Checked — no site / worth a prototype",
  "Prototype Ready": "Arena + Vercel done — not called yet",
  "To Call": "In your phone call queue",
  "No Answer": "Called — try again later",
  "In Talk": "Talking / sent link / negotiating",
  Won: "Paid or agreed",
  Passed: "Not interested or skipped",
};

/** Pipeline = your real board */
export const PIPELINE_COLUMNS_FULL: LeadStatus[] = [
  "New",
  "Qualified",
  "Prototype Ready",
  "To Call",
  "No Answer",
  "In Talk",
  "Won",
  "Passed",
];

/** Focus board for calling days */
export const PIPELINE_COLUMNS_SIMPLE: LeadStatus[] = [
  "Prototype Ready",
  "To Call",
  "No Answer",
  "In Talk",
  "Won",
];

export const PIPELINE_COLUMNS = PIPELINE_COLUMNS_FULL;

export type PipelinePreset = "simple" | "full";

/** Map old CRM labels → workflow statuses */
export function normalizeStatus(status: string | null | undefined): LeadStatus {
  const s = (status || "New").trim();
  const map: Record<string, LeadStatus> = {
    Contacted: "No Answer",
    Replied: "In Talk",
    Interested: "In Talk",
    "Follow-up": "No Answer",
    Meeting: "In Talk",
    Proposal: "In Talk",
    "Not Interested": "Passed",
    Lost: "Passed",
  };
  if (map[s]) return map[s];
  if ((LEAD_STATUSES as string[]).includes(s)) return s as LeadStatus;
  return "New";
}

export type Tier = 1 | 2 | 3 | 4 | 5;
export type ResearchStatus = "Not Researched" | "Researching" | "Researched";
export type WebsiteStatus = "has_website" | "no_website";

export interface Lead {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: "pending" | "synced" | "failed";
  version: number;

  business_name: string;
  category: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  website: string | null;
  website_status: WebsiteStatus;

  google_maps_url: string;
  facebook_url: string;
  instagram_url: string;
  tiktok_url: string;
  telegram_url: string;
  telegram_username: string;
  linkedin_url: string;

  rating: number | null;
  reviews_count: number | null;

  lead_score: number;
  tier: Tier;
  status: LeadStatus;
  potential_value: number | null;
  tags: string[];
  custom_fields: Record<string, string>;
  why_scored: string;
  next_action: string;
  research_status: ResearchStatus;

  last_contacted_at: string | null;
  next_followup_at: string | null;
  converted_at: string | null;

  is_pinned: boolean;
  is_archived: boolean;

  import_batch_id: string | null;

  notes_count: number;
  activities_count: number;
  followups_count: number;
}

export interface ImportBatch {
  id: string;
  name: string;
  source: string;
  file_name: string;
  total_imported: number;
  duplicates_skipped: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
  version: number;
}

export type ActivityType =
  | "Call"
  | "WhatsApp"
  | "Telegram"
  | "Email"
  | "Meeting"
  | "Message"
  | "Proposal"
  | "Other"
  | "Note";

export const ACTIVITY_TYPES: ActivityType[] = [
  "Call",
  "WhatsApp",
  "Telegram",
  "Email",
  "Meeting",
  "Message",
  "Proposal",
  "Other",
  "Note",
];

export interface LeadActivity {
  id: string;
  lead_id: string;
  type: ActivityType;
  content: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
  version: number;
}

export interface LeadNote {
  id: string;
  lead_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
  version: number;
}

export type FollowUpStatus = "Pending" | "Done" | "Overdue" | "Cancelled";

export interface FollowUp {
  id: string;
  lead_id: string;
  title: string;
  due_date: string;
  status: FollowUpStatus;
  notes: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
  version: number;
}

export type ContactRole = "Owner" | "Manager" | "Marketing" | "Other";

export interface Contact {
  id: string;
  lead_id: string;
  name: string;
  role: ContactRole;
  phone: string;
  email: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
  version: number;
}

export type ProjectStage =
  | "Planning"
  | "Design"
  | "Development"
  | "Content"
  | "Testing"
  | "Launch"
  | "Completed";

export const PROJECT_STAGES: ProjectStage[] = [
  "Planning",
  "Design",
  "Development",
  "Content",
  "Testing",
  "Launch",
  "Completed",
];

export type PaymentStatus = "Unpaid" | "Partially Paid" | "Paid" | "Overdue";

export interface Project {
  id: string;
  client_lead_id: string;
  name: string;
  description: string;
  stage: ProjectStage;
  progress: number;
  deadline: string | null;
  value: number;
  paid: number;
  payment_status: PaymentStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
  version: number;
}

export type TaskStatus = "To Do" | "In Progress" | "Review" | "Done";
export type TaskPriority = "Low" | "Medium" | "High" | "Urgent";

export interface Subtask {
  text: string;
  done: boolean;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  notes: string;
  subtasks: Subtask[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
  version: number;
}

export interface ProjectNote {
  id: string;
  project_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
  version: number;
}

export interface ProjectFileMeta {
  id: string;
  project_id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  storage_path: string;
  is_cached_locally: boolean;
  cached_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
  version: number;
}

export interface Payment {
  id: string;
  project_id: string;
  lead_id: string;
  amount: number;
  date: string;
  notes: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
  version: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
  version: number;
}

export type SyncOperation = "CREATE" | "UPDATE" | "DELETE";
export type SyncQueueStatus = "pending" | "syncing" | "synced" | "failed";

export interface SyncQueueItem {
  mutation_id: string;
  entity_type: string;
  entity_id: string;
  operation: SyncOperation;
  payload: any;
  created_at: string;
  retry_count: number;
  status: SyncQueueStatus;
  error?: string;
}

export interface SyncMeta {
  id: string;
  last_sync_at: string | null;
}

export interface SavedView {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  pinned?: boolean;
  filters: any;
  sort: any;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
  version: number;
}

export interface AppSetting {
  key: string;
  value: any;
}
