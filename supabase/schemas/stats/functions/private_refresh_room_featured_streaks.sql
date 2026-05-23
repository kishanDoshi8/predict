create or replace function private.refresh_room_featured_streaks(
  p_room_id uuid
)
returns void
language plpgsql
set search_path = public, private
as $$
declare
  v_current record;
  v_highest record;
begin
  select s.user_id, s.username, s.streak
  into v_current
  from (
    select
      prs.user_id,
      p.username,
      coalesce((prs.stat_value_json ->> 'streak')::integer, 0) as streak
    from public.player_room_stats prs
    join public.players p on p.id = prs.user_id
    where prs.room_id = p_room_id
      and prs.stat_key = 'current_streak'
  ) s
  order by s.streak desc, s.username asc
  limit 1;

  if found and v_current.streak > 0 then
    perform private.upsert_room_stat(
      p_room_id,
      'current_streak',
      jsonb_build_object(
        'streak', v_current.streak,
        'user_id', v_current.user_id,
        'username', v_current.username
      )
    );
  else
    delete from public.room_stats
    where room_id = p_room_id
      and stat_key = 'current_streak';
  end if;

  select s.user_id, s.username, s.streak
  into v_highest
  from (
    select
      prs.user_id,
      p.username,
      coalesce((prs.stat_value_json ->> 'streak')::integer, 0) as streak
    from public.player_room_stats prs
    join public.players p on p.id = prs.user_id
    where prs.room_id = p_room_id
      and prs.stat_key = 'highest_streak'
  ) s
  order by s.streak desc, s.username asc
  limit 1;

  if found and v_highest.streak > 0 then
    perform private.upsert_room_stat(
      p_room_id,
      'highest_streak',
      jsonb_build_object(
        'streak', v_highest.streak,
        'user_id', v_highest.user_id,
        'username', v_highest.username
      )
    );
  else
    delete from public.room_stats
    where room_id = p_room_id
      and stat_key = 'highest_streak';
  end if;
end;
$$;
