alter table public.room_members
  add column if not exists prediction_rating integer not null default 1500,
  add column if not exists rated_predictions_count integer not null default 0,
  add column if not exists rating_system_version smallint not null default 1;

create index if not exists idx_room_members_prediction_rating
on public.room_members (room_id, prediction_rating desc);

alter table public.predictions
  add column if not exists affects_rating boolean not null default true;

grant select (prediction_rating, rated_predictions_count, rating_system_version) on public.room_members to anon;
grant select (prediction_rating, rated_predictions_count, rating_system_version) on public.room_members to authenticated;
grant select (affects_rating) on public.predictions to anon;
grant select (affects_rating) on public.predictions to authenticated;

create table if not exists public.rating_system_config (
  version smallint primary key,
  is_active boolean not null,
  base_k numeric(10,4) not null,
  min_participants integer not null,
  created_at timestamptz not null default now()
);

insert into public.rating_system_config (
  version,
  is_active,
  base_k,
  min_participants
)
values (
  1,
  true,
  10,
  3
)
on conflict (version) do update
set is_active = excluded.is_active,
    base_k = excluded.base_k,
    min_participants = excluded.min_participants;

alter table public.rating_system_config enable row level security;
revoke all on public.rating_system_config from anon;
revoke all on public.rating_system_config from authenticated;
drop policy if exists "rating_system_config_select_authenticated" on public.rating_system_config;
create policy "rating_system_config_select_authenticated"
  on public.rating_system_config
  for select
  to authenticated
  using (true);
grant select on public.rating_system_config to authenticated;

create or replace function public.update_prediction_ratings(
  p_room_id uuid,
  p_prediction_id uuid,
  p_winning_option_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_prediction public.predictions%rowtype;
  v_config record;
  v_participant record;
  v_member public.room_members%rowtype;

  v_total_predictors integer;
  v_winning_predictors integer;
  v_prediction_popularity numeric;
  v_surprise numeric;
  v_sample_weight numeric;
  v_difficulty numeric;

  v_experience numeric;
  v_effective_k numeric;
  v_change numeric;
  v_rounded_change integer;
  v_new_rating integer;
begin
  select *
  into v_prediction
  from public.predictions
  where id = p_prediction_id
    and room_id = p_room_id;

  if not found then
    raise exception 'Prediction not found for rating update' using errcode = 'P0006';
  end if;

  if not v_prediction.affects_rating then
    return;
  end if;

  if v_prediction.status <> 'revealed' then
    return;
  end if;

  if v_prediction.winning_option_id is distinct from p_winning_option_id then
    raise exception 'Winning option mismatch for rating update' using errcode = 'P0008';
  end if;

  select version, base_k, min_participants
  into v_config
  from public.rating_system_config
  where is_active = true
  order by version desc
  limit 1;

  if not found then
    raise exception 'No active rating system configuration found' using errcode = 'P0001';
  end if;

  select
    count(distinct b.player_id),
    count(distinct case when b.option_id = p_winning_option_id then b.player_id end)
  into v_total_predictors, v_winning_predictors
  from public.bets b
  where b.prediction_id = p_prediction_id;

  if v_total_predictors < v_config.min_participants then
    return;
  end if;

  -- Popular winners imply low surprise; unpopular winners imply upset outcomes.
  v_prediction_popularity := v_winning_predictors::numeric / v_total_predictors::numeric;
  v_surprise := 1 - v_prediction_popularity;

  -- Scale difficulty by participation size so larger samples carry stronger signal.
  v_sample_weight := ln(v_total_predictors::numeric + 1);
  v_difficulty := 1 + (v_surprise * v_sample_weight * 0.5);

  for v_participant in
    select distinct b.player_id, b.option_id
    from public.bets b
    where b.prediction_id = p_prediction_id
  loop
    select *
    into v_member
    from public.room_members
    where room_id = p_room_id
      and player_id = v_participant.player_id
    for update;

    if not found then
      continue;
    end if;

    v_experience := least(
      1.0::numeric,
      v_member.rated_predictions_count::numeric / 100.0
    );

    v_effective_k := v_config.base_k * (0.25 + (0.75 * v_experience));

    if v_participant.option_id = p_winning_option_id then
      v_change := v_effective_k * v_difficulty;
    else
      v_change := -(v_effective_k / v_difficulty);
    end if;

    v_rounded_change := round(v_change)::integer;
    v_new_rating := greatest(0, v_member.prediction_rating + v_rounded_change);

    update public.room_members
    set prediction_rating = v_new_rating,
        rated_predictions_count = rated_predictions_count + 1,
        rating_system_version = v_config.version
    where id = v_member.id;
  end loop;
end;
$$;

revoke execute on function public.update_prediction_ratings(uuid, uuid, uuid) from public;

drop function if exists public.resolve_prediction_v2(uuid, uuid, text, uuid);

create or replace function public.resolve_prediction_v2(
  p_prediction_id     uuid,
  p_room_id           uuid,
  p_outcome           text,
  p_winning_option_id uuid default null,
  p_no_result_reason  varchar(50) default null
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id         uuid;
  v_prediction        public.predictions%rowtype;
  v_winning_option    public.prediction_options%rowtype;

  v_total_winner_cap  numeric;
  v_loser             record;
  v_winner            record;
  v_winner_gain       integer;
  v_loser_refund      integer;
  v_final_payout      integer;
  v_winners_count     integer := 0;
  v_losers_count      integer := 0;
  v_multiple_sides    boolean;
  v_effective_outcome text;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id
      and player_id = v_player_id
      and is_organizer = true
  ) then
    raise exception 'Only the room organizer can resolve predictions' using errcode = 'P0012';
  end if;

  select * into v_prediction
  from public.predictions
  where id      = p_prediction_id
    and room_id = p_room_id
    and status  = 'locked';

  if not found then
    raise exception 'Prediction not found or not in locked phase' using errcode = 'P0006';
  end if;

  if p_outcome in ('no_result', 'cancel') then
    perform private.refund_all_bets_v2(p_prediction_id);

    v_effective_outcome := case
      when p_outcome = 'cancel' then 'cancelled'
      else p_outcome
    end;

    update public.predictions
    set status      = v_effective_outcome,
      no_result_reason = nullif(trim(p_no_result_reason), ''),
      resolved_at = now()
    where id = p_prediction_id;

    perform public.update_player_stats_after_resolution(
      p_room_id,
      p_prediction_id,
      null,
      v_effective_outcome
    );

    perform public.update_room_stats_after_resolution(
      p_room_id,
      p_prediction_id,
      null,
      v_effective_outcome
    );

    return json_build_object(
      'resolved', true,
      'outcome',  v_effective_outcome,
      'refunded', true
    );
  end if;

  if p_outcome <> 'win' then
    raise exception 'Invalid outcome. Must be win, no_result, or cancel.' using errcode = 'P0001';
  end if;

  if p_winning_option_id is null then
    raise exception 'p_winning_option_id is required for a win outcome' using errcode = 'P0001';
  end if;

  select * into v_winning_option
  from public.prediction_options
  where id            = p_winning_option_id
    and prediction_id = p_prediction_id;

  if not found then
    raise exception 'Winning option does not belong to this prediction' using errcode = 'P0008';
  end if;

  select count(distinct option_id) > 1 into v_multiple_sides
  from public.bets
  where prediction_id = p_prediction_id;

  if not v_multiple_sides then
    perform private.refund_all_bets_v2(p_prediction_id);

    update public.predictions
    set status = 'no_result',
        winning_option_id = p_winning_option_id,
        no_result_reason = coalesce(
          nullif(trim(p_no_result_reason), ''),
          'Only one option had bets — all refunded'
        ),
        resolved_at = now()
    where id = p_prediction_id;

    perform public.update_player_stats_after_resolution(
      p_room_id,
      p_prediction_id,
      null,
      'no_result'
    );

    perform public.update_room_stats_after_resolution(
      p_room_id,
      p_prediction_id,
      null,
      'no_result'
    );

    return json_build_object(
      'resolved', true,
      'outcome', 'no_result',
      'reason', 'Only one option had bets — all refunded',
      'winning_option_id', p_winning_option_id,
      'refunded', true
    );
  end if;

  if v_winning_option.total_bet = 0 then
    perform private.refund_all_bets_v2(p_prediction_id);

    update public.predictions
    set status = 'no_result',
        winning_option_id = p_winning_option_id,
        no_result_reason = coalesce(
          nullif(trim(p_no_result_reason), ''),
          'Nobody bet on the winning option — all refunded'
        ),
        resolved_at = now()
    where id = p_prediction_id;

    perform public.update_player_stats_after_resolution(
      p_room_id,
      p_prediction_id,
      null,
      'no_result'
    );

    perform public.update_room_stats_after_resolution(
      p_room_id,
      p_prediction_id,
      null,
      'no_result'
    );

    return json_build_object(
      'resolved', true,
      'outcome', 'no_result',
      'reason', 'Nobody bet on the winning option — all refunded',
      'winning_option_id', p_winning_option_id,
      'refunded', true
    );
  end if;

  select sum(amount)::numeric into v_total_winner_cap
  from public.bets
  where prediction_id = p_prediction_id
    and option_id     = p_winning_option_id;

  create temp table _winner_gains (
    player_id  uuid    primary key,
    bet_amount integer not null,
    total_gain integer not null default 0
  ) on commit drop;

  insert into _winner_gains (player_id, bet_amount)
  select player_id, amount
  from public.bets
  where prediction_id = p_prediction_id
    and option_id     = p_winning_option_id;

  for v_loser in
    select b.id as bet_id, b.player_id, b.amount
    from public.bets b
    where b.prediction_id = p_prediction_id
      and b.option_id    <> p_winning_option_id
  loop
    if v_loser.amount::numeric >= v_total_winner_cap then
      v_loser_refund := v_loser.amount - v_total_winner_cap::integer;
      for v_winner in select player_id, bet_amount from _winner_gains loop
        update _winner_gains
        set total_gain = total_gain + v_winner.bet_amount
        where player_id = v_winner.player_id;
      end loop;
    else
      v_loser_refund := 0;
      for v_winner in select player_id, bet_amount from _winner_gains loop
        v_winner_gain := floor(
          (v_winner.bet_amount::numeric / v_total_winner_cap) * v_loser.amount::numeric
        );

        update _winner_gains
        set total_gain = total_gain + v_winner_gain
        where player_id = v_winner.player_id;
      end loop;
    end if;

    update public.players
    set points_in_escrow = points_in_escrow - v_loser.amount,
        points_balance   = points_balance   - v_loser.amount + v_loser_refund
    where id = v_loser.player_id;

    update public.bets
    set payout = v_loser_refund
    where id = v_loser.bet_id;

    v_losers_count := v_losers_count + 1;
  end loop;

  for v_winner in select player_id, bet_amount, total_gain from _winner_gains loop
    v_final_payout := v_winner.bet_amount + v_winner.total_gain;

    update public.players
    set points_in_escrow = points_in_escrow - v_winner.bet_amount,
        points_balance   = points_balance   + v_final_payout,
        total_won        = total_won        + v_winner.total_gain
    where id = v_winner.player_id;

    update public.room_members
    set total_won_in_room = total_won_in_room + v_winner.total_gain
    where room_id   = v_prediction.room_id
      and player_id = v_winner.player_id;

    update public.bets
    set payout = v_final_payout
    where prediction_id = p_prediction_id
      and player_id     = v_winner.player_id;

    v_winners_count := v_winners_count + 1;
  end loop;

  update public.predictions
  set status            = 'revealed',
      winning_option_id = p_winning_option_id,
      resolved_at       = now()
  where id = p_prediction_id;

  perform public.update_prediction_ratings(
    p_room_id,
    p_prediction_id,
    p_winning_option_id
  );

  perform public.update_player_stats_after_resolution(
    p_room_id,
    p_prediction_id,
    p_winning_option_id,
    'win'
  );

  perform public.update_room_stats_after_resolution(
    p_room_id,
    p_prediction_id,
    p_winning_option_id,
    'win'
  );

  return json_build_object(
    'resolved',          true,
    'outcome',           'revealed',
    'winning_option_id', p_winning_option_id,
    'winning_label',     v_winning_option.label,
    'winners',           v_winners_count,
    'losers',            v_losers_count
  );
end;
$$;

grant execute on function public.resolve_prediction_v2(uuid, uuid, text, uuid, varchar) to authenticated;
