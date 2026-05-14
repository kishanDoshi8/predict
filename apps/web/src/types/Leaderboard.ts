export type LeaderboardEntry = {
  player_id:          string
  username:           string
  total_won_in_room:  number
  joined_at:          string
  is_organizer:       boolean
  current_streak:     number
  longest_streak:     number
  total_bets:         number
  total_revealed_bets:number
  winning_bets:       number
  total_wagered:      number
  total_payout:       number
  net_points:         number
  win_percentage:     number
  rank:               number
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
  status:               'revealed' | 'cancelled' | 'no_result'
  resolved_at:          string | null
  created_at:           string
  winning_option_id:    string | null
  creator_username:     string
  winning_option_label: string | null
  total_pool:           number
  total_bets:           number
  winner_count:         number
  options:              PredictionHistoryOption[] | null
}
