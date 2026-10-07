-- =============================================================
-- MERIDIAN · AGENCY OS — Supabase schema (cloud sync / backup)
-- Run this in the Supabase SQL editor.
--
-- PRINCIPLE: the browser writes to Dexie (IndexedDB) FIRST.
-- Postgres here is only the sync target and backup.
-- RLS is enabled on EVERY table with owner-only policies.
-- =============================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------
-- Every table shares these columns:
--   id uuid pk, created_at, updated_at, deleted_at (soft delete),
--   owner_id uuid (defaults to auth.uid()), version int
-- -------------------------------------------------------------

create table if not exists leads (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version int not null default 1,

  business_name text not null default '',
  category text not null default '',
  address text not null default '',
  city text not null default '',
  phone text not null default '',
  email text not null default '',
  website text,
  website_status text not null default 'no_website' check (website_status in ('has_website','no_website')),

  google_maps_url text not null default '',
  facebook_url text not null default '',
  instagram_url text not null default '',
  tiktok_url text not null default '',
  telegram_url text not null default '',
  telegram_username text not null default '',
  linkedin_url text not null default '',

  rating numeric(3,2),
  reviews_count int,

  lead_score int not null default 0 check (lead_score >= 0 and lead_score <= 100),
  tier int not null default 3 check (tier between 1 and 5),
  status text not null default 'New',
  potential_value numeric(14,2),
  tags text[] not null default '{}',
  custom_fields jsonb not null default '{}'::jsonb,
  why_scored text not null default '',
  next_action text not null default '',
  research_status text not null default 'Not Researched',

  last_contacted_at timestamptz,
  next_followup_at timestamptz,
  converted_at timestamptz,

  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  import_batch_id uuid,

  notes_count int not null default 0,
  activities_count int not null default 0,
  followups_count int not null default 0
);
create index if not exists leads_owner_updated_idx on leads (owner_id, updated_at);
create index if not exists leads_owner_name_idx on leads (owner_id, business_name);
create index if not exists leads_owner_status_idx on leads (owner_id, status);
create index if not exists leads_owner_tier_idx on leads (owner_id, tier);
create index if not exists leads_owner_phone_idx on leads (owner_id, phone);
create index if not exists leads_owner_maps_idx on leads (owner_id, google_maps_url);
create index if not exists leads_owner_batch_idx on leads (owner_id, import_batch_id);

create table if not exists import_batches (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version int not null default 1,
  name text not null,
  source text not null default 'import',
  file_name text not null default '',
  total_imported int not null default 0,
  duplicates_skipped int not null default 0
);
create index if not exists batches_owner_updated_idx on import_batches (owner_id, updated_at);

create table if not exists lead_activities (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version int not null default 1,
  lead_id uuid not null,
  type text not null default 'Note',
  content text not null default ''
);
create index if not exists activities_lead_idx on lead_activities (lead_id, created_at);
create index if not exists activities_owner_updated_idx on lead_activities (owner_id, updated_at);

create table if not exists lead_notes (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version int not null default 1,
  lead_id uuid not null,
  content text not null default ''
);
create index if not exists notes_lead_idx on lead_notes (lead_id, created_at);
create index if not exists notes_owner_updated_idx on lead_notes (owner_id, updated_at);

create table if not exists follow_ups (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version int not null default 1,
  lead_id uuid not null,
  title text not null default '',
  due_date timestamptz not null,
  status text not null default 'Pending',
  notes text not null default '',
  completed_at timestamptz
);
create index if not exists followups_lead_idx on follow_ups (lead_id, due_date);
create index if not exists followups_owner_updated_idx on follow_ups (owner_id, updated_at);

create table if not exists contacts (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version int not null default 1,
  lead_id uuid not null,
  name text not null default '',
  role text not null default 'Other',
  phone text not null default '',
  email text not null default '',
  is_primary boolean not null default false
);
create index if not exists contacts_lead_idx on contacts (lead_id);
create index if not exists contacts_owner_updated_idx on contacts (owner_id, updated_at);

create table if not exists projects (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version int not null default 1,
  client_lead_id uuid,
  name text not null,
  description text not null default '',
  stage text not null default 'Planning',
  progress int not null default 0 check (progress between 0 and 100),
  deadline timestamptz,
  value numeric(14,2) not null default 0,
  paid numeric(14,2) not null default 0,
  payment_status text not null default 'Unpaid'
);
create index if not exists projects_client_idx on projects (client_lead_id);
create index if not exists projects_owner_updated_idx on projects (owner_id, updated_at);

create table if not exists project_tasks (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version int not null default 1,
  project_id uuid not null,
  title text not null,
  description text not null default '',
  status text not null default 'To Do',
  priority text not null default 'Medium',
  due_date timestamptz,
  notes text not null default '',
  subtasks jsonb not null default '[]'::jsonb
);
create index if not exists tasks_project_idx on project_tasks (project_id, status);
create index if not exists tasks_owner_updated_idx on project_tasks (owner_id, updated_at);

create table if not exists project_notes (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version int not null default 1,
  project_id uuid not null,
  content text not null default ''
);
create index if not exists project_notes_project_idx on project_notes (project_id, created_at);

create table if not exists project_files_meta (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version int not null default 1,
  project_id uuid not null,
  file_name text not null,
  file_size bigint not null default 0,
  file_type text not null default '',
  storage_path text not null default '',
  is_cached_locally boolean not null default false,
  cached_at timestamptz
);
create index if not exists files_project_idx on project_files_meta (project_id);

create table if not exists payments (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version int not null default 1,
  project_id uuid,
  lead_id uuid,
  amount numeric(14,2) not null default 0,
  date timestamptz not null default now(),
  notes text not null default ''
);
create index if not exists payments_project_idx on payments (project_id);
create index if not exists payments_owner_updated_idx on payments (owner_id, updated_at);

create table if not exists tags (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version int not null default 1,
  name text not null,
  color text not null default '#6366f1'
);
create index if not exists tags_owner_updated_idx on tags (owner_id, updated_at);

create table if not exists saved_views (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version int not null default 1,
  name text not null,
  icon text,
  color text,
  pinned boolean not null default false,
  filters jsonb not null default '{}'::jsonb,
  sort jsonb not null default '{}'::jsonb
);
create index if not exists views_owner_updated_idx on saved_views (owner_id, updated_at);

-- =============================================================
-- ROW LEVEL SECURITY — authenticated owner only on every table
-- =============================================================

alter table leads               enable row level security;
alter table import_batches      enable row level security;
alter table lead_activities     enable row level security;
alter table lead_notes          enable row level security;
alter table follow_ups          enable row level security;
alter table contacts            enable row level security;
alter table projects            enable row level security;
alter table project_tasks       enable row level security;
alter table project_notes       enable row level security;
alter table project_files_meta  enable row level security;
alter table payments            enable row level security;
alter table tags                enable row level security;
alter table saved_views         enable row level security;

-- Owner-only policies (owner_id = auth.uid()). Unauthenticated access is denied.
do $$
declare t text;
begin
  foreach t in array array[
    'leads','import_batches','lead_activities','lead_notes','follow_ups','contacts','projects',
    'project_tasks','project_notes','project_files_meta','payments','tags','saved_views'
  ] loop
    execute format('drop policy if exists %I_owner_all on %I', t, t);
    execute format(
      'create policy %I_owner_all on %I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())',
      t, t
    );
  end loop;
end $$;

-- =============================================================
-- STORAGE — private bucket for project files (never base64 in Postgres)
-- =============================================================

insert into storage.buckets (id, name, public)
values ('agency-files', 'agency-files', false)
on conflict (id) do nothing;

drop policy if exists agency_files_owner_all on storage.objects;
create policy agency_files_owner_all on storage.objects
  for all to authenticated
  using (bucket_id = 'agency-files' and owner = auth.uid())
  with check (bucket_id = 'agency-files' and owner = auth.uid());

-- =============================================================
-- NOTES
--  - Conflicts are resolved client-side (last-write-wins by updated_at for
--    scalar fields; notes/activities are append-only and never overwritten).
--  - The frontend only ever uses the ANON key. Never expose service_role.
-- =============================================================
