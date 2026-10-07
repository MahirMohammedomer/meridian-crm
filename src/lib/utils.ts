import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Lead, Tier } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function nowISO() {
  return new Date().toISOString();
}

/* ---------------- phone / link helpers ---------------- */

export function cleanPhone(phone?: string | null): string {
  if (!phone) return "";
  return phone.replace(/[^\d]/g, "");
}

/** Ethiopian aware: 0912345678 -> 251912345678 */
export function toIntlPhone(phone?: string | null): string {
  const digits = cleanPhone(phone);
  if (!digits) return "";
  if (digits.startsWith("251")) return digits;
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return "251" + digits.slice(1);
  return digits;
}

export function telHref(phone?: string | null): string {
  return `tel:+${toIntlPhone(phone)}`;
}

export function waHref(phone?: string | null): string {
  const p = toIntlPhone(phone);
  return p ? `https://wa.me/${p}` : "";
}

export type TelegramResolution =
  | { kind: "none" }
  | { kind: "username"; url: string }
  | { kind: "url"; url: string }
  | { kind: "phone"; tgUrl: string; webUrl: string; phone: string };

export function resolveTelegram(lead: Partial<Lead>): TelegramResolution {
  const username = (lead.telegram_username || "").trim();
  if (username) {
    let handle = username;
    if (/^https?:\/\/(www\.)?t\.me\//i.test(handle)) handle = handle.replace(/^https?:\/\/(www\.)?t\.me\//i, "");
    handle = handle.replace(/^@/, "").replace(/^\+/, "").split(/[/?#]/)[0];
    if (handle) return { kind: "username", url: `https://t.me/${handle}` };
  }
  const rawUrl = (lead.telegram_url || "").trim();
  if (rawUrl) {
    if (/^https?:\/\/(www\.)?t\.me\//i.test(rawUrl)) {
      const handle = rawUrl.replace(/^https?:\/\/(www\.)?t\.me\//i, "").replace(/^\+/, "").split(/[/?#]/)[0];
      if (handle) return { kind: "username", url: `https://t.me/${handle}` };
    }
    return { kind: "url", url: rawUrl };
  }
  const phone = (lead.phone || "").trim();
  if (phone) {
    const intl = toIntlPhone(phone);
    return {
      kind: "phone",
      tgUrl: `tg://resolve?phone=%2B${intl}`,
      webUrl: `https://t.me/+${intl}`,
      phone: `+${intl}`,
    };
  }
  return { kind: "none" };
}

export function googleSearchUrl(lead: Partial<Lead>) {
  const q = [lead.business_name, lead.city || lead.address || "Ethiopia"].filter(Boolean).join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

export function googleImagesUrl(lead: Partial<Lead>) {
  return `${googleSearchUrl(lead)}&tbm=isch`;
}

export function safeUrl(url?: string | null): string | null {
  if (!url) return null;
  const t = url.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(t)) return `https://${t}`;
  return null;
}

export function normalizeMapsUrl(url?: string | null): string {
  return (url || "").trim().toLowerCase();
}

export function normalizeText(v?: string | null): string {
  return (v || "").toLowerCase().trim().replace(/\s+/g, " ");
}

export function similarity(a: string, b: string): number {
  const s1 = normalizeText(a);
  const s2 = normalizeText(b);
  if (!s1 && !s2) return 1;
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  const longer = s1.length > s2.length ? s1 : s2;
  if (longer.length === 0) return 1;
  // Levenshtein
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) costs[j] = j;
      else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(newValue, lastValue, costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  const dist = costs[s2.length];
  return 1 - dist / longer.length;
}

/* ---------------- formatting ---------------- */

export function formatETB(n?: number | null) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US").format(Math.round(n)) + " ETB";
}

export function timeAgo(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.round(day / 7);
  if (wk < 5) return `${wk}w ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(day / 365)}y ago`;
}

export function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function dueLabel(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(d) - startOf(today)) / 86400000);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (diffDays === 0) return `Today ${time}`;
  if (diffDays === 1) return `Tomorrow ${time}`;
  if (diffDays === -1) return `Yesterday ${time}`;
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays < 7) return `In ${diffDays}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function toLocalInputValue(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ---------------- tier / status styling ---------------- */

export const TIER_META: Record<Tier, { label: string; short: string; className: string; dot: string }> = {
  1: {
    label: "Tier 1 · Highest",
    short: "T1",
    className: "bg-red-500/12 text-red-600 dark:text-red-400 ring-red-500/25",
    dot: "bg-red-500",
  },
  2: {
    label: "Tier 2 · Very High",
    short: "T2",
    className: "bg-orange-500/12 text-orange-600 dark:text-orange-400 ring-orange-500/25",
    dot: "bg-orange-500",
  },
  3: {
    label: "Tier 3 · Medium",
    short: "T3",
    className: "bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-amber-500/25",
    dot: "bg-amber-500",
  },
  4: {
    label: "Tier 4 · Low",
    short: "T4",
    className: "bg-sky-500/12 text-sky-600 dark:text-sky-400 ring-sky-500/25",
    dot: "bg-sky-500",
  },
  5: {
    label: "Tier 5 · Lowest",
    short: "T5",
    className: "bg-slate-500/12 text-slate-600 dark:text-slate-400 ring-slate-500/25",
    dot: "bg-slate-500",
  },
};

export const STATUS_STYLES: Record<string, string> = {
  New: "bg-slate-500/12 text-slate-600 dark:text-slate-300 ring-slate-500/25",
  Contacted: "bg-blue-500/12 text-blue-600 dark:text-blue-400 ring-blue-500/25",
  Replied: "bg-cyan-500/12 text-cyan-600 dark:text-cyan-400 ring-cyan-500/25",
  Interested: "bg-violet-500/12 text-violet-600 dark:text-violet-400 ring-violet-500/25",
  "Not Interested": "bg-rose-500/12 text-rose-600 dark:text-rose-400 ring-rose-500/25",
  "Follow-up": "bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-amber-500/25",
  Meeting: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-400 ring-indigo-500/25",
  Proposal: "bg-purple-500/12 text-purple-600 dark:text-purple-400 ring-purple-500/25",
  Won: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25",
  Lost: "bg-red-500/12 text-red-600 dark:text-red-400 ring-red-500/25",
};

export const STAGE_STYLES: Record<string, string> = {
  Planning: "bg-slate-500/12 text-slate-600 dark:text-slate-300",
  Design: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
  Development: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
  Content: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  Testing: "bg-cyan-500/12 text-cyan-600 dark:text-cyan-400",
  Launch: "bg-orange-500/12 text-orange-600 dark:text-orange-400",
  Completed: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
};

/* ---------------- copy all info ---------------- */

export function copyAllInfo(lead: Lead, extras?: { notes?: string }): string {
  const lines: string[] = [];
  lines.push(lead.business_name || "(unnamed)");
  if (lead.category) lines.push(`Category: ${lead.category}`);
  const loc = [lead.address, lead.city].filter(Boolean).join(", ");
  if (loc) lines.push(`Location: ${loc}`);
  if (lead.phone) lines.push(`Phone: ${lead.phone}`);
  if (lead.email) lines.push(`Email: ${lead.email}`);
  lines.push(`Website: ${lead.website_status === "has_website" && lead.website ? lead.website : "None"}`);
  if (lead.rating !== null && lead.rating !== undefined)
    lines.push(`Rating: ${lead.rating}${lead.reviews_count ? ` (${lead.reviews_count} reviews)` : ""}`);
  else if (lead.reviews_count) lines.push(`Reviews: ${lead.reviews_count}`);
  if (lead.google_maps_url) lines.push(`Google Maps: ${lead.google_maps_url}`);
  if (lead.facebook_url) lines.push(`Facebook: ${lead.facebook_url}`);
  if (lead.instagram_url) lines.push(`Instagram: ${lead.instagram_url}`);
  if (lead.tiktok_url) lines.push(`TikTok: ${lead.tiktok_url}`);
  if (lead.telegram_username) lines.push(`Telegram: ${lead.telegram_username}`);
  else if (lead.telegram_url) lines.push(`Telegram: ${lead.telegram_url}`);
  if (lead.linkedin_url) lines.push(`LinkedIn: ${lead.linkedin_url}`);
  lines.push(`Lead Score: ${lead.lead_score ?? 0}`);
  lines.push(`Tier: ${lead.tier ?? ""}`);
  lines.push(`Status: ${lead.status}`);
  if (lead.potential_value) lines.push(`Potential Value: ${formatETB(lead.potential_value)}`);
  if (lead.next_action) lines.push(`Next Action: ${lead.next_action}`);
  if (lead.why_scored) lines.push(`Why Scored: ${lead.why_scored}`);
  lines.push(`Research: ${lead.research_status}`);
  if (lead.tags?.length) lines.push(`Tags: ${lead.tags.join(", ")}`);
  if (lead.custom_fields && Object.keys(lead.custom_fields).length) {
    for (const [k, v] of Object.entries(lead.custom_fields)) lines.push(`${k}: ${v}`);
  }
  if (extras?.notes) lines.push(`Notes: ${extras.notes}`);
  lines.push(`Last Contacted: ${lead.last_contacted_at ? timeAgo(lead.last_contacted_at) : "Never"}`);
  lines.push(`Next Follow-up: ${lead.next_followup_at ? dueLabel(lead.next_followup_at) : "None"}`);
  return lines.join("\n");
}

export function copyContactInfo(lead: Lead) {
  return [lead.business_name, lead.phone, [lead.address, lead.city].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join("\n");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function titleCase(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
