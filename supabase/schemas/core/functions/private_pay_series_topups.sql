-- Run by the series-weekly-topup cron job every Monday.
-- Pays each active series' weekly top-up to every wallet, at most once per ISO week.
create or replace function private.pay_series_topups()
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
    select s.id, s.room_id, s.title, s.weekly_topup, r.room_code
    from public.series s
    join public.rooms r on r.id = s.room_id
    where s.status = 'active'
      and s.weekly_topup > 0
      and s.last_topup_week is distinct from v_week_key
    for update of s
  loop
    update public.series_wallets
    set balance = balance + v_series.weekly_topup,
        granted = granted + v_series.weekly_topup,
        updated_at = now()
    where series_id = v_series.id;

    update public.series
    set topups_paid = topups_paid + 1,
        last_topup_week = v_week_key
    where id = v_series.id;

    perform private.fire_push_notification(
      'weekly_points_claim',
      null,
      v_series.room_id,
      '+' || v_series.weekly_topup || ' points',
      'Your weekly top-up for ' || v_series.title || ' is in.',
      '/rooms/' || v_series.room_code
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
