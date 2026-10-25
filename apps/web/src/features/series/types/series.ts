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
  totalPredictions: number
  activePredictions: number
  completedPredictions: number
  cancelledPredictions: number
  remainingGames: number
  progressPercentage: number
  createdBy:        string
  createdAt:        string
  startedAt:        string | null
  completedAt:      string | null
  archivedAt:       string | null
  // Every member's wallet starts at startingStack and gains weeklyTopup each
  // Monday if they bet the week before.
  startingStack:    number
  weeklyTopup:      number
  topupsPaid:       number
  // Points settings are locked once anyone has bet in the series.
  hasBets:          boolean
  // Players must bet on this many settled predictions to be ranked.
  minBetsToRank:    number
}