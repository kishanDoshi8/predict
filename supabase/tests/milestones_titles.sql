begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

-- ------------------------------------------------------------
-- Fixtures: Alice runs the room with Bob and Carol. Eve is not a member.
-- ------------------------------------------------------------
insert into auth.users (id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000a11c', 'authenticated', 'authenticated', 'alice@example.com'),
  ('00000000-0000-0000-0000-000000000b0b', 'authenticated', 'authenticated', 'bob@example.com'),
  ('00000000-0000-0000-0000-00000000ca01', 'authenticated', 'authenticated', 'carol@example.com'),
  ('00000000-0000-0000-0000-000000000e7e', 'authenticated', 'authenticated', 'eve@example.com');

create function pg_temp.uid(p_username text)
returns uuid
language sql
as $$
  select case p_username
    when 'alice' then '00000000-0000-0000-0000-00000000a11c'
    when 'bob' then '00000000-0000-0000-0000-000000000b0b'
    when 'carol' then '00000000-0000-0000-0000-00000000ca01'
    when 'eve' then '00000000-0000-0000-0000-000000000e7e'
  end::uuid
$$;

create function pg_temp.login(p_username text)
returns void
language sql
as $$
  select set_config('request.jwt.claim.sub', pg_temp.uid(p_username)::text, true);
  select set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(p_username), 'role', 'authenticated')::text, true);
$$;

create function pg_temp.setting(p_name text)
returns uuid
language sql
as $$ select current_setting('test.' || p_name)::uuid $$;

create function pg_temp.player(p_username text)
returns uuid
language sql
as $$ select id from public.players where username = p_username $$;

-- One game in a series: each bettor backs a side with a stake, then Alice
-- reveals the winner. p_bets is {"alice": ["Home", 100], ...}.
create function pg_temp.play(p_series text, p_bets jsonb, p_winner text)
returns uuid
language plpgsql
as $$
declare
  v_prediction uuid;
  v_bettor text;
  v_bet jsonb;
begin
  perform pg_temp.login('alice');
  v_prediction := (public.create_prediction(
    pg_temp.setting('room_id'), 'Game', array['Home', 'Away'], now() + interval '1 day', pg_temp.setting(p_series)
  )->>'prediction_id')::uuid;

  for v_bettor, v_bet in select * from jsonb_each(p_bets) loop
    perform pg_temp.login(v_bettor);
    perform public.place_bet(
      v_prediction,
      (select id from public.prediction_options where prediction_id = v_prediction and label = v_bet->>0),
      (v_bet->>1)::int
    );
  end loop;

  update public.predictions set status = 'locked' where id = v_prediction;

  perform pg_temp.login('alice');
  perform public.resolve_prediction_v2(
    v_prediction,
    pg_temp.setting('room_id'),
    'win',
    (select id from public.prediction_options where prediction_id = v_prediction and label = p_winner)
  );
  -- Each resolve is its own transaction in the app; clear its scratch table.
  drop table if exists _winner_gains;
  return v_prediction;
end;
$$;

create function pg_temp.award(p_series text, p_type text)
returns table (username text, value numeric, tier text)
language sql
as $$
  select pl.username::text, sa.value, sa.tier
  from public.series_awards sa
  join public.players pl on pl.id = sa.player_id
  where sa.series_id = pg_temp.setting(p_series) and sa.award_type::text = p_type
  order by pl.username
$$;

create function pg_temp.has_milestone(p_username text, p_type text)
returns boolean
language sql
as $$
  select exists (
    select 1 from public.room_member_milestones
    where room_id = pg_temp.setting('room_id')
      and player_id = pg_temp.player(p_username)
      and milestone_type = p_type
  )
$$;

select pg_temp.login('alice');
select public.register_player('alice');
select set_config('test.room_id', (public.create_room('Alice room')->>'id'), true);
select set_config('test.room_code', (select room_code from public.rooms where id = pg_temp.setting('room_id')), true);

select pg_temp.login('bob');
select public.register_player('bob');
select public.join_room(current_setting('test.room_code'));

select pg_temp.login('carol');
select public.register_player('carol');
select public.join_room(current_setting('test.room_code'));

select pg_temp.login('eve');
select public.register_player('eve');

-- ------------------------------------------------------------
-- 1. A six-game cup: Alice and Carol call every game, Bob misses every one
-- ------------------------------------------------------------
select pg_temp.login('alice');
select set_config('test.cup', (public.create_series(pg_temp.setting('room_id'), 'Cup', null, 0, 1000, 100, 1)->>'id'), true);

select pg_temp.play('cup', '{"alice": ["Home", 100], "bob": ["Away", 150], "carol": ["Home", 50]}', 'Home')
from generate_series(1, 6);

-- Carol sat fourth one Monday before climbing to second.
insert into public.series_standing_snapshots (series_id, player_id, week_key, rank, is_ranked, balance)
values
  (pg_temp.setting('cup'), pg_temp.player('alice'), '2026-W01', 1, true, 1000),
  (pg_temp.setting('cup'), pg_temp.player('carol'), '2026-W01', 4, true, 1000);

select pg_temp.login('alice');
select public.complete_series(pg_temp.setting('cup'));

select results_eq(
  $$ select username, value, tier from pg_temp.award('cup', 'SHARPSHOOTER') $$,
  $$ values ('alice', 100.0, 'gold'), ('carol', 100.0, 'gold') $$,
  'Sharpshooter goes to the best win rate, and ties share it'
);
select results_eq(
  $$ select username, value, tier from pg_temp.award('cup', 'UNDERDOG') $$,
  $$ values ('alice', 2.00, 'bronze'), ('carol', 2.00, 'bronze') $$,
  'Underdog goes to the best winning multiplier'
);
select results_eq(
  $$ select username, value, tier from pg_temp.award('cup', 'COMEBACK') $$,
  $$ values ('carol', 2::numeric, 'bronze') $$,
  'Comeback goes to the biggest climb from a weekly low'
);
select results_eq(
  $$ select username, value, tier from pg_temp.award('cup', 'HOT_FINISH') $$,
  $$ values ('alice', 3::numeric, 'gold'), ('carol', 3::numeric, 'gold') $$,
  'Hot Finish counts wins over the final stretch'
);
select is(private.series_finish_window(6), 3, 'the final stretch is at least three games');
select is(private.series_finish_window(40), 10, 'the final stretch is a quarter of a long series');

-- ------------------------------------------------------------
-- 2. Milestones from the cup
-- ------------------------------------------------------------
select ok(pg_temp.has_milestone('alice', 'FIRST_TITLE'), 'winning a series unlocks First Title');
select ok(not pg_temp.has_milestone('bob', 'FIRST_TITLE'), 'only the champion gets First Title');
select is(
  (select count(*)::int from public.room_activities
   where room_id = pg_temp.setting('room_id') and activity_type = 'achievement_milestone'),
  1,
  'a new milestone is posted to the room feed'
);
select is(private.award_milestones(pg_temp.setting('room_id')), 0, 'milestones are granted only once');

-- ------------------------------------------------------------
-- 3. A long second series: Moonshot on reveal, then Century, Back-to-Back
--    and an Iron Season when it completes
-- ------------------------------------------------------------
select pg_temp.login('alice');
select set_config('test.league', (public.create_series(pg_temp.setting('room_id'), 'League', null, 0, 1000, 100, 1)->>'id'), true);

select pg_temp.play('league', '{"alice": ["Home", 10], "bob": ["Away", 100]}', 'Home');
select ok(pg_temp.has_milestone('alice', 'MOONSHOT'), 'a win at 10x or more unlocks Moonshot as soon as it is revealed');
select ok(not pg_temp.has_milestone('alice', 'CENTURY'), 'Century needs a hundred predictions');

select pg_temp.play('league', '{"alice": ["Home", 1], "bob": ["Away", 1]}', 'Home')
from generate_series(1, 99);
select ok(pg_temp.has_milestone('alice', 'CENTURY'), 'a hundredth prediction unlocks Century');

select pg_temp.login('alice');
select public.complete_series(pg_temp.setting('league'));

select ok(pg_temp.has_milestone('alice', 'BACK_TO_BACK'), 'winning two series in a row unlocks Back-to-Back');
select ok(not pg_temp.has_milestone('alice', 'HAT_TRICK'), 'Hat-trick needs three titles');
select ok(pg_temp.has_milestone('alice', 'IRON_SEASON'), 'Ever-Present in a 10+ game series unlocks Iron Season');
select ok(not pg_temp.has_milestone('carol', 'IRON_SEASON'), 'missing games rules out Iron Season');

-- ------------------------------------------------------------
-- 4. Play-style titles
-- ------------------------------------------------------------
select pg_temp.login('carol');
set local role authenticated;
select is(
  (public.get_room_member_style(pg_temp.setting('room_id'), pg_temp.player('alice'))->'titles')::text,
  '["EVER_PRESENT", "SHARPSHOOTER"]',
  'the best caller with 20+ bets is the Sharpshooter'
);
select is(
  (public.get_room_member_style(pg_temp.setting('room_id'), pg_temp.player('bob'))->'titles')::text,
  '["EVER_PRESENT", "HIGH_ROLLER"]',
  'whoever risks the most is the High Roller'
);
select is(
  (public.get_room_member_style(pg_temp.setting('room_id'), pg_temp.player('carol'))->'titles')::text,
  '[]',
  'a player with no stand-out style holds no title'
);
reset role;

-- ------------------------------------------------------------
-- 5. Access
-- ------------------------------------------------------------
select pg_temp.login('eve');
set local role authenticated;
select is(
  (select count(*)::int from public.room_member_milestones),
  0,
  'non-members cannot see a room''s milestones'
);
select throws_ok(
  format($$ select public.get_room_member_style(%L, %L) $$, pg_temp.setting('room_id'), pg_temp.player('alice')),
  'P0011', null,
  'non-members cannot read play styles'
);
reset role;

select * from finish();
rollback;
