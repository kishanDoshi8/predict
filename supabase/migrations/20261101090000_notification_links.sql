-- ============================================================
-- Migration: notification_links
-- Description: Prediction pushes linked to /room/<uuid>, which isn't a
--   route, so tapping one showed the 404 page. They now open the
--   prediction: /rooms/<code>/predictions/<id>.
-- ============================================================

CREATE OR REPLACE FUNCTION private.on_prediction_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION private.fire_push_notification_for_deadline_1h()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_now       timestamptz := now();
  v_rec       record;
  v_room_name text;
  v_room_code text;
begin
  for v_rec in
    select
      p.id,
      p.room_id,
      p.title,
      p.series_id,
      p.series_prediction_number,
      s.title as series_title
    from public.predictions p
    left join public.series s on s.id = p.series_id
    where p.status     = 'draft'
      and p.notified_1h = false
      and p.deadline between v_now and v_now + interval '1 hour'
  loop
    select name, room_code into v_room_name, v_room_code from public.rooms where id = v_rec.room_id;

    -- Mark first so a concurrent run does not double-send.
    update public.predictions
    set notified_1h = true
    where id = v_rec.id
      and notified_1h = false;   -- guard against race

    if found then
      perform private.fire_push_notification(
        'deadline_1h',
        v_rec.id,
        v_rec.room_id,
        '⏰ 1 Hour Left to Bet!',
        coalesce(v_room_name, 'Your room') || ' · ' || v_rec.title,
        '/rooms/' || v_room_code || '/predictions/' || v_rec.id::text,
        jsonb_build_object(
          'predictionId', v_rec.id,
          'predictionTitle', v_rec.title,
          'seriesId', v_rec.series_id,
          'seriesTitle', v_rec.series_title,
          'seriesPredictionNumber', v_rec.series_prediction_number
        )
      );
    end if;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION private.fire_push_notification_for_result_needed()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_rec record;
begin
  for v_rec in
    select
      p.id,
      p.room_id,
      p.title,
      p.series_id,
      p.series_prediction_number,
      s.title as series_title,
      r.name as room_name,
      r.room_code
    from public.predictions p
    join public.rooms r on r.id = p.room_id
    left join public.series s on s.id = p.series_id
    where p.status = 'locked'
      and p.notified_result_needed = false
      and p.deadline + make_interval(hours => r.result_reminder_hours) <= now()
  loop
    -- Mark first so a concurrent run does not double-send.
    update public.predictions
    set notified_result_needed = true
    where id = v_rec.id
      and notified_result_needed = false;

    if found then
      perform private.fire_push_notification(
        'result_needed',
        v_rec.id,
        v_rec.room_id,
        '⚑ Result needed',
        coalesce(v_rec.room_name, 'Your room') || ' · ' || v_rec.title,
        '/rooms/' || v_rec.room_code || '/predictions/' || v_rec.id::text,
        jsonb_build_object(
          'predictionId', v_rec.id,
          'predictionTitle', v_rec.title,
          'seriesId', v_rec.series_id,
          'seriesTitle', v_rec.series_title,
          'seriesPredictionNumber', v_rec.series_prediction_number,
          -- Only staff get this one.
          'roles', jsonb_build_array('owner', 'organizer', 'resolver')
        )
      );
    end if;
  end loop;
end;
$function$;
