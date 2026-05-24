create or replace function public.place_bet(
  p_prediction_id uuid,
  p_option_id     uuid,
  p_amount        integer
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player        public.players%rowtype;
  v_prediction    public.predictions%rowtype;
  v_option        public.prediction_options%rowtype;
  v_existing_bet  public.bets%rowtype;
  v_is_member     boolean;
  v_available     integer;
  v_old_amount    integer := 0;
  v_escrow_delta  integer;
begin
  select * into v_player
  from public.players
  where user_id = auth.uid();

  if not found then
    raise exception 'Player profile not found' using errcode = 'P0004';
  end if;

  select * into v_prediction
  from public.predictions
  where id = p_prediction_id and status = 'draft';

  if not found then
    raise exception 'Prediction not found or not in draft phase' using errcode = 'P0006';
  end if;

  select exists (
    select 1 from public.room_members
    where room_id = v_prediction.room_id and player_id = v_player.id
  ) into v_is_member;

  if not v_is_member then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  if v_prediction.deadline <= now() then
    raise exception 'Betting deadline has passed' using errcode = 'P0007';
  end if;

  select * into v_option
  from public.prediction_options
  where id = p_option_id and prediction_id = p_prediction_id;

  if not found then
    raise exception 'Option does not belong to this prediction' using errcode = 'P0008';
  end if;

  if p_amount < 1 then
    raise exception 'Minimum bet is 1 point' using errcode = 'P0001';
  end if;

  select * into v_existing_bet
  from public.bets
  where prediction_id = p_prediction_id and player_id = v_player.id;

  if found then
    v_old_amount := v_existing_bet.amount;
  end if;

  v_available := v_player.points_balance - v_player.points_in_escrow + v_old_amount;

  if p_amount > v_available then
    raise exception 'Insufficient points. Available: %, Requested: %', v_available, p_amount
    using errcode = 'P0009';
  end if;

  v_escrow_delta := p_amount - v_old_amount;

  if found then
    update public.prediction_options
    set total_bet = total_bet - v_old_amount
    where id = v_existing_bet.option_id;

    update public.bets
    set option_id  = p_option_id,
        amount     = p_amount,
        updated_at = now()
    where id = v_existing_bet.id;
  else
    insert into public.bets (prediction_id, player_id, option_id, amount)
    values (p_prediction_id, v_player.id, p_option_id, p_amount);
  end if;

  update public.prediction_options
  set total_bet = total_bet + p_amount
  where id = p_option_id;

  update public.players
  set points_in_escrow = points_in_escrow + v_escrow_delta
  where id = v_player.id
  returning * into v_player;

  return json_build_object(
    'bet_placed',       true,
    'prediction_id',    p_prediction_id,
    'option_id',        p_option_id,
    'amount',           p_amount,
    'points_available', v_player.points_balance - v_player.points_in_escrow
  );
end;
$$;
