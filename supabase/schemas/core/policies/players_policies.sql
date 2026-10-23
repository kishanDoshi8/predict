alter table public.players enable row level security;
revoke all on public.players from anon;
revoke insert, update, delete, truncate, references, trigger on public.players from authenticated;

drop policy if exists "players_select" on public.players;
create policy "players_select" on public.players for select to authenticated using (private.shares_room_with(id));
drop policy if exists "players_no_direct_write" on public.players;
create policy "players_no_direct_write" on public.players for insert with check (false);
drop policy if exists "players_no_direct_update" on public.players;
create policy "players_no_direct_update" on public.players for update using (false);
drop policy if exists "players_no_direct_delete" on public.players;
create policy "players_no_direct_delete" on public.players for delete using (false);
drop policy if exists "players_self_update" on public.players;

-- Column-level only: player_token, user_id and last_visited_room_id stay private.
revoke select on public.players from authenticated;
grant select (id, username, points_balance, points_in_escrow, total_won, current_streak, longest_streak, last_claim_at, created_at) on public.players to authenticated;
