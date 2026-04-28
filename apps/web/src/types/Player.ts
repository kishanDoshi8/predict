

export interface Player {
    id:               string
    username:         string
    points_in_escrow: number
    points_balance:   number
    total_won:        number
    current_streak:   number
    longest_streak:   number
    last_claim_at:    string | null
}