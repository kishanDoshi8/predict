drop function if exists public.get_room_series_selector(uuid, uuid);
create or replace function public.get_room_series_selector(
  p_room_id uuid,
  p_selected_series_id uuid default null,
  p_mode text default 'active-or-last'
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_mode text;
  v_active_count integer := 0;
  v_options json := '[]'::json;
  v_selected_series_id uuid;
  v_latest_completed_series_id uuid;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  if not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.player_id = v_player_id
  ) then
    raise exception 'Room member not found' using errcode = 'P0011';
  end if;

  v_mode := coalesce(nullif(lower(trim(p_mode)), ''), 'active-or-last');

  if v_mode not in ('active', 'active-or-last', 'all') then
    raise exception 'Invalid selector mode: %', p_mode using errcode = 'P0001';
  end if;

  select count(*)::int
  into v_active_count
  from public.series s
  where s.room_id = p_room_id
    and s.status = 'active';

  if v_mode = 'all' then
    select coalesce(
      json_agg(
        json_build_object(
          'id', s.id,
          'title', s.title,
          'status', s.status,
          'started_at', s.started_at,
          'completed_at', s.completed_at,
          'created_at', s.created_at
        )
        order by
          case s.status
            when 'active' then 0
            when 'draft' then 1
            when 'completed' then 2
            else 3
          end,
          coalesce(s.started_at, s.completed_at, s.created_at) desc,
          s.created_at desc
      ),
      '[]'::json
    )
    into v_options
    from public.series s
    where s.room_id = p_room_id
      and s.status <> 'archived';

    if p_selected_series_id is not null
      and exists (
        select 1
        from public.series s
        where s.id = p_selected_series_id
          and s.room_id = p_room_id
          and s.status <> 'archived'
      ) then
      v_selected_series_id := p_selected_series_id;
    else
      v_selected_series_id := null;
    end if;

  elsif v_active_count > 0 then
    select coalesce(
      json_agg(
        json_build_object(
          'id', s.id,
          'title', s.title,
          'status', s.status,
          'started_at', s.started_at,
          'completed_at', s.completed_at,
          'created_at', s.created_at
        )
        order by s.started_at desc nulls last, s.created_at desc
      ),
      '[]'::json
    )
    into v_options
    from public.series s
    where s.room_id = p_room_id
      and s.status = 'active';

    if p_selected_series_id is not null
      and exists (
        select 1
        from public.series s
        where s.id = p_selected_series_id
          and s.room_id = p_room_id
          and s.status = 'active'
      ) then
      v_selected_series_id := p_selected_series_id;
    elsif v_mode = 'active' and v_active_count > 1 then
      v_selected_series_id := null;
    else
      select s.id
      into v_selected_series_id
      from public.series s
      where s.room_id = p_room_id
        and s.status = 'active'
      order by s.started_at desc nulls last, s.created_at desc
      limit 1;
    end if;
  elsif v_mode = 'active' then
    v_selected_series_id := null;
    v_options := '[]'::json;
  else
    select coalesce(
      json_agg(
        json_build_object(
          'id', s.id,
          'title', s.title,
          'status', s.status,
          'started_at', s.started_at,
          'completed_at', s.completed_at,
          'created_at', s.created_at
        )
      ),
      '[]'::json
    )
    into v_options
    from (
      select s.*
      from public.series s
      where s.room_id = p_room_id
        and s.status = 'completed'
      order by s.completed_at desc nulls last, s.created_at desc
      limit 1
    ) s;

    select s.id
    into v_latest_completed_series_id
    from public.series s
    where s.room_id = p_room_id
      and s.status = 'completed'
    order by s.completed_at desc nulls last, s.created_at desc
    limit 1;

    if p_selected_series_id is not null
      and p_selected_series_id = v_latest_completed_series_id then
      v_selected_series_id := p_selected_series_id;
    else
      v_selected_series_id := v_latest_completed_series_id;
    end if;
  end if;

  return json_build_object(
    'selected_series_id', v_selected_series_id,
    'series', v_options
  );
end;
$$;

drop function if exists public.get_room_activities(uuid, integer, timestamptz, uuid, text);
create or replace function public.get_room_activities(
  p_room_id uuid,
  p_limit integer default 20,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_filter text default 'all',
  p_series_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_limit integer;
  v_filter text;
  v_items json;
  v_next_cursor_created_at timestamptz;
  v_next_cursor_id uuid;
  v_has_more boolean := false;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  if not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.player_id = v_player_id
  ) then
    raise exception 'Only room members can view room activities' using errcode = 'P0013';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 20), 50));
  v_filter := coalesce(lower(trim(p_filter)), 'all');

  with scoped as (
    select
      a.id,
      a.activity_type,
      a.activity_tier,
      a.metadata,
      a.click_action,
      a.created_at
    from public.room_activities a
    where a.room_id = p_room_id
      and (
        p_cursor_created_at is null
        or p_cursor_id is null
        or a.created_at < p_cursor_created_at
        or (a.created_at = p_cursor_created_at and a.id < p_cursor_id)
      )
      and (
        v_filter = 'all'
        or (v_filter = 'predictions' and a.activity_type like 'prediction_%')
        or (v_filter = 'duels' and a.activity_type like 'duel_%')
        or (v_filter = 'members' and a.activity_type like 'room_%')
        or (v_filter = 'achievements' and a.activity_type like 'achievement_%')
      )
      and (
        p_series_id is null
        or exists (
          select 1
          from public.predictions p
          where p.id = case
            when coalesce(
              a.metadata ->> 'predictionId',
              a.metadata #>> '{duel,predictionId}',
              a.click_action ->> 'predictionId'
            ) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then coalesce(
              a.metadata ->> 'predictionId',
              a.metadata #>> '{duel,predictionId}',
              a.click_action ->> 'predictionId'
            )::uuid
            else null
          end
            and p.series_id = p_series_id
        )
      )
    order by a.created_at desc, a.id desc
    limit v_limit + 1
  ),
  limited as (
    select *
    from scoped
    order by created_at desc, id desc
    limit v_limit
  ),
  next_cursor as (
    select s.created_at, s.id
    from scoped s
    order by s.created_at desc, s.id desc
    offset v_limit
    limit 1
  )
  select
    coalesce(
      json_agg(
        json_build_object(
          'id', l.id,
          'activityType', l.activity_type,
          'activityTier', l.activity_tier,
          'metadata', l.metadata,
          'clickAction', l.click_action,
          'createdAt', l.created_at
        )
        order by l.created_at desc, l.id desc
      ),
      '[]'::json
    ),
    (select created_at from next_cursor),
    (select id from next_cursor),
    exists(select 1 from next_cursor)
  into v_items, v_next_cursor_created_at, v_next_cursor_id, v_has_more
  from limited l;

  return json_build_object(
    'items', v_items,
    'next_cursor_created_at', v_next_cursor_created_at,
    'next_cursor_id', v_next_cursor_id,
    'has_more', v_has_more
  );
end;
$$;

create or replace function public.get_room_prediction_history(
  p_room_id uuid,
  p_limit   int default 20,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_search text default null,
  p_filter text default 'all',
  p_series_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_caller_id uuid;
  v_is_member boolean;
  v_result    json;
  v_filter text;
  v_search text;
begin
  v_caller_id := private.get_player_id_from_auth();
  if v_caller_id is null then
    raise exception 'Not authenticated' using errcode = 'P0004';
  end if;

  select exists(
    select 1 from public.room_members
    where room_id = p_room_id and player_id = v_caller_id
  ) into v_is_member;

  if not v_is_member then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  p_limit  := greatest(1, least(p_limit, 100));
  v_filter := coalesce(nullif(lower(trim(p_filter)), ''), 'all');
  v_search := nullif(trim(p_search), '');

  /*
    Cursor pagination uses (created_at, id) so ordering is deterministic even when
    multiple predictions share the same created_at timestamp.
  */
  with fetched as (
    select
      pred.id             as prediction_id,
      pred.title,
      pred.status,
      pred.no_result_reason,
      pred.resolved_at,
      pred.created_at,
      pred.winning_option_id,
      pred.series_id,
      pred.series_prediction_number,
      s.title as series_title,
      user_bet.option_id  as selected_option_id,
      selected_opt.label  as selected_option_label,
      creator.username    as creator_username,
      winning_opt.label   as winning_option_label,
      (
        select coalesce(sum(po.total_bet), 0)
        from public.prediction_options po
        where po.prediction_id = pred.id
      ) as total_pool,
      coalesce(bs.participant_count, 0) as participant_count,
      coalesce(bs.participant_count, 0) as total_bets,
      coalesce(bs.winner_count, 0) as winner_count,
      coalesce(bs.total_paid_to_winners, 0) as total_paid_to_winners,
      coalesce(bs.biggest_payout, 0) as biggest_payout,
      (
        select json_agg(
          json_build_object(
            'id',            po2.id,
            'label',         po2.label,
            'total_bet',     po2.total_bet,
            'display_order', po2.display_order
          ) order by po2.display_order
        )
        from public.prediction_options po2
        where po2.prediction_id = pred.id
      ) as options
    from public.predictions pred
    left join public.series s on s.id = pred.series_id
    join public.players creator on creator.id = pred.created_by
    left join public.prediction_options winning_opt
      on winning_opt.id = pred.winning_option_id
    left join public.bets user_bet
      on user_bet.prediction_id = pred.id
      and user_bet.player_id = v_caller_id
    left join public.prediction_options selected_opt
      on selected_opt.id = user_bet.option_id
    left join (
      select
        b.prediction_id,
        count(*) as participant_count,
        count(*) filter (
          where pred2.status = 'revealed'
            and b.option_id = pred2.winning_option_id
        ) as winner_count,
        sum(
          case
            when pred2.status = 'revealed'
              then greatest(coalesce(b.payout, 0) - b.amount, 0)
            else 0
          end
        ) as total_paid_to_winners,
        max(
          case
            when pred2.status = 'revealed'
              then greatest(coalesce(b.payout, 0) - b.amount, 0)
            else 0
          end
        ) as biggest_payout
      from public.bets b
      join public.predictions pred2 on pred2.id = b.prediction_id
      where pred2.room_id = p_room_id
        and pred2.status in ('revealed', 'cancelled', 'no_result')
      group by b.prediction_id
    ) bs on bs.prediction_id = pred.id
    where pred.room_id = p_room_id
      and pred.status in ('revealed', 'cancelled', 'no_result')
      and (p_series_id is null or pred.series_id = p_series_id)
      and (
        p_cursor_created_at is null
        or p_cursor_id is null
        or (pred.created_at, pred.id) < (p_cursor_created_at, p_cursor_id)
      )
      and (
        v_search is null
        or coalesce(pred.title, '') ilike '%' || v_search || '%'
      )
      and case v_filter
        when 'wins' then (
          pred.status = 'revealed'
          and user_bet.option_id is not null
          and user_bet.option_id = pred.winning_option_id
        )
        when 'losses' then (
          pred.status = 'revealed'
          and user_bet.option_id is not null
          and user_bet.option_id <> pred.winning_option_id
        )
        when 'my_bets' then user_bet.option_id is not null
        else true
      end
    order by pred.created_at desc, pred.id desc
    limit p_limit + 1
  ),
  items as (
    select *
    from fetched
    order by created_at desc, prediction_id desc
    limit p_limit
  ),
  pagination as (
    select count(*) > p_limit as has_more
    from fetched
  ),
  tail_item as (
    select i.created_at, i.prediction_id
    from items i
    order by i.created_at asc, i.prediction_id asc
    limit 1
  )
  select json_build_object(
    'items', coalesce((select json_agg(i order by i.created_at desc, i.prediction_id desc) from items i), '[]'::json),
    'next_cursor_created_at', case when p.has_more then t.created_at else null end,
    'next_cursor_id', case when p.has_more then t.prediction_id else null end,
    'has_more', p.has_more
  )
  into v_result
  from pagination p
  left join tail_item t on true;

  return coalesce(
    v_result,
    json_build_object(
      'items', '[]'::json,
      'next_cursor_created_at', null,
      'next_cursor_id', null,
      'has_more', false
    )
  );
end;
$$;

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

drop function if exists private.fire_push_notification(text, uuid, uuid, text, text, text);
create or replace function private.fire_push_notification(
  p_event_type    text,
  p_prediction_id uuid,
  p_room_id       uuid,
  p_title         text,
  p_body          text,
  p_url_path      text,
  p_extra_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_supabase_url     text;
  v_secret           text;
  v_service_role_key text;
  v_app_url          text;
  v_request_id       bigint;
  v_payload          jsonb;
  v_headers          jsonb;
begin
  select value into v_supabase_url
  from private.notification_config
  where key = 'supabase_url';

  select value into v_secret
  from private.notification_config
  where key = 'notification_function_secret';

  -- Skip silently when the operator has not yet populated the config.
  if v_supabase_url is null or v_secret is null then
    return;
  end if;

  select coalesce(value, '') into v_app_url
  from private.notification_config
  where key = 'app_url';

  select value into v_service_role_key
  from private.notification_config
  where key = 'service_role_key';

  -- With verify_jwt = true on the edge function, every request must carry a
  -- valid JWT.  The service_role_key is that JWT for database-triggered calls.
  -- Skip and log a config warning rather than firing a request that will be
  -- rejected by the gateway with a 401.
  if v_service_role_key is null then
    insert into private.notification_dispatch_log
      (event_type, prediction_id, room_id, http_request_id, payload)
    values (
      p_event_type,
      p_prediction_id,
      p_room_id,
      null,
      jsonb_build_object(
        'error', 'Missing service_role_key in private.notification_config. '
                 'Add it to enable JWT-authenticated edge-function calls.'
      )
    );
    return;
  end if;

  v_payload := jsonb_build_object(
    'event_type', p_event_type,
    'room_id',    p_room_id,
    'payload', jsonb_build_object(
      'title', p_title,
      'body',  p_body,
      'url',   v_app_url || p_url_path
    ) || coalesce(p_extra_payload, '{}'::jsonb)
  );

  v_headers := jsonb_build_object(
    'Content-Type',          'application/json',
    'Authorization',         'Bearer ' || v_service_role_key,
    'x-notification-secret', v_secret
  );

  select net.http_post(
    url     := v_supabase_url || '/functions/v1/send-push-notifications',
    headers := v_headers,
    body    := v_payload
  ) into v_request_id;

  insert into private.notification_dispatch_log
    (event_type, prediction_id, room_id, http_request_id, payload)
  values
    (p_event_type, p_prediction_id, p_room_id, v_request_id, v_payload);

exception when others then
  -- Log the failure without aborting the parent transaction.
  insert into private.notification_dispatch_log
    (event_type, prediction_id, room_id, http_request_id, payload)
  values (
    p_event_type,
    p_prediction_id,
    p_room_id,
    null,
    jsonb_build_object(
      'error',            sqlerrm,
      'original_payload', v_payload
    )
  );
end;
$$;

create or replace function private.on_prediction_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_room_name text;
  v_series_title text;
  v_series_prediction_number integer;
  v_extra_payload jsonb;
begin
  select name into v_room_name from public.rooms where id = NEW.room_id;
  select s.title into v_series_title from public.series s where s.id = NEW.series_id;
  v_series_prediction_number := NEW.series_prediction_number;
  v_extra_payload := jsonb_build_object(
    'predictionId', NEW.id,
    'predictionTitle', NEW.title,
    'seriesId', NEW.series_id,
    'seriesTitle', v_series_title,
    'seriesPredictionNumber', v_series_prediction_number
  );

  -- New prediction published (draft = live for betting)
  if TG_OP = 'INSERT' and NEW.status = 'draft' then
    perform private.fire_push_notification(
      'prediction_live',
      NEW.id,
      NEW.room_id,
      '🎯 New Prediction',
      coalesce(v_room_name, 'Your room') || ' · ' || NEW.title,
      '/room/' || NEW.room_id::text,
      v_extra_payload
    );

  -- Organizer (or cron) locked the prediction
  elsif TG_OP = 'UPDATE'
    and OLD.status = 'draft'
    and NEW.status = 'locked'
  then
    perform private.fire_push_notification(
      'prediction_locked',
      NEW.id,
      NEW.room_id,
      '🔒 Betting Closed',
      coalesce(v_room_name, 'Your room') || ' · ' || NEW.title,
      '/room/' || NEW.room_id::text,
      v_extra_payload
    );

  -- Organizer revealed the result (win, no_result, or cancelled)
  elsif TG_OP = 'UPDATE'
    and OLD.status = 'locked'
    and NEW.status in ('revealed', 'no_result', 'cancelled')
  then
    perform private.fire_push_notification(
      'result_revealed',
      NEW.id,
      NEW.room_id,
      '🏆 Result Is In',
      coalesce(v_room_name, 'Your room') || ' · ' || NEW.title,
      '/room/' || NEW.room_id::text,
      v_extra_payload
    );
  end if;

  return NEW;
end;
$$;

create or replace function private.fire_push_notification_for_deadline_1h()
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_now       timestamptz := now();
  v_rec       record;
  v_room_name text;
begin
  for v_rec in
    select
      p.id,
      p.room_id,
      p.title,
      p.series_id,
      p.series_prediction_number,
      s.title as series_title
    from public.predictions p
    left join public.series s on s.id = p.series_id
    where p.status     = 'draft'
      and p.notified_1h = false
      and p.deadline between v_now and v_now + interval '1 hour'
  loop
    select name into v_room_name from public.rooms where id = v_rec.room_id;

    -- Mark first so a concurrent run does not double-send.
    update public.predictions
    set notified_1h = true
    where id = v_rec.id
      and notified_1h = false;   -- guard against race

    if found then
      perform private.fire_push_notification(
        'deadline_1h',
        v_rec.id,
        v_rec.room_id,
        '⏰ 1 Hour Left to Bet!',
        coalesce(v_room_name, 'Your room') || ' · ' || v_rec.title,
        '/room/' || v_rec.room_id::text,
        jsonb_build_object(
          'predictionId', v_rec.id,
          'predictionTitle', v_rec.title,
          'seriesId', v_rec.series_id,
          'seriesTitle', v_rec.series_title,
          'seriesPredictionNumber', v_rec.series_prediction_number
        )
      );
    end if;
  end loop;
end;
$$;

grant execute on function public.get_room_series_selector(uuid, uuid, text) to authenticated;
grant execute on function public.get_room_activities(uuid, integer, timestamptz, uuid, text, uuid) to authenticated;
