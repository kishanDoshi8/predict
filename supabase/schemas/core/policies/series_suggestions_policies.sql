-- Read and written only through the series suggestion RPCs.
alter table public.series_suggestions enable row level security;
alter table public.series_suggestion_votes enable row level security;
revoke all on public.series_suggestions from anon, authenticated;
revoke all on public.series_suggestion_votes from anon, authenticated;
