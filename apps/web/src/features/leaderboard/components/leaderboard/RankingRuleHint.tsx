// Why some players are "not ranked yet": the bar every player clears first.
export function RankingRuleHint({ requiredBets }: Readonly<{ requiredBets: number }>) {
	return (
		<>
			<p>
				Bet on {requiredBets > 0 ? requiredBets : "a few"} settled{" "}
				{requiredBets === 1 ? "prediction" : "predictions"} in this series
				to be ranked.
			</p>
			<p className='mt-2 text-muted-foreground'>
				Only ranked players can win the series or its awards, so nobody
				tops the table just by sitting on their starting points.
			</p>
		</>
	);
}
