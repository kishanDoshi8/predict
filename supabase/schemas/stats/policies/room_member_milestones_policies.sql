alter table public.room_member_milestones enable row level security;
revoke all on public.room_member_milestones from anon;
revoke insert, update, delete, truncate, references, trigger on public.room_member_milestones from authenticated;
drop policy if exists "room_member_milestones_select" on public.room_member_milestones;
create policy "room_member_milestones_select" on public.room_member_milestones
  for select to authenticated using (private.is_room_member(room_id));
grant select (id, room_id, player_id, milestone_type, achieved_at, series_id, created_at)
  on public.room_member_milestones to authenticated;
