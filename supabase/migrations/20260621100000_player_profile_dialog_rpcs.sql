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

  with prediction_stats as (
    select
      count(*)::int as total_predictions,
      count(*) filter (
        where pred.status = 'revealed'
          and b.option_id = pred.winning_option_id
      )::int as winning_predictions
    from public.bets b
    join public.predictions pred on pred.id = b.prediction_id
    where pred.room_id = p_room_id
      and b.player_id = p_player_id
      and pred.status in ('revealed', 'cancelled', 'no_result')
  )
  select json_build_object(
    'player_id', rm.player_id,
    'username', p.username,
    'current_points', rm.total_won_in_room,
    'current_rating', rm.prediction_rating,
    'peak_rating', rm.peak_prediction_rating,
    'total_predictions', coalesce(ps.total_predictions, 0),
    'winning_predictions', coalesce(ps.winning_predictions, 0),
    'total_rated_predictions', rm.rated_predictions_count,
    'current_win_streak', rm.current_streak,
    'highest_win_streak', rm.highest_streak,
    'activity_streak', p.current_streak
  )
  into v_result
  from public.room_members rm
  join public.players p on p.id = rm.player_id
  left join prediction_stats ps on true
  where rm.room_id = p_room_id
    and rm.player_id = p_player_id;

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
