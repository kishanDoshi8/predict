begin;

select plan(19);

create or replace function public._test_create_player_with_auth_user(
  p_user_id uuid,
  p_username text,
  p_points_balance integer default 0,
  p_current_streak integer default 0,
  p_longest_streak integer default 0,
  p_last_claim_at timestamptz default null
)
returns public.players
language plpgsql
as $$
declare
  v_player public.players%rowtype;
begin
  insert into auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data
  )
  values (
    p_user_id,
    'authenticated',
    'authenticated',
    p_username || '@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}'::jsonb
  )
  on conflict (id) do nothing;

  insert into public.players (
    username,
    player_token,
    points_balance,
    points_in_escrow,
    total_won,
    current_streak,
    longest_streak,
    last_claim_at,
    user_id
  )
  values (
    p_username,
    p_username || '_token',
    p_points_balance,
    0,
    0,
    p_current_streak,
    p_longest_streak,
    p_last_claim_at,
    p_user_id
  )
  returning * into v_player;

  return v_player;
end;
$$;

do $$
declare
  v_current_week text := private.current_week_key();
  v_prev_week text := to_char((now() - interval '7 days') at time zone 'UTC', 'IYYY"-W"IW');
  v_old_week text := to_char((now() - interval '21 days') at time zone 'UTC', 'IYYY"-W"IW');
  v_player public.players%rowtype;
  v_result json;
begin
  -- first manual claim = 500
  v_player := public._test_create_player_with_auth_user('11111111-1111-1111-1111-111111111111', 'weekly_bonus_manual');
  perform set_config('request.jwt.claim.sub', v_player.user_id::text, true);
  v_result := public.claim_weekly_points(false);

  perform is((v_result->>'claimed')::boolean, true, 'manual first claim succeeds');
  perform is((v_result->>'points_added')::integer, 500, 'manual first claim awards 500');
  perform is((v_result->>'current_streak')::integer, 1, 'manual first claim starts streak at 1');
  perform is((select points_balance from public.players where id = v_player.id), 500, 'manual first claim updates points balance to 500');

  -- first auto claim = 500
  v_player := public._test_create_player_with_auth_user('22222222-2222-2222-2222-222222222222', 'weekly_bonus_auto');
  perform set_config('request.jwt.claim.sub', v_player.user_id::text, true);
  v_result := public.claim_weekly_points(true);

  perform is((v_result->>'points_added')::integer, 500, 'auto first claim awards 500');
  perform is((v_result->>'auto_claimed')::boolean, true, 'auto first claim response marks auto_claimed=true');
  perform is(
    (select auto_claimed from public.weekly_claims where player_id = v_player.id and week_key = v_current_week),
    true,
    'auto first claim stores auto_claimed=true in weekly_claims'
  );

  -- second claim = 100 (after a prior week claim)
  v_player := public._test_create_player_with_auth_user(
    '33333333-3333-3333-3333-333333333333',
    'weekly_bonus_second',
    10,
    1,
    1,
    now() - interval '7 days'
  );
  insert into public.weekly_claims (player_id, week_key, auto_claimed)
  values (v_player.id, v_prev_week, false);
  perform set_config('request.jwt.claim.sub', v_player.user_id::text, true);
  v_result := public.claim_weekly_points(false);

  perform is((v_result->>'points_added')::integer, 100, 'second claim awards 100');
  perform is((v_result->>'current_streak')::integer, 2, 'second claim increments streak normally');
  perform is((select points_balance from public.players where id = v_player.id), 110, 'second claim adds 100 points to balance');

  -- existing users remain at 100
  v_player := public._test_create_player_with_auth_user(
    '44444444-4444-4444-4444-444444444444',
    'weekly_bonus_existing',
    300,
    5,
    5,
    now() - interval '21 days'
  );
  insert into public.weekly_claims (player_id, week_key, auto_claimed)
  values (v_player.id, v_old_week, false);
  perform set_config('request.jwt.claim.sub', v_player.user_id::text, true);
  v_result := public.claim_weekly_points(false);

  perform is((v_result->>'points_added')::integer, 100, 'existing player with prior claim still gets 100');
  perform is((v_result->>'current_streak')::integer, 1, 'existing player streak still follows prior logic');
  perform is((select points_balance from public.players where id = v_player.id), 400, 'existing player points increase by 100');

  -- duplicate weekly claim returns already claimed without extra points
  v_player := public._test_create_player_with_auth_user(
    '55555555-5555-5555-5555-555555555555',
    'weekly_bonus_duplicate',
    777,
    5,
    6,
    now()
  );
  insert into public.weekly_claims (player_id, week_key, auto_claimed)
  values (v_player.id, v_current_week, false);
  perform set_config('request.jwt.claim.sub', v_player.user_id::text, true);
  v_result := public.claim_weekly_points(false);

  perform is((v_result->>'claimed')::boolean, false, 'duplicate claim returns claimed=false');
  perform is((v_result->>'already_claimed')::boolean, true, 'duplicate claim returns already_claimed=true');
  perform ok(not (v_result ? 'points_added'), 'duplicate claim does not return points_added');
  perform is((select points_balance from public.players where id = v_player.id), 777, 'duplicate claim does not change points balance');
  perform is((select count(*) from public.weekly_claims where player_id = v_player.id and week_key = v_current_week), 1::bigint, 'duplicate claim does not insert extra weekly claim row');
end;
$$;

drop function if exists public._test_create_player_with_auth_user(uuid, text, integer, integer, integer, timestamptz);

select * from finish();
rollback;
