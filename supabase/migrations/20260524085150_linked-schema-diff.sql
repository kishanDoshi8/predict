CREATE OR REPLACE FUNCTION private.fire_push_notification_for_deadline_1h()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$declare
  v_now       timestamptz := now();
  v_rec       record;
  v_room_name text;
  v_room_code text;
begin
  for v_rec in
    select id, room_id, title
    from public.predictions
    where status     = 'draft'
      and notified_1h = false
      and deadline between v_now and v_now + interval '1 hour'
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
        '/rooms/' || v_room_code
      );
    end if;
  end loop;
end;$function$
;

CREATE OR REPLACE FUNCTION private.on_prediction_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$declare
  v_room_name text;
  v_room_code text;
begin
  select name into v_room_name from public.rooms where id = NEW.room_id;
  select room_code into v_room_code from public.rooms where id = NEW.room_id;

  -- New prediction published (draft = live for betting)
  if TG_OP = 'INSERT' and NEW.status = 'draft' then
    perform private.fire_push_notification(
      'prediction_live',
      NEW.id,
      NEW.room_id,
      '🎯 New Prediction',
      coalesce(v_room_name, 'Your room') || ' · ' || NEW.title,
      '/rooms/' || v_room_code
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
      '/rooms/' || v_room_code
    );

  -- Organizer revealed the result (win, no_result, or cancel)
  elsif TG_OP = 'UPDATE'
    and OLD.status = 'locked'
    and NEW.status in ('revealed', 'no_result', 'cancel')
  then
    perform private.fire_push_notification(
      'result_revealed',
      NEW.id,
      NEW.room_id,
      '🏆 Result Is In',
      coalesce(v_room_name, 'Your room') || ' · ' || NEW.title,
      '/rooms/' || v_room_code
    );
  end if;

  return NEW;
end;$function$
;