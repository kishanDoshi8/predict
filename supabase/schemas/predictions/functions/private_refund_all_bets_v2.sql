create or replace function private.refund_all_bets_v2(p_prediction_id uuid)
returns void
language plpgsql
as $$
declare
  v_bet public.bets%rowtype;
begin
  for v_bet in
    select * from public.bets
    where prediction_id = p_prediction_id
  loop
    update public.players
    set points_in_escrow = points_in_escrow - v_bet.amount
    where id = v_bet.player_id;

    update public.bets
    set payout = v_bet.amount   -- full refund = original stake
    where id = v_bet.id;
  end loop;
end;
$$;
