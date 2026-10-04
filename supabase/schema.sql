-- Uncharted Waters cloud saves
-- Run this in Supabase Dashboard > SQL Editor

create table if not exists public.voyages (
  id text primary key,
  save jsonb not null default '{}'::jsonb,
  distance numeric not null default 0,
  treasures int not null default 0,
  lands int not null default 0,
  won boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Anonymous voyages: allow insert/select/update without login.
-- Tighten this later with auth + RLS policies per user.
alter table public.voyages enable row level security;

drop policy if exists "anon read voyages" on public.voyages;
create policy "anon read voyages"
  on public.voyages for select
  to anon
  using (true);

drop policy if exists "anon upsert voyages" on public.voyages;
create policy "anon upsert voyages"
  on public.voyages for insert
  to anon
  with check (true);

drop policy if exists "anon update voyages" on public.voyages;
create policy "anon update voyages"
  on public.voyages for update
  to anon
  using (true)
  with check (true);
