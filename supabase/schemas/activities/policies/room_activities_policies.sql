alter table public.room_activities enable row level security;
revoke all on public.room_activities from anon;

drop policy if exists "room_activities_select" on public.room_activities;
create policy "room_activities_select"
on public.room_activities
for select
using (
  exists (
    select 1
    from public.room_members rm
    where rm.room_id = room_activities.room_id
      and rm.player_id = private.get_player_id_from_auth()
  )
);

drop policy if exists "room_activities_no_direct_insert" on public.room_activities;
create policy "room_activities_no_direct_insert"
on public.room_activities
for insert
with check (false);

drop policy if exists "room_activities_no_direct_update" on public.room_activities;
create policy "room_activities_no_direct_update"
on public.room_activities
for update
using (false);

drop policy if exists "room_activities_no_direct_delete" on public.room_activities;
create policy "room_activities_no_direct_delete"
on public.room_activities
for delete
using (false);

grant select (id, room_id, activity_type, activity_tier, metadata, click_action, created_by_player_id, created_at)
  on public.room_activities to authenticated;
