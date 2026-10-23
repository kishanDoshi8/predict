create or replace function private.run_weekly_processing()
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_snapshot_result json;
begin
  -- Snapshot room-member state for weekly movement calculations.
  -- Weekly claims are retired; series top-ups (private.pay_series_topups) send their own notice.
  v_snapshot_result := public.create_weekly_room_member_snapshots();

  return json_build_object(
    'snapshots_created',
    coalesce((v_snapshot_result->>'snapshots_created')::integer, 0)
  );
end;
$$;
