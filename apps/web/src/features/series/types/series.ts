export type SeriesStatus = 'draft' | 'active' | 'completed' | 'archived'


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