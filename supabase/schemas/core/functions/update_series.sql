create or replace function public.update_series(
  p_series_id uuid,
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
  v_series public.series%rowtype;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  select s.* into v_series
  from public.series s
  join public.room_members rm
    on rm.room_id = s.room_id
   and rm.player_id = v_player_id
   and rm.is_organizer = true
  where s.id = p_series_id
  for update;

  if not found then
    raise exception 'Series not found or access denied' using errcode = 'P0002';
  end if;

  if v_series.status = 'archived' then
    raise exception 'Archived series are read-only' using errcode = 'P0001';
  end if;

  if length(trim(p_title)) = 0 then
    raise exception 'Series title cannot be empty' using errcode = 'P0001';
  end if;

  if p_expected_games < 0 then
    raise exception 'Expected games cannot be negative' using errcode = 'P0001';
  end if;

  update public.series
  set
    title = trim(p_title),
    description = nullif(trim(coalesce(p_description, '')), ''),
    expected_games = p_expected_games
  where id = p_series_id
  returning * into v_series;

  return row_to_json(v_series);
end;
$$;
