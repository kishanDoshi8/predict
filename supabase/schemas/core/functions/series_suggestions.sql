-- The room's open ideas for its next series, most backed first. Organizers
-- also see who backed each one.
create or replace function public.get_series_suggestions(
  p_room_id uuid
)
returns json
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_role text;
  v_result json;
begin
  v_player_id := private.get_player_id_from_auth();

  select rm.role into v_role
  from public.room_members rm
  where rm.room_id = p_room_id and rm.player_id = v_player_id;

  if v_role is null then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  select coalesce(json_agg(row_to_json(s) order by s.vote_count desc, s.created_at asc), '[]'::json)
  into v_result
  from (
    select
      ss.id,
      ss.title,
      ss.created_at,
      author.username as created_by_username,
      ss.created_by = v_player_id as created_by_me,
      (select count(*)::int from public.series_suggestion_votes v where v.suggestion_id = ss.id) as vote_count,
      exists (
        select 1 from public.series_suggestion_votes v
        where v.suggestion_id = ss.id and v.player_id = v_player_id
      ) as voted_by_me,
      case when v_role in ('owner', 'organizer') then (
        select coalesce(json_agg(p.username order by p.username), '[]'::json)
        from public.series_suggestion_votes v
        join public.players p on p.id = v.player_id
        where v.suggestion_id = ss.id
      ) end as voters
    from public.series_suggestions ss
    join public.players author on author.id = ss.created_by
    where ss.room_id = p_room_id
      and ss.status = 'open'
  ) s;

  return v_result;
end;
$$;

-- Suggests an idea and backs it. If the same idea is already on the board,
-- backs that one instead. Each player can have three open ideas at a time.
create or replace function public.suggest_series(
  p_room_id uuid,
  p_title text
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_title text := regexp_replace(trim(coalesce(p_title, '')), '\s+', ' ', 'g');
  v_suggestion_id uuid;
begin
  v_player_id := private.get_player_id_from_auth();

  if not private.is_room_member(p_room_id) then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  if char_length(v_title) = 0 or char_length(v_title) > 60 then
    raise exception 'Keep the idea between 1 and 60 characters' using errcode = 'P0001';
  end if;

  select ss.id into v_suggestion_id
  from public.series_suggestions ss
  where ss.room_id = p_room_id
    and ss.status = 'open'
    and lower(ss.title) = lower(v_title);

  if v_suggestion_id is not null then
    insert into public.series_suggestion_votes (suggestion_id, player_id)
    values (v_suggestion_id, v_player_id)
    on conflict do nothing;
    return json_build_object('id', v_suggestion_id, 'existing', true);
  end if;

  if (
    select count(*) from public.series_suggestions ss
    where ss.room_id = p_room_id and ss.created_by = v_player_id and ss.status = 'open'
  ) >= 3 then
    raise exception 'You already have 3 ideas up. Remove one to add another.' using errcode = 'P0001';
  end if;

  insert into public.series_suggestions (room_id, title, created_by)
  values (p_room_id, v_title, v_player_id)
  returning id into v_suggestion_id;

  insert into public.series_suggestion_votes (suggestion_id, player_id)
  values (v_suggestion_id, v_player_id);

  return json_build_object('id', v_suggestion_id, 'existing', false);
end;
$$;

-- Backs an idea, or takes the vote back. Returns whether it's now backed.
create or replace function public.toggle_series_suggestion_vote(
  p_suggestion_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_room_id uuid;
begin
  v_player_id := private.get_player_id_from_auth();

  select ss.room_id into v_room_id
  from public.series_suggestions ss
  where ss.id = p_suggestion_id and ss.status = 'open';

  if v_room_id is null or not private.is_room_member(v_room_id) then
    raise exception 'Idea not found' using errcode = 'P0002';
  end if;

  delete from public.series_suggestion_votes
  where suggestion_id = p_suggestion_id and player_id = v_player_id;

  if found then
    return false;
  end if;

  insert into public.series_suggestion_votes (suggestion_id, player_id)
  values (p_suggestion_id, v_player_id);
  return true;
end;
$$;

-- Takes an idea off the board: its author or an organizer.
create or replace function public.remove_series_suggestion(
  p_suggestion_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
begin
  v_player_id := private.get_player_id_from_auth();

  update public.series_suggestions ss
  set status = 'removed'
  where ss.id = p_suggestion_id
    and ss.status = 'open'
    and (
      ss.created_by = v_player_id
      or exists (
        select 1 from public.room_members rm
        where rm.room_id = ss.room_id
          and rm.player_id = v_player_id
          and rm.role in ('owner', 'organizer')
      )
    );

  if not found then
    raise exception 'Only the idea''s author or an organizer can remove it' using errcode = 'P0012';
  end if;
end;
$$;

-- An organizer started a series from an idea: it leaves the board.
create or replace function public.mark_series_suggestion_played(
  p_suggestion_id uuid,
  p_series_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
begin
  v_player_id := private.get_player_id_from_auth();

  update public.series_suggestions ss
  set status = 'played', series_id = p_series_id
  where ss.id = p_suggestion_id
    and ss.status = 'open'
    and exists (
      select 1 from public.series s
      where s.id = p_series_id and s.room_id = ss.room_id
    )
    and exists (
      select 1 from public.room_members rm
      where rm.room_id = ss.room_id
        and rm.player_id = v_player_id
        and rm.role in ('owner', 'organizer')
    );

  if not found then
    raise exception 'Only organizers can start a series from an idea' using errcode = 'P0012';
  end if;

  delete from public.series_suggestion_votes where suggestion_id = p_suggestion_id;
end;
$$;
