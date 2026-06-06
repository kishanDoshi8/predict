create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  created_by uuid not null references public.players(id),
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'locked', 'revealed', 'cancelled', 'no_result')),
  deadline timestamptz not null,
  winning_option_id uuid,
  affects_rating boolean not null default true,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  notified_1h boolean not null default false
);

create table if not exists public.prediction_options (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null references public.predictions(id) on delete cascade,
  label text not null,
  display_order smallint not null default 0,
  total_bet integer not null default 0 check (total_bet >= 0),
  created_at timestamptz not null default now()
);


alter table public.predictions
  drop constraint if exists fk_predictions_winning_option,
  add constraint fk_predictions_winning_option foreign key (winning_option_id) references public.prediction_options(id);
create index if not exists idx_predictions_room_status on public.predictions(room_id, status);
create index if not exists idx_predictions_room_status_deadline on public.predictions(room_id, status, deadline asc);
create index if not exists idx_predictions_room_resolved on public.predictions (room_id, status, resolved_at desc) where status in ('revealed', 'cancelled', 'no_result');
