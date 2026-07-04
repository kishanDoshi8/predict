import { Player, Prediction, PredictionStatus, Room, PredictionHistoryPage, PredictionHistoryFilter, LeaderboardEntry, DefaultRoomStat, RoomMemberRecentPrediction, RoomMemberStats, Duel, DuelSummary } from '@/types'
import type { Json } from '@/types/supabase'
import { supabase } from './supabase'

export type PreferenceSettings = {
  prediction_live: boolean
  prediction_locked: boolean
  deadline_1h: boolean
  result_revealed: boolean
  weekly_points_claim: boolean
  dark_mode: boolean
  sounds_enabled: boolean
}

export type RoomPreferenceOverrides = {
  prediction_live: boolean | null
  prediction_locked: boolean | null
  deadline_1h: boolean | null
  result_revealed: boolean | null
  weekly_points_claim: boolean | null
  dark_mode: boolean | null
  sounds_enabled: boolean | null
}

export type PreferenceResponse = {
  room_id: string | null
  has_seen_how_to_play: boolean
  has_seen_ratings_tip: boolean
  global: PreferenceSettings
  room_overrides: RoomPreferenceOverrides
  effective: PreferenceSettings
}

export type NotificationEventType =
  | 'prediction_live'
  | 'prediction_locked'
  | 'deadline_1h'
  | 'result_revealed'
  | 'weekly_points_claim'

// ============================================================
// API — thin wrappers around Supabase RPC functions
// All functions throw on error so callers can catch uniformly.
// Auth context is automatically attached from the Supabase session.
// ============================================================

function assertOk<T>(data: T | null, error: unknown): T {
  if (error) throw error
  if (data === null) throw new Error('No data returned')
  return data
}

type UntypedSupabaseClient = {
  from: (table: string) => any
  rpc: (fn: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
}

const untypedSupabase = supabase as unknown as UntypedSupabaseClient

// #region Players & Session
// -------------------------------------------------------
export async function createPlayer(username: string) {
  const { data, error } = await supabase.rpc('register_player', {
    p_username: username,
  })
  return assertOk(data, error) as {
    player_id: string
    username: string
  }
}

export async function getPlayer(): Promise<Player> {
  const { data, error } = await supabase.rpc('get_player')
  return assertOk(data, error) as {
    id: string
    username: string
    points_in_escrow: number
    points_balance: number
    total_won: number
    current_streak: number
    longest_streak: number
    last_claim_at: string | null
  }
}

// #endregion Players & Session

// #region Rooms
// -------------------------------------------------------

export async function createRoom(room_name: string): Promise<Room> {
  const { data, error } = await supabase.rpc('create_room', {
    p_room_name: room_name,
  })
  const room = assertOk(data, error) as {
    id: string
    code: string
    name: string
    status: string
    player_id: string
    username: string
    created_at: string
  }
  const members = await getRoomMembers(room.id)

  return {
    ...room,
    members: members,
    // predictions_limit is not returned by the create_room RPC; default to 5.
    // The useRoom hook always re-fetches via spectateRoom (select *) which has the real value.
    predictions_limit: 5,
  }
}

export async function getRoomMembers(roomId: string) {
  const { data, error } = await supabase
    .from("room_members")
    .select(`
      id,
      room_id,
      player_id,
      is_organizer,
      joined_at,
      total_won_in_room,
      player:players (
        id,
        username
      )
    `)
    .eq("room_id", roomId)

  if (error) throw error
  return data ?? []
}

export async function spectateRoom(roomCode: string): Promise<Room> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('room_code', roomCode.toUpperCase())
    .single()

  if (error) throw error
  const members = await getRoomMembers(data.id)

  return {
    ...data,
    code: data.room_code,
    members,
  }
}

export async function joinRoom(roomCode: string): Promise<Room> {
  const { data, error } = await supabase.rpc('join_room', {
    p_room_code: roomCode,
  })
  const room = assertOk(data, error) as {
    id: string
    code: string
    name: string
    status: string
    player_id: string
    username: string
    created_at: string
  }
  const members = await getRoomMembers(room.id)
  
  return {
    ...room,
    members: members,
    // predictions_limit is not returned by the join_room RPC; default to 5.
    // The useRoom hook always re-fetches via spectateRoom (select *) which has the real value.
    predictions_limit: 5,
  }
}

export async function getPlayerRooms(player_id: string): Promise<Room[]> {
  const { data, error } = await supabase
    .from('player_rooms_by_activity')
    .select('*')
    .eq('player_id', player_id)
    .order('latest_prediction_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  if (!data) return [];

  return data.map((row: any): Room => ({
    id: row.room_id,
    name: row.name,
    code: row.room_code,
    status: row.status,
    predictions_limit: row.predictions_limit,
    created_at: row.created_at,
    
    // UI Counter Helpers
    member_count: row.member_count ?? 0,
    active_prediction_count: row.active_prediction_count ?? 0,
    members: Object.assign([], { length: row.member_count ?? 0 })
  }));
}

// #endregion Rooms

// #region Weekly Points
// -------------------------------------------------------

export async function claimWeeklyPoints(autoClaimed = true) {
  const { data, error } = await supabase.rpc('claim_weekly_points', {
    p_auto_claimed: autoClaimed,
  })
  return assertOk(data, error) as {
    claimed: boolean
    already_claimed: boolean
    week_key: string
    points_added: number
    points_balance: number
    current_streak: number
    longest_streak: number
    auto_claimed: boolean
  }
}

// #endregion Weekly Points

// #region Preferences
// -------------------------------------------------------
export async function getPreferences(roomId?: string) {
  const { data, error } = await supabase.rpc('get_preferences', {
    p_room_id: roomId ?? undefined,
  })

  return assertOk(data, error) as PreferenceResponse
}

export async function updateGlobalPreferences(
  preferences: PreferenceSettings,
) {
  const { data, error } = await supabase.rpc('update_global_preferences', {
    p_prediction_live: preferences.prediction_live,
    p_prediction_locked: preferences.prediction_locked,
    p_deadline_1h: preferences.deadline_1h,
    p_result_revealed: preferences.result_revealed,
    p_weekly_points_claim: preferences.weekly_points_claim,
    p_dark_mode: preferences.dark_mode,
    p_sounds_enabled: preferences.sounds_enabled,
  })

  return assertOk(data, error) as PreferenceResponse
}

export async function updateRoomPreferences(
  roomId: string,
  preferences: RoomPreferenceOverrides,
) {
  const { data, error } = await supabase.rpc('update_room_preferences', {
    p_room_id: roomId,
    p_prediction_live: preferences.prediction_live ?? undefined,
    p_prediction_locked: preferences.prediction_locked ?? undefined,
    p_deadline_1h: preferences.deadline_1h ?? undefined,
    p_result_revealed: preferences.result_revealed ?? undefined,
    p_weekly_points_claim: preferences.weekly_points_claim ?? undefined,
    p_dark_mode: preferences.dark_mode ?? undefined,
    p_sounds_enabled: preferences.sounds_enabled ?? undefined,
  })

  return assertOk(data, error) as PreferenceResponse
}

export async function resetRoomPreferences(roomId: string) {
  const { data, error } = await supabase.rpc('reset_room_preferences', {
    p_room_id: roomId,
  })

  return assertOk(data, error) as PreferenceResponse
}

export async function markHowToPlaySeen() {
  const { error } = await supabase.rpc('mark_how_to_play_seen')
  if (error) throw error
}

export async function markRatingsTipSeen() {
  const { error } = await supabase.rpc('mark_ratings_tip_seen')
  if (error) throw error
}

export async function upsertPushSubscription(
  subscription: PushSubscriptionJSON,
) {
  const { data, error } = await supabase.rpc('upsert_user_push_subscription', {
    p_subscription: subscription as unknown as Json,
  })

  return assertOk(data, error) as string
}

export async function sendPushNotificationTrigger(args: {
  event_type: NotificationEventType
  payload?: Record<string, unknown>
}) {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers: Record<string, string> = {}
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }

  const { data, error } = await supabase.functions.invoke(
    'send-push-notifications',
    {
      body: args,
      headers,
    },
  )

  return assertOk(data, error) as {
    sent_count: number
    failed_count: number
    pruned_count: number
    target_count: number
  }
}

// #endregion Preferences

// #region Predictions
// -------------------------------------------------------

export async function createPrediction(
  roomId: string,
  title: string,
  options: string[],
  deadline: Date,
): Promise<Prediction> {
  const { data, error } = await supabase.rpc('create_prediction', {
    p_room_id: roomId,
    p_title: title,
    p_options: options,
    p_deadline: deadline.toISOString(),
  })
  const prediction = assertOk(data, error) as {
    prediction_id: string
    title: string
    status: string
    deadline: string
    option_ids: string[]
    winning_option_id: string | null
    resolved_at: string | null
  }

  const predictionOptions = prediction.option_ids.map((optionId, index) => ({
    id: optionId,
    prediction_id: prediction.prediction_id,
    label: options[index],
    display_order: index,
    total_bet: 0,
  }))

  const bets = await getBetsForPrediction(prediction.prediction_id)

  for (const bet of bets) {
    const option = predictionOptions.find((opt) => opt.id === bet.option_id)
    if (option) {
      option.total_bet += bet.amount
    }
  }

  return {
    ...prediction,
    id: prediction.prediction_id,
    room_id: roomId,
    winning_option_id: prediction.winning_option_id ?? null,
    resolved_at: prediction.resolved_at ?? null,
    status: prediction.status as PredictionStatus,
    prediction_options: predictionOptions,
  }
}

export async function getPrediction(predictionId: string) {
  const { data, error } = await supabase
    .from('predictions')
    .select(`*`)
    .eq('id', predictionId)
    .maybeSingle()
  
  if (error) throw error
  if (!data) return null

  const { data: predictionOptions, error: optionsError } = await supabase
    .from('prediction_options')
    .select('*')
    .eq('prediction_id', data.id)
    .order('display_order', { ascending: true })
  if (optionsError) throw optionsError

  return {
    ...data,
    status: data.status as PredictionStatus,
    prediction_options: predictionOptions ?? [],
  }
}


export async function getActivePrediction(roomId: string) {
  const { data, error } = await supabase
    .from('predictions')
    .select(`*`)
    .eq('room_id', roomId)
    // .in('status', ['draft', 'locked'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const { data: predictionOptions, error: optionsError } = await supabase
    .from('prediction_options')
    .select('*')
    .eq('prediction_id', data.id)
    .order('display_order', { ascending: true })

  if (optionsError) throw optionsError

  return {
    ...data,
    status: data.status as PredictionStatus,
    prediction_options: predictionOptions ?? [],
  }
}

export async function getActivePredictions(roomId: string): Promise<Prediction[]> {
  // First: fetch all active (draft/locked) predictions ordered by deadline asc
  const { data: activeRows, error: activeError } = await supabase
    .from('predictions')
    .select('*')
    .eq('room_id', roomId)
    .in('status', ['draft', 'locked'])
    .order('deadline', { ascending: true })

  if (activeError) throw activeError

  if (activeRows && activeRows.length > 0) {
    // Fetch options for each active prediction in parallel
    const predictions = await Promise.all(
      activeRows.map(async (row: typeof activeRows[0]) => {
        const { data: opts, error: optsErr } = await supabase
          .from('prediction_options')
          .select('*')
          .eq('prediction_id', row.id)
          .order('display_order', { ascending: true })
        if (optsErr) throw optsErr
        return {
          ...row,
          status: row.status as PredictionStatus,
          prediction_options: opts ?? [],
        }
      })
    )
    return predictions
  }

  // Fallback: no active predictions — return the most recently completed prediction
  const { data: fallbackRows, error: fallbackError } = await supabase
    .from('predictions')
    .select('*')
    .eq('room_id', roomId)
    .in('status', ['revealed', 'cancelled', 'no_result'])
    .order('resolved_at', { ascending: false })
    .limit(1)

  if (fallbackError) throw fallbackError
  if (!fallbackRows || fallbackRows.length === 0) return []

  const fallback = fallbackRows[0]
  const { data: fallbackOpts, error: fallbackOptsErr } = await supabase
    .from('prediction_options')
    .select('*')
    .eq('prediction_id', fallback.id)
    .order('display_order', { ascending: true })
  if (fallbackOptsErr) throw fallbackOptsErr

  return [
    {
      ...fallback,
      status: fallback.status as PredictionStatus,
      prediction_options: fallbackOpts ?? [],
    },
  ]
}

export async function getPredictionHistory(roomId: string) {
  const { data, error } = await supabase
    .from('predictions')
    .select(`*`)
    .eq('room_id', roomId)
    .in('status', ['revealed', 'cancelled', 'no_result'])
    .order('resolved_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function resolvePrediction(
  predictionId: string,
  roomId: string,
  outcome: 'win' | 'no_result' | 'cancel',
  winningOptionId?: string,
  noResultReason?: string | null,
) {  
  const { data, error } = await supabase.rpc('resolve_prediction_v2', {
    p_prediction_id: predictionId,
    p_room_id: roomId,
    p_outcome: outcome,
    p_winning_option_id: winningOptionId ?? undefined,
    p_no_result_reason: noResultReason ?? undefined,
  })
  return assertOk(data, error)
}

// #endregion Predictions

// #region Bets
// -------------------------------------------------------
export async function getBetsForPrediction(predictionId: string) {
  const { data, error } = await supabase
    .from('bets')
    .select(`
      id,
      prediction_id,
      option_id,
      player_id,
      amount,
      updated_at,
      payout,
      option:prediction_options (
        id,
        label
      )  
    `)
    .eq('prediction_id', predictionId)
    .order('amount', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function placeBet(
  predictionId: string,
  optionId: string,
  amount: number,
) {
  const { data, error } = await supabase.rpc('place_bet', {
    p_prediction_id: predictionId,
    p_option_id: optionId,
    p_amount: amount,
  })
  return assertOk(data, error) as {
    bet_placed: boolean
    prediction_id: string
    option_id: string
    amount: number
    points_available: number
  }
}

export async function cancelBet(predictionId: string) {
  const { data, error } = await supabase.rpc('cancel_bet', {
    p_prediction_id: predictionId,
  })
  return assertOk(data, error)
}

export async function getMyBet(predictionId: string, playerId: string) {
  const { data, error } = await supabase
    .from('bets')
    .select('*')
    .eq('prediction_id', predictionId)
    .eq('player_id', playerId)
    .maybeSingle()

  if (error) throw error
  return data
}
// #endregion Bets

// #region Duels
// -------------------------------------------------------

export async function getPredictionDuels(predictionId: string): Promise<Duel[]> {
  const { data, error } = await untypedSupabase.rpc('get_prediction_duels_view', {
    p_prediction_id: predictionId,
  })
  return assertOk(data, error) as Duel[]
}

export async function getPredictionDuelSummary(
  predictionId: string,
): Promise<DuelSummary> {
  const { data, error } = await untypedSupabase.rpc('get_prediction_duel_summary', {
    p_prediction_id: predictionId,
  })
  return assertOk(data, error) as DuelSummary
}

export async function createDuel(
  predictionId: string,
  challengerPlayerId: string,
  betId: string,
  stakeAmount: number,
): Promise<Duel> {
  const { data, error } = await untypedSupabase.rpc('create_duel_view', {
    p_prediction_id: predictionId,
    p_challenger_player_id: challengerPlayerId,
    p_bet_id: betId,
    p_stake_amount: stakeAmount,
  })
  return assertOk(data, error) as Duel
}

export async function joinDuelQueue(
  duelId: string,
  playerId: string,
  betId: string,
): Promise<Duel> {
  const { data, error } = await untypedSupabase.rpc('join_duel_queue_view', {
    p_duel_id: duelId,
    p_player_id: playerId,
    p_bet_id: betId,
  })
  return assertOk(data, error) as Duel
}

export async function cancelDuel(
  duelId: string,
  playerId: string,
): Promise<Duel> {
  const { data, error } = await untypedSupabase.rpc('cancel_duel_view', {
    p_duel_id: duelId,
    p_player_id: playerId,
  })
  return assertOk(data, error) as Duel
}

export async function cancelDuelQueue(
  duelId: string,
  playerId: string,
): Promise<Duel> {
  const { data, error } = await untypedSupabase.rpc('cancel_duel_queue_view', {
    p_duel_id: duelId,
    p_player_id: playerId,
  })
  return assertOk(data, error) as Duel
}
// #endregion Duels

// #region Leaderboard
export async function getRoomLeaderboard(
  roomId: string,
  sortBy: 'points' | 'rating' | 'accuracy' | 'streak' = 'points',
) {
  const { data, error } = await supabase.rpc('get_room_leaderboard', {
    p_room_id: roomId,
    p_sort_by: sortBy,
  })
  return assertOk(data, error) as LeaderboardEntry[]
}

export async function getRoomWeeklyLeaderboard(
  roomId: string,
  sortBy: 'points' | 'rating' | 'accuracy' | 'streak' = 'points',
) {
  const { data, error } = await supabase.rpc('get_room_weekly_leaderboard', {
    p_room_id: roomId,
    p_sort_by: sortBy,
  })
  return assertOk(data, error) as LeaderboardEntry[]
}

type GetRoomPredictionHistoryParams = {
  roomId: string
  limit?: number
  cursorCreatedAt?: string | null
  cursorId?: string | null
  search?: string | null
  filter?: PredictionHistoryFilter
}

export async function getRoomPredictionHistory({
  roomId,
  limit = 20,
  cursorCreatedAt = null,
  cursorId = null,
  search = null,
  filter = 'all',
}: GetRoomPredictionHistoryParams) {
  const { data, error } = await supabase.rpc('get_room_prediction_history', {
    p_room_id: roomId,
    p_limit:   limit,
    p_cursor_created_at: cursorCreatedAt,
    p_cursor_id: cursorId,
    p_search: search,
    p_filter: filter,
  })
  return assertOk(data, error) as PredictionHistoryPage
}


export async function getRoomMemberStats(roomId: string, playerId: string) {
  const { data, error } = await supabase.rpc('get_room_member_stats', {
    p_room_id: roomId,
    p_player_id: playerId,
  })

  return assertOk(data, error) as RoomMemberStats
}

export async function getRoomMemberRecentPredictions(
  roomId: string,
  playerId: string,
  limit = 5,
  offset = 0,
) {
  const { data, error } = await supabase.rpc('get_room_member_recent_predictions', {
    p_room_id: roomId,
    p_player_id: playerId,
    p_limit: limit,
    p_offset: offset,
  })

  return assertOk(data, error) as RoomMemberRecentPrediction[]
}

export async function getRoomStatCards(roomId: string, limit = 5) {
  const { data, error } = await supabase.rpc('get_room_stat_cards', {
    p_room_id: roomId,
    p_limit: limit,
  })

  return assertOk(data, error) as DefaultRoomStat[]
}
// #endregion Leaderboard
