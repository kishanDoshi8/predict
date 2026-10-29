begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

insert into auth.users (id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000a11c', 'authenticated', 'authenticated', 'alice@example.com'),
  ('00000000-0000-0000-0000-000000000b0b', 'authenticated', 'authenticated', 'bob@example.com');

create function pg_temp.login(p_user_id uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claim.sub', p_user_id::text, true);
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.owner()
returns text
language sql
as $$
  select p.username::text
  from public.user_push_subscriptions s
  join public.players p on p.id = s.user_id
  where s.subscription->>'endpoint' = 'https://push.example.com/device-1'
$$;

select pg_temp.login('00000000-0000-0000-0000-00000000a11c');
set local role authenticated;
select public.register_player('alice');
select public.upsert_user_push_subscription('{"endpoint": "https://push.example.com/device-1", "keys": {"p256dh": "a", "auth": "b"}}');
reset role;

select is(pg_temp.owner(), 'alice', 'a device subscribes for the signed-in player');

-- Bob signs in on the same phone: the endpoint moves to him.
select pg_temp.login('00000000-0000-0000-0000-000000000b0b');
set local role authenticated;
select public.register_player('bob');
select lives_ok(
  $$ select public.upsert_user_push_subscription('{"endpoint": "https://push.example.com/device-1", "keys": {"p256dh": "c", "auth": "d"}}') $$,
  'a second account on the same device can subscribe'
);
reset role;

select is(pg_temp.owner(), 'bob', 'the endpoint now belongs to whoever is signed in');
select is(
  (select count(*)::int from public.user_push_subscriptions),
  1,
  'one endpoint stays one row'
);

-- Alice can't remove Bob's device; Bob signing out does.
select pg_temp.login('00000000-0000-0000-0000-00000000a11c');
set local role authenticated;
select public.delete_my_push_subscription('https://push.example.com/device-1');
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000b0b');
set local role authenticated;
select public.delete_my_push_subscription('https://push.example.com/device-1');
reset role;

select is(
  (select count(*)::int from public.user_push_subscriptions),
  0,
  'signing out removes only your own device'
);

select * from finish();
rollback;
