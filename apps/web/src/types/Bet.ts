

export interface Bet {
  id:            string
  prediction_id: string
  player_id:     string
  option_id:     string
  amount:        number
  payout:        number | null
}
