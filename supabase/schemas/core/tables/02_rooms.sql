create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now(),
  predictions_limit integer not null default 5 check (predictions_limit >= 1)
);
