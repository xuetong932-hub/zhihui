-- Run in the configured Supabase project, never in an unrelated database.
-- Status: written against Supabase documentation; NOT yet run on a real project (see docs/ACCOUNT_DESIGN.md).
create table if not exists public.learning_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  envelope jsonb not null check (octet_length(envelope::text) <= 15000000),
  updated_at timestamptz not null default now()
);
alter table public.learning_snapshots enable row level security;
revoke all on public.learning_snapshots from anon;
grant select, insert, update, delete on public.learning_snapshots to authenticated;

-- Server-side age gate. Stores the decision only; the birthday is used inside complete_registration and never written.
create table if not exists public.account_eligibility (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null check (status in ('adult','denied')),
  method text not null check (method in ('self-declared-birthdate')),
  policy_version text not null check (length(policy_version) <= 20),
  decided_at timestamptz not null default now()
);
alter table public.account_eligibility enable row level security;
revoke all on public.account_eligibility from anon, authenticated;

-- Registration details. Email and phone here are the contacts the user typed; the verified sign-in
-- email or phone lives in auth.users. Written only through complete_registration.
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[^[:space:][:cntrl:]@<>"''`/\\]{2,20}$'),
  email text check (email is null or (length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  region text not null check (region in ('CN','HK','MO','TW','SG','MY','US','GB','CA','AU','JP','KR','OTHER')),
  created_at timestamptz not null default now()
);
create unique index if not exists user_profiles_username_key on public.user_profiles (lower(username));
alter table public.user_profiles enable row level security;
revoke all on public.user_profiles from anon, authenticated;

-- Administrators are granted only here, by the project operator, e.g.:
--   insert into public.admins(user_id) select id from auth.users where email = 'admin@example.com';
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_adult() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.account_eligibility where user_id = auth.uid() and status = 'adult');
$$;

create or replace function public.my_account() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'status', coalesce((select status from public.account_eligibility where user_id = auth.uid()), 'missing'),
    'registered', exists(select 1 from public.user_profiles where user_id = auth.uid()),
    'username', (select username from public.user_profiles where user_id = auth.uid()),
    'region', (select region from public.user_profiles where user_id = auth.uid()),
    'is_admin', exists(select 1 from public.admins where user_id = auth.uid()));
$$;

-- One-time registration with the adult check. The latest calendar date anywhere (UTC-12) ensures nobody
-- passes before their local 18th birthday; age() treats 29 February birthdays as reaching 18 on 1 March in
-- common years, matching the app. An under-18 result is recorded so the account cannot retry another date.
create or replace function public.complete_registration(username text, email text, phone text, region text, birthdate date, policy_version text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  latest_date date := ((now() at time zone 'UTC') - interval '12 hours')::date;
  decided text;
  result text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select status into decided from public.account_eligibility where user_id = auth.uid();
  if decided = 'denied' then raise exception 'denied'; end if;
  if exists(select 1 from public.user_profiles where user_id = auth.uid()) then raise exception 'already_registered'; end if;
  if birthdate is null or birthdate < date '1900-01-01' or birthdate > latest_date
     or policy_version is null or length(policy_version) > 20 then
    raise exception 'invalid_registration';
  end if;
  result := case when extract(year from age(latest_date, birthdate)) >= 18 then 'adult' else 'denied' end;
  if decided is null then
    insert into public.account_eligibility(user_id, status, method, policy_version)
    values (auth.uid(), result, 'self-declared-birthdate', policy_version);
  end if;
  if result = 'denied' then return 'denied'; end if;
  begin
    insert into public.user_profiles(user_id, username, email, phone, region)
    values (auth.uid(), username, nullif(email, ''), nullif(phone, ''), region);
  exception
    when unique_violation then raise exception 'username_taken';
    when check_violation then raise exception 'invalid_registration';
  end;
  return 'adult';
end;
$$;

-- Admin user list with partially hidden contacts. Birthdays are never stored, so they cannot be listed.
create or replace function public.admin_list_users(search text, max_rows int)
returns table(username text, region text, email text, phone text, registered_at timestamptz, last_sign_in_at timestamptz, eligibility text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.admins where user_id = auth.uid()) then raise exception 'not_admin'; end if;
  return query
  select p.username, p.region,
    (select case when v is null then null else left(split_part(v, '@', 1), 2) || '***@' || split_part(v, '@', 2) end
       from (select coalesce(nullif(u.email, ''), p.email) as v) e),
    (select case when v is null then null when length(v) > 7 then left(v, 3) || '***' || right(v, 4) else '***' end
       from (select coalesce(p.phone, case when coalesce(u.phone, '') <> '' then '+' || u.phone end) as v) t),
    p.created_at, u.last_sign_in_at, coalesce(a.status, 'missing')
  from public.user_profiles p
  join auth.users u on u.id = p.user_id
  left join public.account_eligibility a on a.user_id = p.user_id
  where coalesce(search, '') = '' or p.username ilike '%' || replace(replace(search, '%', '\%'), '_', '\_') || '%'
  order by p.created_at desc
  limit least(greatest(coalesce(max_rows, 200), 1), 500);
end;
$$;

revoke all on function public.is_adult(), public.my_account(), public.complete_registration(text, text, text, text, date, text), public.admin_list_users(text, int) from public, anon;
grant execute on function public.is_adult(), public.my_account(), public.complete_registration(text, text, text, text, date, text), public.admin_list_users(text, int) to authenticated;

-- Snapshots are readable and writable only by their owner after the age gate passed.
drop policy if exists own_snapshot on public.learning_snapshots;
create policy own_snapshot on public.learning_snapshots for all to authenticated
using ((select auth.uid()) = user_id and (select public.is_adult()))
with check ((select auth.uid()) = user_id and (select public.is_adult()));

-- Explicit user-triggered account deletion. Snapshot, profile, eligibility and admin rows cascade with the auth user.
create or replace function public.delete_own_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
