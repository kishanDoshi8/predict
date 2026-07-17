drop function if exists public.create_prediction(uuid, text, text[], timestamptz);

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
    description,
    expected_games,
    created_by
  )
  values (
    p_room_id,
    trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    p_expected_games,
    v_player_id
  )
  returning * into v_series;

  return row_to_json(v_series);
end;
$$;

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

create or replace function public.activate_series(
  p_series_id uuid
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

  if v_series.status <> 'draft' then
    raise exception 'Only draft series can be activated' using errcode = 'P0001';
  end if;

  update public.series
  set
    status = 'active',
    started_at = now()
  where id = p_series_id
  returning * into v_series;

  return row_to_json(v_series);
end;
$$;

create or replace function public.complete_series(
  p_series_id uuid
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

  if v_series.status <> 'active' then
    raise exception 'Only active series can be completed' using errcode = 'P0001';
  end if;

  update public.series
  set
    status = 'completed',
    completed_at = now()
  where id = p_series_id
  returning * into v_series;

  return row_to_json(v_series);
end;
$$;

create or replace function public.archive_series(
  p_series_id uuid
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

  if v_series.status <> 'completed' then
    raise exception 'Only completed series can be archived' using errcode = 'P0001';
  end if;

  update public.series
  set
    status = 'archived',
    archived_at = now()
  where id = p_series_id
  returning * into v_series;

  return row_to_json(v_series);
end;
$$;

create or replace function public.get_room_series(
  p_room_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_active json;
  v_completed json;
  v_archived json;
  v_draft json;
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

  select coalesce(json_agg(s.* order by s.started_at desc nulls last, s.created_at desc), '[]'::json)
    into v_active
  from public.series s
  where s.room_id = p_room_id
    and s.status = 'active';

  select coalesce(json_agg(s.* order by s.completed_at desc nulls last, s.created_at desc), '[]'::json)
    into v_completed
  from public.series s
  where s.room_id = p_room_id
    and s.status = 'completed';

  select coalesce(json_agg(s.* order by s.archived_at desc nulls last, s.created_at desc), '[]'::json)
    into v_archived
  from public.series s
  where s.room_id = p_room_id
    and s.status = 'archived';

  select coalesce(json_agg(s.* order by s.created_at desc), '[]'::json)
    into v_draft
  from public.series s
  where s.room_id = p_room_id
    and s.status = 'draft';

  return json_build_object(
    'draft', v_draft,
    'active', v_active,
    'completed', v_completed,
    'archived', v_archived
  );
end;
$$;

create or replace function public.create_prediction(
  p_room_id  uuid,
  p_title    text,
  p_options  text[],
  p_deadline timestamptz,
  p_series_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id       uuid;
  v_member          public.room_members%rowtype;
  v_room            public.rooms%rowtype;
  v_prediction      public.predictions%rowtype;
  v_option          public.prediction_options%rowtype;
  v_option_ids      uuid[] := '{}';
  v_label           text;
  v_i               int;
  v_active_count    int;
  v_predictions_limit int;
  v_series          public.series%rowtype;
  v_series_prediction_number int;
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
    raise exception 'Only the organizer can create predictions' using errcode = 'P0012';
  end if;

  select * into v_room
  from public.rooms
  where id = p_room_id and status = 'active';

  if not found then
    raise exception 'Room not found or closed' using errcode = 'P0002';
  end if;

  v_predictions_limit := v_room.predictions_limit;

  select count(*) into v_active_count
  from public.predictions
  where room_id = p_room_id
    and status in ('draft', 'locked');

  if v_active_count >= v_predictions_limit then
    raise exception 'Active predictions limit reached (% / %). Resolve or cancel one first.',
      v_active_count, v_predictions_limit
    using errcode = 'P0005';
  end if;

  if coalesce(array_length(p_options, 1), 0) < 2 or array_length(p_options, 1) > 6 then
    raise exception 'Predictions must have between 2 and 6 options' using errcode = 'P0001';
  end if;

  if length(trim(p_title)) = 0 then
    raise exception 'Prediction title cannot be empty' using errcode = 'P0001';
  end if;

  if p_deadline <= now() then
    raise exception 'Deadline must be in the future' using errcode = 'P0001';
  end if;

  if p_series_id is not null then
    select * into v_series
    from public.series
    where id = p_series_id
      and room_id = p_room_id
    for update;

    if not found then
      raise exception 'Series not found for this room' using errcode = 'P0002';
    end if;

    if v_series.status <> 'active' then
      raise exception 'Predictions can only be assigned to active series' using errcode = 'P0001';
    end if;

    select coalesce(max(series_prediction_number), 0) + 1
      into v_series_prediction_number
    from public.predictions
    where series_id = p_series_id;
  else
    v_series_prediction_number := null;
  end if;

  insert into public.predictions (
    room_id,
    series_id,
    series_prediction_number,
    created_by,
    title,
    deadline
  )
  values (
    p_room_id,
    p_series_id,
    v_series_prediction_number,
    v_player_id,
    trim(p_title),
    p_deadline
  )
  returning * into v_prediction;

  if p_series_id is not null then
    update public.series
    set prediction_count = prediction_count + 1
    where id = p_series_id;
  end if;

  v_i := 1;
  foreach v_label in array p_options loop
    if length(trim(v_label)) = 0 then
      raise exception 'Option labels cannot be empty' using errcode = 'P0001';
    end if;

    insert into public.prediction_options (prediction_id, label, display_order)
    values (v_prediction.id, trim(v_label), v_i - 1)
    returning * into v_option;

    v_option_ids := v_option_ids || v_option.id;
    v_i := v_i + 1;
  end loop;

  perform private.create_room_activity(
    p_room_id := p_room_id,
    p_activity_type := 'prediction_created',
    p_activity_tier := 2,
    p_metadata := private.build_prediction_activity_metadata(v_prediction.id),
    p_click_action := jsonb_build_object(
      'type', 'prediction',
      'predictionId', v_prediction.id
    ),
    p_created_by_player_id := v_player_id,
    p_dedupe_key := 'prediction_created:' || v_prediction.id::text
  );

  return json_build_object(
    'prediction_id', v_prediction.id,
    'title',         v_prediction.title,
    'status',        v_prediction.status,
    'deadline',      v_prediction.deadline,
    'option_ids',    v_option_ids,
    'room_id',       p_room_id,
    'series_id', v_prediction.series_id,
    'series_prediction_number', v_prediction.series_prediction_number
  );
end;
$$;

grant execute on function public.create_prediction(uuid, text, text[], timestamptz, uuid) to authenticated;
grant execute on function public.create_series(uuid, text, text, integer) to authenticated;
grant execute on function public.update_series(uuid, text, text, integer) to authenticated;
grant execute on function public.activate_series(uuid) to authenticated;
grant execute on function public.complete_series(uuid) to authenticated;
grant execute on function public.archive_series(uuid) to authenticated;
grant execute on function public.get_room_series(uuid) to authenticated;
