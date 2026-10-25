create or replace function public.update_series(
  p_series_id uuid,
  p_title text,
  p_description text default null,
  p_expected_games integer default 0,
  p_starting_stack integer default null,
  p_weekly_topup integer default null,
  p_min_bets_to_rank integer default null
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_series public.series%rowtype;
  v_points_changed boolean;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  select s.* into v_series
  from public.series s
  join public.room_members rm
    on rm.room_id = s.room_id
   and rm.player_id = v_player_id
   and rm.is_organizer = true
  where s.id = p_series_id
  for update;

  if not found then
    raise exception 'Series not found or access denied' using errcode = 'P0002';
  end if;

  if v_series.status = 'archived' then
    raise exception 'Archived series are read-only' using errcode = 'P0001';
  end if;

  if length(trim(p_title)) = 0 then
    raise exception 'Series title cannot be empty' using errcode = 'P0001';
  end if;

  if p_expected_games < 0 then
    raise exception 'Expected games cannot be negative' using errcode = 'P0001';
  end if;

  -- Unlike points, the ranking bar can change while a series runs: it moves no one's balance.
  if p_min_bets_to_rank is not null and p_min_bets_to_rank not between 0 and 50 then
    raise exception 'Minimum bets to be ranked must be between 0 and 50' using errcode = 'P0001';
  end if;

  if p_min_bets_to_rank is not null
    and p_min_bets_to_rank <> v_series.min_bets_to_rank
    and v_series.status not in ('draft', 'active') then
    raise exception 'Minimum bets to be ranked can only change before a series is closed' using errcode = 'P0001';
  end if;

  v_points_changed :=
    (p_starting_stack is not null and p_starting_stack <> v_series.starting_stack)
    or (p_weekly_topup is not null and p_weekly_topup <> v_series.weekly_topup);

  if v_points_changed then
    if v_series.status not in ('draft', 'active') then
      raise exception 'Points settings can only change before a series is closed' using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from public.bets b
      join public.predictions p on p.id = b.prediction_id
      where p.series_id = p_series_id
    ) then
      raise exception 'Points settings can''t change once the series has bets' using errcode = 'P0001';
    end if;

    if coalesce(p_starting_stack, v_series.starting_stack) < 100 then
      raise exception 'Starting points must be at least 100' using errcode = 'P0001';
    end if;

    if coalesce(p_weekly_topup, v_series.weekly_topup) < 0 then
      raise exception 'Weekly top-up cannot be negative' using errcode = 'P0001';
    end if;
  end if;

  update public.series
  set
    title = trim(p_title),
    description = nullif(trim(coalesce(p_description, '')), ''),
    expected_games = p_expected_games,
    starting_stack = coalesce(p_starting_stack, starting_stack),
    weekly_topup = coalesce(p_weekly_topup, weekly_topup),
    min_bets_to_rank = coalesce(p_min_bets_to_rank, min_bets_to_rank)
  where id = p_series_id
  returning * into v_series;

  -- No bets yet, so every wallet is still untouched: reissue it with the new settings.
  if v_points_changed then
    update public.series_wallets
    set balance = v_series.starting_stack + v_series.weekly_topup * v_series.topups_paid,
        granted = v_series.starting_stack + v_series.weekly_topup * v_series.topups_paid,
        updated_at = now()
    where series_id = p_series_id;
  end if;

  return row_to_json(v_series);
end;
$$;
