create or replace function public.create_series(
  p_room_id uuid,
  p_title text,
  p_description text default null,
  p_expected_games integer default 0
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_member public.room_members%rowtype;
  v_series public.series%rowtype;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  select * into v_member
  from public.room_members
  where room_id = p_room_id
    and player_id = v_player_id
    and is_organizer = true;

  if not found then
    raise exception 'Only the organizer can manage series' using errcode = 'P0012';
  end if;

  if length(trim(p_title)) = 0 then
    raise exception 'Series title cannot be empty' using errcode = 'P0001';
  end if;

  if p_expected_games < 0 then
    raise exception 'Expected games cannot be negative' using errcode = 'P0001';
  end if;

  insert into public.series (
    room_id,
    title,
    status,
    description,
    expected_games,
    created_by
  )
  values (
    p_room_id,
    trim(p_title),
    'active',
    nullif(trim(coalesce(p_description, '')), ''),
    p_expected_games,
    v_player_id
  )
  returning * into v_series;

  return row_to_json(v_series);
end;
$$;
