type PreviewBet = {
	player_id: string;
	option_id: string;
	amount: number;
};

// What a player would gain if their option wins, given the bets so far.
// Mirrors resolve_prediction_v2: each losing bet is shared across the winners
// by stake (rounded down), and a losing bet larger than all winning stakes
// combined pays each winner their stake and refunds the rest.
export function previewWinnings(
	bets: PreviewBet[],
	playerId: string,
	optionId: string,
	amount: number,
): number {
	if (amount < 1) return 0;

	const others = bets.filter((bet) => bet.player_id !== playerId);
	const winners = others.filter((bet) => bet.option_id === optionId);
	const losers = others.filter((bet) => bet.option_id !== optionId);
	const winnerTotal = winners.reduce((sum, bet) => sum + bet.amount, 0) + amount;

	return losers.reduce((gain, loser) => {
		if (loser.amount >= winnerTotal) return gain + amount;
		return gain + Math.floor((amount / winnerTotal) * loser.amount);
	}, 0);
}
