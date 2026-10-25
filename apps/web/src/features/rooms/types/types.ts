
import type { RoomRole } from "@/features/rooms/lib/roles";

export interface RoomMember {
  id:       string
  room_id:  string
  player_id: string
  role: RoomRole
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
  description?:      string | null
  status:            string
  created_at:        string
  members:           RoomMember[]
  has_unseen_activities?: boolean
  // Max concurrent active (draft/locked) predictions. The owner can change it.
  predictions_limit: number
  // Hours after a deadline before staff get a "result needed" push.
  result_reminder_hours?: number

  // UI helper properties
  member_count?: number
  active_prediction_count?: number
  // Set by the invite-code lookup, which non-members can use before joining.
  organizer_username?: string | null
}