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
drop policy if exists own_snapshot on public.learning_snapshots;
create policy own_snapshot on public.learning_snapshots for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

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
