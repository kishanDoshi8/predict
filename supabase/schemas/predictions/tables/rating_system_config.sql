create table if not exists public.rating_system_config (
  version smallint primary key,
  is_active boolean not null,
  base_k numeric(10,4) not null,
  min_participants integer not null,
  created_at timestamptz not null default now()
);

insert into public.rating_system_config (
  version,
  is_active,
  base_k,
  min_participants
)
values (
  1,
  true,
  10,
  3
)
on conflict (version) do update
set is_active = excluded.is_active,
    base_k = excluded.base_k,
    min_participants = excluded.min_participants;
