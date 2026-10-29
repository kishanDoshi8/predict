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
