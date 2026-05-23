create table if not exists private.notification_dispatch_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  prediction_id uuid,
  room_id uuid,
  http_request_id bigint,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_ndl_created_at on private.notification_dispatch_log (created_at desc);
create index if not exists idx_ndl_prediction_id on private.notification_dispatch_log (prediction_id) where prediction_id is not null;
