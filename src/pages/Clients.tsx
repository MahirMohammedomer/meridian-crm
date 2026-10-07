import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Handshake, Plus, Phone, MessageCircle, Download, Wallet, FolderKanban, Contact2, Paperclip } from "lucide-react";
import { db } from "@/lib/db";
import { useApp } from "@/lib/app";
import { LeadProfile } from "@/components/leads/LeadProfile";
import { Button, Card, EmptyState, Progress, SectionTitle, Select } from "@/components/ui/ui";
import { TierBadge, StatusSelect } from "@/components/leads/controls";
import { TelegramButton } from "@/components/common/QuickActions";
import { downloadCSV, downloadExcel } from "@/lib/export";
import { formatDate, formatETB, telHref, waHref } from "@/lib/utils";
import { toast } from "sonner";
import type { Lead } from "@/lib/types";

export function Clients() {
  const { openLead, leadId, closeLead } = useApp();
  const [stageFilter, setStageFilter] = useState("");

  const leads = useLiveQuery(() => db.leads.toArray(), [], []);
  const projects = useLiveQuery(() => db.projects.toArray(), [], []);
  const contacts = useLiveQuery(() => db.contacts.toArray(), [], []);
  const files = useLiveQuery(() => db.project_files_meta.toArray(), [], []);

  const clients = useMemo(
    () =>
      (leads || [])
        .filter((l) => !l.deleted_at && l.status === "Won")
        .sort((a, b) => new Date(b.converted_at || b.updated_at).getTime() - new Date(a.converted_at || a.updated_at).getTime()),
    [leads],
  );

  const stats = useMemo(() => {
    const value = (projects || []).reduce((s, p) => s + (p.value || 0), 0);
    const paid = (projects || []).reduce((s, p) => s + (p.paid || 0), 0);
    return { value, paid, remaining: value - paid, count: clients.length };
  }, [projects, clients]);

  const visible = useMemo(() => {
    if (!stageFilter) return clients;
    const ids = new Set((projects || []).filter((p) => p.stage === stageFilter).map((p) => p.client_lead_id));
    return clients.filter((c) => ids.has(c.id));
  }, [clients, projects, stageFilter]);

  const exportClients = (kind: "csv" | "xlsx") => {
    const rows = clients.map((c) => {
      const ps = (projects || []).filter((p) => p.client_lead_id === c.id);
      return {
        business_name: c.business_name,
        category: c.category,
        phone: c.phone,
        city: c.city,
        converted_at: c.converted_at,
        tier: c.tier,
        value: ps.reduce((s, p) => s + (p.value || 0), 0),
        paid: ps.reduce((s, p) => s + (p.paid || 0), 0),
      };
    });
    const stamp = new Date().toISOString().slice(0, 10);
    kind === "csv" ? downloadCSV(rows, `clients-${stamp}.csv`) : downloadExcel(rows, `clients-${stamp}.xlsx`, "Clients");
    toast.success("Clients exported");
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-5 md:px-7 md:py-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-white">Clients</h1>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            {stats.count} won · {formatETB(stats.value)} project value · {formatETB(stats.remaining)} outstanding
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="w-[150px]"
            size="sm"
            value={stageFilter}
            onChange={setStageFilter}
            placeholder="All stages"
            options={["Planning", "Design", "Development", "Content", "Testing", "Launch", "Completed"].map((s) => ({
              value: s,
              label: s,
            }))}
          />
          <Button variant="outline" size="sm" onClick={() => exportClients("csv")}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportClients("xlsx")}>
            <Download className="h-3.5 w-3.5" /> Excel
          </Button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <SummaryCard icon={<Handshake className="h-4 w-4" />} label="Clients" value={String(stats.count)} />
        <SummaryCard icon={<Wallet className="h-4 w-4" />} label="Project value" value={formatETB(stats.value)} />
        <SummaryCard icon={<Wallet className="h-4 w-4" />} label="Paid" value={formatETB(stats.paid)} tone="emerald" />
        <SummaryCard icon={<Wallet className="h-4 w-4" />} label="Outstanding" value={formatETB(stats.remaining)} tone="amber" />
      </div>

      {clients.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Handshake className="h-6 w-6" />}
            title="No clients yet"
            description="When you move a lead to Won it appears here automatically."
            action={
              <Button variant="primary" onClick={() => (window.location.hash = "#/leads")}>
                Go to leads
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((c) => (
            <ClientCard
              key={c.id}
              lead={c}
              projects={(projects || []).filter((p) => p.client_lead_id === c.id)}
              contactCount={(contacts || []).filter((x) => x.lead_id === c.id).length}
              fileCount={(files || []).filter((f) =>
                (projects || []).some((p) => p.client_lead_id === c.id && p.id === f.project_id),
              ).length}
              onOpen={() => openLead(c.id)}
              onCreateProject={() => openLead(c.id)}
            />
          ))}
        </div>
      )}

      <LeadProfile leadId={leadId} onClose={closeLead} />
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "emerald" | "amber";
}) {
  return (
    <Card className="flex items-center gap-3 p-3.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10.5px] uppercase tracking-wide text-slate-400">{label}</div>
        <div
          className={`truncate text-[15px] font-semibold ${
            tone === "emerald"
              ? "text-emerald-600 dark:text-emerald-400"
              : tone === "amber"
                ? "text-amber-600 dark:text-amber-400"
                : "text-slate-900 dark:text-white"
          }`}
        >
          {value}
        </div>
      </div>
    </Card>
  );
}

function ClientCard({
  lead,
  projects,
  contactCount,
  fileCount,
  onOpen,
  onCreateProject,
}: {
  lead: Lead;
  projects: any[];
  contactCount: number;
  fileCount: number;
  onOpen: () => void;
  onCreateProject: () => void;
}) {
  const value = projects.reduce((s, p) => s + (p.value || 0), 0);
  const paid = projects.reduce((s, p) => s + (p.paid || 0), 0);
  const progress = projects.length
    ? Math.round(projects.reduce((s, p) => s + (p.progress || 0), 0) / projects.length)
    : 0;

  return (
    <Card className="p-4 transition hover:border-slate-300 dark:hover:border-white/20">
      <button onClick={onOpen} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-slate-900 dark:text-white">{lead.business_name}</div>
            <div className="truncate text-[12px] text-slate-500 dark:text-slate-400">
              {[lead.category, lead.city].filter(Boolean).join(" · ") || "—"}
            </div>
          </div>
          <TierBadge lead={lead} size="xs" />
        </div>
      </button>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-slate-50 py-1.5 dark:bg-white/5">
          <div className="text-[13px] font-semibold text-slate-900 dark:text-white">{projects.length}</div>
          <div className="text-[10px] uppercase text-slate-400">Projects</div>
        </div>
        <div className="rounded-lg bg-slate-50 py-1.5 dark:bg-white/5">
          <div className="text-[13px] font-semibold text-slate-900 dark:text-white">{formatETB(value)}</div>
          <div className="text-[10px] uppercase text-slate-400">Value</div>
        </div>
        <div className="rounded-lg bg-slate-50 py-1.5 dark:bg-white/5">
          <div className="text-[13px] font-semibold text-amber-600 dark:text-amber-400">{formatETB(value - paid)}</div>
          <div className="text-[10px] uppercase text-slate-400">Due</div>
        </div>
      </div>

      {projects.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11.5px] text-slate-400">
          <Contact2 className="h-3.5 w-3.5" /> {contactCount} contacts
          <FolderKanban className="ml-2 h-3.5 w-3.5" /> {projects.length}
          <Paperclip className="ml-2 h-3.5 w-3.5" /> {fileCount}
        </div>
        <div className="flex items-center gap-1">
          <a href={lead.phone ? telHref(lead.phone) : undefined}>
            <Button size="icon-sm" variant="ghost" disabled={!lead.phone} title="Call">
              <Phone className="h-3.5 w-3.5" />
            </Button>
          </a>
          <a href={lead.phone ? waHref(lead.phone) : undefined} target="_blank" rel="noreferrer">
            <Button size="icon-sm" variant="ghost" disabled={!lead.phone} title="WhatsApp">
              <MessageCircle className="h-3.5 w-3.5" />
            </Button>
          </a>
          <TelegramButton lead={lead} size="sm" />
          <Button size="icon-sm" variant="secondary" title="Create project" onClick={onCreateProject}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-white/5">
        <StatusSelect lead={lead} />
        <span className="text-[11px] text-slate-400">
          Won {lead.converted_at ? formatDate(lead.converted_at) : ""}
        </span>
      </div>
    </Card>
  );
}

export { SectionTitle, Plus };
