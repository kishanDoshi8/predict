-- ============================================================
-- Migration: 018_push_notification_triggers
-- Description:
--   Wire prediction lifecycle events to push notifications via
--   pg_net HTTP calls to the send-push-notifications Edge Function.
--
--   After applying this migration, populate the config table with
--   your project-specific values (see README §6):
--
--     insert into private.notification_config (key, value)
--     values
--       ('supabase_url',                'https://YOUR_PROJECT_REF.supabase.co'),
--       ('notification_function_secret', 'YOUR_NOTIFICATION_FUNCTION_SECRET'),
--       ('app_url',                      'https://YOUR_APP_URL')
--     on conflict (key) do update set value = excluded.value;
--
--   Then enable the cron jobs by running the commented-out
--   cron.schedule() calls at the bottom of this file once.
-- ============================================================


-- ============================================================
-- 1. pg_net — async HTTP from PostgreSQL
-- ============================================================

create extension if not exists pg_net with schema extensions;


-- ============================================================
-- 2. private.notification_config — secrets / base URLs
--    Populated by the operator post-migration; never exposed
--    through PostgREST (private schema is not routed).
-- ============================================================

create table if not exists private.notification_config (
  key   text primary key,
  value text not null
);

comment on table private.notification_config is
  'Runtime configuration for notification triggers. '
  'Required keys: supabase_url, notification_function_secret, app_url.';


-- ============================================================
-- 3. private.notification_dispatch_log — observability
--    Stores the pg_net request_id and payload for every
--    HTTP call fired by a DB trigger.  Check
--    net._http_response (pg_net's built-in table) for the
--    actual HTTP status code.
-- ============================================================

create table if not exists private.notification_dispatch_log (
  id              uuid        primary key default gen_random_uuid(),
  event_type      text        not null,
  prediction_id   uuid,
  room_id         uuid,
  http_request_id bigint,
  payload         jsonb       not null,
  created_at      timestamptz not null default now()
);

comment on table private.notification_dispatch_log is
  'Audit log of every push-notification HTTP call fired by DB triggers. '
  'Join on http_request_id → net._http_response to inspect HTTP results.';

create index if not exists idx_ndl_created_at
  on private.notification_dispatch_log (created_at desc);

create index if not exists idx_ndl_prediction_id
  on private.notification_dispatch_log (prediction_id)
  where prediction_id is not null;


-- ============================================================
-- 4. private.fire_push_notification
--    Core helper: looks up config, builds JSON payload, calls
--    the Edge Function asynchronously via pg_net, and writes
--    an audit row.  All errors are caught so that the calling
--    transaction is never aborted by a notification failure.
-- ============================================================

create or replace function private.fire_push_notification(
  p_event_type    text,
  p_prediction_id uuid,
  p_room_id       uuid,
  p_title         text,
  p_body          text,
  p_url_path      text
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_supabase_url text;
  v_secret       text;
  v_app_url      text;
  v_request_id   bigint;
  v_payload      jsonb;
begin
  select value into v_supabase_url
  from private.notification_config
  where key = 'supabase_url';

  select value into v_secret
  from private.notification_config
  where key = 'notification_function_secret';

  -- Skip silently when the operator has not yet populated the config.
  if v_supabase_url is null or v_secret is null then
    return;
  end if;

  select coalesce(value, '') into v_app_url
  from private.notification_config
  where key = 'app_url';

  v_payload := jsonb_build_object(
    'event_type', p_event_type,
    'room_id',    p_room_id,
    'payload', jsonb_build_object(
      'title', p_title,
      'body',  p_body,
      'url',   v_app_url || p_url_path
    )
  );

  select net.http_post(
    url     := v_supabase_url || '/functions/v1/send-push-notifications',
    headers := jsonb_build_object(
      'Content-Type',          'application/json',
      'x-notification-secret', v_secret
    ),
    body    := v_payload
  ) into v_request_id;

  insert into private.notification_dispatch_log
    (event_type, prediction_id, room_id, http_request_id, payload)
  values
    (p_event_type, p_prediction_id, p_room_id, v_request_id, v_payload);

exception when others then
  -- Log the failure without aborting the parent transaction.
  insert into private.notification_dispatch_log
    (event_type, prediction_id, room_id, http_request_id, payload)
  values (
    p_event_type,
    p_prediction_id,
    p_room_id,
    null,
    jsonb_build_object(
      'error',            sqlerrm,
      'original_payload', v_payload
    )
  );
end;
$$;


-- ============================================================
-- 5. Prediction lifecycle: track 1-hour deadline notification
-- ============================================================

alter table public.predictions
  add column if not exists notified_1h boolean not null default false;

comment on column public.predictions.notified_1h is
  'Set to true once the 1-hour-before-deadline push notification has been sent.';


-- ============================================================
-- 6. private.on_prediction_status_change
--    Trigger function: fires the appropriate push event
--    whenever a prediction is inserted or its status changes.
-- ============================================================

create or replace function private.on_prediction_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_room_name text;
begin
  select name into v_room_name from public.rooms where id = NEW.room_id;

  -- New prediction published (draft = live for betting)
  if TG_OP = 'INSERT' and NEW.status = 'draft' then
    perform private.fire_push_notification(
      'prediction_live',
      NEW.id,
      NEW.room_id,
      '🎯 New Prediction',
      coalesce(v_room_name, 'Your room') || ' · ' || NEW.title,
      '/room/' || NEW.room_id::text
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
      '/room/' || NEW.room_id::text
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
      '/room/' || NEW.room_id::text
    );
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_predictions_push_notification on public.predictions;

create trigger trg_predictions_push_notification
  after insert or update of status
  on public.predictions
  for each row
  execute function private.on_prediction_status_change();


-- ============================================================
-- 7. private.fire_push_notification_for_deadline_1h
--    Called by the pg_cron job below.  Finds predictions whose
--    deadline falls within the next 60 minutes, skipping any
--    already notified.
-- ============================================================

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


-- ============================================================
-- 8. pg_cron jobs
--    Run these statements ONCE in the Supabase SQL editor
--    (or via supabase db execute) after enabling pg_cron in
--    Database > Extensions.  They are commented out here so
--    that the migration itself is idempotent.
-- ============================================================

/*
-- Poll every minute for predictions with deadline in the next hour.
select cron.schedule(
  'push-deadline-1h',
  '* * * * *',
  $cron$
    select private.fire_push_notification_for_deadline_1h();
  $cron$
);

-- Notify all opted-in players at 08:00 UTC every Monday that
-- weekly points are available to claim.
select cron.schedule(
  'push-weekly-points-claim',
  '0 8 * * 1',
  $cron$
    select private.fire_push_notification(
      'weekly_points_claim',
      null,
      null,
      '💰 Weekly Points Available!',
      'Claim your 100 free points now.',
      '/'
    );
  $cron$
);
*/
