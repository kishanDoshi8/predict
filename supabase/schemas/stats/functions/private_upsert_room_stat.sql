create or replace function private.upsert_room_stat(
  p_room_id uuid,
  p_stat_key text,
  p_stat_value jsonb
)
returns void
language plpgsql
set search_path = public, private
as $$
begin
  insert into public.room_stats (room_id, stat_key, stat_value_json)
  values (p_room_id, p_stat_key, p_stat_value)
  on conflict (room_id, stat_key)
  do update
  set stat_value_json = excluded.stat_value_json,
      updated_at = now();
end;
$$;
