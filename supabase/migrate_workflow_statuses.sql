-- =============================================================
-- Meridian workflow statuses migration
-- Run once in Supabase → SQL Editor (as project owner).
--
-- Old CRM labels → real workflow:
--   Contacted, Follow-up     → No Answer
--   Replied, Interested,
--   Meeting, Proposal        → In Talk
--   Not Interested, Lost     → Passed
--
-- leads.status is unconstrained text — no schema alter required.
-- This only rewrites existing rows for your owner account(s).
-- =============================================================

update leads set status = 'No Answer', updated_at = now(), version = coalesce(version, 1) + 1
where deleted_at is null and status in ('Contacted', 'Follow-up');

update leads set status = 'In Talk', updated_at = now(), version = coalesce(version, 1) + 1
where deleted_at is null and status in ('Replied', 'Interested', 'Meeting', 'Proposal');

update leads set status = 'Passed', updated_at = now(), version = coalesce(version, 1) + 1
where deleted_at is null and status in ('Not Interested', 'Lost');

-- Optional: see counts after migration
-- select status, count(*) from leads where deleted_at is null group by status order by count(*) desc;
