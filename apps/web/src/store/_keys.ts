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

  preferences: (roomId: string) =>
    [...roomKeys.detail(roomId), "preferences"] as const,

  leaderboard: (roomId: string) =>
    [...roomKeys.detail(roomId), "leaderboard"] as const,

  weeklyLeaderboard: (roomId: string) =>
    [...roomKeys.detail(roomId), "weeklyLeaderboard"] as const,

  predictionHistory: (roomId: string) =>
    [...roomKeys.detail(roomId), "predictionHistory"] as const,
};
