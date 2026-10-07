import { useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Check, AlertTriangle, ArrowRight, Trash2, DownloadCloud } from "lucide-react";
import { db } from "@/lib/db";
import { batchesRepo, leadsRepo, notesRepo, queueMutation } from "@/lib/repos";
import { Button, Card, ConfirmDialog, EmptyState, Field, Input, NativeSelect, SectionTitle, Badge } from "@/components/ui/ui";
import {
  formatDate,
  normalizeMapsUrl,
  normalizeText,
  nowISO,
  similarity,
  toIntlPhone,
  uid,
} from "@/lib/utils";
import type { Lead, Tier } from "@/lib/types";
import { useApp } from "@/lib/app";
import { exportLeads } from "@/lib/export";

type TargetField =
  | "business_name"
  | "category"
  | "address"
  | "city"
  | "phone"
  | "email"
  | "website"
  | "google_maps_url"
  | "facebook_url"
  | "instagram_url"
  | "tiktok_url"
  | "telegram_username"
  | "linkedin_url"
  | "rating"
  | "reviews_count"
  | "lead_score"
  | "tier"
  | "status"
  | "potential_value"
  | "tags"
  | "notes"
  | "next_action"
  | "why_scored"
  | "research_status"
  | "ignore";

const FIELD_LABELS: Record<TargetField, string> = {
  business_name: "Business name",
  category: "Category / niche",
  address: "Address",
  city: "City / subcity",
  phone: "Phone",
  email: "Email",
  website: "Website",
  google_maps_url: "Google Maps URL",
  facebook_url: "Facebook",
  instagram_url: "Instagram",
  tiktok_url: "TikTok",
  telegram_username: "Telegram",
  linkedin_url: "LinkedIn",
  rating: "Rating",
  reviews_count: "Reviews",
  lead_score: "Lead Score (manual)",
  tier: "Tier (manual)",
  status: "Status",
  potential_value: "Potential value",
  tags: "Tags (comma separated)",
  notes: "Notes",
  next_action: "Next action",
  why_scored: "Why scored",
  research_status: "Research status",
  ignore: "— Ignore —",
};

const SYNONYMS: Record<string, TargetField> = {
  business_name: "business_name",
  businessname: "business_name",
  name: "business_name",
  title: "business_name",
  company: "business_name",
  "business name": "business_name",
  category: "category",
  niche: "category",
  type: "category",
  industry: "category",
  categories: "category",
  address: "address",
  location: "address",
  "full address": "address",
  city: "city",
  subcity: "city",
  "city/subcity": "city",
  phone: "phone",
  "phone number": "phone",
  mobile: "phone",
  telephone: "phone",
  tel: "phone",
  email: "email",
  "e-mail": "email",
  mail: "email",
  website: "website",
  url: "website",
  site: "website",
  "google maps url": "google_maps_url",
  "google maps": "google_maps_url",
  maps: "google_maps_url",
  mapsurl: "google_maps_url",
  gmap: "google_maps_url",
  facebook: "facebook_url",
  fb: "facebook_url",
  instagram: "instagram_url",
  ig: "instagram_url",
  tiktok: "tiktok_url",
  telegram: "telegram_username",
  tg: "telegram_username",
  linkedin: "linkedin_url",
  rating: "rating",
  stars: "rating",
  reviews: "reviews_count",
  "reviews count": "reviews_count",
  reviewcount: "reviews_count",
  "review count": "reviews_count",
  score: "lead_score",
  "lead score": "lead_score",
  leadscore: "lead_score",
  tier: "tier",
  status: "status",
  "potential value": "potential_value",
  value: "potential_value",
  tags: "tags",
  tag: "tags",
  notes: "notes",
  note: "notes",
  "next action": "next_action",
  nextaction: "next_action",
  "why scored": "why_scored",
  why: "why_scored",
  "research status": "research_status",
  research: "research_status",
};

function autoMap(headers: string[]): Record<string, TargetField> {
  const map: Record<string, TargetField> = {};
  const used = new Set<TargetField>();
  for (const h of headers) {
    const key = normalizeText(h);
    const guess = SYNONYMS[key] || (Object.keys(SYNONYMS).find((k) => key.includes(k)) as any);
    let target: TargetField = guess ? SYNONYMS[guess as string] || (guess as TargetField) : "ignore";
    if (used.has(target) && target !== "ignore") target = "ignore";
    used.add(target);
    map[h] = target;
  }
  return map;
}

interface Parsed {
  headers: string[];
  rows: Record<string, any>[];
}

type DupAction = "skip" | "update" | "both";

export function ImportPage() {
  const { navigate } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<Record<string, TargetField>>({});
  const [step, setStep] = useState<"upload" | "map" | "resolve" | "done">("upload");
  const [dragging, setDragging] = useState(false);
  const [batchName, setBatchName] = useState("");
  const [dupActions, setDupActions] = useState<Record<number, DupAction>>({});
  const [result, setResult] = useState<any>(null);
  const [deleteBatch, setDeleteBatch] = useState<string | null>(null);

  const batches = useLiveQuery(() => db.import_batches.orderBy("created_at").reverse().toArray(), [], []);
  const existing = useLiveQuery(() => db.leads.toArray(), [], []);

  const duplicates = useMemo(() => {
    if (!parsed || !existing) return [];
    const used = new Set<string>();
    return parsed.rows.map((row, idx) => {
      const mapped = mapRow(row, mapping);
      const mapsKey = normalizeMapsUrl(mapped.google_maps_url);
      let match: Lead | null = null;
      let reason = "";
      if (mapsKey) {
        match =
          (existing as Lead[]).find(
            (l) => !l.deleted_at && !used.has(l.id) && normalizeMapsUrl(l.google_maps_url) === mapsKey,
          ) || null;
        if (match) reason = "Same Google Maps URL";
      }
      if (!match && mapped.business_name) {
        const name = normalizeText(mapped.business_name);
        const phone = toIntlPhone(mapped.phone);
        const cands = (existing as Lead[]).filter((l) => !l.deleted_at && !used.has(l.id));
        // exact phone match first
        if (phone) {
          match = cands.find((l) => toIntlPhone(l.phone) && toIntlPhone(l.phone) === phone) || null;
          if (match) reason = "Same phone number";
        }
        if (!match) {
          const fuzzy = cands.find((l) => {
            const s = similarity(l.business_name, name);
            const phoneSame = phone && toIntlPhone(l.phone) === phone;
            const addrSame =
              mapped.address && l.address && normalizeText(l.address) === normalizeText(mapped.address);
            return s > 0.9 && (phoneSame || addrSame || !phone);
          });
          if (fuzzy) {
            match = fuzzy as Lead;
            reason = "Similar name + same location/phone";
          }
        }
      }
      if (match) used.add(match.id);
      return { idx, matched: match, reason, row: mapped };
    });
  }, [parsed, existing, mapping]);

  const dupCount = duplicates.filter((d) => d.matched).length;
  const newCount = parsed ? parsed.rows.length - dupCount : 0;
  const updateCount = duplicates.filter((d) => d.matched && (dupActions[d.idx] || "skip") === "update").length;
  const keepBothCount = duplicates.filter((d) => d.matched && (dupActions[d.idx] || "skip") === "both").length;
  const willImport = newCount + keepBothCount;
  const willUpdate = updateCount;
  const willSkip = dupCount - updateCount - keepBothCount;

  /* ----------------------------- parsing ----------------------------- */

  const readFile = async (file: File) => {
    try {
      setFileName(file.name);
      let headers: string[] = [];
      let rows: Record<string, any>[] = [];

      if (/\.(csv|txt|tsv)$/i.test(file.name)) {
        const text = await file.text();
        const res = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
        headers = (res.meta.fields || []).filter(Boolean);
        rows = (res.data as any[]).filter((r) => Object.values(r).some((v) => String(v ?? "").trim()));
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
        headers = json.length ? Object.keys(json[0]).filter((h: string) => h && !/^__EMPTY/.test(h)) : [];
        rows = json
          .filter((r) => Object.values(r).some((v) => String(v ?? "").trim()))
          .map((r) => {
            const o: Record<string, any> = {};
            headers.forEach((h) => (o[h] = r[h]));
            return o;
          });
      }

      if (!headers.length) {
        toast.error("No columns found in file");
        return;
      }
      setParsed({ headers, rows });
      setMapping(autoMap(headers));
      setDupActions({});
      setStep("map");
      const d = new Date();
      setBatchName(
        `${file.name.replace(/\.(csv|xlsx|xls|txt)$/i, "")} — ${d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`,
      );
      toast.success(`${rows.length} rows read from ${file.name}`);
    } catch (e: any) {
      toast.error("Could not read file: " + (e?.message || "unknown error"));
    }
  };

  /* ----------------------------- import ----------------------------- */

  const doImport = async () => {
    if (!parsed) return;
    const batch = await batchesRepo.create({
      name: batchName.trim() || `Import ${formatDate(nowISO())}`,
      source: /\.(csv|txt)$/i.test(fileName) ? "csv" : "xlsx",
      file_name: fileName,
    });

    const leads: Lead[] = [];
    const pendingNotes: { lead_id: string; content: string }[] = [];
    const updates: { id: string; changes: Partial<Lead>; notes?: string }[] = [];
    let skipped = 0;

    for (const d of duplicates) {
      const mapped = d.row;
      const action = d.matched ? dupActions[d.idx] || "skip" : "create";
      if (action === "skip") {
        skipped++;
        continue;
      }
      if (action === "update" && d.matched) {
        const changes: Partial<Lead> = { ...mapped };
        // Preserve manual score/tier unless the file provides one
        if (mapped.lead_score === undefined || mapped.lead_score === null || mapped.lead_score === 0)
          delete changes.lead_score;
        if (!mapped.tier) delete changes.tier;
        updates.push({ id: d.matched.id, changes, notes: mapped.__notes });
        continue;
      }
      if (action === "create" || action === "both") {
        if (!mapped.business_name) {
          skipped++;
          continue;
        }
        const lead = buildLead(mapped, batch.id);
        leads.push(lead);
        if (mapped.__notes) pendingNotes.push({ lead_id: lead.id, content: mapped.__notes });
      }
    }

    await db.leads.bulkPut(leads);
    for (const l of leads) await queueMutation("leads", "CREATE", l.id, l);
    for (const n of pendingNotes) await notesRepo.create(n.lead_id, n.content);

    for (const u of updates) {
      await leadsRepo.update(u.id, u.changes);
      if (u.notes) await notesRepo.create(u.id, u.notes);
    }

    await batchesRepo.update(batch.id, {
      total_imported: leads.length + updates.length,
      duplicates_skipped: skipped,
    });

    setResult({ batch, imported: leads.length, updated: updates.length, skipped });
    setStep("done");
    toast.success(`Imported ${leads.length} new leads · updated ${updates.length}`);
  };

  /* ------------------------------ render ------------------------------ */

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-5 md:px-7 md:py-7">
      <div className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-white">Import leads</h1>
        <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
          CSV or XLSX · works fully offline · manual score &amp; tier are preserved exactly
        </p>
      </div>

      {step === "upload" && (
        <Card className="p-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void readFile(f);
            }}
            onClick={() => fileRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition ${
              dragging
                ? "border-slate-900 bg-slate-50 dark:border-white dark:bg-white/5"
                : "border-slate-200 hover:border-slate-300 dark:border-white/10"
            }`}
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/5">
              <Upload className="h-6 w-6" />
            </div>
            <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">Drop your file here</h3>
            <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
              CSV, XLSX or XLS · Google Maps exports work great
            </p>
            <Button variant="primary" className="mt-5">
              <FileSpreadsheet className="h-4 w-4" /> Choose file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls,.txt,.tsv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void readFile(f);
              }}
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { t: "1. Parse", d: "We read the file locally — nothing is uploaded until sync." },
              { t: "2. Map columns", d: "Auto-detected, fully editable, or send to a custom field." },
              { t: "3. Resolve duplicates", d: "Matched by Google Maps URL, then name + phone." },
            ].map((s) => (
              <div key={s.t} className="rounded-xl bg-slate-50 p-3.5 dark:bg-white/[0.04]">
                <div className="text-[13px] font-semibold text-slate-900 dark:text-white">{s.t}</div>
                <div className="mt-0.5 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">{s.d}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {step === "map" && parsed && (
        <>
          <Card className="mb-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[15px] font-semibold text-slate-900 dark:text-white">{fileName}</div>
                <div className="text-[12.5px] text-slate-500">
                  {parsed.rows.length} rows · {parsed.headers.length} columns
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setStep("upload")}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={() => setStep("resolve")}>
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>

          <Card className="mb-4 overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3 dark:border-white/5">
              <SectionTitle>Column mapping</SectionTitle>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {parsed.headers.map((h) => (
                <div key={h} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <div className="min-w-[160px] flex-1">
                    <div className="truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">{h}</div>
                    <div className="truncate text-[11.5px] text-slate-400">
                      {String(parsed.rows[0]?.[h] ?? "").slice(0, 60) || "(empty)"}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
                  <NativeSelect
                    className="max-w-[240px] flex-1"
                    value={mapping[h] || "ignore"}
                    onChange={(e) => setMapping({ ...mapping, [h]: e.target.value as TargetField })}
                  >
                    {(Object.keys(FIELD_LABELS) as TargetField[]).map((f) => (
                      <option key={f} value={f}>
                        {FIELD_LABELS[f]}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3 dark:border-white/5">
              <SectionTitle>Preview · first 20 rows</SectionTitle>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-[12.5px]">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-white/[0.04]">
                    {(Object.keys(FIELD_LABELS) as TargetField[])
                      .filter((f) => Object.values(mapping).includes(f))
                      .map((f) => (
                        <th key={f} className="whitespace-nowrap px-3 py-2 font-medium">
                          {FIELD_LABELS[f]}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 20).map((row, i) => {
                    const m = mapRow(row, mapping);
                    return (
                      <tr key={i} className="border-t border-slate-100 dark:border-white/5">
                        {(Object.keys(FIELD_LABELS) as TargetField[])
                          .filter((f) => Object.values(mapping).includes(f))
                          .map((f) => (
                            <td key={f} className="max-w-[220px] truncate px-3 py-1.5 text-slate-600 dark:text-slate-300">
                              {String((m as any)[f] ?? "")}
                            </td>
                          ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {step === "resolve" && parsed && (
        <>
          <Card className="mb-4 p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="New leads" value={newCount} tone="emerald" />
              <Stat label="Duplicates found" value={dupCount} tone="amber" />
              <Stat label="Total rows" value={parsed.rows.length} />
            </div>
            {dupCount > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="flex-1">
                  {dupCount} duplicate{dupCount === 1 ? "" : "s"} found in your local database.
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    const next: Record<number, DupAction> = {};
                    duplicates.forEach((d) => (next[d.idx] = "skip"));
                    setDupActions(next);
                  }}
                >
                  Skip all
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    const next: Record<number, DupAction> = {};
                    duplicates.forEach((d) => (next[d.idx] = "update"));
                    setDupActions(next);
                  }}
                >
                  Update all
                </Button>
              </div>
            )}
          </Card>

          {dupCount > 0 && (
            <Card className="mb-4 overflow-hidden">
              <div className="border-b border-slate-100 px-4 py-3 dark:border-white/5">
                <SectionTitle>Duplicates</SectionTitle>
              </div>
              <div className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto dark:divide-white/5">
                {duplicates
                  .filter((d) => d.matched)
                  .map((d) => {
                    const action = dupActions[d.idx] || "skip";
                    return (
                      <div key={d.idx} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-semibold text-slate-900 dark:text-white">
                            {d.row.business_name || d.matched!.business_name}
                          </div>
                          <div className="truncate text-[12px] text-slate-500 dark:text-slate-400">
                            matches <span className="font-medium">{d.matched!.business_name}</span> · {d.reason}
                          </div>
                          {(d.row.lead_score || d.row.tier) && (
                            <div className="mt-1 flex gap-1.5">
                              {d.row.tier ? <Badge>Tier {d.row.tier}</Badge> : null}
                              {d.row.lead_score ? <Badge>Score {d.row.lead_score}</Badge> : null}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {(["skip", "update", "both"] as DupAction[]).map((a) => (
                            <button
                              key={a}
                              onClick={() => setDupActions({ ...dupActions, [d.idx]: a })}
                              className={`rounded-lg px-2.5 py-1 text-[12px] font-medium capitalize transition ${
                                action === a
                                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                  : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                              }`}
                            >
                              {a === "both" ? "keep both" : a}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Card>
          )}

          <Card className="p-4">
            <Field label="Batch name">
              <Input value={batchName} onChange={(e) => setBatchName(e.target.value)} placeholder="Construction Addis — Aug 29" />
            </Field>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-white/5">
              <div className="text-[13px] text-slate-600 dark:text-slate-300">
                Will import <b>{willImport}</b> new · update <b>{willUpdate}</b> · skip <b>{willSkip}</b>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setStep("map")}>
                  Back
                </Button>
                <Button variant="primary" onClick={doImport}>
                  <Check className="h-4 w-4" /> Import {willImport + willUpdate} leads
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}

      {step === "done" && result && (
        <Card className="p-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
            <Check className="h-7 w-7" />
          </div>
          <h2 className="text-[17px] font-semibold text-slate-900 dark:text-white">Import complete</h2>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
            Batch “{result.batch.name}” · {result.imported} new · {result.updated} updated · {result.skipped} skipped
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button variant="primary" onClick={() => navigate("leads")}>
              View leads
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setStep("upload");
                setParsed(null);
                setResult(null);
              }}
            >
              Import another file
            </Button>
          </div>
        </Card>
      )}

      {/* Past imports (Batches folded into Import) */}
      <div className="mt-8">
        <SectionTitle className="mb-2">Past imports</SectionTitle>
        <p className="mb-3 text-[12.5px] text-slate-500 dark:text-slate-400">
          Every file you import becomes a batch. Filter by batch on the Leads page, export, or clean up here.
        </p>
        {(batches || []).length === 0 ? (
          <Card>
            <EmptyState
              icon={<DownloadCloud className="h-6 w-6" />}
              title="No batches yet"
              description="Imported files are listed here with counts and duplicate stats."
            />
          </Card>
        ) : (
          <div className="space-y-2">
            {(batches || []).map((b) => (
              <Card key={b.id} className="flex flex-wrap items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-slate-900 dark:text-white">{b.name}</div>
                  <div className="text-[12px] text-slate-500 dark:text-slate-400">
                    {b.file_name} · {formatDate(b.created_at)} · {b.total_imported} imported · {b.duplicates_skipped}{" "}
                    duplicates skipped
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigate("leads");
                    toast.success(`Open Filters → Batch → "${b.name}"`);
                  }}
                >
                  View leads
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const list = await db.leads.where("import_batch_id").equals(b.id).toArray();
                    if (!list.length) return toast.error("No leads in this batch");
                    await exportLeads(list, "csv", b.name.replace(/\s+/g, "-").toLowerCase());
                    toast.success("Batch exported");
                  }}
                >
                  Export
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const list = await db.leads.where("import_batch_id").equals(b.id).toArray();
                    const ids = list.filter((l) => !l.deleted_at).map((l) => l.id);
                    if (!ids.length) return toast.error("No leads");
                    await leadsRepo.bulkUpdate(ids, { is_archived: true });
                    toast.success(`Archived ${ids.length} leads`);
                  }}
                >
                  Archive
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={() => setDeleteBatch(b.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteBatch)}
        onClose={() => setDeleteBatch(null)}
        title="Delete batch record?"
        message="This only removes the batch label — imported leads stay in your database."
        confirmLabel="Delete batch"
        onConfirm={async () => {
          if (deleteBatch) await batchesRepo.remove(deleteBatch);
          toast.success("Batch deleted");
        }}
      />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "amber" }) {
  return (
    <div className="rounded-xl border border-slate-100 p-3.5 text-center dark:border-white/5">
      <div
        className={`text-[22px] font-semibold ${
          tone === "emerald"
            ? "text-emerald-600 dark:text-emerald-400"
            : tone === "amber"
              ? "text-amber-600 dark:text-amber-400"
              : "text-slate-900 dark:text-white"
        }`}
      >
        {value}
      </div>
      <div className="text-[11.5px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

/* ------------------------------ helpers ------------------------------ */

function mapRow(row: Record<string, any>, mapping: Record<string, TargetField>) {
  const out: any = {};
  for (const [header, target] of Object.entries(mapping)) {
    if (!target || target === "ignore") continue;
    const raw = row[header];
    const val = typeof raw === "string" ? raw.trim() : raw;
    if (val === "" || val === null || val === undefined) continue;
    switch (target) {
      case "rating":
        out.rating = Number(String(val).replace(/[^\d.]/g, "")) || null;
        break;
      case "reviews_count":
        out.reviews_count = Number(String(val).replace(/[^\d]/g, "")) || null;
        break;
      case "lead_score":
        out.lead_score = Math.max(0, Math.min(100, Number(String(val).replace(/[^\d]/g, "")) || 0));
        break;
      case "tier": {
        const n = Number(String(val).replace(/[^\d]/g, "")) || 0;
        out.tier = (n >= 1 && n <= 5 ? n : 3) as Tier;
        break;
      }
      case "potential_value":
        out.potential_value = Number(String(val).replace(/[^\d.]/g, "")) || null;
        break;
      case "tags":
        out.tags = String(val)
          .split(/[,;|]/)
          .map((t) => t.trim())
          .filter(Boolean);
        break;
      case "notes":
        out.__notes = String(val);
        break;
      default:
        out[target] = String(val);
    }
  }
  return out;
}

function buildLead(mapped: any, batchId: string): Lead {
  const t = nowISO();
  const website = mapped.website || null;
  return {
    id: uid(),
    created_at: t,
    updated_at: t,
    deleted_at: null,
    sync_status: "pending",
    version: 1,
    business_name: mapped.business_name || "(unnamed)",
    category: mapped.category || "",
    address: mapped.address || "",
    city: mapped.city || "",
    phone: mapped.phone || "",
    email: mapped.email || "",
    website,
    website_status: website ? "has_website" : "no_website",
    google_maps_url: mapped.google_maps_url || "",
    facebook_url: mapped.facebook_url || "",
    instagram_url: mapped.instagram_url || "",
    tiktok_url: mapped.tiktok_url || "",
    telegram_url: "",
    telegram_username: mapped.telegram_username || "",
    linkedin_url: mapped.linkedin_url || "",
    rating: mapped.rating ?? null,
    reviews_count: mapped.reviews_count ?? null,
    // MANUAL ONLY — taken exactly from the file
    lead_score: mapped.lead_score ?? 0,
    tier: (mapped.tier ?? 3) as Tier,
    status: (mapped.status as any) || "New",
    potential_value: mapped.potential_value ?? null,
    tags: mapped.tags || [],
    custom_fields: {},
    why_scored: mapped.why_scored || "",
    next_action: mapped.next_action || "",
    research_status: (mapped.research_status as any) || "Not Researched",
    last_contacted_at: null,
    next_followup_at: null,
    converted_at: null,
    is_pinned: false,
    is_archived: false,
    import_batch_id: batchId,
    notes_count: 0,
    activities_count: 0,
    followups_count: 0,
  };
}
