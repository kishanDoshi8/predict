-- ============================================================
-- Migration: share_tracking
-- Description: Shared links carry ?ref=<kind>. Joining stores it on the
--   membership, and each completed share is logged, so we can see which
--   shareables bring people in.
-- ============================================================

alter table public.room_members
  add column if not exists joined_via text;

-- One row each time a player shares something from a room, so we can see
-- which shareables get used. Written only through public.record_share.
create table if not exists public.share_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  kind text not null check (kind ~ '^[a-z][a-z-]{0,31}$'),
  created_at timestamptz not null default now()
);
create index if not exists idx_share_events_room_created on public.share_events(room_id, created_at desc);

alter table public.share_events enable row level security;
revoke all on public.share_events from anon, authenticated;

-- join_room gains an optional ref; the old one-argument version is replaced.
drop function if exists public.join_room(text);

create or replace function public.join_room(
  p_room_code text,
  p_ref text default null
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_player    public.players%rowtype;
  v_room      public.rooms%rowtype;
  v_member    public.room_members%rowtype;
  v_was_inserted boolean := false;
  v_ref       text;
begin
  -- Which shared link brought them in, e.g. "brag-card"; anything else is dropped.
  v_ref := lower(trim(p_ref));
  if v_ref !~ '^[a-z][a-z-]{0,31}$' then
    v_ref := null;
  end if;

  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  select * into v_player from public.players where id = v_player_id;

  select * into v_room
  from public.rooms
  where room_code = upper(trim(p_room_code))
    and status = 'active';

  if not found then
    raise exception 'Room not found or closed' using errcode = 'P0002';
  end if;

  insert into public.room_members (room_id, player_id, is_organizer, joined_via)
  values (v_room.id, v_player_id, false, v_ref)
  on conflict (room_id, player_id) do nothing
  returning * into v_member;

  if found then
    v_was_inserted := true;
  else
    select * into v_member
    from public.room_members
    where room_id = v_room.id and player_id = v_player_id;
  end if;

  if v_was_inserted then
    perform private.ensure_series_wallet(s.id, v_player_id)
    from public.series s
    where s.room_id = v_room.id
      and s.status = 'active';

    perform private.create_room_activity(
      p_room_id := v_room.id,
      p_activity_type := 'room_joined',
      p_activity_tier := 2,
      p_metadata := jsonb_build_object(
        'member', jsonb_build_object(
          'id', v_player.id,
          'username', v_player.username
        )
      ),
      p_created_by_player_id := v_player.id,
      p_dedupe_key := 'room_joined:' || v_room.id::text || ':' || v_player.id::text
    );
  end if;

  return json_build_object(
    'id',           v_room.id,
    'code',         v_room.room_code,
    'name',         v_room.name,
    'status',       v_room.status,
    'player_id',    v_player_id,
    'username',     v_player.username,
    'is_organizer', v_member.is_organizer,
    'created_at',   v_room.created_at
  );
end;
$$;

create or replace function public.record_share(
  p_room_id uuid,
  p_kind text
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_kind text := lower(trim(p_kind));
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null or not private.is_room_member(p_room_id) then
    raise exception 'Only room members can share from this room' using errcode = 'P0013';
  end if;

  if v_kind is null or v_kind !~ '^[a-z][a-z-]{0,31}$' then
    raise exception 'Unknown share kind' using errcode = 'P0001';
  end if;

  insert into public.share_events (room_id, player_id, kind)
  values (p_room_id, v_player_id, v_kind);
end;
$$;

revoke execute on function public.join_room(text, text) from public, anon, authenticated;
revoke execute on function public.record_share(uuid, text) from public, anon, authenticated;
grant execute on function public.join_room(text, text) to authenticated;
grant execute on function public.record_share(uuid, text) to authenticated;
