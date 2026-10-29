-- ============================================================
-- Migration: push_reliability
-- Description: A browser's push endpoint follows whoever is signed in on
--   it, instead of failing for the second account on a shared device, and
--   signing out removes this device's subscription.
-- ============================================================

create or replace function public.upsert_user_push_subscription(
  p_subscription jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user_id              uuid;
  v_subscription_id      uuid;
begin
  if coalesce(p_subscription->>'endpoint', '') = '' then
    raise exception 'Invalid subscription endpoint' using errcode = 'P0001';
  end if;

  v_user_id := private.get_player_id_from_auth();

  if v_user_id is null then
    raise exception 'Player profile not found' using errcode = 'P0004';
  end if;

  -- An endpoint is one browser on one device. Whoever is signed in there now
  -- owns it, so a shared phone or an account switch moves it over.
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

-- Stops pushes to this browser for the signed-in player, e.g. on sign-out.
create or replace function public.delete_my_push_subscription(
  p_endpoint text
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user_id uuid;
begin
  v_user_id := private.get_player_id_from_auth();

  if v_user_id is null then
    return;
  end if;

  delete from public.user_push_subscriptions
  where user_id = v_user_id
    and subscription->>'endpoint' = p_endpoint;
end;
$$;

revoke execute on function public.delete_my_push_subscription(text) from public, anon, authenticated;
grant execute on function public.delete_my_push_subscription(text) to authenticated;
