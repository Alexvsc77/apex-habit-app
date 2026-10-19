-- One document per MRZ account. Run once in the Supabase SQL Editor.
create table if not exists public.tracker_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  revision bigint not null default 1 check (revision > 0)
);

alter table public.tracker_state enable row level security;

-- The publishable key alone must not grant access to any tracker data.
revoke all on table public.tracker_state from public, anon, authenticated;
grant select, insert, update on table public.tracker_state to authenticated;

create policy "Read own tracker"
on public.tracker_state for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Create own tracker"
on public.tracker_state for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Update own tracker"
on public.tracker_state for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
