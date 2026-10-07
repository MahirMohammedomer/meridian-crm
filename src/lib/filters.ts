import { db } from "./db";
import { normalizeText, toIntlPhone } from "./utils";
import type { Lead } from "./types";

export type Tri = "any" | "yes" | "no";

export interface LeadFilters {
  q: string;
  tiers: number[];
  statuses: string[];
  categories: string[];
  cities: string[];
  tags: string[];
  batchIds: string[];
  research: string[];
  website: Tri;
  hasPhone: Tri;
  hasSocial: Tri;
  pinned: Tri;
  archived: Tri;
  ratingMin: number;
  reviewsMin: number;
  scoreMin: number;
  scoreMax: number;
}

export type SortKey =
  | "business_name"
  | "lead_score"
  | "tier"
  | "rating"
  | "reviews_count"
  | "last_contacted_at"
  | "created_at"
  | "updated_at";

export interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

export const DEFAULT_FILTERS: LeadFilters = {
  q: "",
  tiers: [],
  statuses: [],
  categories: [],
  cities: [],
  tags: [],
  batchIds: [],
  research: [],
  website: "any",
  hasPhone: "any",
  hasSocial: "any",
  pinned: "any",
  archived: "no",
  ratingMin: 0,
  reviewsMin: 0,
  scoreMin: 0,
  scoreMax: 100,
};

export const DEFAULT_SORT: SortState = { key: "updated_at", dir: "desc" };

export const SORT_OPTIONS: { value: SortKey; label: string; dir: "asc" | "desc" }[] = [
  { value: "business_name", label: "Name A–Z", dir: "asc" },
  { value: "business_name", label: "Name Z–A", dir: "desc" },
  { value: "lead_score", label: "Score High–Low", dir: "desc" },
  { value: "lead_score", label: "Score Low–High", dir: "asc" },
  { value: "tier", label: "Tier 1 first", dir: "asc" },
  { value: "rating", label: "Rating High–Low", dir: "desc" },
  { value: "reviews_count", label: "Reviews High–Low", dir: "desc" },
  { value: "last_contacted_at", label: "Last Contacted", dir: "desc" },
  { value: "created_at", label: "Newest Added", dir: "desc" },
  { value: "created_at", label: "Oldest Added", dir: "asc" },
];

export function countActiveFilters(f: LeadFilters): number {
  let n = 0;
  if (f.q.trim()) n++;
  n += f.tiers.length ? 1 : 0;
  n += f.statuses.length ? 1 : 0;
  n += f.categories.length ? 1 : 0;
  n += f.cities.length ? 1 : 0;
  n += f.tags.length ? 1 : 0;
  n += f.batchIds.length ? 1 : 0;
  n += f.research.length ? 1 : 0;
  if (f.website !== "any") n++;
  if (f.hasPhone !== "any") n++;
  if (f.hasSocial !== "any") n++;
  if (f.pinned !== "any") n++;
  if (f.archived !== "no") n++;
  if (f.ratingMin > 0) n++;
  if (f.reviewsMin > 0) n++;
  if (f.scoreMin > 0 || f.scoreMax < 100) n++;
  return n;
}

export function hasAnySocial(l: Lead) {
  return Boolean(l.facebook_url || l.instagram_url || l.tiktok_url || l.telegram_url || l.telegram_username || l.linkedin_url);
}

/** Runs a search across leads (+ notes, contacts, tags) fully offline. */
export async function searchLeadIds(query: string): Promise<Set<string> | null> {
  const q = normalizeText(query);
  if (!q) return null;
  const ids = new Set<string>();

  const tokens = q.split(" ").filter(Boolean);
  const phoneDigits = q.replace(/[^\d]/g, "");

  const leads = await db.leads.filter((l) => !l.deleted_at).toArray();
  for (const l of leads) {
    const hay = normalizeText(
      [
        l.business_name,
        l.category,
        l.address,
        l.city,
        l.phone,
        l.email,
        l.website,
        l.why_scored,
        l.next_action,
        (l.tags || []).join(" "),
        Object.values(l.custom_fields || {}).join(" "),
      ].join(" "),
    );
    if (tokens.every((t) => hay.includes(t))) {
      ids.add(l.id);
      continue;
    }
    if (phoneDigits.length >= 4 && toIntlPhone(l.phone).includes(phoneDigits)) ids.add(l.id);
  }

  const [notes, contacts] = await Promise.all([
    db.lead_notes.filter((n) => normalizeText(n.content).includes(q)).toArray(),
    db.contacts.filter((c) => normalizeText(`${c.name} ${c.phone} ${c.email}`).includes(q)).toArray(),
  ]);
  notes.forEach((n) => ids.add(n.lead_id));
  contacts.forEach((c) => ids.add(c.lead_id));

  return ids;
}

export function applyFilters(leads: Lead[], f: LeadFilters, searchIds: Set<string> | null): Lead[] {
  const q = normalizeText(f.q);
  return leads.filter((l) => {
    if (l.deleted_at) return false;
    if (f.archived === "yes" && !l.is_archived) return false;
    if (f.archived === "no" && l.is_archived) return false;
    if (f.pinned === "yes" && !l.is_pinned) return false;
    if (f.pinned === "no" && l.is_pinned) return false;
    if (f.tiers.length && !f.tiers.includes(l.tier)) return false;
    if (f.statuses.length && !f.statuses.includes(l.status)) return false;
    if (f.categories.length && !f.categories.includes(l.category || "Uncategorized")) return false;
    if (f.cities.length && !f.cities.includes(l.city || "Unknown")) return false;
    if (f.research.length && !f.research.includes(l.research_status)) return false;
    if (f.tags.length && !f.tags.some((t) => (l.tags || []).includes(t))) return false;
    if (f.batchIds.length && !f.batchIds.includes(l.import_batch_id || "")) return false;
    if (f.website === "yes" && !(l.website_status === "has_website" && l.website)) return false;
    if (f.website === "no" && l.website_status === "has_website" && l.website) return false;
    if (f.hasPhone === "yes" && !l.phone) return false;
    if (f.hasPhone === "no" && l.phone) return false;
    if (f.hasSocial === "yes" && !hasAnySocial(l)) return false;
    if (f.hasSocial === "no" && hasAnySocial(l)) return false;
    if (f.ratingMin > 0 && (l.rating ?? 0) < f.ratingMin) return false;
    if (f.reviewsMin > 0 && (l.reviews_count ?? 0) < f.reviewsMin) return false;
    if ((l.lead_score ?? 0) < f.scoreMin || (l.lead_score ?? 0) > f.scoreMax) return false;
    if (q && searchIds && !searchIds.has(l.id)) return false;
    return true;
  });
}

export function sortLeads(leads: Lead[], sort: SortState): Lead[] {
  const dir = sort.dir === "asc" ? 1 : -1;
  const val = (l: Lead): any => {
    switch (sort.key) {
      case "business_name":
        return normalizeText(l.business_name);
      case "lead_score":
        return l.lead_score ?? 0;
      case "tier":
        return l.tier ?? 5;
      case "rating":
        return l.rating ?? 0;
      case "reviews_count":
        return l.reviews_count ?? 0;
      case "last_contacted_at":
        return l.last_contacted_at ? new Date(l.last_contacted_at).getTime() : 0;
      case "created_at":
        return new Date(l.created_at).getTime();
      default:
        return new Date(l.updated_at).getTime();
    }
  };
  return [...leads].sort((a, b) => {
    const av = val(a);
    const bv = val(b);
    if (av === bv) return normalizeText(a.business_name) < normalizeText(b.business_name) ? -1 : 1;
    return av > bv ? dir : -dir;
  });
}

export async function getFacetValues() {
  const [leads, batches, tags] = await Promise.all([
    db.leads.toArray(),
    db.import_batches.toArray(),
    db.tags.toArray(),
  ]);
  const categories = Array.from(new Set(leads.map((l) => l.category || "Uncategorized").filter(Boolean))).sort();
  const cities = Array.from(new Set(leads.map((l) => l.city || "Unknown").filter(Boolean))).sort();
  const tagSet = new Set<string>();
  leads.forEach((l) => (l.tags || []).forEach((t) => tagSet.add(t)));
  tags.forEach((t) => tagSet.add(t.name));
  return { categories, cities, tags: Array.from(tagSet).sort(), batches };
}
