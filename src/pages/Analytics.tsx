import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { TrendingUp, Users, Trophy, Wallet, Globe, ArrowDown, ChevronUp, ChevronDown } from "lucide-react";
import { db } from "@/lib/db";
import { Card, Progress, SectionTitle, Select } from "@/components/ui/ui";
import { PIPELINE_COLUMNS } from "@/lib/types";
import { TIER_META, cn, formatETB } from "@/lib/utils";

const TIER_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#0ea5e9", "#64748b"];
const BAR_COLOR = "#0f172a";

export function Analytics() {
  const leads = useLiveQuery(async () => db.leads.toArray(), [], []);
  const projects = useLiveQuery(async () => db.projects.toArray(), [], []);
  const payments = useLiveQuery(async () => db.payments.toArray(), [], []);
  const batches = useLiveQuery(async () => db.import_batches.toArray(), [], []);

  const [nicheSort, setNicheSort] = useState("leads");

  const s = useMemo(() => {
    const active = (leads || []).filter((l) => !l.deleted_at && !l.is_archived);

    const byStatus = PIPELINE_COLUMNS.map((st) => ({
      label: st,
      value: active.filter((l) => l.status === st).length,
      etb: active.filter((l) => l.status === st).reduce((a, l) => a + (l.potential_value || 0), 0),
    }));

    const byTier = [1, 2, 3, 4, 5].map((t, i) => ({
      name: `Tier ${t}`,
      value: active.filter((l) => l.tier === t).length,
      color: TIER_COLORS[i],
    }));

    const catMap = new Map<string, number>();
    active.forEach((l) => {
      const k = l.category || "Uncategorized";
      catMap.set(k, (catMap.get(k) || 0) + 1);
    });
    const byCategory = Array.from(catMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    const locMap = new Map<string, number>();
    active.forEach((l) => {
      const k = l.city || "Unknown";
      locMap.set(k, (locMap.get(k) || 0) + 1);
    });
    const byLocation = Array.from(locMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);

    const byBatch = (batches || [])
      .map((b) => ({
        label: b.name,
        date: b.created_at,
        imported: b.total_imported,
        dups: b.duplicates_skipped,
        count: active.filter((l) => l.import_batch_id === b.id).length,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const noWebsite = active.filter((l) => l.website_status !== "has_website" || !l.website).length;
    const websiteData = [
      { name: "No website", value: noWebsite, color: "#ef4444" },
      { name: "Has website", value: active.length - noWebsite, color: "#10b981" },
    ];

    const ratingBuckets = [
      { name: "4.5+", value: active.filter((l) => (l.rating || 0) >= 4.5).length },
      { name: "4–4.5", value: active.filter((l) => (l.rating || 0) >= 4 && (l.rating || 0) < 4.5).length },
      { name: "3.5–4", value: active.filter((l) => (l.rating || 0) >= 3.5 && (l.rating || 0) < 4).length },
      { name: "<3.5", value: active.filter((l) => (l.rating || 0) > 0 && (l.rating || 0) < 3.5).length },
      { name: "No rating", value: active.filter((l) => !l.rating).length },
    ];

    const reviewBuckets = [
      { name: "200+", value: active.filter((l) => (l.reviews_count || 0) >= 200).length },
      { name: "100–199", value: active.filter((l) => (l.reviews_count || 0) >= 100 && (l.reviews_count || 0) < 200).length },
      { name: "50–99", value: active.filter((l) => (l.reviews_count || 0) >= 50 && (l.reviews_count || 0) < 100).length },
      { name: "10–49", value: active.filter((l) => (l.reviews_count || 0) >= 10 && (l.reviews_count || 0) < 50).length },
      { name: "<10", value: active.filter((l) => (l.reviews_count || 0) < 10).length },
    ];

    // Funnel
    const count = (st: string) => active.filter((l) => l.status === st).length;
    const total = active.length;
    const contacted = count("Contacted") + count("Replied") + count("Interested") + count("Follow-up") + count("Meeting") + count("Proposal") + count("Won");
    const replied = count("Replied") + count("Interested") + count("Follow-up") + count("Meeting") + count("Proposal") + count("Won");
    const interested = count("Interested") + count("Follow-up") + count("Meeting") + count("Proposal") + count("Won");
    const meeting = count("Meeting") + count("Proposal") + count("Won");
    const proposal = count("Proposal") + count("Won");
    const won = count("Won");

    const funnel = [
      { label: "Total leads", value: total, pct: 100, of: "" },
      { label: "Contacted", value: contacted, pct: total ? (contacted / total) * 100 : 0, of: "of total" },
      { label: "Replied", value: replied, pct: contacted ? (replied / contacted) * 100 : 0, of: "of contacted" },
      { label: "Interested", value: interested, pct: replied ? (interested / replied) * 100 : 0, of: "of replied" },
      { label: "Meeting", value: meeting, pct: interested ? (meeting / interested) * 100 : 0, of: "of interested" },
      { label: "Proposal", value: proposal, pct: meeting ? (proposal / meeting) * 100 : 0, of: "of meeting" },
      { label: "Won", value: won, pct: proposal ? (won / proposal) * 100 : 0, of: "of proposal" },
    ];

    // Niche performance
    const nicheMap = new Map<string, { leads: number; clients: number; revenue: number; potential: number }>();
    active.forEach((l) => {
      const k = l.category || "Uncategorized";
      const cur = nicheMap.get(k) || { leads: 0, clients: 0, revenue: 0, potential: 0 };
      cur.leads += 1;
      cur.potential += l.potential_value || 0;
      if (l.status === "Won") {
        cur.clients += 1;
        cur.revenue += l.potential_value || 0;
      }
      nicheMap.set(k, cur);
    });
    const nicheRows = Array.from(nicheMap.entries())
      .map(([niche, v]) => ({
        niche,
        leads: v.leads,
        clients: v.clients,
        conversion: v.leads ? (v.clients / v.leads) * 100 : 0,
        revenue: v.revenue,
        avgValue: v.clients ? v.revenue / v.clients : 0,
        potential: v.potential,
      }))
      .sort((a, b) => {
        if (nicheSort === "conversion") return b.conversion - a.conversion;
        if (nicheSort === "revenue") return b.revenue - a.revenue;
        if (nicheSort === "clients") return b.clients - a.clients;
        return b.leads - a.leads;
      });

    const tierRows = [1, 2, 3, 4, 5].map((t) => {
      const inTier = active.filter((l) => l.tier === t);
      const clients = inTier.filter((l) => l.status === "Won").length;
      const revenue = inTier.filter((l) => l.status === "Won").reduce((a, l) => a + (l.potential_value || 0), 0);
      return {
        tier: t,
        leads: inTier.length,
        clients,
        conversion: inTier.length ? (clients / inTier.length) * 100 : 0,
        revenue,
      };
    });

    // Revenue
    const potential = active.reduce((a, l) => a + (l.potential_value || 0), 0);
    const wonValue = active.filter((l) => l.status === "Won").reduce((a, l) => a + (l.potential_value || 0), 0);
    const projectValue = (projects || []).reduce((a, p) => a + (p.value || 0), 0);
    const paid = (projects || []).reduce((a, p) => a + (p.paid || 0), 0);

    const monthMap = new Map<string, number>();
    (payments || []).forEach((p) => {
      const k = new Date(p.date).toLocaleDateString(undefined, { year: "numeric", month: "short" });
      monthMap.set(k, (monthMap.get(k) || 0) + p.amount);
    });
    const revenueByMonth = Array.from(monthMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => new Date(a.label).getTime() - new Date(b.label).getTime())
      .slice(-12);

    const revNicheMap = new Map<string, number>();
    (projects || []).forEach((p) => {
      const lead = active.find((l) => l.id === p.client_lead_id);
      const k = lead?.category || "Uncategorized";
      revNicheMap.set(k, (revNicheMap.get(k) || 0) + (p.paid || 0));
    });
    const revenueByNiche = Array.from(revNicheMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Lost analysis
    const lostLeads = active.filter((l) => l.status === "Lost" || l.status === "Not Interested");
    const lostByNicheMap = new Map<string, number>();
    lostLeads.forEach((l) => lostByNicheMap.set(l.category || "Uncategorized", (lostByNicheMap.get(l.category || "Uncategorized") || 0) + 1));
    const lostByNiche = Array.from(lostByNicheMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    const lostByTier = [1, 2, 3, 4, 5].map((t) => ({
      label: `T${t}`,
      value: lostLeads.filter((l) => l.tier === t).length,
    }));

    return {
      total,
      byStatus,
      byTier,
      byCategory: byCategory.slice(0, 10),
      byLocation,
      byBatch,
      websiteData,
      ratingBuckets,
      reviewBuckets,
      funnel,
      nicheRows,
      tierRows,
      potential,
      wonValue,
      projectValue,
      paid,
      outstanding: Math.max(0, projectValue - paid),
      revenueByMonth,
      revenueByNiche,
      lostCount: lostLeads.length,
      lostByNiche,
      lostByTier,
      conversionRate: total ? (won / total) * 100 : 0,
    };
  }, [leads, projects, payments, batches, nicheSort]);

  const dark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const axis = dark ? "#64748b" : "#94a3b8";

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-5 md:px-7 md:py-7">
      <div className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-white">Analytics</h1>
        <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
          Every number computed locally from Dexie — works offline
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Kpi icon={<Users className="h-4 w-4" />} label="Total leads" value={String(s.total)} />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Pipeline value" value={formatETB(s.potential)} />
        <Kpi icon={<Trophy className="h-4 w-4" />} label="Won value" value={formatETB(s.wonValue)} tone="emerald" />
        <Kpi icon={<Wallet className="h-4 w-4" />} label="Outstanding" value={formatETB(s.outstanding)} tone="amber" />
      </div>

      {/* Conversion funnel */}
      <Card className="mb-4 p-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Conversion funnel</SectionTitle>
          <span className="text-[12px] text-slate-400">Overall {s.conversionRate.toFixed(1)}% lead → client</span>
        </div>
        <div className="mt-3 space-y-1">
          {s.funnel.map((f, i) => (
            <div key={f.label}>
              <div className="flex items-center gap-3 rounded-lg px-1 py-1">
                <span className="w-[110px] shrink-0 text-[12.5px] text-slate-600 dark:text-slate-300">{f.label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                  <div
                    className="h-full rounded-full bg-slate-800 transition-all dark:bg-slate-200"
                    style={{ width: `${Math.max(1, (f.value / Math.max(1, s.total)) * 100)}%` }}
                  />
                </div>
                <span className="w-14 text-right text-[12.5px] font-semibold tabular-nums text-slate-900 dark:text-white">
                  {f.value}
                </span>
                <span className="w-24 text-right text-[11.5px] text-slate-400">
                  {f.pct.toFixed(1)}% {f.of}
                </span>
              </div>
              {i < s.funnel.length - 1 && (
                <div className="ml-[110px] pl-1 text-slate-300 dark:text-slate-600">
                  <ArrowDown className="h-3 w-3" />
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle>Leads by tier</SectionTitle>
          <div className="mt-2 flex items-center gap-4">
            <div className="h-[180px] w-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={s.byTier} dataKey="value" innerRadius={45} outerRadius={78} paddingAngle={2} stroke="none">
                    {s.byTier.map((t) => (
                      <Cell key={t.name} fill={t.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid rgba(148,163,184,.25)",
                      background: dark ? "#181b21" : "#fff",
                      color: dark ? "#fff" : "#0f172a",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5">
              {s.byTier.map((t, i) => (
                <div key={t.name} className="flex items-center gap-2 text-[12.5px]">
                  <span className="h-2 w-2 rounded-full" style={{ background: TIER_COLORS[i] }} />
                  <span className="flex-1 text-slate-600 dark:text-slate-300">{TIER_META[(i + 1) as 1].label}</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{t.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle>Leads by status</SectionTitle>
          <div className="mt-3 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.byStatus} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={dark ? "rgba(255,255,255,.06)" : "rgba(15,23,42,.06)"} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: axis }} interval={0} angle={-25} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10, fill: axis }} />
                <Tooltip
                  cursor={{ fill: dark ? "rgba(255,255,255,.04)" : "rgba(15,23,42,.04)" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid rgba(148,163,184,.25)",
                    background: dark ? "#181b21" : "#fff",
                    color: dark ? "#fff" : "#0f172a",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" fill={dark ? "#e2e8f0" : BAR_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle>Top niches</SectionTitle>
          <div className="mt-3 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.byCategory} layout="vertical" margin={{ top: 0, right: 12, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={dark ? "rgba(255,255,255,.06)" : "rgba(15,23,42,.06)"} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: axis }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: axis }} width={100} />
                <Tooltip
                  cursor={{ fill: dark ? "rgba(255,255,255,.04)" : "rgba(15,23,42,.04)" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid rgba(148,163,184,.25)",
                    background: dark ? "#181b21" : "#fff",
                    color: dark ? "#fff" : "#0f172a",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" fill={dark ? "#cbd5e1" : "#334155"} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle>Website presence</SectionTitle>
          <div className="mt-2 flex items-center gap-4">
            <div className="h-[180px] w-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={s.websiteData} dataKey="value" innerRadius={45} outerRadius={78} paddingAngle={2} stroke="none">
                    {s.websiteData.map((w) => (
                      <Cell key={w.name} fill={w.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid rgba(148,163,184,.25)",
                      background: dark ? "#181b21" : "#fff",
                      color: dark ? "#fff" : "#0f172a",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {s.websiteData.map((w) => (
                <div key={w.name} className="flex items-center gap-2 text-[12.5px]">
                  <span className="h-2 w-2 rounded-full" style={{ background: w.color }} />
                  <span className="flex-1 text-slate-600 dark:text-slate-300">{w.name}</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{w.value}</span>
                  <span className="text-[11px] text-slate-400">
                    {s.total ? ((w.value / s.total) * 100).toFixed(0) : 0}%
                  </span>
                </div>
              ))}
              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-[12px] text-slate-500 dark:bg-white/5 dark:text-slate-400">
                <Globe className="mr-1.5 inline h-3.5 w-3.5" />
                {s.websiteData[0].value} businesses without a website — that's your opportunity.
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Niche performance table */}
      <Card className="mb-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-white/5">
          <SectionTitle>Niche performance</SectionTitle>
          <Select
            className="w-[170px]"
            size="sm"
            value={nicheSort}
            onChange={setNicheSort}
            options={[
              { value: "leads", label: "Sort by leads" },
              { value: "clients", label: "Sort by clients" },
              { value: "conversion", label: "Sort by conversion" },
              { value: "revenue", label: "Sort by revenue" },
            ]}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-white/[0.04]">
                <th className="px-4 py-2 font-medium">Niche</th>
                <th className="px-3 py-2 text-right font-medium">Leads</th>
                <th className="px-3 py-2 text-right font-medium">Clients</th>
                <th className="px-3 py-2 text-right font-medium">Conversion</th>
                <th className="px-3 py-2 text-right font-medium">Revenue</th>
                <th className="px-3 py-2 text-right font-medium">Avg value</th>
                <th className="px-4 py-2 text-right font-medium">Potential</th>
              </tr>
            </thead>
            <tbody>
              {s.nicheRows.map((r) => (
                <tr key={r.niche} className="border-t border-slate-100 dark:border-white/5">
                  <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">{r.niche}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{r.leads}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{r.clients}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className={r.conversion >= 20 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-slate-300"}>
                      {r.conversion.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{formatETB(r.revenue)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{formatETB(r.avgValue)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-500">{formatETB(r.potential)}</td>
                </tr>
              ))}
              {s.nicheRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[13px] text-slate-400">
                    No data yet — import some leads.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-white/5">
            <SectionTitle>Tier performance · does your manual scoring work?</SectionTitle>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-white/[0.04]">
                <th className="px-4 py-2 font-medium">Tier</th>
                <th className="px-3 py-2 text-right font-medium">Leads</th>
                <th className="px-3 py-2 text-right font-medium">Clients</th>
                <th className="px-3 py-2 text-right font-medium">Conversion</th>
                <th className="px-4 py-2 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {s.tierRows.map((r, i) => (
                <tr key={r.tier} className="border-t border-slate-100 dark:border-white/5">
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: TIER_COLORS[i] }} />
                      <span className="font-medium text-slate-900 dark:text-white">Tier {r.tier}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{r.leads}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{r.clients}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">
                    {r.conversion.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{formatETB(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-4">
          <SectionTitle>Revenue by month</SectionTitle>
          {s.revenueByMonth.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-[13px] text-slate-400">
              No payments recorded yet
            </div>
          ) : (
            <div className="mt-3 h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s.revenueByMonth} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={dark ? "rgba(255,255,255,.06)" : "rgba(15,23,42,.06)"} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: axis }} />
                  <YAxis tick={{ fontSize: 10, fill: axis }} />
                  <Tooltip
                    cursor={{ fill: dark ? "rgba(255,255,255,.04)" : "rgba(15,23,42,.04)" }}
                    formatter={(v: any) => formatETB(Number(v))}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid rgba(148,163,184,.25)",
                      background: dark ? "#181b21" : "#fff",
                      color: dark ? "#fff" : "#0f172a",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <SectionTitle>Rating distribution</SectionTitle>
          <div className="mt-3 space-y-2">
            {s.ratingBuckets.map((b) => (
              <div key={b.name} className="flex items-center gap-2 text-[12.5px]">
                <span className="w-16 shrink-0 text-slate-500 dark:text-slate-400">{b.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                  <div
                    className="h-full rounded-full bg-amber-500"
                    style={{ width: `${(b.value / Math.max(1, s.total)) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right tabular-nums text-slate-700 dark:text-slate-200">{b.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle>Reviews distribution</SectionTitle>
          <div className="mt-3 space-y-2">
            {s.reviewBuckets.map((b) => (
              <div key={b.name} className="flex items-center gap-2 text-[12.5px]">
                <span className="w-16 shrink-0 text-slate-500 dark:text-slate-400">{b.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                  <div
                    className="h-full rounded-full bg-sky-500"
                    style={{ width: `${(b.value / Math.max(1, s.total)) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right tabular-nums text-slate-700 dark:text-slate-200">{b.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle>By location (top 8)</SectionTitle>
          <div className="mt-3 space-y-1.5">
            {s.byLocation.slice(0, 8).map((l) => (
              <div key={l.label} className="flex items-center gap-2 text-[12.5px]">
                <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">{l.label}</span>
                <span className="tabular-nums text-slate-900 dark:text-white">{l.value}</span>
              </div>
            ))}
            {s.byLocation.length === 0 && <div className="text-[13px] text-slate-400">No data</div>}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-white/5">
            <SectionTitle>By import batch</SectionTitle>
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-slate-50 dark:bg-[#14171d]">
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">Batch</th>
                  <th className="px-3 py-2 text-right font-medium">Leads</th>
                  <th className="px-3 py-2 text-right font-medium">Imported</th>
                  <th className="px-4 py-2 text-right font-medium">Dups</th>
                </tr>
              </thead>
              <tbody>
                {s.byBatch.map((b) => (
                  <tr key={b.label} className="border-t border-slate-100 dark:border-white/5">
                    <td className="max-w-[220px] truncate px-4 py-2 text-slate-700 dark:text-slate-200">{b.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{b.count}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{b.imported}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-400">{b.dups}</td>
                  </tr>
                ))}
                {s.byBatch.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-[13px] text-slate-400">
                      No batches yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <SectionTitle>Lost analysis</SectionTitle>
            <span className="text-[12px] text-slate-400">{s.lostCount} lost / not interested</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              {s.lostByNiche.map((n) => (
                <div key={n.label} className="flex items-center gap-2 text-[12.5px]">
                  <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">{n.label}</span>
                  <span className="tabular-nums text-slate-900 dark:text-white">{n.value}</span>
                </div>
              ))}
              {s.lostByNiche.length === 0 && <div className="text-[12.5px] text-slate-400">Nothing lost yet 🎉</div>}
            </div>
            <div className="space-y-1.5">
              {s.lostByTier.map((t, i) => (
                <div key={t.label} className="flex items-center gap-2 text-[12.5px]">
                  <span className="h-2 w-2 rounded-full" style={{ background: TIER_COLORS[i] }} />
                  <span className="flex-1 text-slate-600 dark:text-slate-300">{t.label}</span>
                  <span className="tabular-nums text-slate-900 dark:text-white">{t.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-white/5">
              <div className="text-[16px] font-semibold text-slate-900 dark:text-white">{formatETB(s.paid)}</div>
              <div className="text-[10.5px] uppercase text-slate-400">Collected</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-white/5">
              <div className="text-[16px] font-semibold text-amber-600 dark:text-amber-400">{formatETB(s.outstanding)}</div>
              <div className="text-[10.5px] uppercase text-slate-400">Outstanding</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
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
    <Card className="flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10.5px] uppercase tracking-wide text-slate-400">{label}</div>
        <div
          className={cn(
            "truncate text-[17px] font-semibold",
            tone === "emerald"
              ? "text-emerald-600 dark:text-emerald-400"
              : tone === "amber"
                ? "text-amber-600 dark:text-amber-400"
                : "text-slate-900 dark:text-white",
          )}
        >
          {value}
        </div>
      </div>
    </Card>
  );
}

export { Progress, ChevronUp, ChevronDown };
