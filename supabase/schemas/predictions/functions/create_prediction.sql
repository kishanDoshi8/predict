create or replace function public.create_prediction(
  p_room_id  uuid,
  p_title    text,
  p_options  text[],
  p_deadline timestamptz
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
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  -- Verify caller is the room organizer
  select * into v_member
  from public.room_members
  where room_id = p_room_id
    and player_id = v_player_id
    and is_organizer = true;

  if not found then
    raise exception 'Only the organizer can create predictions' using errcode = 'P0012';
  end if;

  -- Fetch room to get the predictions_limit
  select * into v_room
  from public.rooms
  where id = p_room_id and status = 'active';

  if not found then
    raise exception 'Room not found or closed' using errcode = 'P0002';
  end if;

  v_predictions_limit := v_room.predictions_limit;

  -- Count currently active (draft or locked) predictions for this room
  select count(*) into v_active_count
  from public.predictions
  where room_id = p_room_id
    and status in ('draft', 'locked');

  if v_active_count >= v_predictions_limit then
    raise exception 'Active predictions limit reached (% / %). Resolve or cancel one first.',
      v_active_count, v_predictions_limit
    using errcode = 'P0005';
  end if;

  -- Validate options count
  if array_length(p_options, 1) < 2 or array_length(p_options, 1) > 6 then
    raise exception 'Predictions must have between 2 and 6 options' using errcode = 'P0001';
  end if;

  if length(trim(p_title)) = 0 then
    raise exception 'Prediction title cannot be empty' using errcode = 'P0001';
  end if;

  if p_deadline <= now() then
    raise exception 'Deadline must be in the future' using errcode = 'P0001';
  end if;

  -- Create the prediction
  insert into public.predictions (room_id, created_by, title, deadline)
  values (p_room_id, v_player_id, trim(p_title), p_deadline)
  returning * into v_prediction;

  -- Create options
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
    'room_id',       p_room_id
  );
end;
$$;
