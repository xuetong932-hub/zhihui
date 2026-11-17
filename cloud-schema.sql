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

-- Administrators are created by the operator (with a password, no registration form) and count as eligible.
create or replace function public.is_adult() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.account_eligibility where user_id = auth.uid() and status = 'adult')
      or exists(select 1 from public.admins where user_id = auth.uid());
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

-- 知回 free allowance (server key, env ZHIPU_API_KEY): use per account per day, China time.
-- The limits live here so a client cannot change them; the table is reachable only through free_quota().
create table if not exists public.free_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  ask_used int not null default 0 check (ask_used >= 0),
  grade_used int not null default 0 check (grade_used >= 0),
  photo_used int not null default 0 check (photo_used >= 0),
  primary key (user_id, day)
);
-- Added with photo questions; safe to run again on a table created before.
alter table public.free_usage add column if not exists photo_used int not null default 0 check (photo_used >= 0);
-- Added with the learning square's translate button.
alter table public.free_usage add column if not exists translate_used int not null default 0 check (translate_used >= 0);
alter table public.free_usage enable row level security;
revoke all on public.free_usage from public, anon, authenticated;

-- action: 'status' | 'consume' | 'refund'; kind: 'ask' (questions, 20 a day) | 'grade' (review grading, 30 a day)
-- | 'photo' (photo-question text recognition, 20 a day) | 'translate' (learning square translations, 50 a day).
create or replace function public.free_quota(action text, kind text default 'ask') returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Asia/Shanghai')::date;
  ask_limit constant int := 20;
  grade_limit constant int := 30;
  photo_limit constant int := 20;
  translate_limit constant int := 50;
  used public.free_usage;
  ok boolean := true;
begin
  if uid is null or not public.is_adult() then raise exception 'not eligible' using errcode = '42501'; end if;
  if action not in ('status', 'consume', 'refund') or kind not in ('ask', 'grade', 'photo', 'translate') then raise exception 'invalid request' using errcode = '22023'; end if;
  insert into public.free_usage(user_id, day) values (uid, today) on conflict do nothing;
  select * into used from public.free_usage where user_id = uid and day = today for update;
  if action = 'consume' then
    ok := case kind when 'ask' then used.ask_used < ask_limit when 'grade' then used.grade_used < grade_limit when 'photo' then used.photo_used < photo_limit else used.translate_used < translate_limit end;
    if ok then update public.free_usage set ask_used = ask_used + (kind = 'ask')::int, grade_used = grade_used + (kind = 'grade')::int, photo_used = photo_used + (kind = 'photo')::int, translate_used = translate_used + (kind = 'translate')::int where user_id = uid and day = today returning * into used; end if;
  elsif action = 'refund' then
    update public.free_usage set ask_used = greatest(0, ask_used - (kind = 'ask')::int), grade_used = greatest(0, grade_used - (kind = 'grade')::int), photo_used = greatest(0, photo_used - (kind = 'photo')::int), translate_used = greatest(0, translate_used - (kind = 'translate')::int) where user_id = uid and day = today returning * into used;
  end if;
  return jsonb_build_object('allowed', ok, 'ask_used', used.ask_used, 'ask_limit', ask_limit, 'grade_used', used.grade_used, 'grade_limit', grade_limit, 'photo_used', used.photo_used, 'photo_limit', photo_limit, 'translate_used', used.translate_used, 'translate_limit', translate_limit);
end $$;
revoke all on function public.free_quota(text, text) from public, anon;
grant execute on function public.free_quota(text, text) to authenticated;

-- 学习广场 (learning square): public posts, comments, likes and reports. The tables are reachable only through the
-- functions below, which check sign-in, the age gate and registration, length, rate limits and ownership.
-- Anyone (also without an account) may read; posting, commenting, liking and reporting need a registered adult account.
create table if not exists public.square_posts (
  id uuid primary key default gen_random_uuid(),
  author uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 1000),
  lang text not null check (lang in ('zh','zh-TW','en','ja','ko','ms','es','fr','pt','de')),
  module text check (module is null or module in ('coding','english','work','life')),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists square_posts_created_idx on public.square_posts (created_at desc);
create index if not exists square_posts_author_idx on public.square_posts (author, created_at desc);
create table if not exists public.square_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.square_posts(id) on delete cascade,
  author uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 500),
  lang text not null check (lang in ('zh','zh-TW','en','ja','ko','ms','es','fr','pt','de')),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists square_comments_post_idx on public.square_comments (post_id, created_at);
create index if not exists square_comments_author_idx on public.square_comments (author, created_at desc);
create table if not exists public.square_likes (
  post_id uuid not null references public.square_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
-- One report per person per item; three different reporters hide the item until an administrator decides.
create table if not exists public.square_reports (
  kind text not null check (kind in ('post','comment')),
  target uuid not null,
  reporter uuid not null references auth.users(id) on delete cascade,
  reason text not null default '' check (length(reason) <= 200),
  created_at timestamptz not null default now(),
  primary key (kind, target, reporter)
);
create index if not exists square_reports_reporter_idx on public.square_reports (reporter, created_at desc);
alter table public.square_posts enable row level security;
alter table public.square_comments enable row level security;
alter table public.square_likes enable row level security;
alter table public.square_reports enable row level security;
revoke all on public.square_posts, public.square_comments, public.square_likes, public.square_reports from public, anon, authenticated;

-- May write in the square: registered adults, and administrators (operator-created, shown as 知回).
create or replace function public.square_can_write() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    exists(select 1 from public.admins where user_id = auth.uid())
    or (public.is_adult() and exists(select 1 from public.user_profiles where user_id = auth.uid())));
$$;
create or replace function public.square_name(uid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select username from public.user_profiles where user_id = uid), '知回');
$$;
create or replace function public.square_post_json(p public.square_posts) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'body', p.body, 'lang', p.lang, 'module', p.module, 'created_at', p.created_at,
    'author_name', public.square_name(p.author),
    'like_count', (select count(*) from public.square_likes l where l.post_id = p.id),
    'comment_count', (select count(*) from public.square_comments c where c.post_id = p.id and not c.hidden),
    'liked', auth.uid() is not null and exists(select 1 from public.square_likes l where l.post_id = p.id and l.user_id = auth.uid()),
    'mine', coalesce(p.author = auth.uid(), false),
    'can_delete', coalesce(p.author = auth.uid(), false) or exists(select 1 from public.admins where user_id = auth.uid()));
$$;
create or replace function public.square_comment_json(c public.square_comments) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'post_id', c.post_id, 'body', c.body, 'lang', c.lang, 'created_at', c.created_at,
    'author_name', public.square_name(c.author), 'mine', coalesce(c.author = auth.uid(), false),
    'can_delete', coalesce(c.author = auth.uid(), false) or exists(select 1 from public.admins where user_id = auth.uid()));
$$;

-- Newest visible posts, up to 20 at a time; before_at: created_at of the last post already shown.
create or replace function public.square_feed(before_at timestamptz default null, max_rows int default 20) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public.square_post_json(p) order by p.created_at desc), '[]'::jsonb)
  from (select * from public.square_posts where not hidden and (square_feed.before_at is null or created_at < square_feed.before_at)
        order by created_at desc limit least(greatest(coalesce(max_rows, 20), 1), 50)) p;
$$;
create or replace function public.square_comments(post uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public.square_comment_json(c) order by c.created_at), '[]'::jsonb)
  from (select * from public.square_comments where post_id = square_comments.post and not hidden order by created_at limit 200) c;
$$;

create or replace function public.square_post(body text, lang text, module text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare created public.square_posts;
begin
  if not public.square_can_write() then raise exception 'not_eligible'; end if;
  if (select count(*) from public.square_posts p where p.author = auth.uid() and p.created_at > now() - interval '1 hour') >= 10 then raise exception 'rate_limited'; end if;
  begin
    insert into public.square_posts(author, body, lang, module) values (auth.uid(), btrim(square_post.body), square_post.lang, nullif(square_post.module, '')) returning * into created;
  exception when check_violation or not_null_violation then raise exception 'invalid_square';
  end;
  return public.square_post_json(created);
end $$;
create or replace function public.square_comment(post uuid, body text, lang text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare created public.square_comments;
begin
  if not public.square_can_write() then raise exception 'not_eligible'; end if;
  if not exists(select 1 from public.square_posts p where p.id = square_comment.post and not p.hidden) then raise exception 'not_found'; end if;
  if (select count(*) from public.square_comments c where c.author = auth.uid() and c.created_at > now() - interval '1 hour') >= 60 then raise exception 'rate_limited'; end if;
  begin
    insert into public.square_comments(post_id, author, body, lang) values (square_comment.post, auth.uid(), btrim(square_comment.body), square_comment.lang) returning * into created;
  exception when check_violation or not_null_violation then raise exception 'invalid_square';
  end;
  return public.square_comment_json(created);
end $$;
create or replace function public.square_like(post uuid, liked boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.square_can_write() then raise exception 'not_eligible'; end if;
  if not exists(select 1 from public.square_posts p where p.id = square_like.post and not p.hidden) then raise exception 'not_found'; end if;
  if square_like.liked then insert into public.square_likes(post_id, user_id) values (square_like.post, auth.uid()) on conflict do nothing;
  else delete from public.square_likes l where l.post_id = square_like.post and l.user_id = auth.uid(); end if;
  return jsonb_build_object('liked', square_like.liked, 'like_count', (select count(*) from public.square_likes l where l.post_id = square_like.post));
end $$;
-- Authors delete their own posts and comments; administrators may delete any.
create or replace function public.square_delete(kind text, target uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare is_admin boolean := exists(select 1 from public.admins where user_id = auth.uid());
begin
  if auth.uid() is null then raise exception 'not_eligible'; end if;
  if square_delete.kind = 'post' then delete from public.square_posts p where p.id = square_delete.target and (p.author = auth.uid() or is_admin);
  elsif square_delete.kind = 'comment' then delete from public.square_comments c where c.id = square_delete.target and (c.author = auth.uid() or is_admin);
  else raise exception 'invalid_square'; end if;
  if not found then raise exception 'not_found'; end if;
  delete from public.square_reports r where r.kind = square_delete.kind and r.target = square_delete.target;
end $$;
create or replace function public.square_report(kind text, target uuid, reason text default '') returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.square_can_write() then raise exception 'not_eligible'; end if;
  if square_report.kind not in ('post', 'comment') then raise exception 'invalid_square'; end if;
  if (square_report.kind = 'post' and not exists(select 1 from public.square_posts p where p.id = square_report.target))
     or (square_report.kind = 'comment' and not exists(select 1 from public.square_comments c where c.id = square_report.target)) then raise exception 'not_found'; end if;
  if (select count(*) from public.square_reports r where r.reporter = auth.uid() and r.created_at > now() - interval '1 hour') >= 30 then raise exception 'rate_limited'; end if;
  insert into public.square_reports(kind, target, reporter, reason) values (square_report.kind, square_report.target, auth.uid(), left(coalesce(square_report.reason, ''), 200)) on conflict do nothing;
  if (select count(*) from public.square_reports r where r.kind = square_report.kind and r.target = square_report.target) >= 3 then
    if square_report.kind = 'post' then update public.square_posts p set hidden = true where p.id = square_report.target;
    else update public.square_comments c set hidden = true where c.id = square_report.target; end if;
  end if;
end $$;

-- Administrators: reported or hidden items, most recently reported first.
create or replace function public.admin_square_reports() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.admins where user_id = auth.uid()) then raise exception 'not_admin'; end if;
  return coalesce((select jsonb_agg(item order by item->>'reported_at' desc) from (
    select jsonb_build_object('kind', 'post', 'id', p.id, 'body', p.body, 'author_name', public.square_name(p.author), 'created_at', p.created_at, 'hidden', p.hidden,
      'reports', (select count(*) from public.square_reports r where r.kind = 'post' and r.target = p.id),
      'reasons', (select coalesce(jsonb_agg(r.reason) filter (where r.reason <> ''), '[]'::jsonb) from public.square_reports r where r.kind = 'post' and r.target = p.id),
      'reported_at', coalesce((select max(r.created_at) from public.square_reports r where r.kind = 'post' and r.target = p.id), p.created_at)) as item
    from public.square_posts p where p.hidden or exists(select 1 from public.square_reports r where r.kind = 'post' and r.target = p.id)
    union all
    select jsonb_build_object('kind', 'comment', 'id', c.id, 'body', c.body, 'author_name', public.square_name(c.author), 'created_at', c.created_at, 'hidden', c.hidden,
      'reports', (select count(*) from public.square_reports r where r.kind = 'comment' and r.target = c.id),
      'reasons', (select coalesce(jsonb_agg(r.reason) filter (where r.reason <> ''), '[]'::jsonb) from public.square_reports r where r.kind = 'comment' and r.target = c.id),
      'reported_at', coalesce((select max(r.created_at) from public.square_reports r where r.kind = 'comment' and r.target = c.id), c.created_at))
    from public.square_comments c where c.hidden or exists(select 1 from public.square_reports r where r.kind = 'comment' and r.target = c.id)
    limit 300) items), '[]'::jsonb);
end $$;
-- action: 'hide' | 'restore' (also clears its reports) | 'delete'.
create or replace function public.admin_square_moderate(kind text, target uuid, action text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.admins where user_id = auth.uid()) then raise exception 'not_admin'; end if;
  if admin_square_moderate.kind not in ('post', 'comment') or admin_square_moderate.action not in ('hide', 'restore', 'delete') then raise exception 'invalid_square'; end if;
  if admin_square_moderate.action = 'delete' then
    if admin_square_moderate.kind = 'post' then delete from public.square_posts p where p.id = admin_square_moderate.target;
    else delete from public.square_comments c where c.id = admin_square_moderate.target; end if;
  elsif admin_square_moderate.kind = 'post' then update public.square_posts p set hidden = (admin_square_moderate.action = 'hide') where p.id = admin_square_moderate.target;
  else update public.square_comments c set hidden = (admin_square_moderate.action = 'hide') where c.id = admin_square_moderate.target; end if;
  if admin_square_moderate.action <> 'hide' then delete from public.square_reports r where r.kind = admin_square_moderate.kind and r.target = admin_square_moderate.target; end if;
end $$;

revoke all on function public.square_can_write(), public.square_name(uuid), public.square_post_json(public.square_posts), public.square_comment_json(public.square_comments),
  public.square_feed(timestamptz, int), public.square_comments(uuid), public.square_post(text, text, text), public.square_comment(uuid, text, text),
  public.square_like(uuid, boolean), public.square_delete(text, uuid), public.square_report(text, uuid, text),
  public.admin_square_reports(), public.admin_square_moderate(text, uuid, text) from public, anon, authenticated;
grant execute on function public.square_feed(timestamptz, int), public.square_comments(uuid) to anon, authenticated;
grant execute on function public.square_post(text, text, text), public.square_comment(uuid, text, text), public.square_like(uuid, boolean),
  public.square_delete(text, uuid), public.square_report(text, uuid, text), public.admin_square_reports(), public.admin_square_moderate(text, uuid, text) to authenticated;

-- ── Friends (个人主页 → 好友, 2026-11-17) ───────────────────────────────────────────────────────────────────
-- Every registered account gets a public friend code (KB- + 6 characters, no 0/O/1/I/L) shown as text and as a QR
-- code; it reveals nothing else and can be reset. Friend requests go by code; accepted requests become friendships.
-- The tables are closed; everything goes through the functions below, which only touch the caller's own rows.
create table if not exists public.friend_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^KB-[2-9A-HJKMNP-Z]{6}$'),
  created_at timestamptz not null default now()
);
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (from_user <> to_user),
  unique (from_user, to_user)
);
create table if not exists public.friend_links (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
alter table public.friend_codes enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friend_links enable row level security;
revoke all on public.friend_codes, public.friend_requests, public.friend_links from anon, authenticated;

create or replace function public.friend_new_code() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare alphabet text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; candidate text;
begin
  loop
    candidate := 'KB-' || (select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '') from generate_series(1, 6));
    exit when not exists(select 1 from public.friend_codes where code = candidate);
  end loop;
  return candidate;
end $$;
-- The caller's code, created on first use. Only registered (or administrator) accounts take part.
create or replace function public.my_friend_code() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare found text;
begin
  if not public.square_can_write() then raise exception 'not_eligible'; end if;
  select code into found from public.friend_codes where user_id = auth.uid();
  if found is null then
    insert into public.friend_codes(user_id, code) values (auth.uid(), public.friend_new_code()) on conflict (user_id) do nothing;
    select code into found from public.friend_codes where user_id = auth.uid();
  end if;
  return found;
end $$;
create or replace function public.friend_reset_code() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare fresh text;
begin
  if not public.square_can_write() then raise exception 'not_eligible'; end if;
  fresh := public.friend_new_code();
  insert into public.friend_codes(user_id, code) values (auth.uid(), fresh) on conflict (user_id) do update set code = excluded.code, created_at = now();
  return fresh;
end $$;
create or replace function public.friend_user(friend_code text) returns uuid
language sql stable security definer set search_path = '' as $$
  select user_id from public.friend_codes where code = upper(btrim(friend_code));
$$;
create or replace function public.friend_pair_exists(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.friend_links where user_a = least(a, b) and user_b = greatest(a, b));
$$;
-- Who a code belongs to (name only) and how the caller stands with them: self / friends / sent / received / none.
create or replace function public.friend_lookup(friend_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare target uuid;
begin
  if not public.square_can_write() then raise exception 'not_eligible'; end if;
  target := public.friend_user(friend_code);
  if target is null then raise exception 'not_found'; end if;
  return jsonb_build_object('code', upper(btrim(friend_code)), 'name', public.square_name(target), 'state',
    case when target = auth.uid() then 'self'
         when public.friend_pair_exists(auth.uid(), target) then 'friends'
         when exists(select 1 from public.friend_requests where from_user = auth.uid() and to_user = target) then 'sent'
         when exists(select 1 from public.friend_requests where from_user = target and to_user = auth.uid()) then 'received'
         else 'none' end);
end $$;
-- Send a request; when the other side already asked, this accepts theirs instead.
create or replace function public.friend_request(friend_code text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare target uuid;
begin
  if not public.square_can_write() then raise exception 'not_eligible'; end if;
  target := public.friend_user(friend_code);
  if target is null then raise exception 'not_found'; end if;
  if target = auth.uid() then raise exception 'friend_self'; end if;
  if public.friend_pair_exists(auth.uid(), target) then return 'friends'; end if;
  if exists(select 1 from public.friend_requests where from_user = target and to_user = auth.uid()) then
    delete from public.friend_requests where (from_user = target and to_user = auth.uid()) or (from_user = auth.uid() and to_user = target);
    insert into public.friend_links(user_a, user_b) values (least(auth.uid(), target), greatest(auth.uid(), target)) on conflict do nothing;
    return 'friends';
  end if;
  if (select count(*) from public.friend_requests where from_user = auth.uid() and created_at > now() - interval '1 hour') >= 30 then raise exception 'rate_limited'; end if;
  insert into public.friend_requests(from_user, to_user) values (auth.uid(), target) on conflict do nothing;
  return 'sent';
end $$;
-- Accept or decline a request sent to the caller (by the sender's code).
create or replace function public.friend_respond(friend_code text, accept boolean) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare sender uuid;
begin
  if not public.square_can_write() then raise exception 'not_eligible'; end if;
  sender := public.friend_user(friend_code);
  if sender is null or not exists(select 1 from public.friend_requests where from_user = sender and to_user = auth.uid()) then raise exception 'not_found'; end if;
  delete from public.friend_requests where from_user = sender and to_user = auth.uid();
  if accept then
    delete from public.friend_requests where from_user = auth.uid() and to_user = sender;
    insert into public.friend_links(user_a, user_b) values (least(auth.uid(), sender), greatest(auth.uid(), sender)) on conflict do nothing;
    return 'friends';
  end if;
  return 'declined';
end $$;
-- Remove a friend, or cancel a request the caller sent.
create or replace function public.friend_remove(friend_code text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare target uuid;
begin
  if not public.square_can_write() then raise exception 'not_eligible'; end if;
  target := public.friend_user(friend_code);
  if target is null then return; end if;
  delete from public.friend_links where user_a = least(auth.uid(), target) and user_b = greatest(auth.uid(), target);
  delete from public.friend_requests where from_user = auth.uid() and to_user = target;
end $$;
-- Everything the friends page shows: the caller's code, friends, requests received and sent (names and codes only).
create or replace function public.friend_overview() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare mine text;
begin
  mine := public.my_friend_code();
  return jsonb_build_object('code', mine,
    'friends', coalesce((select jsonb_agg(jsonb_build_object('code', c.code, 'name', public.square_name(c.user_id), 'since', l.created_at) order by l.created_at desc)
      from public.friend_links l join public.friend_codes c on c.user_id = case when l.user_a = auth.uid() then l.user_b else l.user_a end
      where auth.uid() in (l.user_a, l.user_b)), '[]'::jsonb),
    'received', coalesce((select jsonb_agg(jsonb_build_object('code', c.code, 'name', public.square_name(r.from_user), 'at', r.created_at) order by r.created_at desc)
      from public.friend_requests r join public.friend_codes c on c.user_id = r.from_user where r.to_user = auth.uid()), '[]'::jsonb),
    'sent', coalesce((select jsonb_agg(jsonb_build_object('code', c.code, 'name', public.square_name(r.to_user), 'at', r.created_at) order by r.created_at desc)
      from public.friend_requests r join public.friend_codes c on c.user_id = r.to_user where r.from_user = auth.uid()), '[]'::jsonb));
end $$;
revoke all on function public.friend_new_code(), public.my_friend_code(), public.friend_reset_code(), public.friend_user(text),
  public.friend_pair_exists(uuid, uuid), public.friend_lookup(text), public.friend_request(text), public.friend_respond(text, boolean),
  public.friend_remove(text), public.friend_overview() from public, anon, authenticated;
grant execute on function public.my_friend_code(), public.friend_reset_code(), public.friend_lookup(text), public.friend_request(text),
  public.friend_respond(text, boolean), public.friend_remove(text), public.friend_overview() to authenticated;

-- ── Review reminders by push (2026-11-17) ───────────────────────────────────────────────────────────────────
-- A device that turned reminders on registers its push subscription with the next few reminder times (kind and card
-- counts only, no card content). Every 10 minutes pg_cron calls the server's /api/push/tick with a secret; the server
-- takes the reminders now due through push_take_due (which checks the secret against push_config) and sends them.
-- The operator sets the secret once (see cloud-setup.md): insert into public.push_config ... sha256 of the secret.
create table if not exists public.push_subscriptions (
  endpoint text primary key check (length(endpoint) <= 1000 and endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/'),
  p256dh text not null check (length(p256dh) between 80 and 100),
  auth text not null check (length(auth) between 16 and 30),
  locale text not null default 'zh' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  slots jsonb not null default '[]'::jsonb,
  last_line int not null default -1,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.push_config (
  id int primary key check (id = 1),
  secret_hash text not null
);
alter table public.push_subscriptions enable row level security;
alter table public.push_config enable row level security;
revoke all on public.push_subscriptions, public.push_config from anon, authenticated;

-- Register or update this device. slots: [{at, kind: morning|evening|streak, n, d}], at most 6, within the next 4 days.
create or replace function public.push_register(endpoint text, p256dh text, auth text, locale text, slots jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare cleaned jsonb;
begin
  if jsonb_typeof(push_register.slots) <> 'array' or jsonb_array_length(push_register.slots) > 6 then raise exception 'invalid_push'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('at', (s->>'at')::timestamptz, 'kind', s->>'kind', 'n', least(greatest((s->>'n')::int, 0), 9999), 'd', least(greatest(coalesce((s->>'d')::int, 0), 0), 9999))), '[]'::jsonb)
    into cleaned from jsonb_array_elements(push_register.slots) s
    where s->>'kind' in ('morning', 'evening', 'streak') and (s->>'at')::timestamptz between now() - interval '1 hour' and now() + interval '4 days';
  begin
    insert into public.push_subscriptions(endpoint, p256dh, auth, locale, slots, user_id)
      values (push_register.endpoint, push_register.p256dh, push_register.auth, push_register.locale, cleaned, auth.uid())
      on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, locale = excluded.locale, slots = excluded.slots,
        user_id = coalesce(excluded.user_id, public.push_subscriptions.user_id), updated_at = now();
  exception when check_violation or not_null_violation or invalid_text_representation then raise exception 'invalid_push';
  end;
end $$;
create or replace function public.push_unregister(endpoint text) returns void
language sql volatile security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = push_unregister.endpoint;
$$;
create or replace function public.push_secret_ok(secret text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.push_config where id = 1 and secret_hash = encode(sha256(convert_to(coalesce(secret, ''), 'UTF8')), 'hex'));
$$;
-- For the server only (secret): the reminders due now — the latest due slot per device, sent at most 3 hours late —
-- and those slots are removed so each is sent once.
create or replace function public.push_take_due(secret text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.push_secret_ok(secret) then raise exception 'denied'; end if;
  with due as (
    select p.endpoint, (select s from jsonb_array_elements(p.slots) s where (s->>'at')::timestamptz <= now() and (s->>'at')::timestamptz > now() - interval '3 hours' order by (s->>'at')::timestamptz desc limit 1) as slot
    from public.push_subscriptions p
    where exists(select 1 from jsonb_array_elements(p.slots) s where (s->>'at')::timestamptz <= now())
  ), taken as (
    update public.push_subscriptions p set slots = coalesce((select jsonb_agg(s) from jsonb_array_elements(p.slots) s where (s->>'at')::timestamptz > now()), '[]'::jsonb)
    from due where p.endpoint = due.endpoint
    returning p.endpoint, p.p256dh, p.auth, p.locale, p.last_line, due.slot
  )
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth, 'locale', locale, 'last_line', last_line,
    'kind', slot->>'kind', 'n', (slot->>'n')::int, 'd', (slot->>'d')::int)) filter (where slot is not null), '[]'::jsonb)
  into result from taken;
  return result;
end $$;
-- For the server only (secret): remember the line each device got, and drop subscriptions the push service says are gone.
create or replace function public.push_after(secret text, results jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.push_secret_ok(secret) then raise exception 'denied'; end if;
  update public.push_subscriptions p set last_line = (r->>'line')::int
    from jsonb_array_elements(push_after.results) r where p.endpoint = r->>'endpoint' and r->>'line' is not null;
  delete from public.push_subscriptions p using jsonb_array_elements(push_after.results) r
    where p.endpoint = r->>'endpoint' and coalesce((r->>'gone')::boolean, false);
end $$;
revoke all on function public.push_register(text, text, text, text, jsonb), public.push_unregister(text), public.push_secret_ok(text),
  public.push_take_due(text), public.push_after(text, jsonb) from public, anon, authenticated;
grant execute on function public.push_register(text, text, text, text, jsonb), public.push_unregister(text), public.push_take_due(text),
  public.push_after(text, jsonb) to anon, authenticated;
