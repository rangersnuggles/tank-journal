-- ─────────────────────────────────────────
-- Tank Journal — Supabase Schema
-- Run this in your Supabase SQL editor
-- ─────────────────────────────────────────

create table inhabitants (
  id          bigint generated always as identity primary key,
  name        text not null,
  count       integer,
  date_added  date not null default current_date,
  notes       text,
  created_at  timestamptz not null default now()
);

create table entries (
  id          bigint generated always as identity primary key,
  type        text not null check (type in ('parameters','changes','observations','medical')),
  date        date not null,
  time        text not null,
  data        jsonb not null default '{}',
  note        text,
  created_at  timestamptz not null default now()
);

-- Index for fast chronological listing
create index entries_date_idx on entries (date desc, created_at desc);

-- Enable Row Level Security (keeps data private by default)
alter table inhabitants enable row level security;
alter table entries     enable row level security;

-- Simple open policies — fine for a personal app.
-- Swap these for auth-based policies if you ever add login.
create policy "allow all" on inhabitants for all using (true) with check (true);
create policy "allow all" on entries     for all using (true) with check (true);
