import type { Lead } from "./types";
import { getSetting, setSetting } from "./db";
import { copyText, nowISO } from "./utils";
import { leadsRepo } from "./repos";

export const WEBSITE_BRIEF_SETTING_KEY = "website_brief_template";

/** Placeholders available in the template. Use {{key}} syntax. */
export const BRIEF_PLACEHOLDERS: { key: string; label: string }[] = [
  { key: "business_name", label: "Business name" },
  { key: "category", label: "Category" },
  { key: "city", label: "City" },
  { key: "address", label: "Address" },
  { key: "location", label: "City + address" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "telegram", label: "Telegram @ or phone" },
  { key: "google_maps_url", label: "Google Maps URL" },
  { key: "website", label: "Existing website or none" },
  { key: "rating", label: "Rating" },
  { key: "reviews_count", label: "Review count" },
  { key: "rating_line", label: "Rating · N reviews" },
  { key: "facebook_url", label: "Facebook" },
  { key: "instagram_url", label: "Instagram" },
  { key: "tiktok_url", label: "TikTok" },
  { key: "linkedin_url", label: "LinkedIn" },
  { key: "notes", label: "CRM next action / why scored" },
  { key: "missing_fields", label: "List of empty critical fields" },
];

export const DEFAULT_WEBSITE_BRIEF_TEMPLATE = `You are a senior product designer + frontend engineer. Build ONE production-ready marketing website for a real Ethiopian business (not for an agency homepage).

## Business (facts from CRM — research Maps before designing)
- Business name: {{business_name}}
- Category / what they sell: {{category}}
- City / area: {{location}}
- Phone (WhatsApp-ready): {{phone}}
- Telegram: {{telegram}}
- Email: {{email}}
- Google Maps URL: {{google_maps_url}}
- Existing website: {{website}}
- Google rating: {{rating_line}}
- Facebook: {{facebook_url}}
- Instagram: {{instagram_url}}
- TikTok: {{tiktok_url}}
- LinkedIn: {{linkedin_url}}
- CRM notes: {{notes}}

Missing critical data (fill or research if listed): {{missing_fields}}

## Goal
- Make the business look professional and trustworthy
- Drive contact via Call, WhatsApp, and Telegram
- Full UI in English + Amharic (toggle, persist choice; default English)
- Embed Google Maps from the URL above; show written address in EN + Amharic

## Mandatory research before design
1. Open the Google Maps URL. Extract exact name, address, rating, review count, category, hours if shown.
2. Use REAL photos from the public web (Unsplash/Pexels/Wikimedia or similar) that fit this type of Ethiopian business. Do NOT use AI-generated images.
3. Write copy from facts, not generic filler.

## Site structure (single page)
1. Sticky header: name/logo, nav, EN | አማ toggle, Call + WhatsApp CTAs
2. Hero: strong local visual, clear headline, value line, Call / WhatsApp / Telegram, trust line (rating, location)
3. About / what they offer
4. Services or offerings (cards)
5. Location: map embed + address
6. Social proof from rating/reviews if available
7. FAQ (4–6 local questions)
8. Final CTA: Call / WhatsApp / Telegram
9. Footer: name, phone, Telegram, address

## Design rules
- Clean, calm, high contrast, mobile-first
- Avoid: purple glassmorphism everywhere, fake 3D, stock “laptop people”, excessive gradients, robot English
- Prefer: neutral palette, one accent, solid buttons, real hierarchy
- Subtle scroll motion only
- WhatsApp: https://wa.me/ with digits only from phone
- Telegram: https://t.me/username or phone-based link
- tel: links for call

## Tech
- Single page ready to deploy (HTML/CSS/JS or simple React/Vite)
- No backend; fast load; lazy images; accessible lang switching

## Output
- Complete production-ready code
- Short note: Maps facts used + image sources
`;

function val(s: string | null | undefined): string {
  const t = (s || "").trim();
  return t || "—";
}

export function leadToBriefVars(lead: Lead): Record<string, string> {
  const location = [lead.city, lead.address].filter((x) => (x || "").trim()).join(", ") || "—";
  const telegram =
    (lead.telegram_username || "").trim() ||
    (lead.telegram_url || "").trim() ||
    (lead.phone || "").trim() ||
    "—";
  const website =
    lead.website_status === "has_website" && lead.website
      ? lead.website
      : lead.website
        ? lead.website
        : "none";
  const rating = lead.rating != null ? String(lead.rating) : "—";
  const reviews = lead.reviews_count != null ? String(lead.reviews_count) : "—";
  const ratingLine =
    lead.rating != null
      ? `${lead.rating}${lead.reviews_count != null ? ` · ${lead.reviews_count} reviews` : ""}`
      : "—";

  const missing: string[] = [];
  if (!(lead.business_name || "").trim()) missing.push("business_name");
  if (!(lead.google_maps_url || "").trim()) missing.push("google_maps_url");
  if (!(lead.phone || "").trim()) missing.push("phone");
  if (!(lead.category || "").trim()) missing.push("category");
  if (!(lead.city || lead.address || "").trim()) missing.push("location");

  const notes = [lead.next_action, lead.why_scored].filter((x) => (x || "").trim()).join(" · ") || "—";

  return {
    business_name: val(lead.business_name),
    category: val(lead.category),
    city: val(lead.city),
    address: val(lead.address),
    location,
    phone: val(lead.phone),
    email: val(lead.email),
    telegram,
    google_maps_url: val(lead.google_maps_url),
    website,
    rating,
    reviews_count: reviews,
    rating_line: ratingLine,
    facebook_url: val(lead.facebook_url),
    instagram_url: val(lead.instagram_url),
    tiktok_url: val(lead.tiktok_url),
    linkedin_url: val(lead.linkedin_url),
    notes,
    missing_fields: missing.length ? missing.join(", ") : "none",
  };
}

export function fillWebsiteBrief(template: string, lead: Lead): string {
  const vars = leadToBriefVars(lead);
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key: string) => {
    const k = key.toLowerCase();
    return vars[k] != null ? vars[k] : `{{${key}}}`;
  });
}

export async function getWebsiteBriefTemplate(): Promise<string> {
  const stored = await getSetting<string>(WEBSITE_BRIEF_SETTING_KEY);
  if (stored && stored.trim()) return stored;
  return DEFAULT_WEBSITE_BRIEF_TEMPLATE;
}

export async function saveWebsiteBriefTemplate(template: string): Promise<void> {
  await setSetting(WEBSITE_BRIEF_SETTING_KEY, template);
}

export interface CopyBriefOptions {
  /** Set lead status to Prototype Ready after copy */
  markProposal?: boolean;
  /** Optional prototype URL to store on the lead */
  prototypeUrl?: string;
}

export interface CopyBriefResult {
  text: string;
  missing: string[];
}

/**
 * Build brief, copy to clipboard, stamp last_brief_copied_at on the lead,
 * optionally set Prototype Ready + prototype_url in custom_fields.
 */
export async function copyWebsiteBrief(lead: Lead, opts: CopyBriefOptions = {}): Promise<CopyBriefResult> {
  const template = await getWebsiteBriefTemplate();
  const text = fillWebsiteBrief(template, lead);
  const vars = leadToBriefVars(lead);
  const missing =
    vars.missing_fields === "none" ? [] : vars.missing_fields.split(", ").filter(Boolean);

  await copyText(text);

  const custom = { ...(lead.custom_fields || {}) };
  custom.last_brief_copied_at = nowISO();
  if (opts.prototypeUrl?.trim()) {
    custom.prototype_url = opts.prototypeUrl.trim();
  }

  const patch: Partial<Lead> = {
    custom_fields: custom,
  };
  if (opts.markProposal && lead.status !== "Won" && lead.status !== "Passed" && lead.status !== "Lost") {
    patch.status = "Prototype Ready";
  }

  await leadsRepo.update(lead.id, patch);

  return { text, missing };
}
