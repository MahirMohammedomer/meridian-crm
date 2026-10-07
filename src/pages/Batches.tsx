import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Layers, Trash2, Archive, Download, Users, Upload, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { useApp } from "@/lib/app";
import { batchesRepo, leadsRepo } from "@/lib/repos";
import { exportLeads } from "@/lib/export";
import { Button, Card, ConfirmDialog, EmptyState, SectionTitle } from "@/components/ui/ui";
import { formatDate } from "@/lib/utils";

type DeleteMode = "record" | "withLeads" | "archive" | null;

export function Batches() {
  const { navigate, openLead } = useApp();
  const batches = useLiveQuery(async () => db.import_batches.orderBy("created_at").reverse().toArray(), [], []);
  const leads = useLiveQuery(async () => db.leads.toArray(), [], []);
  const [target, setTarget] = useState<string | null>(null);
  const [mode, setMode] = useState<DeleteMode>(null);

  const rows = useMemo(
    () =>
      (batches || []).map((b) => {
        const inBatch = (leads || []).filter((l) => l.import_batch_id === b.id && !l.deleted_at);
        return {
          batch: b,
          count: inBatch.length,
          archived: inBatch.filter((l) => l.is_archived).length,
          won: inBatch.filter((l) => l.status === "Won").length,
          noWebsite: inBatch.filter((l) => l.website_status !== "has_website" || !l.website).length,
        };
      }),
    [batches, leads],
  );

  const totalImported = rows.reduce((s, r) => s + r.count, 0);
  const totalDups = (batches || []).reduce((s, b) => s + (b.duplicates_skipped || 0), 0);
  const targetRow = rows.find((r) => r.batch.id === target);

  const runDelete = async () => {
    if (!target || !mode) return;
    const b = rows.find((r) => r.batch.id === target)?.batch;
    if (!b) return;
    const inBatch = (leads || []).filter((l) => l.import_batch_id === b.id && !l.deleted_at);
    if (mode === "record") {
      await batchesRepo.remove(b.id);
      toast.success("Batch record deleted — leads kept");
    } else if (mode === "withLeads") {
      await leadsRepo.bulkUpdate(
        inBatch.map((l) => l.id),
        {},
      );
      for (const l of inBatch) await leadsRepo.remove(l.id);
      await batchesRepo.remove(b.id);
      toast.success(`Deleted batch and ${inBatch.length} leads`);
    } else if (mode === "archive") {
      await leadsRepo.bulkUpdate(
        inBatch.map((l) => l.id),
        { is_archived: true },
      );
      toast.success(`Archived ${inBatch.length} leads`);
    }
    setTarget(null);
    setMode(null);
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-5 md:px-7 md:py-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-white">Import batches</h1>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            {(batches || []).length} batches · {totalImported} leads · {totalDups} duplicates skipped
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => navigate("import")}>
          <Upload className="h-4 w-4" /> Import new batch
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Layers className="h-6 w-6" />}
            title="No batches yet"
            description="Every import creates a batch so you can keep thousands of leads organised by source."
            action={
              <Button variant="primary" onClick={() => navigate("import")}>
                <Upload className="h-4 w-4" /> Import leads
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.batch.id} className="p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400">
                  <Layers className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] font-semibold text-slate-900 dark:text-white">
                    {r.batch.name}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                    <span>{formatDate(r.batch.created_at)}</span>
                    <span>{r.batch.file_name || r.batch.source}</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">{r.count} leads</span>
                    <span>{r.batch.duplicates_skipped} dups skipped</span>
                    <span>{r.noWebsite} without website</span>
                    <span>{r.won} won</span>
                    {r.archived > 0 && <span>{r.archived} archived</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      window.location.hash = "#/leads";
                      toast.success(`Showing leads from "${r.batch.name}" — apply the batch filter`);
                    }}
                  >
                    <Users className="h-3.5 w-3.5" /> View leads
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const list = (leads || []).filter((l) => l.import_batch_id === r.batch.id && !l.deleted_at);
                      if (!list.length) return toast.error("No leads in this batch");
                      await exportLeads(list, "csv", r.batch.name.replace(/\s+/g, "-").toLowerCase());
                      toast.success("Batch exported");
                    }}
                  >
                    <Download className="h-3.5 w-3.5" /> Export
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const list = (leads || []).filter((l) => l.import_batch_id === r.batch.id && !l.deleted_at);
                      if (!list.length) return toast.error("No leads in this batch");
                      await leadsRepo.bulkUpdate(
                        list.map((l) => l.id),
                        { is_archived: true },
                      );
                      toast.success(`Archived ${list.length} leads`);
                    }}
                  >
                    <Archive className="h-3.5 w-3.5" /> Archive leads
                  </Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => { setTarget(r.batch.id); setMode("record"); }}>
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>
              </div>

              {(leads || []).filter((l) => l.import_batch_id === r.batch.id && !l.deleted_at).length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3 dark:border-white/5">
                  <SectionTitle className="mb-1.5">Sample leads</SectionTitle>
                  <div className="flex flex-wrap gap-1.5">
                    {(leads || [])
                      .filter((l) => l.import_batch_id === r.batch.id && !l.deleted_at)
                      .slice(0, 6)
                      .map((l) => (
                        <button
                          key={l.id}
                          onClick={() => openLead(l.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-[12px] text-slate-600 transition hover:bg-slate-100 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                        >
                          {l.business_name}
                          <ExternalLink className="h-3 w-3 opacity-40" />
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(target && mode)}
        onClose={() => {
          setTarget(null);
          setMode(null);
        }}
        title={
          mode === "withLeads"
            ? `Delete batch and ${targetRow?.count || 0} leads?`
            : mode === "archive"
              ? `Archive ${targetRow?.count || 0} leads?`
              : "Delete batch record?"
        }
        message={
          mode === "withLeads"
            ? "This permanently deletes the batch AND every lead it imported, including their notes, activities and follow-ups. This cannot be undone."
            : mode === "archive"
              ? "The batch stays, but all of its leads are moved to the archive. You can restore them later."
              : "Only the batch label is removed. All imported leads stay in your database."
        }
        confirmLabel={mode === "withLeads" ? "Delete everything" : mode === "archive" ? "Archive leads" : "Delete record"}
        onConfirm={runDelete}
      />

      {targetRow && (
        <Card className="mt-6 p-4">
          <SectionTitle className="mb-2">Danger zone for "{targetRow.batch.name}"</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" size="sm" onClick={() => setMode("withLeads")}>
              <Trash2 className="h-3.5 w-3.5" /> Delete batch + all {targetRow.count} leads
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
