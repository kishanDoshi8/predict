create or replace function private.run_weekly_processing()
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_snapshot_result json;
begin
  -- 1) Snapshot room-member state for weekly movement calculations.
  v_snapshot_result := public.create_weekly_room_member_snapshots();

  -- 2) Run the existing weekly claims processing hook when it exists.
  begin
    execute 'select public.process_weekly_claims()';
  exception
    when undefined_function then
      null;
  end;

  -- 3) Send weekly claim reminder notifications.
  perform private.fire_push_notification(
    'weekly_points_claim',
    null,
    null,
    '💰 Weekly Points Available!',
    'Claim your 100 free points now.',
    '/'
  );

  return json_build_object(
    'snapshots_created',
    coalesce((v_snapshot_result->>'snapshots_created')::integer, 0)
  );
end;
$$;
