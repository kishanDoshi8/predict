create or replace function private.build_prediction_activity_metadata(
  p_prediction_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_prediction public.predictions%rowtype;
  v_series_title text := null;
  v_total_bets integer := 0;
  v_total_wagered integer := 0;
  v_option_totals jsonb := '[]'::jsonb;
  v_winning_option_label text := null;
begin
  select * into v_prediction
  from public.predictions
  where id = p_prediction_id;

  if not found then
    return '{}'::jsonb;
  end if;

  select
    count(*)::int,
    coalesce(sum(amount), 0)::int
  into v_total_bets, v_total_wagered
  from public.bets
  where prediction_id = p_prediction_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'optionId', po.id,
        'label', po.label,
        'totalBet', po.total_bet,
        'displayOrder', po.display_order
      )
      order by po.display_order asc
    ),
    '[]'::jsonb
  )
  into v_option_totals
  from public.prediction_options po
  where po.prediction_id = p_prediction_id;

  if v_prediction.winning_option_id is not null then
    select po.label into v_winning_option_label
    from public.prediction_options po
    where po.id = v_prediction.winning_option_id;
  end if;

  if v_prediction.series_id is not null then
    select s.title into v_series_title
    from public.series s
    where s.id = v_prediction.series_id;
  end if;

  return jsonb_build_object(
    'predictionId', v_prediction.id,
    'title', v_prediction.title,
    'seriesId', v_prediction.series_id,
    'seriesTitle', v_series_title,
    'seriesPredictionNumber', v_prediction.series_prediction_number,
    'status', v_prediction.status,
    'deadline', v_prediction.deadline,
    'resolvedAt', v_prediction.resolved_at,
    'winningOptionId', v_prediction.winning_option_id,
    'winningOptionLabel', v_winning_option_label,
    'noResultReason', v_prediction.no_result_reason,
    'totalBets', v_total_bets,
    'totalWagered', v_total_wagered,
    'optionTotals', v_option_totals
  );
end;
$$;
