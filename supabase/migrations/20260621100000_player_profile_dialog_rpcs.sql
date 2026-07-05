create or replace function public.get_room_member_stats(
  p_room_id uuid,
  p_player_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_caller_id uuid;
  v_is_caller_member boolean;
  v_is_target_member boolean;
  v_result json;
begin
  v_caller_id := private.get_player_id_from_auth();

  if v_caller_id is null then
    raise exception 'Not authenticated'
      using errcode = 'P0004';
  end if;

  select exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.player_id = v_caller_id
  )
  into v_is_caller_member;

  if not v_is_caller_member then
    raise exception 'You are not a member of this room'
      using errcode = 'P0011';
  end if;

  select exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.player_id = p_player_id
  )
  into v_is_target_member;

  if not v_is_target_member then
    raise exception 'Player is not a member of this room'
      using errcode = 'P0011';
  end if;

  with member_ranks as (
    select
      rm.*,

      rank() over (
        order by rm.total_won_in_room desc
      ) as points_rank,

      rank() over (
        order by rm.prediction_rating desc
      ) as rating_rank

    from public.room_members rm
    where rm.room_id = p_room_id
  ),

  prediction_stats as (
    select
      count(*)::int as total_predictions,

      count(*) filter (
        where pred.status = 'revealed'
          and b.option_id = pred.winning_option_id
      )::int as winning_predictions

    from public.bets b
    join public.predictions pred
      on pred.id = b.prediction_id

    where pred.room_id = p_room_id
      and b.player_id = p_player_id
      and pred.status in (
        'revealed',
        'cancelled',
        'no_result'
      )
  ),

  largest_win as (
    select
      b.amount as largest_win_bet,
      b.payout as largest_win_payout,

      round(
        b.payout::numeric /
        nullif(b.amount, 0),
        2
      ) as largest_win_multiplier

    from public.bets b
    join public.predictions pred
      on pred.id = b.prediction_id

    where pred.room_id = p_room_id
      and b.player_id = p_player_id
      and pred.status = 'revealed'
      and b.option_id = pred.winning_option_id

    order by b.payout desc
    limit 1
  )

  select json_build_object(

    'player_id', mr.player_id,
    'username', p.username,

    'current_points', mr.total_won_in_room,
    'points_rank', mr.points_rank,

    'current_rating', mr.prediction_rating,
    'rating_rank', mr.rating_rank,
    'peak_rating', mr.peak_prediction_rating,

    'total_predictions', coalesce(ps.total_predictions, 0),
    'winning_predictions', coalesce(ps.winning_predictions, 0),
    'total_rated_predictions', mr.rated_predictions_count,

    'current_win_streak', mr.current_streak,
    'highest_win_streak', mr.highest_streak,

    'activity_streak', p.current_streak,

    'largest_win_bet', lw.largest_win_bet,
    'largest_win_payout', lw.largest_win_payout,
    'largest_win_multiplier', lw.largest_win_multiplier

  )
  into v_result

  from member_ranks mr
  join public.players p
    on p.id = mr.player_id

  left join prediction_stats ps on true
  left join largest_win lw on true

  where mr.player_id = p_player_id;

  return v_result;
end;
$$;

create or replace function public.get_room_member_recent_predictions(
  p_room_id uuid,
  p_player_id uuid,
  p_limit int default 5,
  p_offset int default 0
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_caller_id uuid;
  v_is_caller_member boolean;
  v_is_target_member boolean;
  v_result json;
begin
  v_caller_id := private.get_player_id_from_auth();
  if v_caller_id is null then
    raise exception 'Not authenticated' using errcode = 'P0004';
  end if;

  select exists(
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.player_id = v_caller_id
  ) into v_is_caller_member;

  if not v_is_caller_member then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  select exists(
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.player_id = p_player_id
  ) into v_is_target_member;

  if not v_is_target_member then
    raise exception 'Player is not a member of this room' using errcode = 'P0011';
  end if;

  p_limit := greatest(1, least(p_limit, 100));
  p_offset := greatest(0, p_offset);

  select json_agg(row_data)
  into v_result
  from (
    select
      pred.id as prediction_id,
      pred.title as prediction_title,
      selected_opt.label as selected_option,
      case
        when pred.status = 'revealed' and b.option_id = pred.winning_option_id then 'won'
        when pred.status = 'revealed' then 'lost'
        else 'no_result'
      end as result,
      pred.resolved_at
    from public.bets b
    join public.predictions pred on pred.id = b.prediction_id
    join public.prediction_options selected_opt on selected_opt.id = b.option_id
    where pred.room_id = p_room_id
      and b.player_id = p_player_id
      and pred.status in ('revealed', 'no_result')
      and pred.resolved_at is not null
    order by pred.resolved_at desc, pred.created_at desc
    limit p_limit
    offset p_offset
  ) row_data;

  return coalesce(v_result, '[]'::json);
end;
$$;

grant execute on function public.get_room_member_stats(uuid, uuid) to authenticated;
grant execute on function public.get_room_member_recent_predictions(uuid, uuid, int, int) to authenticated;
