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
