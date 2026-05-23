create or replace function public.lock_prediction(
  p_prediction_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id  uuid;
  v_prediction public.predictions%rowtype;
  v_member     public.room_members%rowtype;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  select * into v_prediction
  from public.predictions
  where id = p_prediction_id
    and status = 'draft';

  if not found then
    raise exception 'Prediction not found or not in draft phase' using errcode = 'P0006';
  end if;

  select * into v_member
  from public.room_members
  where room_id = v_prediction.room_id
    and player_id = v_player_id
    and is_organizer = true;

  if not found then
    raise exception 'Only the organizer can lock this prediction' using errcode = 'P0012';
  end if;

  update public.predictions
  set status = 'locked'
  where id = v_prediction.id
  returning * into v_prediction;

  return json_build_object(
    'locked',        true,
    'prediction_id', v_prediction.id
  );
end;
$$;
