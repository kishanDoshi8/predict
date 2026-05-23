create or replace function public.get_room_stat_cards(
  p_room_id uuid,
  p_limit int default 5
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_caller_id uuid;
  v_is_member boolean;
  v_cards json;
begin
  v_caller_id := private.get_player_id_from_auth();
  if v_caller_id is null then
    raise exception 'Not authenticated' using errcode = 'P0004';
  end if;

  select exists (
    select 1
    from public.room_members
    where room_id = p_room_id
      and player_id = v_caller_id
  ) into v_is_member;

  if not v_is_member then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  p_limit := greatest(1, least(p_limit, 10));

  select json_agg(
    json_build_object(
      'key', c.stat_key,
      'title', c.title,
      'value', c.value,
      'subtitle', c.subtitle,
      'icon', c.icon,
      'priority', c.priority
    )
    order by c.priority asc
  )
  into v_cards
  from (
    select
      rs.stat_key,
      case rs.stat_key
        when 'current_streak' then 10
        when 'highest_streak' then 20
        when 'biggest_win' then 30
        when 'biggest_bet' then 40
        when 'most_profit' then 50
        else 100
      end as priority,
      case rs.stat_key
        when 'current_streak' then 'Win Streak'
        when 'highest_streak' then 'Best Streak'
        when 'biggest_win' then 'Biggest Win'
        when 'biggest_bet' then 'Biggest Bet'
        when 'most_profit' then 'Most Profit'
        else initcap(replace(rs.stat_key, '_', ' '))
      end as title,
      case rs.stat_key
        when 'current_streak' then format('%s Win Streak', coalesce((rs.stat_value_json ->> 'streak')::int, 0))
        when 'highest_streak' then format('%s Highest', coalesce((rs.stat_value_json ->> 'streak')::int, 0))
        else format('%s pts', to_char(coalesce((rs.stat_value_json ->> 'amount')::numeric, 0), 'FM999,999,999,999'))
      end as value,
      coalesce(rs.stat_value_json ->> 'username', '') as subtitle,
      case rs.stat_key
        when 'current_streak' then '🔥'
        when 'highest_streak' then '🏅'
        when 'biggest_win' then '💰'
        when 'biggest_bet' then '🎯'
        when 'most_profit' then '📈'
        else '⭐'
      end as icon
    from public.room_stats rs
    where rs.room_id = p_room_id
      and rs.stat_key in ('current_streak', 'highest_streak', 'biggest_win', 'biggest_bet', 'most_profit')
    order by priority asc, rs.stat_key
    limit p_limit
  ) c;

  return coalesce(v_cards, '[]'::json);
end;
$$;
