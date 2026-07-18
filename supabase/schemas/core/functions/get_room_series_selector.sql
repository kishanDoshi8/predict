create or replace function public.get_room_series_selector(
  p_room_id uuid,
  p_selected_series_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_active_count integer := 0;
  v_options json := '[]'::json;
  v_selected_series_id uuid;
  v_latest_completed_series_id uuid;
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

  select count(*)::int
  into v_active_count
  from public.series s
  where s.room_id = p_room_id
    and s.status = 'active';

  if v_active_count > 0 then
    select coalesce(
      json_agg(
        json_build_object(
          'id', s.id,
          'title', s.title,
          'status', s.status,
          'started_at', s.started_at,
          'completed_at', s.completed_at,
          'created_at', s.created_at
        )
        order by s.started_at desc nulls last, s.created_at desc
      ),
      '[]'::json
    )
    into v_options
    from public.series s
    where s.room_id = p_room_id
      and s.status = 'active';

    if p_selected_series_id is not null
      and exists (
        select 1
        from public.series s
        where s.id = p_selected_series_id
          and s.room_id = p_room_id
          and s.status = 'active'
      ) then
      v_selected_series_id := p_selected_series_id;
    else
      select s.id
      into v_selected_series_id
      from public.series s
      where s.room_id = p_room_id
        and s.status = 'active'
      order by s.started_at desc nulls last, s.created_at desc
      limit 1;
    end if;
  else
    select coalesce(
      json_agg(
        json_build_object(
          'id', s.id,
          'title', s.title,
          'status', s.status,
          'started_at', s.started_at,
          'completed_at', s.completed_at,
          'created_at', s.created_at
        )
      ),
      '[]'::json
    )
    into v_options
    from (
      select s.*
      from public.series s
      where s.room_id = p_room_id
        and s.status = 'completed'
      order by s.completed_at desc nulls last, s.created_at desc
      limit 1
    ) s;

    select s.id
    into v_latest_completed_series_id
    from public.series s
    where s.room_id = p_room_id
      and s.status = 'completed'
    order by s.completed_at desc nulls last, s.created_at desc
    limit 1;

    if p_selected_series_id is not null
      and p_selected_series_id = v_latest_completed_series_id then
      v_selected_series_id := p_selected_series_id;
    else
      v_selected_series_id := v_latest_completed_series_id;
    end if;
  end if;

  return json_build_object(
    'selected_series_id', v_selected_series_id,
    'series', v_options
  );
end;
$$;
