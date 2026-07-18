alter table public.series
  drop column if exists prediction_count,
  drop column if exists completed_games;

create or replace view public.series_with_stats as
with series_prediction_stats as (
  select
    p.series_id,
    count(*)::int as total_predictions,
    count(*) filter (where p.status in ('draft', 'locked'))::int as active_predictions,
    count(*) filter (where p.status in ('revealed', 'no_result'))::int as completed_predictions,
    count(*) filter (where p.status = 'cancelled')::int as cancelled_predictions
  from public.predictions p
  where p.series_id is not null
  group by p.series_id
)
select
  s.id,
  s.room_id,
  s.title,
  s.description,
  s.status,
  s.expected_games,
  coalesce(sps.total_predictions, 0) as prediction_count,
  coalesce(sps.completed_predictions, 0) as completed_games,
  coalesce(sps.total_predictions, 0) as total_predictions,
  coalesce(sps.active_predictions, 0) as active_predictions,
  coalesce(sps.completed_predictions, 0) as completed_predictions,
  coalesce(sps.cancelled_predictions, 0) as cancelled_predictions,
  greatest(s.expected_games - coalesce(sps.completed_predictions, 0), 0) as remaining_games,
  case
    when s.expected_games > 0 then least(round((coalesce(sps.completed_predictions, 0)::numeric / s.expected_games::numeric) * 100, 2), 100)
    else 0::numeric
  end as progress_percentage,
  s.created_by,
  s.created_at,
  s.started_at,
  s.completed_at,
  s.archived_at
from public.series s
left join series_prediction_stats sps on sps.series_id = s.id;


create or replace function public.get_room_series(
  p_room_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_active json;
  v_completed json;
  v_archived json;
  v_draft json;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  if not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.player_id = v_player_id
  ) then
    raise exception 'Room member not found' using errcode = 'P0011';
  end if;

  select coalesce(json_agg(s.* order by s.started_at desc nulls last, s.created_at desc), '[]'::json)
    into v_active
  from public.series_with_stats s
  where s.room_id = p_room_id
    and s.status = 'active';

  select coalesce(json_agg(s.* order by s.completed_at desc nulls last, s.created_at desc), '[]'::json)
    into v_completed
  from public.series_with_stats s
  where s.room_id = p_room_id
    and s.status = 'completed';

  select coalesce(json_agg(s.* order by s.archived_at desc nulls last, s.created_at desc), '[]'::json)
    into v_archived
  from public.series_with_stats s
  where s.room_id = p_room_id
    and s.status = 'archived';

  select coalesce(json_agg(s.* order by s.created_at desc), '[]'::json)
    into v_draft
  from public.series_with_stats s
  where s.room_id = p_room_id
    and s.status = 'draft';

  return json_build_object(
    'draft', v_draft,
    'active', v_active,
    'completed', v_completed,
    'archived', v_archived
  );
end;
$$;


create or replace function public.get_series_active_predictions(
  p_room_id uuid,
  p_series_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_result json;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  if not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.player_id = v_player_id
  ) then
    raise exception 'Room member not found' using errcode = 'P0011';
  end if;

  if not exists (
    select 1
    from public.series s
    where s.id = p_series_id
      and s.room_id = p_room_id
  ) then
    raise exception 'Series not found for this room' using errcode = 'P0002';
  end if;

  select coalesce(json_agg(p order by p.deadline asc), '[]'::json)
    into v_result
  from (
    select
      pred.*,
      s.title as series_title
    from public.predictions pred
    join public.series s on s.id = pred.series_id
    where pred.room_id = p_room_id
      and pred.series_id = p_series_id
      and pred.status in ('draft', 'locked')
  ) p;

  return v_result;
end;
$$;


create or replace function public.get_series_completed_predictions(
  p_room_id uuid,
  p_series_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_result json;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  if not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.player_id = v_player_id
  ) then
    raise exception 'Room member not found' using errcode = 'P0011';
  end if;

  if not exists (
    select 1
    from public.series s
    where s.id = p_series_id
      and s.room_id = p_room_id
  ) then
    raise exception 'Series not found for this room' using errcode = 'P0002';
  end if;

  select coalesce(json_agg(p order by p.resolved_at desc nulls last, p.created_at desc), '[]'::json)
    into v_result
  from (
    select
      pred.*,
      s.title as series_title
    from public.predictions pred
    join public.series s on s.id = pred.series_id
    where pred.room_id = p_room_id
      and pred.series_id = p_series_id
      and pred.status in ('revealed', 'no_result')
  ) p;

  return v_result;
end;
$$;


create or replace function public.create_prediction(
  p_room_id  uuid,
  p_title    text,
  p_options  text[],
  p_deadline timestamptz,
  p_series_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id       uuid;
  v_member          public.room_members%rowtype;
  v_room            public.rooms%rowtype;
  v_prediction      public.predictions%rowtype;
  v_option          public.prediction_options%rowtype;
  v_option_ids      uuid[] := '{}';
  v_label           text;
  v_i               int;
  v_active_count    int;
  v_predictions_limit int;
  v_series          public.series%rowtype;
  v_series_prediction_number int;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  -- Verify caller is the room organizer
  select * into v_member
  from public.room_members
  where room_id = p_room_id
    and player_id = v_player_id
    and is_organizer = true;

  if not found then
    raise exception 'Only the organizer can create predictions' using errcode = 'P0012';
  end if;

  -- Fetch room to get the predictions_limit
  select * into v_room
  from public.rooms
  where id = p_room_id and status = 'active';

  if not found then
    raise exception 'Room not found or closed' using errcode = 'P0002';
  end if;

  v_predictions_limit := v_room.predictions_limit;

  -- Count currently active (draft or locked) predictions for this room
  select count(*) into v_active_count
  from public.predictions
  where room_id = p_room_id
    and status in ('draft', 'locked');

  if v_active_count >= v_predictions_limit then
    raise exception 'Active predictions limit reached (% / %). Resolve or cancel one first.',
      v_active_count, v_predictions_limit
    using errcode = 'P0005';
  end if;

  -- Validate options count
  if coalesce(array_length(p_options, 1), 0) < 2 or array_length(p_options, 1) > 6 then
    raise exception 'Predictions must have between 2 and 6 options' using errcode = 'P0001';
  end if;

  if length(trim(p_title)) = 0 then
    raise exception 'Prediction title cannot be empty' using errcode = 'P0001';
  end if;

  if p_deadline <= now() then
    raise exception 'Deadline must be in the future' using errcode = 'P0001';
  end if;

  if p_series_id is not null then
    select * into v_series
    from public.series
    where id = p_series_id
      and room_id = p_room_id
    for update;

    if not found then
      raise exception 'Series not found for this room' using errcode = 'P0002';
    end if;

    if v_series.status <> 'active' then
      raise exception 'Predictions can only be assigned to active series' using errcode = 'P0001';
    end if;

    select coalesce(max(series_prediction_number), 0) + 1
      into v_series_prediction_number
    from public.predictions
    where series_id = p_series_id;
  else
    v_series_prediction_number := null;
  end if;

  -- Create the prediction
  insert into public.predictions (
    room_id,
    series_id,
    series_prediction_number,
    created_by,
    title,
    deadline
  )
  values (
    p_room_id,
    p_series_id,
    v_series_prediction_number,
    v_player_id,
    trim(p_title),
    p_deadline
  )
  returning * into v_prediction;

  -- Create options
  v_i := 1;
  foreach v_label in array p_options loop
    if length(trim(v_label)) = 0 then
      raise exception 'Option labels cannot be empty' using errcode = 'P0001';
    end if;

    insert into public.prediction_options (prediction_id, label, display_order)
    values (v_prediction.id, trim(v_label), v_i - 1)
    returning * into v_option;

    v_option_ids := v_option_ids || v_option.id;
    v_i := v_i + 1;
  end loop;

  perform private.create_room_activity(
    p_room_id := p_room_id,
    p_activity_type := 'prediction_created',
    p_activity_tier := 2,
    p_metadata := private.build_prediction_activity_metadata(v_prediction.id),
    p_click_action := jsonb_build_object(
      'type', 'prediction',
      'predictionId', v_prediction.id
    ),
    p_created_by_player_id := v_player_id,
    p_dedupe_key := 'prediction_created:' || v_prediction.id::text
  );

  return json_build_object(
    'prediction_id', v_prediction.id,
    'title',         v_prediction.title,
    'status',        v_prediction.status,
    'deadline',      v_prediction.deadline,
    'option_ids',    v_option_ids,
    'room_id',       p_room_id,
    'series_id', v_prediction.series_id,
    'series_prediction_number', v_prediction.series_prediction_number
  );
end;
$$;


drop function if exists public.get_room_prediction_history(uuid, int, timestamptz, uuid, text, text);

create or replace function public.get_room_prediction_history(
  p_room_id uuid,
  p_limit   int default 20,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_search text default null,
  p_filter text default 'all',
  p_series_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_caller_id uuid;
  v_is_member boolean;
  v_result    json;
  v_filter text;
  v_search text;
begin
  v_caller_id := private.get_player_id_from_auth();
  if v_caller_id is null then
    raise exception 'Not authenticated' using errcode = 'P0004';
  end if;

  select exists(
    select 1 from public.room_members
    where room_id = p_room_id and player_id = v_caller_id
  ) into v_is_member;

  if not v_is_member then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  p_limit  := greatest(1, least(p_limit, 100));
  v_filter := coalesce(nullif(lower(trim(p_filter)), ''), 'all');
  v_search := nullif(trim(p_search), '');

  /*
    Cursor pagination uses (created_at, id) so ordering is deterministic even when
    multiple predictions share the same created_at timestamp.
  */
  with fetched as (
    select
      pred.id             as prediction_id,
      pred.title,
      pred.status,
      pred.no_result_reason,
      pred.resolved_at,
      pred.created_at,
      pred.winning_option_id,
      pred.series_prediction_number,
      s.title as series_title,
      user_bet.option_id  as selected_option_id,
      selected_opt.label  as selected_option_label,
      creator.username    as creator_username,
      winning_opt.label   as winning_option_label,
      (
        select coalesce(sum(po.total_bet), 0)
        from public.prediction_options po
        where po.prediction_id = pred.id
      ) as total_pool,
      coalesce(bs.participant_count, 0) as participant_count,
      coalesce(bs.participant_count, 0) as total_bets,
      coalesce(bs.winner_count, 0) as winner_count,
      coalesce(bs.total_paid_to_winners, 0) as total_paid_to_winners,
      coalesce(bs.biggest_payout, 0) as biggest_payout,
      (
        select json_agg(
          json_build_object(
            'id',            po2.id,
            'label',         po2.label,
            'total_bet',     po2.total_bet,
            'display_order', po2.display_order
          ) order by po2.display_order
        )
        from public.prediction_options po2
        where po2.prediction_id = pred.id
      ) as options
    from public.predictions pred
    left join public.series s on s.id = pred.series_id
    join public.players creator on creator.id = pred.created_by
    left join public.prediction_options winning_opt
      on winning_opt.id = pred.winning_option_id
    left join public.bets user_bet
      on user_bet.prediction_id = pred.id
      and user_bet.player_id = v_caller_id
    left join public.prediction_options selected_opt
      on selected_opt.id = user_bet.option_id
    left join (
      select
        b.prediction_id,
        count(*) as participant_count,
        count(*) filter (
          where pred2.status = 'revealed'
            and b.option_id = pred2.winning_option_id
        ) as winner_count,
        sum(
          case
            when pred2.status = 'revealed'
              then greatest(coalesce(b.payout, 0) - b.amount, 0)
            else 0
          end
        ) as total_paid_to_winners,
        max(
          case
            when pred2.status = 'revealed'
              then greatest(coalesce(b.payout, 0) - b.amount, 0)
            else 0
          end
        ) as biggest_payout
      from public.bets b
      join public.predictions pred2 on pred2.id = b.prediction_id
      where pred2.room_id = p_room_id
        and pred2.status in ('revealed', 'cancelled', 'no_result')
      group by b.prediction_id
    ) bs on bs.prediction_id = pred.id
    where pred.room_id = p_room_id
      and (
        (p_series_id is null and pred.status in ('revealed', 'cancelled', 'no_result'))
        or (p_series_id is not null and pred.status in ('revealed', 'no_result'))
      )
      and (p_series_id is null or pred.series_id = p_series_id)
      and (
        p_cursor_created_at is null
        or p_cursor_id is null
        or (pred.created_at, pred.id) < (p_cursor_created_at, p_cursor_id)
      )
      and (
        v_search is null
        or coalesce(pred.title, '') ilike '%' || v_search || '%'
      )
      and case v_filter
        when 'wins' then (
          pred.status = 'revealed'
          and user_bet.option_id is not null
          and user_bet.option_id = pred.winning_option_id
        )
        when 'losses' then (
          pred.status = 'revealed'
          and user_bet.option_id is not null
          and user_bet.option_id <> pred.winning_option_id
        )
        when 'my_bets' then user_bet.option_id is not null
        else true
      end
    order by pred.created_at desc, pred.id desc
    limit p_limit + 1
  ),
  items as (
    select *
    from fetched
    order by created_at desc, prediction_id desc
    limit p_limit
  ),
  pagination as (
    select count(*) > p_limit as has_more
    from fetched
  ),
  tail_item as (
    select i.created_at, i.prediction_id
    from items i
    order by i.created_at asc, i.prediction_id asc
    limit 1
  )
  select json_build_object(
    'items', coalesce((select json_agg(i order by i.created_at desc, i.prediction_id desc) from items i), '[]'::json),
    'next_cursor_created_at', case when p.has_more then t.created_at else null end,
    'next_cursor_id', case when p.has_more then t.prediction_id else null end,
    'has_more', p.has_more
  )
  into v_result
  from pagination p
  left join tail_item t on true;

  return coalesce(
    v_result,
    json_build_object(
      'items', '[]'::json,
      'next_cursor_created_at', null,
      'next_cursor_id', null,
      'has_more', false
    )
  );
end;
$$;


create or replace function public.get_room_leaderboard(
  p_room_id uuid,
  p_sort_by text default 'points'
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_caller_id uuid;
  v_is_member boolean;
  v_result    json;
begin
  v_caller_id := private.get_player_id_from_auth();
  if v_caller_id is null then
    raise exception 'Not authenticated' using errcode = 'P0004';
  end if;

  select exists(
    select 1 from public.room_members
    where room_id = p_room_id and player_id = v_caller_id
  ) into v_is_member;

  if not v_is_member then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  if p_sort_by not in ('points', 'rating', 'accuracy', 'streak') then
    raise exception 'Invalid sort mode: %', p_sort_by using errcode = 'P0001';
  end if;

  with stats as (
    select
      b.player_id,
      count(*) as total_bets,
      count(*) filter (where pred.status = 'revealed') as total_revealed_bets,
      count(*) filter (
        where pred.status = 'revealed'
          and b.option_id = pred.winning_option_id
      ) as winning_bets,
      sum(b.amount) as total_wagered,
      sum(coalesce(b.payout, 0)) as total_payout,
      sum(greatest(coalesce(b.payout, 0) - b.amount, 0)) as total_profit,
      sum(greatest(b.amount - coalesce(b.payout, 0), 0)) as total_loss,
      sum(coalesce(b.payout, 0) - b.amount) as net_points
    from public.bets b
    join public.predictions pred on pred.id = b.prediction_id
    where pred.room_id = p_room_id
      and pred.status in ('revealed', 'cancelled', 'no_result')
    group by b.player_id
  ),
  latest_snapshots as (
    select distinct on (s.player_id)
      s.player_id,
      s.week_start,
      s.total_won_in_room,
      s.prediction_rating,
      s.peak_prediction_rating,
      s.rated_predictions_count,
      s.correct_predictions,
      s.total_predictions,
      s.current_streak,
      s.highest_streak
    from public.room_member_weekly_snapshots s
    where s.room_id = p_room_id
    order by s.player_id, s.week_start desc
  ),
  base_current as (
    select
      rm.player_id,
      p.username,
      coalesce(s.net_points, 0) as total_won_in_room,
      coalesce(s.net_points, 0) as current_total_won_in_room,
      rm.joined_at,
      rm.is_organizer,
      rm.current_streak,
      rm.highest_streak,
      rm.prediction_rating,
      rm.peak_prediction_rating,
      rm.rated_predictions_count,
      coalesce(s.total_bets, 0) as total_bets,
      coalesce(s.total_revealed_bets, 0) as total_revealed_bets,
      coalesce(s.winning_bets, 0) as winning_bets,
      coalesce(s.total_wagered, 0) as total_wagered,
      coalesce(s.total_payout, 0) as total_payout,
      coalesce(s.total_profit, 0) as total_profit,
      coalesce(s.total_loss, 0) as total_loss,
      coalesce(s.net_points, 0) as net_points,
      case
        when coalesce(s.total_revealed_bets, 0) > 0 then
          round((coalesce(s.winning_bets, 0)::numeric / s.total_revealed_bets) * 100, 1)
        else 0
      end as win_percentage,
      case
        when coalesce(s.total_revealed_bets, 0) > 0 then
          coalesce(s.winning_bets, 0)::numeric / s.total_revealed_bets
      end as accuracy_ratio
    from public.room_members rm
    join public.players p on p.id = rm.player_id
    left join stats s on s.player_id = rm.player_id
    where rm.room_id = p_room_id
  ),
  current_ranked as (
    select
      bc.*,
      rank() over (
        order by
          case when p_sort_by = 'points' then bc.total_won_in_room end desc nulls last,
          case when p_sort_by = 'points' then bc.accuracy_ratio end desc nulls last,
          case when p_sort_by = 'rating' then bc.prediction_rating end desc nulls last,
          case when p_sort_by = 'rating' then bc.rated_predictions_count end desc nulls last,
          case when p_sort_by = 'accuracy' then bc.accuracy_ratio end desc nulls last,
          case when p_sort_by = 'accuracy' then bc.total_revealed_bets end desc nulls last,
          case when p_sort_by = 'streak' then bc.current_streak end desc nulls last,
          case when p_sort_by = 'streak' then bc.highest_streak end desc nulls last,
          bc.joined_at asc
      ) as rank
    from base_current bc
  ),
  previous_candidates as (
    select
      bc.player_id,
      bc.joined_at,
      ls.total_won_in_room,
      ls.prediction_rating,
      ls.rated_predictions_count,
      ls.correct_predictions,
      ls.total_predictions,
      ls.current_streak,
      ls.highest_streak,
      case
        when ls.total_predictions > 0 then ls.correct_predictions::numeric / ls.total_predictions
      end as accuracy_ratio
    from base_current bc
    join latest_snapshots ls on ls.player_id = bc.player_id
  ),
  previous_ranked as (
    select
      pc.player_id,
      rank() over (
        order by
          case when p_sort_by = 'points' then pc.total_won_in_room end desc nulls last,
          case when p_sort_by = 'points' then pc.accuracy_ratio end desc nulls last,
          case when p_sort_by = 'rating' then pc.prediction_rating end desc nulls last,
          case when p_sort_by = 'rating' then pc.rated_predictions_count end desc nulls last,
          case when p_sort_by = 'accuracy' then pc.accuracy_ratio end desc nulls last,
          case when p_sort_by = 'accuracy' then pc.total_predictions end desc nulls last,
          case when p_sort_by = 'streak' then pc.current_streak end desc nulls last,
          case when p_sort_by = 'streak' then pc.highest_streak end desc nulls last,
          pc.joined_at asc
      ) as previous_rank
    from previous_candidates pc
  )
  select json_agg(lb order by lb.rank)
  into v_result
  from (
    select
      cr.player_id,
      cr.username,
      cr.total_won_in_room,
      cr.joined_at,
      cr.is_organizer,
      cr.current_streak,
      cr.highest_streak,
      cr.prediction_rating,
      cr.peak_prediction_rating,
      cr.rated_predictions_count,
      cr.total_bets,
      cr.total_revealed_bets,
      cr.winning_bets,
      cr.total_wagered,
      cr.total_payout,
      cr.net_points,
      cr.win_percentage,
      cr.rank,
      pr.previous_rank,
      case
        when pr.previous_rank is not null then pr.previous_rank - cr.rank
      end as rank_change,
      ls.prediction_rating as previous_prediction_rating,
      case
        when ls.player_id is not null then cr.prediction_rating - ls.prediction_rating
      end as rating_change,
      null::numeric as previous_total_won_in_room,
      null::numeric as points_change
    from current_ranked cr
    left join latest_snapshots ls on ls.player_id = cr.player_id
    left join previous_ranked pr on pr.player_id = cr.player_id
  ) lb;

  return coalesce(v_result, '[]'::json);
end;
$$;


create or replace function public.get_series_leaderboard(
  p_room_id uuid,
  p_series_id uuid,
  p_sort_by text default 'points'
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_caller_id uuid;
  v_is_member boolean;
  v_result json;
begin
  v_caller_id := private.get_player_id_from_auth();
  if v_caller_id is null then
    raise exception 'Not authenticated' using errcode = 'P0004';
  end if;

  select exists(
    select 1 from public.room_members
    where room_id = p_room_id and player_id = v_caller_id
  ) into v_is_member;

  if not v_is_member then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  if not exists (
    select 1
    from public.series s
    where s.id = p_series_id
      and s.room_id = p_room_id
  ) then
    raise exception 'Series not found for this room' using errcode = 'P0002';
  end if;

  if p_sort_by not in ('points', 'rating', 'accuracy', 'streak') then
    raise exception 'Invalid sort mode: %', p_sort_by using errcode = 'P0001';
  end if;

  with stats as (
    select
      b.player_id,
      count(*) as total_bets,
      count(*) filter (where pred.status = 'revealed') as total_revealed_bets,
      count(*) filter (
        where pred.status = 'revealed'
          and b.option_id = pred.winning_option_id
      ) as winning_bets,
      sum(b.amount) as total_wagered,
      sum(coalesce(b.payout, 0)) as total_payout,
      sum(greatest(coalesce(b.payout, 0) - b.amount, 0)) as total_profit,
      sum(greatest(b.amount - coalesce(b.payout, 0), 0)) as total_loss,
      sum(coalesce(b.payout, 0) - b.amount) as net_points
    from public.bets b
    join public.predictions pred on pred.id = b.prediction_id
    where pred.room_id = p_room_id
      and pred.series_id = p_series_id
      and pred.status in ('revealed', 'cancelled', 'no_result')
    group by b.player_id
  ),
  base_current as (
    select
      rm.player_id,
      p.username,
      coalesce(s.net_points, 0) as total_won_in_room,
      rm.joined_at,
      rm.is_organizer,
      rm.current_streak,
      rm.highest_streak,
      rm.prediction_rating,
      rm.peak_prediction_rating,
      rm.rated_predictions_count,
      coalesce(s.total_bets, 0) as total_bets,
      coalesce(s.total_revealed_bets, 0) as total_revealed_bets,
      coalesce(s.winning_bets, 0) as winning_bets,
      coalesce(s.total_wagered, 0) as total_wagered,
      coalesce(s.total_payout, 0) as total_payout,
      coalesce(s.total_profit, 0) as total_profit,
      coalesce(s.total_loss, 0) as total_loss,
      coalesce(s.net_points, 0) as net_points,
      case
        when coalesce(s.total_revealed_bets, 0) > 0 then
          round((coalesce(s.winning_bets, 0)::numeric / s.total_revealed_bets) * 100, 1)
        else 0
      end as win_percentage,
      case
        when coalesce(s.total_revealed_bets, 0) > 0 then
          coalesce(s.winning_bets, 0)::numeric / s.total_revealed_bets
      end as accuracy_ratio
    from public.room_members rm
    join public.players p on p.id = rm.player_id
    left join stats s on s.player_id = rm.player_id
    where rm.room_id = p_room_id
  ),
  ranked as (
    select
      bc.*,
      rank() over (
        order by
          case when p_sort_by = 'points' then bc.total_won_in_room end desc nulls last,
          case when p_sort_by = 'points' then bc.accuracy_ratio end desc nulls last,
          case when p_sort_by = 'rating' then bc.prediction_rating end desc nulls last,
          case when p_sort_by = 'rating' then bc.rated_predictions_count end desc nulls last,
          case when p_sort_by = 'accuracy' then bc.accuracy_ratio end desc nulls last,
          case when p_sort_by = 'accuracy' then bc.total_revealed_bets end desc nulls last,
          case when p_sort_by = 'streak' then bc.current_streak end desc nulls last,
          case when p_sort_by = 'streak' then bc.highest_streak end desc nulls last,
          bc.joined_at asc
      ) as rank
    from base_current bc
  )
  select json_agg(lb order by lb.rank)
  into v_result
  from (
    select
      r.player_id,
      r.username,
      r.total_won_in_room,
      r.joined_at,
      r.is_organizer,
      r.current_streak,
      r.highest_streak,
      r.prediction_rating,
      r.peak_prediction_rating,
      r.rated_predictions_count,
      r.total_bets,
      r.total_revealed_bets,
      r.winning_bets,
      r.total_wagered,
      r.total_payout,
      r.net_points,
      r.win_percentage,
      r.rank,
      null::int as previous_rank,
      null::int as rank_change,
      null::numeric as previous_prediction_rating,
      null::numeric as rating_change,
      null::numeric as previous_total_won_in_room,
      null::numeric as points_change
    from ranked r
  ) lb;

  return coalesce(v_result, '[]'::json);
end;
$$;


create or replace function public.get_room_weekly_leaderboard(
  p_room_id uuid,
  p_sort_by text default 'points'
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_caller_id uuid;
  v_is_member boolean;
  v_result    json;
begin
  v_caller_id := private.get_player_id_from_auth();
  if v_caller_id is null then
    raise exception 'Not authenticated' using errcode = 'P0004';
  end if;

  select exists(
    select 1
    from public.room_members
    where room_id = p_room_id
      and player_id = v_caller_id
  ) into v_is_member;

  if not v_is_member then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  if p_sort_by not in ('points', 'rating', 'accuracy', 'streak') then
    raise exception 'Invalid sort mode: %', p_sort_by using errcode = 'P0001';
  end if;

  with weekly_stats as (
    select
      b.player_id,
      count(*) as total_bets,
      count(*) as total_revealed_bets,
      count(*) filter (
        where b.option_id = pred.winning_option_id
      ) as winning_bets,
      sum(b.amount) as total_wagered,
      sum(coalesce(b.payout, 0)) as total_payout,
      sum(greatest(coalesce(b.payout, 0) - b.amount, 0)) as total_profit,
      sum(greatest(b.amount - coalesce(b.payout, 0), 0)) as total_loss,
      sum(coalesce(b.payout, 0) - b.amount) as net_points
    from public.bets b
    join public.predictions pred on pred.id = b.prediction_id
    where pred.room_id = p_room_id
      and pred.status = 'revealed'
      and pred.resolved_at is not null
      and to_char(pred.resolved_at at time zone 'UTC', 'IYYY"-W"IW') = private.current_week_key()
    group by b.player_id
  ),
  latest_snapshots as (
    select distinct on (s.player_id)
      s.player_id,
      s.week_start,
      s.total_won_in_room,
      s.prediction_rating,
      s.peak_prediction_rating,
      s.rated_predictions_count,
      s.correct_predictions,
      s.total_predictions,
      s.current_streak,
      s.highest_streak
    from public.room_member_weekly_snapshots s
    where s.room_id = p_room_id
    order by s.player_id, s.week_start desc
  ),
  base_current as (
    select
      rm.player_id,
      p.username,
      coalesce(ws.net_points, 0) as total_won_in_room,
      coalesce(ws.net_points, 0) as current_total_won_in_room,
      rm.joined_at,
      rm.is_organizer,
      rm.current_streak,
      rm.highest_streak,
      rm.prediction_rating,
      rm.peak_prediction_rating,
      rm.rated_predictions_count,
      coalesce(ws.total_bets, 0) as total_bets,
      coalesce(ws.total_revealed_bets, 0) as total_revealed_bets,
      coalesce(ws.winning_bets, 0) as winning_bets,
      coalesce(ws.total_wagered, 0) as total_wagered,
      coalesce(ws.total_payout, 0) as total_payout,
      coalesce(ws.total_profit, 0) as total_profit,
      coalesce(ws.total_loss, 0) as total_loss,
      coalesce(ws.net_points, 0) as net_points,
      case
        when coalesce(ws.total_revealed_bets, 0) > 0 then
          round((coalesce(ws.winning_bets, 0)::numeric / ws.total_revealed_bets) * 100, 1)
        else 0
      end as win_percentage,
      case
        when coalesce(ws.total_revealed_bets, 0) > 0 then
          coalesce(ws.winning_bets, 0)::numeric / ws.total_revealed_bets
      end as accuracy_ratio
    from public.room_members rm
    join public.players p on p.id = rm.player_id
    left join weekly_stats ws on ws.player_id = rm.player_id
    where rm.room_id = p_room_id
  ),
  current_ranked as (
    select
      bc.*,
      rank() over (
        order by
          case when p_sort_by = 'points' then bc.total_won_in_room end desc nulls last,
          case when p_sort_by = 'points' then bc.accuracy_ratio end desc nulls last,
          case when p_sort_by = 'rating' then bc.prediction_rating end desc nulls last,
          case when p_sort_by = 'rating' then bc.rated_predictions_count end desc nulls last,
          case when p_sort_by = 'accuracy' then bc.accuracy_ratio end desc nulls last,
          case when p_sort_by = 'accuracy' then bc.total_revealed_bets end desc nulls last,
          case when p_sort_by = 'streak' then bc.current_streak end desc nulls last,
          case when p_sort_by = 'streak' then bc.highest_streak end desc nulls last,
          bc.joined_at asc
      ) as rank
    from base_current bc
  ),
  previous_candidates as (
    select
      bc.player_id,
      bc.joined_at,
      ls.total_won_in_room,
      ls.prediction_rating,
      ls.rated_predictions_count,
      ls.correct_predictions,
      ls.total_predictions,
      ls.current_streak,
      ls.highest_streak,
      case
        when ls.total_predictions > 0 then ls.correct_predictions::numeric / ls.total_predictions
      end as accuracy_ratio
    from base_current bc
    join latest_snapshots ls on ls.player_id = bc.player_id
  ),
  previous_ranked as (
    select
      pc.player_id,
      rank() over (
        order by
          case when p_sort_by = 'points' then pc.total_won_in_room end desc nulls last,
          case when p_sort_by = 'points' then pc.accuracy_ratio end desc nulls last,
          case when p_sort_by = 'rating' then pc.prediction_rating end desc nulls last,
          case when p_sort_by = 'rating' then pc.rated_predictions_count end desc nulls last,
          case when p_sort_by = 'accuracy' then pc.accuracy_ratio end desc nulls last,
          case when p_sort_by = 'accuracy' then pc.total_predictions end desc nulls last,
          case when p_sort_by = 'streak' then pc.current_streak end desc nulls last,
          case when p_sort_by = 'streak' then pc.highest_streak end desc nulls last,
          pc.joined_at asc
      ) as previous_rank
    from previous_candidates pc
  )
  select json_agg(lb order by lb.rank)
  into v_result
  from (
    select
      cr.player_id,
      cr.username,
      cr.total_won_in_room,
      cr.joined_at,
      cr.is_organizer,
      cr.current_streak,
      cr.highest_streak,
      cr.prediction_rating,
      cr.peak_prediction_rating,
      cr.rated_predictions_count,
      cr.total_bets,
      cr.total_revealed_bets,
      cr.winning_bets,
      cr.total_wagered,
      cr.total_payout,
      cr.net_points,
      cr.win_percentage,
      cr.rank,
      pr.previous_rank,
      case
        when pr.previous_rank is not null then pr.previous_rank - cr.rank
      end as rank_change,
      ls.prediction_rating as previous_prediction_rating,
      case
        when ls.player_id is not null then cr.prediction_rating - ls.prediction_rating
      end as rating_change,
      null::numeric as previous_total_won_in_room,
      null::numeric as points_change
    from current_ranked cr
    left join latest_snapshots ls on ls.player_id = cr.player_id
    left join previous_ranked pr on pr.player_id = cr.player_id
  ) lb;

  return coalesce(v_result, '[]'::json);
end;
$$;


grant execute on function public.get_room_series(uuid) to authenticated;
grant execute on function public.get_series_active_predictions(uuid, uuid) to authenticated;
grant execute on function public.get_series_completed_predictions(uuid, uuid) to authenticated;
grant execute on function public.create_prediction(uuid, text, text[], timestamptz, uuid) to authenticated;
grant execute on function public.get_room_prediction_history(uuid, int, timestamptz, uuid, text, text, uuid) to authenticated;
grant execute on function public.get_room_leaderboard(uuid, text) to authenticated;
grant execute on function public.get_series_leaderboard(uuid, uuid, text) to authenticated;
grant execute on function public.get_room_weekly_leaderboard(uuid, text) to authenticated;

grant select (id, room_id, title, description, status, expected_games, created_by, created_at, started_at, completed_at, archived_at) on public.series to anon;
grant select (id, room_id, title, description, status, expected_games, created_by, created_at, started_at, completed_at, archived_at) on public.series to authenticated;
