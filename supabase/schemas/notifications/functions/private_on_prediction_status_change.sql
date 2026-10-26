create or replace function private.on_prediction_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_room_name text;
  v_room_code text;
  v_series_title text;
  v_series_prediction_number integer;
  v_extra_payload jsonb;
begin
  select name, room_code into v_room_name, v_room_code from public.rooms where id = NEW.room_id;
  select s.title into v_series_title from public.series s where s.id = NEW.series_id;
  v_series_prediction_number := NEW.series_prediction_number;
  v_extra_payload := jsonb_build_object(
    'predictionId', NEW.id,
    'predictionTitle', NEW.title,
    'seriesId', NEW.series_id,
    'seriesTitle', v_series_title,
    'seriesPredictionNumber', v_series_prediction_number
  );

  -- New prediction published (draft = live for betting)
  if TG_OP = 'INSERT' and NEW.status = 'draft' then
    perform private.fire_push_notification(
      'prediction_live',
      NEW.id,
      NEW.room_id,
      '🎯 New Prediction',
      coalesce(v_room_name, 'Your room') || ' · ' || NEW.title,
      '/rooms/' || v_room_code || '/predictions/' || NEW.id::text,
      v_extra_payload
    );

  -- Organizer (or cron) locked the prediction
  elsif TG_OP = 'UPDATE'
    and OLD.status = 'draft'
    and NEW.status = 'locked'
  then
    perform private.fire_push_notification(
      'prediction_locked',
      NEW.id,
      NEW.room_id,
      '🔒 Betting Closed',
      coalesce(v_room_name, 'Your room') || ' · ' || NEW.title,
      '/rooms/' || v_room_code || '/predictions/' || NEW.id::text,
      v_extra_payload
    );

  -- Staff closed the prediction (win, no_result, or cancelled). Open
  -- predictions can be cancelled too, which refunds everyone.
  elsif TG_OP = 'UPDATE'
    and (
      (OLD.status = 'locked' and NEW.status in ('revealed', 'no_result', 'cancelled'))
      or (OLD.status = 'draft' and NEW.status = 'cancelled')
    )
  then
    perform private.fire_push_notification(
      'result_revealed',
      NEW.id,
      NEW.room_id,
      '🏆 Result Is In',
      coalesce(v_room_name, 'Your room') || ' · ' || NEW.title,
      '/rooms/' || v_room_code || '/predictions/' || NEW.id::text,
      v_extra_payload
    );
  end if;

  return NEW;
end;
$$;
