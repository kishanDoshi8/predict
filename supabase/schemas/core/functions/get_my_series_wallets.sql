-- The caller's points in each series of a room, active series first.
create or replace function public.get_my_series_wallets(
  p_room_id uuid
)
returns json
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_result    json;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  if not private.is_room_member(p_room_id) then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  select coalesce(json_agg(row_to_json(w) order by w.status_order, w.started_at desc nulls last), '[]'::json)
  into v_result
  from (
    select
      s.id as series_id,
      s.title,
      s.status,
      s.starting_stack,
      s.weekly_topup,
      sw.balance,
      sw.escrow,
      sw.balance - sw.escrow as available,
      sw.granted,
      sw.balance - sw.granted as net_profit,
      s.started_at,
      -- Earns next Monday's top-up (see private.pay_series_topups).
      exists (
        select 1
        from public.bets b
        join public.predictions p on p.id = b.prediction_id
        where p.series_id = s.id
          and b.player_id = v_player_id
          and greatest(b.placed_at, b.updated_at)
            >= date_trunc('week', now() at time zone 'UTC') at time zone 'UTC'
      ) as bet_this_week,
      case s.status when 'active' then 0 else 1 end as status_order
    from public.series_wallets sw
    join public.series s on s.id = sw.series_id
    where sw.player_id = v_player_id
      and s.room_id = p_room_id
  ) w;

  return v_result;
end;
$$;
