-- Read and written only through the Home RPCs.
alter table public.result_seen enable row level security;
alter table public.weekly_recap_seen enable row level security;
revoke all on public.result_seen from anon, authenticated;
revoke all on public.weekly_recap_seen from anon, authenticated;
