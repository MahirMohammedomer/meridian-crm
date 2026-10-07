import { db, markRecentlyViewed } from "./db";
import { nowISO, uid } from "./utils";
import type {
  ActivityType,
  Contact,
  FollowUp,
  ImportBatch,
  Lead,
  LeadActivity,
  LeadNote,
  Payment,
  Project,
  ProjectNote,
  ProjectTask,
  SavedView,
  Tag,
} from "./types";

const SYNC_ENTITY: Record<string, string> = {
  leads: "leads",
  notes: "lead_notes",
  activities: "lead_activities",
  followups: "follow_ups",
  contacts: "contacts",
  projects: "projects",
  tasks: "project_tasks",
  projectNotes: "project_notes",
  payments: "payments",
  batches: "import_batches",
  tags: "tags",
  views: "saved_views",
  files: "project_files_meta",
};

export type EntityKey = keyof typeof SYNC_ENTITY;

/**
 * Local-first mutation helper.
 * 1. writes to Dexie (source of truth)
 * 2. pushes a durable mutation into the sync_queue (survives restart)
 */
export async function queueMutation(
  entity: EntityKey,
  operation: "CREATE" | "UPDATE" | "DELETE",
  entityId: string,
  payload: any,
) {
  await db.sync_queue.put({
    mutation_id: uid(),
    entity_type: SYNC_ENTITY[entity],
    entity_id: entityId,
    operation,
    payload,
    created_at: nowISO(),
    retry_count: 0,
    status: "pending",
  });
  try {
    window.dispatchEvent(new CustomEvent("meridian:sync-queued"));
  } catch {
    /* ignore */
  }
}

function bump<T extends { updated_at: string; version: number; sync_status?: string }>(rec: T): T {
  return { ...rec, updated_at: nowISO(), version: (rec.version || 0) + 1, sync_status: "pending" };
}

export function emptyLead(partial: Partial<Lead> = {}): Lead {
  const t = nowISO();
  return {
    id: uid(),
    created_at: t,
    updated_at: t,
    deleted_at: null,
    sync_status: "pending",
    version: 1,
    business_name: "",
    category: "",
    address: "",
    city: "",
    phone: "",
    email: "",
    website: null,
    website_status: "no_website",
    google_maps_url: "",
    facebook_url: "",
    instagram_url: "",
    tiktok_url: "",
    telegram_url: "",
    telegram_username: "",
    linkedin_url: "",
    rating: null,
    reviews_count: null,
    lead_score: 0,
    tier: 3,
    status: "New",
    potential_value: null,
    tags: [],
    custom_fields: {},
    why_scored: "",
    next_action: "",
    research_status: "Not Researched",
    last_contacted_at: null,
    next_followup_at: null,
    converted_at: null,
    is_pinned: false,
    is_archived: false,
    import_batch_id: null,
    notes_count: 0,
    activities_count: 0,
    followups_count: 0,
    ...partial,
  };
}

/* ------------------------------ LEADS ------------------------------ */

export const leadsRepo = {
  async create(partial: Partial<Lead> = {}) {
    const lead = emptyLead(partial);
    await db.leads.put(lead);
    await queueMutation("leads", "CREATE", lead.id, lead);
    return lead;
  },

  async update(id: string, changes: Partial<Lead>) {
    const existing = await db.leads.get(id);
    if (!existing) return;
    const next = bump({ ...existing, ...changes });
    if (changes.status === "Won" && !existing.converted_at) next.converted_at = nowISO();
    await db.leads.put(next);
    await queueMutation("leads", "UPDATE", id, next);
    return next;
  },

  async bulkUpdate(ids: string[], changes: Partial<Lead>) {
    const t = nowISO();
    const records: Lead[] = [];
    await db.transaction("rw", db.leads, db.sync_queue, async () => {
      for (const id of ids) {
        const existing = await db.leads.get(id);
        if (!existing) continue;
        const next = bump({ ...existing, ...changes });
        if (changes.status === "Won" && !existing.converted_at) next.converted_at = t;
        records.push(next);
      }
      await db.leads.bulkPut(records);
      for (const r of records) await queueMutation("leads", "UPDATE", r.id, r);
    });
    return records;
  },

  async remove(id: string) {
    const existing = await db.leads.get(id);
    if (!existing) return;
    // Queue remote delete first, then hard-delete locally so the lead
    // disappears immediately and cannot reappear from a soft-deleted row.
    await queueMutation("leads", "DELETE", id, {
      id,
      deleted_at: nowISO(),
    });
    await db.leads.delete(id);
    // clean up children locally
    await db.lead_notes.where("lead_id").equals(id).delete();
    await db.lead_activities.where("lead_id").equals(id).delete();
    await db.follow_ups.where("lead_id").equals(id).delete();
    await db.contacts.where("lead_id").equals(id).delete();
    await db.recently_viewed.delete(id);
  },

  async touchViewed(id: string) {
    await markRecentlyViewed(id);
  },
};

/* ------------------------------ NOTES ------------------------------ */

export const notesRepo = {
  async create(lead_id: string, content: string) {
    const t = nowISO();
    const note: LeadNote = {
      id: uid(),
      lead_id,
      content,
      created_at: t,
      updated_at: t,
      deleted_at: null,
      sync_status: "pending",
      version: 1,
    };
    await db.lead_notes.put(note);
    await queueMutation("notes", "CREATE", note.id, note);
    await bumpLeadSnapshot(lead_id);
    return note;
  },
  async update(id: string, content: string) {
    const n = await db.lead_notes.get(id);
    if (!n) return;
    const next = bump({ ...n, content });
    await db.lead_notes.put(next);
    await queueMutation("notes", "UPDATE", id, next);
    return next;
  },
  async remove(id: string) {
    const n = await db.lead_notes.get(id);
    if (!n) return;
    await db.lead_notes.delete(id);
    await queueMutation("notes", "DELETE", id, { id });
    if (n.lead_id) await bumpLeadSnapshot(n.lead_id);
  },
};

/* --------------------------- ACTIVITIES --------------------------- */

export const activitiesRepo = {
  async create(lead_id: string, type: ActivityType, content: string, created_at?: string) {
    const t = nowISO();
    const act: LeadActivity = {
      id: uid(),
      lead_id,
      type,
      content,
      created_at: created_at ? new Date(created_at).toISOString() : t,
      updated_at: t,
      deleted_at: null,
      sync_status: "pending",
      version: 1,
    };
    await db.lead_activities.put(act);
    await queueMutation("activities", "CREATE", act.id, act);
    // last contacted for outreach-type activities
    const outreach: ActivityType[] = ["Call", "WhatsApp", "Telegram", "Email", "Meeting"];
    if (outreach.includes(type)) {
      const lead = await db.leads.get(lead_id);
      if (lead) {
        const next = bump({ ...lead, last_contacted_at: act.created_at });
        await db.leads.put(next);
        await queueMutation("leads", "UPDATE", lead_id, next);
      }
    }
    await bumpLeadSnapshot(lead_id);
    return act;
  },
  async update(id: string, changes: Partial<LeadActivity>) {
    const a = await db.lead_activities.get(id);
    if (!a) return;
    const next = bump({ ...a, ...changes });
    await db.lead_activities.put(next);
    await queueMutation("activities", "UPDATE", id, next);
    return next;
  },
  async remove(id: string) {
    const a = await db.lead_activities.get(id);
    if (!a) return;
    await db.lead_activities.delete(id);
    await queueMutation("activities", "DELETE", id, { id });
    if (a.lead_id) await bumpLeadSnapshot(a.lead_id);
  },
};

/* --------------------------- FOLLOW-UPS --------------------------- */

export const followupsRepo = {
  async create(input: { lead_id: string; title: string; due_date: string; notes?: string }) {
    const t = nowISO();
    const fu: FollowUp = {
      id: uid(),
      lead_id: input.lead_id,
      title: input.title,
      due_date: new Date(input.due_date).toISOString(),
      status: "Pending",
      notes: input.notes || "",
      completed_at: null,
      created_at: t,
      updated_at: t,
      deleted_at: null,
      sync_status: "pending",
      version: 1,
    };
    await db.follow_ups.put(fu);
    await queueMutation("followups", "CREATE", fu.id, fu);
    await syncNextFollowup(input.lead_id);
    await bumpLeadSnapshot(input.lead_id);
    return fu;
  },
  async update(id: string, changes: Partial<FollowUp>) {
    const f = await db.follow_ups.get(id);
    if (!f) return;
    const next = bump({ ...f, ...changes });
    await db.follow_ups.put(next);
    await queueMutation("followups", "UPDATE", id, next);
    await syncNextFollowup(next.lead_id);
    return next;
  },
  async complete(id: string) {
    return this.update(id, { status: "Done", completed_at: nowISO() });
  },
  async remove(id: string) {
    const f = await db.follow_ups.get(id);
    if (!f) return;
    await db.follow_ups.delete(id);
    await queueMutation("followups", "DELETE", id, { id });
    await syncNextFollowup(f.lead_id);
  },
};

export async function syncNextFollowup(lead_id: string) {
  if (!lead_id) return;
  const pending = await db.follow_ups
    .where("lead_id")
    .equals(lead_id)
    .filter((f) => f.status === "Pending" || f.status === "Overdue")
    .toArray();
  pending.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  const next = pending[0]?.due_date ?? null;
  const lead = await db.leads.get(lead_id);
  if (lead && lead.next_followup_at !== next) {
    const updated = bump({ ...lead, next_followup_at: next });
    await db.leads.put(updated);
    await queueMutation("leads", "UPDATE", lead_id, updated);
  }
}

async function bumpLeadSnapshot(lead_id: string) {
  const lead = await db.leads.get(lead_id);
  if (!lead) return;
  const [notes, acts, fus] = await Promise.all([
    db.lead_notes.where("lead_id").equals(lead_id).count(),
    db.lead_activities.where("lead_id").equals(lead_id).count(),
    db.follow_ups
      .where("lead_id")
      .equals(lead_id)
      .filter((f) => f.status === "Pending" || f.status === "Overdue")
      .count(),
  ]);
  await db.leads.put({ ...lead, notes_count: notes, activities_count: acts, followups_count: fus });
}

/* ------------------------------ CONTACTS ------------------------------ */

export const contactsRepo = {
  async create(input: Partial<Contact>) {
    const t = nowISO();
    const c: Contact = {
      id: uid(),
      lead_id: input.lead_id || "",
      name: input.name || "",
      role: input.role || "Other",
      phone: input.phone || "",
      email: input.email || "",
      is_primary: !!input.is_primary,
      created_at: t,
      updated_at: t,
      deleted_at: null,
      sync_status: "pending",
      version: 1,
    };
    await db.contacts.put(c);
    await queueMutation("contacts", "CREATE", c.id, c);
    return c;
  },
  async update(id: string, changes: Partial<Contact>) {
    const c = await db.contacts.get(id);
    if (!c) return;
    const next = bump({ ...c, ...changes });
    await db.contacts.put(next);
    await queueMutation("contacts", "UPDATE", id, next);
    return next;
  },
  async remove(id: string) {
    const c = await db.contacts.get(id);
    if (!c) return;
    await db.contacts.delete(id);
    await queueMutation("contacts", "DELETE", id, { id });
  },
};

/* ------------------------------ PROJECTS ------------------------------ */

export const projectsRepo = {
  async create(input: Partial<Project>) {
    const t = nowISO();
    const p: Project = {
      id: uid(),
      client_lead_id: input.client_lead_id || "",
      name: input.name || "Untitled project",
      description: input.description || "",
      stage: input.stage || "Planning",
      progress: input.progress ?? 0,
      deadline: input.deadline ?? null,
      value: input.value ?? 0,
      paid: input.paid ?? 0,
      payment_status: input.payment_status || "Unpaid",
      created_at: t,
      updated_at: t,
      deleted_at: null,
      sync_status: "pending",
      version: 1,
    };
    await db.projects.put(p);
    await queueMutation("projects", "CREATE", p.id, p);
    return p;
  },
  async update(id: string, changes: Partial<Project>) {
    const p = await db.projects.get(id);
    if (!p) return;
    const next = bump({ ...p, ...changes });
    await db.projects.put(next);
    await queueMutation("projects", "UPDATE", id, next);
    return next;
  },
  async remove(id: string) {
    const p = await db.projects.get(id);
    if (!p) return;
    await db.projects.delete(id);
    await queueMutation("projects", "DELETE", id, { id });
    await db.project_tasks.where("project_id").equals(id).delete();
    await db.project_notes.where("project_id").equals(id).delete();
  },
};

/* ------------------------------ TASKS ------------------------------ */

export const tasksRepo = {
  async create(input: Partial<ProjectTask>) {
    const t = nowISO();
    const task: ProjectTask = {
      id: uid(),
      project_id: input.project_id || "",
      title: input.title || "New task",
      description: input.description || "",
      status: input.status || "To Do",
      priority: input.priority || "Medium",
      due_date: input.due_date ?? null,
      notes: input.notes || "",
      subtasks: input.subtasks || [],
      created_at: t,
      updated_at: t,
      deleted_at: null,
      sync_status: "pending",
      version: 1,
    };
    await db.project_tasks.put(task);
    await queueMutation("tasks", "CREATE", task.id, task);
    return task;
  },
  async update(id: string, changes: Partial<ProjectTask>) {
    const t = await db.project_tasks.get(id);
    if (!t) return;
    const next = bump({ ...t, ...changes });
    await db.project_tasks.put(next);
    await queueMutation("tasks", "UPDATE", id, next);
    return next;
  },
  async remove(id: string) {
    const t = await db.project_tasks.get(id);
    if (!t) return;
    await db.project_tasks.delete(id);
    await queueMutation("tasks", "DELETE", id, { id });
  },
};

/** Auto-calc progress from completed tasks — only when the user asks for it. */
export async function recalcProjectProgress(projectId: string) {
  const tasks = await db.project_tasks.where("project_id").equals(projectId).toArray();
  const project = await db.projects.get(projectId);
  if (!project) return;
  const progress = tasks.length ? Math.round((tasks.filter((t) => t.status === "Done").length / tasks.length) * 100) : 0;
  const next = bump({ ...project, progress });
  await db.projects.put(next);
  await queueMutation("projects", "UPDATE", projectId, next);
  return progress;
}

/** Copy a project with its tasks (notes/files are not copied). */
export async function duplicateProject(projectId: string, name?: string) {
  const src = await db.projects.get(projectId);
  if (!src) return null;
  const copy = await projectsRepo.create({
    client_lead_id: src.client_lead_id,
    name: name || `${src.name} (copy)`,
    description: src.description,
    stage: src.stage,
    progress: 0,
    deadline: src.deadline,
    value: src.value,
    paid: 0,
    payment_status: "Unpaid",
  });
  const tasks = await db.project_tasks.where("project_id").equals(projectId).toArray();
  for (const t of tasks) {
    await tasksRepo.create({
      project_id: copy.id,
      title: t.title,
      description: t.description,
      status: "To Do",
      priority: t.priority,
      due_date: t.due_date,
      notes: t.notes,
      subtasks: (t.subtasks || []).map((s) => ({ ...s, done: false })),
    });
  }
  return copy;
}

export const projectNotesRepo = {
  async create(project_id: string, content: string) {
    const t = nowISO();
    const n: ProjectNote = {
      id: uid(),
      project_id,
      content,
      created_at: t,
      updated_at: t,
      deleted_at: null,
      sync_status: "pending",
      version: 1,
    };
    await db.project_notes.put(n);
    await queueMutation("projectNotes", "CREATE", n.id, n);
    return n;
  },
  async remove(id: string) {
    await db.project_notes.delete(id);
    await queueMutation("projectNotes", "DELETE", id, { id });
  },
};

/* ------------------------------ PAYMENTS ------------------------------ */

export const paymentsRepo = {
  async create(input: { project_id?: string; lead_id?: string; amount: number; date: string; notes?: string }) {
    const t = nowISO();
    const p: Payment = {
      id: uid(),
      project_id: input.project_id || "",
      lead_id: input.lead_id || "",
      amount: Number(input.amount) || 0,
      date: input.date || t,
      notes: input.notes || "",
      created_at: t,
      updated_at: t,
      deleted_at: null,
      sync_status: "pending",
      version: 1,
    };
    await db.payments.put(p);
    await queueMutation("payments", "CREATE", p.id, p);
    if (p.project_id) {
      const project = await db.projects.get(p.project_id);
      if (project) {
        const paid = (project.paid || 0) + p.amount;
        const payment_status: Project["payment_status"] =
          paid <= 0 ? "Unpaid" : paid >= (project.value || 0) ? "Paid" : "Partially Paid";
        const next = bump({ ...project, paid, payment_status });
        await db.projects.put(next);
        await queueMutation("projects", "UPDATE", project.id, next);
      }
    }
    return p;
  },
  async remove(id: string) {
    const p = await db.payments.get(id);
    if (!p) return;
    await db.payments.delete(id);
    await queueMutation("payments", "DELETE", id, { id });
    if (p.project_id) {
      const project = await db.projects.get(p.project_id);
      if (project) {
        const paid = Math.max(0, (project.paid || 0) - p.amount);
        const payment_status: Project["payment_status"] =
          paid <= 0 ? "Unpaid" : paid >= (project.value || 0) ? "Paid" : "Partially Paid";
        const next = bump({ ...project, paid, payment_status });
        await db.projects.put(next);
        await queueMutation("projects", "UPDATE", project.id, next);
      }
    }
  },
};

/* ------------------------------ BATCHES / TAGS / VIEWS ------------------------------ */

export const batchesRepo = {
  async create(input: Partial<ImportBatch>) {
    const t = nowISO();
    const b: ImportBatch = {
      id: uid(),
      name: input.name || "Untitled batch",
      source: input.source || "import",
      file_name: input.file_name || "",
      total_imported: input.total_imported ?? 0,
      duplicates_skipped: input.duplicates_skipped ?? 0,
      created_at: t,
      updated_at: t,
      deleted_at: null,
      sync_status: "pending",
      version: 1,
    };
    await db.import_batches.put(b);
    await queueMutation("batches", "CREATE", b.id, b);
    return b;
  },
  async update(id: string, changes: Partial<ImportBatch>) {
    const b = await db.import_batches.get(id);
    if (!b) return;
    const next = bump({ ...b, ...changes });
    await db.import_batches.put(next);
    await queueMutation("batches", "UPDATE", id, next);
    return next;
  },
  async remove(id: string) {
    await db.import_batches.delete(id);
    await queueMutation("batches", "DELETE", id, { id });
  },
};

export const tagsRepo = {
  async ensure(name: string, color = "#6366f1") {
    const existing = await db.tags.where("name").equals(name).first();
    if (existing) return existing;
    const t = nowISO();
    const tag: Tag = {
      id: uid(),
      name,
      color,
      created_at: t,
      updated_at: t,
      deleted_at: null,
      sync_status: "pending",
      version: 1,
    };
    await db.tags.put(tag);
    await queueMutation("tags", "CREATE", tag.id, tag);
    return tag;
  },
  async remove(id: string) {
    await db.tags.delete(id);
    await queueMutation("tags", "DELETE", id, { id });
  },
};

export const viewsRepo = {
  async create(name: string, filters: any, sort: any, extra: Partial<SavedView> = {}) {
    const t = nowISO();
    const v: SavedView = {
      id: uid(),
      name,
      ...extra,
      filters,
      sort,
      created_at: t,
      updated_at: t,
      deleted_at: null,
      sync_status: "pending",
      version: 1,
    };
    await db.saved_views.put(v);
    await queueMutation("views", "CREATE", v.id, v);
    return v;
  },
  async remove(id: string) {
    await db.saved_views.delete(id);
    await queueMutation("views", "DELETE", id, { id });
  },
};
