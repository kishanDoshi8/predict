create or replace function private.current_week_key()
returns text
language sql
as $$
  select to_char(now() at time zone 'UTC', 'IYYY"-W"IW');
$$;
