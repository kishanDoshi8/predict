create or replace function public.update_streaks_after_resolution(
  p_room_id uuid,
  p_prediction_id uuid,
  p_winning_option_id uuid,
  p_outcome text
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if p_outcome <> 'win' or p_winning_option_id is null then
    return;
  end if;

  update public.room_members rm
  set current_streak = rm.current_streak + 1,
      highest_streak = greatest(rm.highest_streak, rm.current_streak + 1)
  where rm.room_id = p_room_id
    and exists (
      select 1
      from public.bets b
      where b.prediction_id = p_prediction_id
        and b.player_id = rm.player_id
        and b.option_id = p_winning_option_id
    );

  update public.room_members rm
  set current_streak = 0
  where rm.room_id = p_room_id
    and exists (
      select 1
      from public.bets b
      where b.prediction_id = p_prediction_id
        and b.player_id = rm.player_id
        and b.option_id <> p_winning_option_id
    );
end;
$$;
