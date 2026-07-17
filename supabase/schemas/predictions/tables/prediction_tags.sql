create table if not exists public.prediction_tags (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null references public.predictions(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  constraint prediction_tags_tag_normalized check (
    tag = lower(btrim(tag))
    and length(btrim(tag)) between 1 and 30
  ),
  unique (prediction_id, tag)
);

create index if not exists idx_prediction_tags_prediction_id on public.prediction_tags(prediction_id, created_at asc);
