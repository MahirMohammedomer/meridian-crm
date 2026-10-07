import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Phone, ChevronRight, ExternalLink, Check, X, RotateCcw } from "lucide-react";
import { db } from "@/lib/db";
import { leadsRepo } from "@/lib/repos";
import { useApp } from "@/lib/app";
import { Button, Card, EmptyState } from "@/components/ui/ui";
import { MessageMenu } from "@/components/common/QuickActions";
import { normalizeStatus, type Lead } from "@/lib/types";
import { telHref, safeUrl } from "@/lib/utils";

/**
 * Phone-first screen: only people ready to call.
 * Built for “I finished 15 prototypes on laptop → open Call Mode on phone.”
 */
export function CallMode() {
  const { openLead } = useApp();
  const leads = useLiveQuery(() => db.leads.toArray(), [], []);
  const [filter, setFilter] = useState<"queue" | "noanswer" | "all">("queue");

  const list = useMemo(() => {
    const all = (leads || []).filter((l) => !l.deleted_at && !l.is_archived && l.phone);
    const withNorm = all.map((l) => ({ ...l, status: normalizeStatus(l.status) }));
    if (filter === "queue") {
      return withNorm.filter((l) => l.status === "To Call" || l.status === "Prototype Ready");
    }
    if (filter === "noanswer") {
      return withNorm.filter((l) => l.status === "No Answer");
    }
    return withNorm.filter((l) =>
      ["Prototype Ready", "To Call", "No Answer", "In Talk"].includes(l.status),
    );
  }, [leads, filter]);

  const setStatus = async (lead: Lead, status: Lead["status"]) => {
    await leadsRepo.update(lead.id, { status, last_contacted_at: new Date().toISOString() });
    toast.success(`${lead.business_name} → ${status}`);
  };

  return (
    <div className="mx-auto w-full max-w-lg px-3 py-4 md:max-w-2xl md:px-6 md:py-6">
      <div className="mb-4">
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-white">Call Mode</h1>
        <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
          Prototypes ready + call queue · big call buttons · phone-friendly
        </p>
      </div>

      <div className="mb-4 flex gap-1 rounded-xl border border-slate-200 p-1 dark:border-white/10">
        {(
          [
            ["queue", "To call"],
            ["noanswer", "No answer"],
            ["all", "All active"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition ${
              filter === k
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Phone className="h-6 w-6" />}
            title="Nothing to call"
            description="Mark leads Prototype Ready or To Call after you deploy a site. They show up here."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((lead) => {
            const proto = lead.custom_fields?.prototype_url;
            return (
              <Card key={lead.id} className="overflow-hidden p-0">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-2 px-4 pt-4 text-left"
                  onClick={() => openLead(lead.id)}
                >
                  <div className="min-w-0">
                    <div className="truncate text-[16px] font-semibold text-slate-900 dark:text-white">
                      {lead.business_name}
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-slate-500">
                      {[lead.category, lead.city].filter(Boolean).join(" · ") || "—"}
                      {" · "}
                      <span className="font-medium text-slate-600 dark:text-slate-300">{normalizeStatus(lead.status)}</span>
                    </div>
                    {proto && (
                      <a
                        href={safeUrl(proto) || "#"}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 inline-flex items-center gap-1 text-[12px] text-violet-600 dark:text-violet-400"
                      >
                        Prototype <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
                </button>

                <div className="space-y-2 px-4 pb-4 pt-3">
                  <a href={telHref(lead.phone)} className="block">
                    <Button variant="primary" className="h-14 w-full gap-2 rounded-2xl text-[16px] font-semibold">
                      <Phone className="h-5 w-5" /> Call {lead.phone}
                    </Button>
                  </a>
                  <div className="flex items-center gap-2">
                    <MessageMenu lead={lead} size="md" />
                    <div className="flex flex-1 flex-wrap gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => void setStatus(lead, "No Answer")}>
                        <RotateCcw className="h-3.5 w-3.5" /> No answer
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => void setStatus(lead, "In Talk")}>
                        <Check className="h-3.5 w-3.5" /> In talk
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void setStatus(lead, "Passed")}>
                        <X className="h-3.5 w-3.5" /> Pass
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
