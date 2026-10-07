import * as XLSX from "xlsx";
import { db } from "./db";
import type { Lead } from "./types";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function toCSV(rows: Record<string, any>[], headers?: string[]): string {
  const cols = headers && headers.length ? headers : Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = Array.isArray(v) ? v.join("; ") : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))];
  return lines.join("\n");
}

export function downloadCSV(rows: Record<string, any>[], filename: string, headers?: string[]) {
  const csv = toCSV(rows, headers);
  download(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }), filename);
}

export function downloadExcel(rows: Record<string, any>[], filename: string, sheetName = "Sheet1") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  download(new Blob([out], { type: "application/octet-stream" }), filename);
}

export const LEAD_EXPORT_HEADERS = [
  "business_name",
  "category",
  "address",
  "city",
  "phone",
  "email",
  "website",
  "website_status",
  "google_maps_url",
  "facebook_url",
  "instagram_url",
  "tiktok_url",
  "telegram_username",
  "linkedin_url",
  "rating",
  "reviews_count",
  "lead_score",
  "tier",
  "status",
  "potential_value",
  "tags",
  "why_scored",
  "next_action",
  "research_status",
  "last_contacted_at",
  "next_followup_at",
  "is_pinned",
  "is_archived",
];

export function leadRows(leads: Lead[]) {
  return leads.map((l) => ({
    ...l,
    tags: (l.tags || []).join("; "),
    is_pinned: l.is_pinned ? "yes" : "no",
    is_archived: l.is_archived ? "yes" : "no",
  }));
}

export async function exportLeads(leads: Lead[], format: "csv" | "xlsx", name = "leads") {
  const rows = leadRows(leads).map((r) =>
    Object.fromEntries(LEAD_EXPORT_HEADERS.map((h) => [h, (r as any)[h]])),
  );
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "csv") downloadCSV(rows, `${name}-${stamp}.csv`, LEAD_EXPORT_HEADERS);
  else downloadExcel(rows, `${name}-${stamp}.xlsx`, "Leads");
}

export async function exportAllData() {
  const [
    leads,
    import_batches,
    lead_activities,
    lead_notes,
    follow_ups,
    contacts,
    projects,
    project_tasks,
    project_notes,
    payments,
    tags,
    saved_views,
  ] = await Promise.all([
    db.leads.toArray(),
    db.import_batches.toArray(),
    db.lead_activities.toArray(),
    db.lead_notes.toArray(),
    db.follow_ups.toArray(),
    db.contacts.toArray(),
    db.projects.toArray(),
    db.project_tasks.toArray(),
    db.project_notes.toArray(),
    db.payments.toArray(),
    db.tags.toArray(),
    db.saved_views.toArray(),
  ]);
  const payload = {
    exported_at: new Date().toISOString(),
    app: "Meridian Agency OS",
    schema: 1,
    data: {
      leads,
      import_batches,
      lead_activities,
      lead_notes,
      follow_ups,
      contacts,
      projects,
      project_tasks,
      project_notes,
      payments,
      tags,
      saved_views,
    },
  };
  download(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    `meridian-full-backup-${new Date().toISOString().slice(0, 10)}.json`,
  );
}

export async function importAllData(file: File): Promise<{ imported: number }> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const data = parsed?.data;
  if (!data) throw new Error("Invalid backup file");
  let count = 0;
  await db.transaction(
    "rw",
    [
      db.leads,
      db.import_batches,
      db.lead_activities,
      db.lead_notes,
      db.follow_ups,
      db.contacts,
      db.projects,
      db.project_tasks,
      db.project_notes,
      db.payments,
      db.tags,
      db.saved_views,
    ],
    async () => {
      for (const [table, rows] of Object.entries(data)) {
        const store = (db as any)[table];
        if (!store || !Array.isArray(rows)) continue;
        await store.bulkPut(rows as any[]);
        count += (rows as any[]).length;
      }
    },
  );
  return { imported: count };
}
