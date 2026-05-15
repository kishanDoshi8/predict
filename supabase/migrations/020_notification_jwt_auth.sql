-- ============================================================
-- Migration: 020_notification_jwt_auth
-- Description:
--   Update private.fire_push_notification to include an
--   Authorization: Bearer header using the service_role_key
--   stored in private.notification_config.  This allows the
--   edge function to be deployed with verify_jwt = true while
--   still accepting calls from database triggers.
--
--   After applying this migration, add the new config key
--   (run once in the Supabase SQL editor):
--
--     insert into private.notification_config (key, value)
--     values ('service_role_key', 'YOUR_SERVICE_ROLE_KEY')
--     on conflict (key) do update set value = excluded.value;
--
--   The service_role_key is the "service_role" JWT from
--   Settings > API in the Supabase dashboard.
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
  v_supabase_url     text;
  v_secret           text;
  v_service_role_key text;
  v_app_url          text;
  v_request_id       bigint;
  v_payload          jsonb;
  v_headers          jsonb;
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

  select value into v_service_role_key
  from private.notification_config
  where key = 'service_role_key';

  v_payload := jsonb_build_object(
    'event_type', p_event_type,
    'room_id',    p_room_id,
    'payload', jsonb_build_object(
      'title', p_title,
      'body',  p_body,
      'url',   v_app_url || p_url_path
    )
  );

  v_headers := jsonb_build_object(
    'Content-Type',          'application/json',
    'x-notification-secret', v_secret
  );

  -- Include the service-role JWT so the edge function can be
  -- deployed with verify_jwt = true (required for JWT auth).
  if v_service_role_key is not null then
    v_headers := v_headers || jsonb_build_object(
      'Authorization', 'Bearer ' || v_service_role_key
    );
  end if;

  select net.http_post(
    url     := v_supabase_url || '/functions/v1/send-push-notifications',
    headers := v_headers,
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

comment on table private.notification_config is
  'Runtime configuration for notification triggers. '
  'Required keys: supabase_url, notification_function_secret, app_url, service_role_key.';
