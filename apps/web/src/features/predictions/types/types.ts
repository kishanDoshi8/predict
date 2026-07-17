export type PredictionStatus = 'draft' | 'locked' | 'revealed' | 'cancelled' | 'no_result'
export type SeriesStatus = 'draft' | 'active' | 'completed' | 'archived'

export interface PredictionTag {
  id:            string
  prediction_id: string
  tag:           string
  created_at:    string
}

export interface Series {
  id:               string
  roomId:           string
  title:            string
  description:      string | null
  status:           SeriesStatus
  expectedGames:    number
  predictionCount:  number
  completedGames:   number
  createdBy:        string
  createdAt:        string
  startedAt:        string | null
  completedAt:      string | null
  archivedAt:       string | null
}

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
  series_id?:        string | null
  series_prediction_number?: number | null
  seriesId?:         string | null
  seriesPredictionNumber?: number | null
  tags?:             PredictionTag[]
  title:             string
  status:            PredictionStatus
  // deadline is supabase timstamp string, e.g. "2024-06-01T12:00:00Z"
  deadline:          string
  winning_option_id: string | null
  // created_at:        string
  resolved_at:       string | null
  prediction_options: PredictionOption[]
  no_result_reason?: string | null
}