-- Read only through get_series_leaderboard and get_series_weekly_recap.
alter table public.series_standing_snapshots enable row level security;
revoke all on public.series_standing_snapshots from anon, authenticated;
