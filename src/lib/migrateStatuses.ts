import { getSetting, setSetting, db } from "./db";
import { normalizeStatus } from "./types";

const FLAG = "migrated_workflow_statuses_v1";

/**
 * One-time: rewrite legacy CRM statuses in local IndexedDB to workflow labels.
 * Writes Dexie only (no sync flood). Cloud can be fixed via SQL migration file.
 */
export async function migrateLeadStatusesOnce(): Promise<void> {
  try {
    const done = await getSetting<boolean>(FLAG);
    if (done) return;

    await setSetting(FLAG, true);

    const leads = await db.leads.toArray();
    let changed = 0;
    const now = new Date().toISOString();

    for (const lead of leads) {
      if (lead.deleted_at) continue;
      const next = normalizeStatus(lead.status);
      if (next === lead.status) continue;
      await db.leads.update(lead.id, {
        status: next,
        updated_at: now,
        sync_status: "pending",
        version: (lead.version || 1) + 1,
      });
      changed++;
    }

    if (changed > 0 && typeof console !== "undefined") {
      console.info(`[Meridian] Migrated ${changed} lead status(es) to workflow labels`);
    }
  } catch (e) {
    console.warn("[Meridian] status migration skipped", e);
  }
}
