create or replace function private.refund_all_bets_v2(p_prediction_id uuid)
returns void
language plpgsql
as $$
declare
  v_bet       public.bets%rowtype;
  v_series_id uuid;
begin
  select series_id into v_series_id
  from public.predictions
  where id = p_prediction_id;

  for v_bet in
    select * from public.bets
    where prediction_id = p_prediction_id
  loop
    update public.series_wallets
    set escrow     = escrow - v_bet.amount,
        updated_at = now()
    where series_id = v_series_id
      and player_id = v_bet.player_id;

    update public.bets
    set payout = v_bet.amount   -- full refund = original stake
    where id = v_bet.id;
  end loop;
end;
$$;
