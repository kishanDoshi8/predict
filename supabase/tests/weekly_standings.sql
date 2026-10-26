begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

-- ------------------------------------------------------------
-- Fixtures: Alice runs a series with Bob and Carol. Dave joins mid-week,
-- Eve is not in the room.
-- ------------------------------------------------------------
insert into auth.users (id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000a11c', 'authenticated', 'authenticated', 'alice@example.com'),
  ('00000000-0000-0000-0000-000000000b0b', 'authenticated', 'authenticated', 'bob@example.com'),
  ('00000000-0000-0000-0000-00000000ca01', 'authenticated', 'authenticated', 'carol@example.com'),
  ('00000000-0000-0000-0000-00000000da7e', 'authenticated', 'authenticated', 'dave@example.com'),
  ('00000000-0000-0000-0000-000000000e7e', 'authenticated', 'authenticated', 'eve@example.com');

create function pg_temp.login(p_user_id uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claim.sub', p_user_id::text, true);
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.setting(p_name text)
returns uuid
language sql
as $$ select current_setting('test.' || p_name)::uuid $$;

create function pg_temp.player(p_username text)
returns uuid
language sql
as $$ select id from public.players where username = p_username $$;

create function pg_temp.option_id(p_prediction text, p_label text)
returns uuid
language sql
as $$
  select id from public.prediction_options
  where prediction_id = pg_temp.setting(p_prediction) and label = p_label
$$;

-- The series leaderboard, as Alice sees it.
create function pg_temp.board()
returns json
language plpgsql
as $$
declare
  v_board json;
begin
  perform pg_temp.login('00000000-0000-0000-0000-00000000a11c');
  set local role authenticated;
  v_board := public.get_series_leaderboard(pg_temp.setting('room_id'), pg_temp.setting('cup'));
  reset role;
  return v_board;
end;
$$;

create function pg_temp.row(p_username text)
returns json
language sql
as $$
  select e from json_array_elements(pg_temp.board()) e where e->>'username' = p_username
$$;

create function pg_temp.recap()
returns json
language plpgsql
as $$
declare
  v_recap json;
begin
  perform pg_temp.login('00000000-0000-0000-0000-00000000a11c');
  set local role authenticated;
  v_recap := public.get_series_weekly_recap(pg_temp.setting('room_id'), pg_temp.setting('cup'));
  reset role;
  return v_recap;
end;
$$;

select pg_temp.login('00000000-0000-0000-0000-00000000a11c');
set local role authenticated;
select public.register_player('alice');
select set_config('test.room_id', (public.create_room('Cricket Fever')->>'id'), true);
reset role;

select set_config('test.room_code', (select room_code from public.rooms where id = pg_temp.setting('room_id')), true);

select pg_temp.login('00000000-0000-0000-0000-000000000b0b');
set local role authenticated;
select public.register_player('bob');
select public.join_room(current_setting('test.room_code'));
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000ca01');
set local role authenticated;
select public.register_player('carol');
select public.join_room(current_setting('test.room_code'));
reset role;

select pg_temp.login('00000000-0000-0000-0000-000000000e7e');
set local role authenticated;
select public.register_player('eve');
reset role;

-- Everyone joined in this one transaction; spread the join times so ties
-- break the way they would in real life.
update public.room_members set joined_at = now() - interval '3 hours' where player_id = pg_temp.player('alice');
update public.room_members set joined_at = now() - interval '2 hours' where player_id = pg_temp.player('bob');
update public.room_members set joined_at = now() - interval '1 hour' where player_id = pg_temp.player('carol');

select pg_temp.login('00000000-0000-0000-0000-00000000a11c');
set local role authenticated;
select set_config('test.cup', (public.create_series(pg_temp.setting('room_id'), 'IND v AUS')->>'id'), true);
select set_config('test.old', (public.create_series(pg_temp.setting('room_id'), 'Last season')->>'id'), true);
select set_config('test.final',
  (public.create_prediction(pg_temp.setting('room_id'), 'Who wins ODI 1?', array['IND', 'AUS'], now() + interval '1 day', pg_temp.setting('cup'))->>'prediction_id'),
  true);
select public.place_bet(pg_temp.setting('final'), pg_temp.option_id('final', 'IND'), 100);
reset role;

select pg_temp.login('00000000-0000-0000-0000-000000000b0b');
set local role authenticated;
select public.place_bet(pg_temp.setting('final'), pg_temp.option_id('final', 'AUS'), 100);
reset role;

update public.series set status = 'completed' where id = pg_temp.setting('old');

-- ------------------------------------------------------------
-- 1. Before any snapshot there is no movement
-- ------------------------------------------------------------
select is(pg_temp.row('alice')->>'rank_change', null, 'no snapshot yet: no rank change');
select is((pg_temp.row('alice')->>'rank_is_new')::boolean, false, 'no snapshot yet: nobody is new');
select is(pg_temp.recap()::text, null, 'no snapshot yet: no weekly recap');

-- ------------------------------------------------------------
-- 2. The Monday snapshot records active series only, once a week
-- ------------------------------------------------------------
select is(private.snapshot_series_standings(), 1, 'one active series is snapshotted');
select is(private.snapshot_series_standings(), 1, 'running it again is harmless');

select is(
  (select count(*)::int from public.series_standing_snapshots where series_id = pg_temp.setting('cup')),
  3,
  'one row per member, written once'
);
select is(
  (select count(*)::int from public.series_standing_snapshots where series_id = pg_temp.setting('old')),
  0,
  'closed series are not snapshotted'
);
select is(
  (select rank from public.series_standing_snapshots
   where series_id = pg_temp.setting('cup') and player_id = pg_temp.player('alice')),
  1,
  'standings are recorded as they stood'
);

-- ------------------------------------------------------------
-- 3. Results during the week move the arrows
-- ------------------------------------------------------------
-- Dave joins after Monday and backs the winner too.
select pg_temp.login('00000000-0000-0000-0000-00000000da7e');
set local role authenticated;
select public.register_player('dave');
select public.join_room(current_setting('test.room_code'));
select public.place_bet(pg_temp.setting('final'), pg_temp.option_id('final', 'AUS'), 100);
reset role;

update public.predictions set status = 'locked' where id = pg_temp.setting('final');

select pg_temp.login('00000000-0000-0000-0000-00000000a11c');
set local role authenticated;
select public.resolve_prediction_v2(pg_temp.setting('final'), pg_temp.setting('room_id'), 'win', pg_temp.option_id('final', 'AUS'));
reset role;

select is((pg_temp.row('bob')->>'rank')::int, 1, 'bob leads after the result');
select is((pg_temp.row('bob')->>'previous_rank')::int, 2, 'bob was second on Monday');
select is((pg_temp.row('bob')->>'rank_change')::int, 1, 'bob is up one');
select is((pg_temp.row('alice')->>'rank_change')::int, -2, 'alice is down two');
select is((pg_temp.row('dave')->>'rank_is_new')::boolean, true, 'a player ranked since Monday is new');
select is(pg_temp.row('dave')->>'rank_change', null, 'a new player has no rank change');
select is(pg_temp.row('carol')->>'rank', null, 'carol is short of the bar and unranked');

select is(
  array(select st.rank from private.series_standings(pg_temp.setting('cup')) st order by st.player_id),
  array(select (e->>'rank')::int from json_array_elements(pg_temp.board()) e order by (e->>'player_id')::uuid),
  'snapshot standings rank exactly like the leaderboard'
);

-- ------------------------------------------------------------
-- 4. The weekly recap compares the last two snapshots
-- ------------------------------------------------------------
select is((pg_temp.recap()->>'has_previous')::boolean, false, 'the first week has nothing to compare');
select is(pg_temp.recap()->>'climber', null, 'no climber in the first week');

-- The week before: Bob led, then Carol, then Alice.
insert into public.series_standing_snapshots (series_id, player_id, week_key, rank, is_ranked, balance)
values
  (pg_temp.setting('cup'), pg_temp.player('bob'), '2000-W01', 1, true, 1000),
  (pg_temp.setting('cup'), pg_temp.player('carol'), '2000-W01', 2, true, 1000),
  (pg_temp.setting('cup'), pg_temp.player('alice'), '2000-W01', 3, true, 1000);

select is((pg_temp.recap()->>'week_number')::int, 2, 'weeks are numbered from the first snapshot');
select is(pg_temp.recap()->'climber'->>'username', 'alice', 'alice climbed the most (3rd to 1st)');
select is(pg_temp.recap()->'faller'->>'username', 'bob', 'falls tie at one place; the better final rank wins');

select pg_temp.login('00000000-0000-0000-0000-000000000e7e');
set local role authenticated;
select throws_ok(
  format($$ select public.get_series_weekly_recap(%L, %L) $$, pg_temp.setting('room_id'), pg_temp.setting('cup')),
  'P0011', null,
  'only room members can read the recap'
);
reset role;

select * from finish();
rollback;
