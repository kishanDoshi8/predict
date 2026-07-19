export type LeaderboardEntry = {
  player_id:          string
  username:           string
  total_won_in_room:  number
  joined_at:          string
  is_organizer:       boolean
  current_streak:     number
  highest_streak:     number
  prediction_rating:  number
  peak_prediction_rating: number
  rated_predictions_count: number
  total_bets:         number
  total_revealed_bets:number
  winning_bets:       number
  total_wagered:      number
  total_payout:       number
  net_points:         number
  win_percentage:     number
  rank:               number
  previous_rank: number | null
  rank_change: number | null
  previous_prediction_rating: number | null
  rating_change: number | null
  previous_total_won_in_room: number | null
  points_change: number | null
}

export type PredictionHistoryOption = {
  id:            string
  label:         string
  total_bet:     number
  display_order: number
}

export type PredictionHistoryEntry = {
  prediction_id:        string
  title:                string
  series_id:            string | null
  series_title:         string | null
  series_prediction_number: number | null
  status:               'revealed' | 'cancelled' | 'no_result'
  no_result_reason:     string | null
  resolved_at:          string | null
  created_at:           string
  winning_option_id:    string | null
  creator_username:     string
  winning_option_label: string | null
  total_pool:           number
  participant_count:    number
  total_bets:           number
  winner_count:         number
  total_paid_to_winners:number
  biggest_payout:       number
  selected_option_id  : string | null
  selected_option_label: string | null
  options:              PredictionHistoryOption[] | null
}

export type PredictionHistoryFilter = "all" | "wins" | "losses" | "my_bets"

export type SortByOption = "points" | "ratings"

export type PredictionHistoryPage = {
  items: PredictionHistoryEntry[]
  next_cursor_created_at: string | null
  next_cursor_id: string | null
  has_more: boolean
}


export type RoomMemberStats = {
  player_id: string
  username: string
  current_points: number
  points_rank: number
  current_rating: number
  peak_rating: number
  rating_rank: number
  total_predictions: number
  winning_predictions: number
  total_rated_predictions: number
  current_win_streak: number
  highest_win_streak: number
  activity_streak: number
  largest_win_bet: number
  largest_win_payout: number
  largest_win_multiplier: number
}

export type RoomMemberRecentPrediction = {
  prediction_id: string
  prediction_title: string
  selected_option: string
  result: "won" | "lost" | "no_result"
  resolved_at: string
}
