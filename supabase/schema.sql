-- Pitch IQ Supabase foundation.
-- Run this in the Supabase SQL editor after creating the project.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  subscription_plan text not null default 'free' check (subscription_plan in ('free', 'pro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.planner_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  selection_id text not null,
  match_id text not null,
  match_title text not null,
  sport text not null check (sport in ('football', 'tennis')),
  commence_time timestamptz,
  competition text,
  market text not null,
  outcome text not null,
  odds numeric not null,
  status text not null default 'watching' check (status in ('watching', 'strong-interest', 'review-later', 'avoid')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, selection_id)
);

create table if not exists public.analysis_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  tag text not null,
  selections jsonb not null default '[]'::jsonb,
  selection_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  selection_id text,
  rule_type text not null default 'review',
  trigger_at timestamptz,
  enabled boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.planner_items enable row level security;
alter table public.analysis_sessions enable row level security;
alter table public.alert_rules enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "planner_items_all_own"
  on public.planner_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "analysis_sessions_all_own"
  on public.analysis_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "alert_rules_all_own"
  on public.alert_rules for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
