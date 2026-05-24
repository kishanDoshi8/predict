create or replace function public.claim_weekly_points(
  p_auto_claimed boolean default false
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player          public.players%rowtype;
  v_week_key        text;
  v_prev_week_key   text;
  v_new_streak      integer;
  v_already_claimed boolean;
begin
  select * into v_player
  from public.players
  where user_id = auth.uid();

  if not found then
    raise exception 'Player profile not found' using errcode = 'P0004';
  end if;

  v_week_key := private.current_week_key();

  select exists (
    select 1 from public.weekly_claims
    where player_id = v_player.id
      and week_key  = v_week_key
  ) into v_already_claimed;

  if v_already_claimed then
    return json_build_object(
      'claimed',         false,
      'already_claimed', true,
      'week_key',        v_week_key,
      'points_balance',  v_player.points_balance,
      'current_streak',  v_player.current_streak
    );
  end if;

  v_prev_week_key := to_char(
    (now() - interval '7 days') at time zone 'UTC',
    'IYYY"-W"IW'
  );

  if v_player.last_claim_at is not null
     and to_char(v_player.last_claim_at at time zone 'UTC', 'IYYY"-W"IW') = v_prev_week_key
  then
    v_new_streak := v_player.current_streak + 1;
  else
    v_new_streak := 1;
  end if;

  insert into public.weekly_claims (player_id, week_key, auto_claimed)
  values (v_player.id, v_week_key, p_auto_claimed);

  update public.players
  set
    points_balance = points_balance + 100,
    current_streak = v_new_streak,
    longest_streak = greatest(longest_streak, v_new_streak),
    last_claim_at  = now()
  where id = v_player.id
  returning * into v_player;

  return json_build_object(
    'claimed',         true,
    'already_claimed', false,
    'week_key',        v_week_key,
    'points_added',    100,
    'points_balance',  v_player.points_balance,
    'current_streak',  v_player.current_streak,
    'longest_streak',  v_player.longest_streak,
    'auto_claimed',    p_auto_claimed
  );
end;
$$;
