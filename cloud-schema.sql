-- Run in the configured Supabase project, never in an unrelated database.
create table if not exists public.learning_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  envelope jsonb not null check (octet_length(envelope::text) <= 15000000),
  updated_at timestamptz not null default now()
);
alter table public.learning_snapshots enable row level security;
revoke all on public.learning_snapshots from anon;
grant select, insert, update, delete on public.learning_snapshots to authenticated;

-- Server-side age gate (docs/ACCOUNT_DESIGN.md §3). Not yet run against a real project.
-- Stores the decision only; the birth date is used inside attest_adult and never written.
create table if not exists public.account_eligibility (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null check (status in ('adult','denied')),
  method text not null check (method in ('self-declared-birthdate')),
  policy_version text not null check (length(policy_version) <= 20),
  decided_at timestamptz not null default now()
);
alter table public.account_eligibility enable row level security;
revoke all on public.account_eligibility from anon, authenticated;

create or replace function public.is_adult() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.account_eligibility where user_id = auth.uid() and status = 'adult');
$$;

create or replace function public.account_status() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select status from public.account_eligibility where user_id = auth.uid()), 'missing');
$$;

-- The latest calendar date anywhere (UTC-12) ensures nobody passes before their local 18th birthday.
-- age() treats 29 February birthdays as reaching 18 on 1 March in common years, matching the app.
create or replace function public.attest_adult(birthdate date, policy_version text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  latest_date date := ((now() at time zone 'UTC') - interval '12 hours')::date;
  result text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists(select 1 from public.account_eligibility where user_id = auth.uid()) then
    raise exception 'Eligibility already decided';
  end if;
  if birthdate is null or birthdate < date '1900-01-01' or birthdate > latest_date
     or policy_version is null or length(policy_version) > 20 then
    raise exception 'Invalid request';
  end if;
  result := case when extract(year from age(latest_date, birthdate)) >= 18 then 'adult' else 'denied' end;
  insert into public.account_eligibility(user_id, status, method, policy_version)
  values (auth.uid(), result, 'self-declared-birthdate', policy_version);
  return result;
end;
$$;
revoke all on function public.is_adult(), public.account_status(), public.attest_adult(date, text) from public, anon;
grant execute on function public.is_adult(), public.account_status(), public.attest_adult(date, text) to authenticated;

-- Snapshots are readable and writable only by their owner after the age gate passed.
drop policy if exists own_snapshot on public.learning_snapshots;
create policy own_snapshot on public.learning_snapshots for all to authenticated
using ((select auth.uid()) = user_id and (select public.is_adult()))
with check ((select auth.uid()) = user_id and (select public.is_adult()));

-- Explicit user-triggered account deletion. Snapshot cascades with the auth user.
create or replace function public.delete_own_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
