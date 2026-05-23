create table if not exists public.prediction_options (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null references public.predictions(id) on delete cascade,
  label text not null,
  display_order smallint not null default 0,
  total_bet integer not null default 0 check (total_bet >= 0),
  created_at timestamptz not null default now()
);
