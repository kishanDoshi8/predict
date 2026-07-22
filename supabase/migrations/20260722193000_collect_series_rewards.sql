create or replace function private.prevent_series_result_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Series results are immutable once generated' using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'collected_at') is distinct from (to_jsonb(old) - 'collected_at') then
      raise exception 'Series results are immutable once generated' using errcode = 'P0001';
    end if;

    if old.collected_at is null and new.collected_at is not null then
      return new;
    end if;

    if new.collected_at is not distinct from old.collected_at then
      return new;
    end if;

    raise exception 'Series results are immutable once generated' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.collect_series_rewards(
  series_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_auth_user_id uuid;
  v_player_id uuid;
  v_placements_collected integer := 0;
  v_awards_collected integer := 0;
  v_collected_at timestamptz := now();
begin
  v_auth_user_id := auth.uid();
  if v_auth_user_id is null then
    raise exception 'Authentication required' using errcode = 'P0003';
  end if;

  v_player_id := private.get_player_id_from_auth();
  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  if not exists (
    select 1
    from public.series s
    join public.room_members rm
      on rm.room_id = s.room_id
     and rm.player_id = v_player_id
    where s.id = series_id
      and s.status in ('completed', 'archived')
  ) then
    raise exception 'Series not found or access denied' using errcode = 'P0002';
  end if;

  update public.series_placements sp
  set collected_at = v_collected_at
  where sp.series_id = collect_series_rewards.series_id
    and sp.player_id = v_player_id
    and sp.collected_at is null;

  get diagnostics v_placements_collected = row_count;

  update public.series_awards sa
  set collected_at = v_collected_at
  where sa.series_id = collect_series_rewards.series_id
    and sa.player_id = v_player_id
    and sa.collected_at is null;

  get diagnostics v_awards_collected = row_count;

  return json_build_object(
    'placements_collected', v_placements_collected,
    'awards_collected', v_awards_collected,
    'collected_at', v_collected_at
  );
end;
$$;

grant execute on function public.collect_series_rewards(uuid) to authenticated;
