-- How many settled predictions a player must have bet on to be ranked in a series.
-- Early on, the bar is capped at the number settled so far, so nobody is shut out.
create or replace function private.series_required_bets(
  p_series_id uuid
)
returns integer
language sql
stable
security definer
set search_path = public, private
as $$
  select least(
    s.min_bets_to_rank,
    (
      select count(*)::int
      from public.predictions p
      where p.series_id = s.id
        and p.status in ('revealed', 'no_result')
    )
  )
  from public.series s
  where s.id = p_series_id;
$$;
