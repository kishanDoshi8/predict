begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000a11c', 'authenticated', 'authenticated', 'alice@example.com'),
  ('00000000-0000-0000-0000-000000000b0b', 'authenticated', 'authenticated', 'bob@example.com'),
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

-- The board as a player sees it.
create function pg_temp.board(p_user_id uuid)
returns json
language plpgsql
as $$
declare
  v_board json;
begin
  perform pg_temp.login(p_user_id);
  set local role authenticated;
  v_board := public.get_series_suggestions(pg_temp.setting('room_id'));
  reset role;
  return v_board;
end;
$$;

-- Alice owns the room; Bob is a member; Eve is not in it.
select pg_temp.login('00000000-0000-0000-0000-00000000a11c');
select public.register_player('alice');
select set_config('test.room_id', (public.create_room('Alice room')->>'id'), true);
select set_config('test.room_code', (select room_code from public.rooms where id = pg_temp.setting('room_id')), true);
select pg_temp.login('00000000-0000-0000-0000-000000000b0b');
select public.register_player('bob');
select public.join_room(current_setting('test.room_code'));
select pg_temp.login('00000000-0000-0000-0000-000000000e7e');
select public.register_player('eve');

-- ------------------------------------------------------------
-- Suggesting
-- ------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-000000000b0b');
set local role authenticated;
select set_config('test.epl', (public.suggest_series(pg_temp.setting('room_id'), '  Premier   League ')->>'id'), true);
select public.suggest_series(pg_temp.setting('room_id'), 'NBA Playoffs');
select public.suggest_series(pg_temp.setting('room_id'), 'Wimbledon');
select throws_ok(
  format($$ select public.suggest_series(%L, 'Tour de France') $$, pg_temp.setting('room_id')),
  'P0001', null,
  'a player can have three open ideas at a time'
);
reset role;

select is(
  (select title from public.series_suggestions where id = pg_temp.setting('epl')),
  'Premier League',
  'titles are tidied up'
);
select is(
  (select (e->>'voted_by_me')::boolean
   from json_array_elements(pg_temp.board('00000000-0000-0000-0000-000000000b0b')) e
   where e->>'id' = current_setting('test.epl')),
  true,
  'suggesting an idea backs it'
);

-- Alice suggests the same idea in other capitals: it becomes her vote.
select pg_temp.login('00000000-0000-0000-0000-00000000a11c');
set local role authenticated;
select is(
  (public.suggest_series(pg_temp.setting('room_id'), 'premier league')->>'existing')::boolean,
  true,
  'suggesting an idea already on the board backs it instead'
);
reset role;
select is(
  (select count(*)::int from public.series_suggestions where room_id = pg_temp.setting('room_id')),
  3,
  'no duplicate idea is created'
);
select is(
  (pg_temp.board('00000000-0000-0000-0000-00000000a11c')->0->>'vote_count')::int,
  2,
  'the most backed idea comes first'
);

-- ------------------------------------------------------------
-- Voting
-- ------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000a11c');
set local role authenticated;
select is(public.toggle_series_suggestion_vote(pg_temp.setting('epl')), false, 'voting again takes the vote back');
select is(public.toggle_series_suggestion_vote(pg_temp.setting('epl')), true, 'and voting once more backs it again');
reset role;

-- ------------------------------------------------------------
-- Who sees voters
-- ------------------------------------------------------------
select is(
  (pg_temp.board('00000000-0000-0000-0000-00000000a11c')->0->'voters')::text,
  '["alice", "bob"]',
  'organizers see who backed an idea'
);
select is(
  (pg_temp.board('00000000-0000-0000-0000-000000000b0b')->0->'voters')::text,
  'null',
  'players see only the count'
);

select pg_temp.login('00000000-0000-0000-0000-000000000e7e');
set local role authenticated;
select throws_ok(
  format($$ select public.get_series_suggestions(%L) $$, pg_temp.setting('room_id')),
  'P0011', null,
  'non-members cannot see the board'
);
reset role;

-- ------------------------------------------------------------
-- Removing and starting a series from an idea
-- ------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-000000000b0b');
set local role authenticated;
select throws_ok(
  format($$ select public.mark_series_suggestion_played(%L, gen_random_uuid()) $$, pg_temp.setting('epl')),
  'P0012', null,
  'only organizers start a series from an idea'
);
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000a11c');
set local role authenticated;
select set_config('test.series', (public.create_series(pg_temp.setting('room_id'), 'Premier League')->>'id'), true);
select public.mark_series_suggestion_played(pg_temp.setting('epl'), pg_temp.setting('series'));
reset role;

select is(
  (select status from public.series_suggestions where id = pg_temp.setting('epl')),
  'played',
  'an idea that became a series leaves the board'
);

select pg_temp.login('00000000-0000-0000-0000-00000000a11c');
set local role authenticated;
select public.remove_series_suggestion((pg_temp.board('00000000-0000-0000-0000-00000000a11c')->0->>'id')::uuid);
reset role;
select is(
  json_array_length(pg_temp.board('00000000-0000-0000-0000-00000000a11c')),
  1,
  'an organizer can take an idea down'
);

select * from finish();
rollback;
