
export interface RoomMember {
  id:       string
  room_id:  string
  player_id: string
  is_organizer: boolean
  total_won_in_room: number
  joined_at: string
  player: {
    id: string
    username: string,
  }
}

export interface Room {
  id:                string
  code:              string
  name:              string
  status:            string
  created_at:        string
  members:           RoomMember[]
  // Max concurrent active (draft/locked) predictions. Read-only from the app layer.
  predictions_limit: number
}