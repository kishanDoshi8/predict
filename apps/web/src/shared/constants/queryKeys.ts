export const roomKeys = {
  all: ["rooms"] as const,

  byCode: (roomCode: string) =>
    [...roomKeys.all, "code", roomCode] as const,

  byPlayer: (playerId: string) =>
    [...roomKeys.all, "player", playerId] as const,

  detail: (roomId: string) =>
    [...roomKeys.all, roomId] as const,

  members: (roomId: string) =>
    [...roomKeys.detail(roomId), "members"] as const,

  activePrediction: (roomId: string) =>
    [...roomKeys.detail(roomId), "activePrediction"] as const,

  activePredictions: (roomId: string) =>
    [...roomKeys.detail(roomId), "activePredictions"] as const,

  prediction: (roomId: string, predictionId: string) =>
    [...roomKeys.detail(roomId), "predictions", predictionId] as const,

  bets: (roomId: string, predictionId: string) =>
    [...roomKeys.detail(roomId), "predictions", predictionId, "bets"] as const,

  myBet: (roomId: string, predictionId: string, playerId: string) =>
    [...roomKeys.detail(roomId), "predictions", predictionId, "myBet", playerId] as const,

  duels: (roomId: string, predictionId: string) =>
    [...roomKeys.detail(roomId), "predictions", predictionId, "duels"] as const,

  duelSummary: (roomId: string, predictionId: string) =>
    [...roomKeys.detail(roomId), "predictions", predictionId, "duelSummary"] as const,

  preferences: (roomId: string) =>
    [...roomKeys.detail(roomId), "preferences"] as const,

  leaderboard: (roomId: string, sortBy = "points") =>
    [...roomKeys.detail(roomId), "leaderboard", sortBy] as const,

  stats: (roomId: string) =>
    [...roomKeys.detail(roomId), "stats"] as const,

  weeklyLeaderboard: (roomId: string, sortBy = "points") =>
    [...roomKeys.detail(roomId), "weeklyLeaderboard", sortBy] as const,

  predictionHistory: (roomId: string) =>
    [...roomKeys.detail(roomId), "predictionHistory"] as const,

  roomMemberStats: (roomId: string, playerId: string) =>
    [...roomKeys.detail(roomId), "memberProfile", playerId, "stats"] as const,

  roomMemberRecentPredictions: (roomId: string, playerId: string, limit = 5, offset = 0) =>
    [...roomKeys.detail(roomId), "memberProfile", playerId, "recentPredictions", limit, offset] as const,
};

export const localStorageKeys = {
  userPreference: {
    theme: "theme",
    leaderboard: {
      active_leaderboard_tab: "active_leaderboard_tab",
      sort_by: "sort_by",
    },
    bettingContorls: {
      collapsed: "bettingControls.collapsed",
    }
  }
}