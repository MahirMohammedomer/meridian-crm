# Meridian · Personal Agency OS

A private, **local-first** command center for a one-person web agency.

> FIND → IMPORT → PRIORITIZE → RESEARCH → CONTACT → FOLLOW-UP → WON → CLIENT → PROJECT → PAID → ANALYZE

## The one rule

**The local device database (Dexie / IndexedDB) is the primary runtime database.**
Supabase is only sync, cross-device access and backup. If the internet, Supabase, APIs
and cloud sync all disappear, Meridian keeps working — every feature, every screen.

```
UI → Dexie (IndexedDB) → UI instantly
Dexie → sync_queue (IndexedDB) → Sync Engine → Supabase (when online)
```

## Stack

React 19 · TypeScript · Vite · Tailwind v4 · Dexie · Supabase (Auth/Postgres/Storage) ·
dnd-kit · SheetJS + PapaParse · @tanstack/react-virtual · Recharts · vite PWA (custom SW)

## Getting started

```bash
npm install
cp .env.example .env      # optional — app works fully without it
npm run dev
npm run build             # → dist/index.html (single-file bundle)
npm run preview
```

### With cloud sync (optional)

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor — it creates every table, enables RLS with
   owner-only policies, and creates the private `agency-files` storage bucket.
3. Create **one** owner user in Authentication → Users (there is no public signup).
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (anon key only — **never** service_role).

Without those variables the app runs in *Local-only mode*: an on-device owner password
protects the workspace and everything is stored in IndexedDB.

## Features

| Module | What it does |
| --- | --- |
| **Dashboard** | Attention-needed counts, today's follow-ups, priority queue, tasks due, active projects, who owes money, continue-where-you-left-off |
| **Start Work** | Fullscreen focus mode: one lead at a time, big actions, keyboard-driven, auto-advance, end-of-session summary |
| **Leads** | Virtualized desktop table / mobile cards, 18 filters, sort, saved views, bulk actions, CSV/XLSX export |
| **Import** | CSV + XLSX, auto column mapping, live preview, duplicate detection (Maps URL → name+phone fuzzy), per-duplicate Skip/Update/Keep-both, batches |
| **Pipeline** | Kanban with drag & drop, per-column count and value |
| **Follow-ups** | Today / Overdue / Upcoming / All / Done, reschedule, call actions |
| **Clients** | Won leads with contacts, projects, payments, files |
| **Projects** | Stage stepper, manual progress slider + auto-calc from tasks, task kanban, files (Supabase Storage + local cache), notes, payments, activity |
| **Tasks** | Global list + kanban grouped by status or project, filters, drag & drop |
| **Calendar** | Month / Week / Day, colour-coded follow-ups, task deadlines, project deadlines, meetings |
| **Analytics** | Conversion funnel, tier & niche performance tables, revenue by month/niche, rating & review distributions, lost analysis |
| **Settings** | Theme, account, sync status, saved views, tags, backups, storage usage, danger zone |

## Offline behaviour

- Every write hits Dexie first and the UI updates instantly.
- Each mutation is appended to `sync_queue` (survives browser close).
- Auto sync on: startup, `online` event, window focus, 30s interval, 1s debounce after any local mutation.
- Notes and activities are **append/merge** — history is never overwritten.
- Scalar fields use last-write-wins by `updated_at`; if both sides changed while a local
  mutation was still pending, a **conflict record** is created and you choose the winner.
- Files: blobs cached in IndexedDB when uploaded or opened; uncached files honestly say
  "Needs internet to download — not cached".

## PWA

Real `manifest.webmanifest`, 192 / 512 / maskable-512 icons, service worker caching the
app shell only (never Supabase data — that lives in Dexie), offline navigation fallback,
and an in-app Install button driven by `beforeinstallprompt`.

## Keyboard

`⌘K` command palette · `⌘N` new lead · `←/→` prev/next lead · `Space` copy all info ·
`C/W/T` call / WhatsApp / Telegram · `G/M` Google / Maps · `1–9,0` set status · `Esc` close

## Security

RLS enabled on all 13 tables with `owner_id = auth.uid()` policies, private storage bucket
with owner policies, anon key only in the bundle. Local IndexedDB is not encrypted — fine
for personal use on a device you control; sign out when sharing it.
