-- Monday cron, just before top-ups: record every active series' standings
-- as they stood when the week ended. Safe to run twice in a week.
create or replace function private.snapshot_series_standings()
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_week_key text := private.current_week_key();
  v_series   record;
  v_count    integer := 0;
begin
  for v_series in
    select s.id from public.series s where s.status = 'active'
  loop
    insert into public.series_standing_snapshots (series_id, player_id, week_key, rank, is_ranked, balance)
    select v_series.id, st.player_id, v_week_key, st.rank, st.is_ranked, st.balance
    from private.series_standings(v_series.id) st
    on conflict (series_id, player_id, week_key) do nothing;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
