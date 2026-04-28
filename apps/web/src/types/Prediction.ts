

export type PredictionStatus = 'draft' | 'locked' | 'revealed' | 'cancelled' | 'no_result'

export interface PredictionOption {
  id:            string
  prediction_id: string
  label:         string
  display_order: number
  total_bet:     number
}

export interface Prediction {
  id:                string
  room_id:           string
  title:             string
  status:            PredictionStatus
  // deadline is supabase timstamp string, e.g. "2024-06-01T12:00:00Z"
  deadline:          string
  winning_option_id: string | null
  // created_at:        string
  resolved_at:       string | null
  prediction_options: PredictionOption[]
}