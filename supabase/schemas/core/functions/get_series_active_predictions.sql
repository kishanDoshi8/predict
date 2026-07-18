create or replace function public.get_series_active_predictions(
  p_room_id uuid,
  p_series_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_result json;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  if not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.player_id = v_player_id
  ) then
    raise exception 'Room member not found' using errcode = 'P0011';
  end if;

  if not exists (
    select 1
    from public.series s
    where s.id = p_series_id
      and s.room_id = p_room_id
  ) then
    raise exception 'Series not found for this room' using errcode = 'P0002';
  end if;

  select coalesce(json_agg(p order by p.deadline asc), '[]'::json)
    into v_result
  from (
    select
      pred.*,
      s.title as series_title
    from public.predictions pred
    join public.series s on s.id = pred.series_id
    where pred.room_id = p_room_id
      and pred.series_id = p_series_id
      and pred.status in ('draft', 'locked')
  ) p;

  return v_result;
end;
$$;
