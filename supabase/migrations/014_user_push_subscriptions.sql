-- ============================================================
-- Migration: 014_user_push_subscriptions
-- Description:
--   Stores browser push subscriptions and exposes safe upsert RPC
-- ============================================================

create table if not exists public.user_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.players(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

comment on table public.user_push_subscriptions is
'Browser push subscriptions for players.';

create unique index if not exists idx_user_push_subscriptions_endpoint
  on public.user_push_subscriptions ((subscription->>'endpoint'));

create index if not exists idx_user_push_subscriptions_user_id
  on public.user_push_subscriptions(user_id);

alter table public.user_push_subscriptions enable row level security;
revoke all on public.user_push_subscriptions from anon;

create policy "user_push_subscriptions_no_direct_select"
  on public.user_push_subscriptions
  for select
  using (false);

create policy "user_push_subscriptions_no_direct_insert"
  on public.user_push_subscriptions
  for insert
  with check (false);

create policy "user_push_subscriptions_no_direct_update"
  on public.user_push_subscriptions
  for update
  using (false);

create policy "user_push_subscriptions_no_direct_delete"
  on public.user_push_subscriptions
  for delete
  using (false);

create or replace function public.upsert_user_push_subscription(
  p_player_token text,
  p_subscription jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user_id uuid;
  v_subscription_id uuid;
begin
  if coalesce(p_subscription->>'endpoint', '') = '' then
    raise exception 'Invalid subscription endpoint' using errcode = 'P0001';
  end if;

  select id into v_user_id
  from public.players
  where player_token = p_player_token;

  if v_user_id is null then
    raise exception 'Invalid player token' using errcode = 'P0004';
  end if;

  insert into public.user_push_subscriptions (user_id, subscription)
  values (v_user_id, p_subscription)
  on conflict ((subscription->>'endpoint')) do update
  set
    user_id = excluded.user_id,
    subscription = excluded.subscription
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$$;

grant execute on function public.upsert_user_push_subscription(text, jsonb) to anon;
