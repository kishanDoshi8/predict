begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

-- Alice runs a room; Bob joins from a brag card; Carol from a bad link; Dave never joins.
insert into auth.users (id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000a11c', 'authenticated', 'authenticated', 'alice@example.com'),
  ('00000000-0000-0000-0000-000000000b0b', 'authenticated', 'authenticated', 'bob@example.com'),
  ('00000000-0000-0000-0000-00000000ca01', 'authenticated', 'authenticated', 'carol@example.com'),
  ('00000000-0000-0000-0000-00000000da7e', 'authenticated', 'authenticated', 'dave@example.com');

create function pg_temp.login(p_user_id uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claim.sub', p_user_id::text, true);
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.joined_via(p_username text)
returns text
language sql
as $$
  select rm.joined_via
  from public.room_members rm
  join public.players p on p.id = rm.player_id
  where p.username = p_username
$$;

select pg_temp.login('00000000-0000-0000-0000-00000000a11c');
set local role authenticated;
select public.register_player('alice');
select set_config('test.room_id', (public.create_room('Alice room')->>'id'), true);
reset role;
select set_config('test.room_code', (select room_code from public.rooms where id = current_setting('test.room_id')::uuid), true);

select pg_temp.login('00000000-0000-0000-0000-000000000b0b');
set local role authenticated;
select public.register_player('bob');
select public.join_room(current_setting('test.room_code'), 'Brag-Card');
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000ca01');
set local role authenticated;
select public.register_player('carol');
select public.join_room(current_setting('test.room_code'), 'x"; drop table rooms; --');
reset role;

select is(pg_temp.joined_via('bob'), 'brag-card', 'joining from a shared link records where it came from');
select is(pg_temp.joined_via('carol'), null, 'a malformed ref is dropped');
select is(pg_temp.joined_via('alice'), null, 'the organizer has no ref');

-- Sharing
select pg_temp.login('00000000-0000-0000-0000-000000000b0b');
set local role authenticated;
select lives_ok(
  format($$ select public.record_share(%L, 'brag-card') $$, current_setting('test.room_id')),
  'a member can record a share'
);
select throws_ok(
  format($$ select public.record_share(%L, 'Not A Kind!') $$, current_setting('test.room_id')),
  'P0001', null,
  'share kinds are validated'
);
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000da7e');
set local role authenticated;
select public.register_player('dave');
select throws_ok(
  format($$ select public.record_share(%L, 'brag-card') $$, current_setting('test.room_id')),
  'P0013', null,
  'non-members cannot record shares'
);
select throws_ok(
  $$ select count(*) from public.share_events $$,
  '42501', null,
  'share events are not readable by players'
);
reset role;

-- Invite previews: counts only, and only for the server
select is(
  (public.get_room_invite_preview(lower(current_setting('test.room_code')))->>'member_count')::int,
  3,
  'the preview counts members'
);
select is(
  (select count(*)::int from json_object_keys(public.get_room_invite_preview(current_setting('test.room_code')))),
  5,
  'the preview carries only name, code, counts and series'
);
select is(public.get_room_invite_preview('NOPE00')::text, null, 'an unknown code has no preview');

select pg_temp.login('00000000-0000-0000-0000-000000000b0b');
set local role authenticated;
select throws_ok(
  format($$ select public.get_room_invite_preview(%L) $$, current_setting('test.room_code')),
  '42501', null,
  'players cannot call the invite preview'
);
reset role;

select * from finish();
rollback;
