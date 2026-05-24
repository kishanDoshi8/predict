create or replace function private.fire_push_notification_for_deadline_1h()
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_now       timestamptz := now();
  v_rec       record;
  v_room_name text;
begin
  for v_rec in
    select id, room_id, title
    from public.predictions
    where status     = 'draft'
      and notified_1h = false
      and deadline between v_now and v_now + interval '1 hour'
  loop
    select name into v_room_name from public.rooms where id = v_rec.room_id;

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
        '/room/' || v_rec.room_id::text
      );
    end if;
  end loop;
end;
$$;
