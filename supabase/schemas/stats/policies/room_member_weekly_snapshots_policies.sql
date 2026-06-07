alter table public.room_member_weekly_snapshots enable row level security;

revoke all on public.room_member_weekly_snapshots from anon;
revoke all on public.room_member_weekly_snapshots from authenticated;

drop policy if exists "room_member_weekly_snapshots_select_room_members" on public.room_member_weekly_snapshots;
create policy "room_member_weekly_snapshots_select_room_members"
  on public.room_member_weekly_snapshots
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.room_members rm
      where rm.room_id = room_member_weekly_snapshots.room_id
        and rm.player_id = private.get_player_id_from_auth()
    )
  );

drop policy if exists "room_member_weekly_snapshots_no_direct_insert" on public.room_member_weekly_snapshots;
create policy "room_member_weekly_snapshots_no_direct_insert"
  on public.room_member_weekly_snapshots
  for insert
  to authenticated
  with check (false);

drop policy if exists "room_member_weekly_snapshots_no_direct_update" on public.room_member_weekly_snapshots;
create policy "room_member_weekly_snapshots_no_direct_update"
  on public.room_member_weekly_snapshots
  for update
  to authenticated
  using (false);

drop policy if exists "room_member_weekly_snapshots_no_direct_delete" on public.room_member_weekly_snapshots;
create policy "room_member_weekly_snapshots_no_direct_delete"
  on public.room_member_weekly_snapshots
  for delete
  to authenticated
  using (false);

grant select on public.room_member_weekly_snapshots to authenticated;
