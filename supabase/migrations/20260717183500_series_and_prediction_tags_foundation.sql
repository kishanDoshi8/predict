alter table public.rooms
  add column if not exists description text;

create table if not exists public.series (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'archived')),
  expected_games integer not null default 0 check (expected_games >= 0),
  prediction_count integer not null default 0 check (prediction_count >= 0),
  completed_games integer not null default 0 check (completed_games >= 0),
  created_by uuid not null references public.players(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz
);

create index if not exists idx_series_room_status on public.series(room_id, status, created_at desc);
create index if not exists idx_series_room_created_at on public.series(room_id, created_at desc);

alter table public.predictions
  add column if not exists series_id uuid references public.series(id) on delete set null,
  add column if not exists series_prediction_number integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'predictions_series_assignment_check'
      and conrelid = 'public.predictions'::regclass
  ) then
    alter table public.predictions
      add constraint predictions_series_assignment_check
      check (
        (series_id is null and series_prediction_number is null)
        or (series_id is not null and series_prediction_number is not null)
      );
  end if;
end $$;

create unique index if not exists idx_predictions_series_number_unique
  on public.predictions (series_id, series_prediction_number)
  where series_id is not null and series_prediction_number is not null;

create index if not exists idx_predictions_series_id
  on public.predictions (series_id);

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

create index if not exists idx_prediction_tags_prediction_id
  on public.prediction_tags(prediction_id, created_at asc);

create or replace function private.enforce_series_prediction_immutability()
returns trigger
language plpgsql
as $$
begin
  if old.series_prediction_number is not null and new.series_prediction_number is distinct from old.series_prediction_number then
    raise exception 'series_prediction_number cannot be changed once assigned' using errcode = 'P0001';
  end if;

  if old.series_prediction_number is not null and new.series_id is distinct from old.series_id then
    raise exception 'series_id cannot be changed after series_prediction_number is assigned' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_predictions_series_immutable on public.predictions;
create trigger trg_predictions_series_immutable
before update on public.predictions
for each row
execute function private.enforce_series_prediction_immutability();

alter table public.series enable row level security;
revoke all on public.series from anon;
drop policy if exists "series_select" on public.series;
create policy "series_select" on public.series for select using (true);
drop policy if exists "series_no_direct_write" on public.series;
create policy "series_no_direct_write" on public.series for insert with check (false);
drop policy if exists "series_no_direct_update" on public.series;
create policy "series_no_direct_update" on public.series for update using (false);
drop policy if exists "series_no_direct_delete" on public.series;
create policy "series_no_direct_delete" on public.series for delete using (false);
grant select (id, room_id, title, description, status, expected_games, prediction_count, completed_games, created_by, created_at, started_at, completed_at, archived_at) on public.series to anon;
grant select (id, room_id, title, description, status, expected_games, prediction_count, completed_games, created_by, created_at, started_at, completed_at, archived_at) on public.series to authenticated;

alter table public.prediction_tags enable row level security;
revoke all on public.prediction_tags from anon;
drop policy if exists "prediction_tags_select" on public.prediction_tags;
create policy "prediction_tags_select" on public.prediction_tags for select using (true);
drop policy if exists "prediction_tags_no_direct_write" on public.prediction_tags;
create policy "prediction_tags_no_direct_write" on public.prediction_tags for insert with check (false);
drop policy if exists "prediction_tags_no_direct_update" on public.prediction_tags;
create policy "prediction_tags_no_direct_update" on public.prediction_tags for update using (false);
drop policy if exists "prediction_tags_no_direct_delete" on public.prediction_tags;
create policy "prediction_tags_no_direct_delete" on public.prediction_tags for delete using (false);
grant select (id, prediction_id, tag, created_at) on public.prediction_tags to anon;
grant select (id, prediction_id, tag, created_at) on public.prediction_tags to authenticated;

grant select (description) on public.rooms to anon;
grant select (description) on public.rooms to authenticated;
grant select (series_id, series_prediction_number) on public.predictions to anon;
grant select (series_id, series_prediction_number) on public.predictions to authenticated;
