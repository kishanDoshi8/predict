import { Cut, Leader, ReceiptFooter, Slip, SlipHeader } from "@/features/share/components/Slip";
import { receipt, type CardFormat } from "@/features/share/tokens";

export type ChampionPosterData = {
	roomName: string;
	roomCode: string;
	host: string;
	seriesTitle: string;
	standings: Array<{ rank: number; username: string; balance: number; netProfit: number }>;
	awards: Array<{ label: string; username: string; value: string }>;
};

// What fits on each format; the rest is summarised.
const MAX_ROWS = { post: 4, story: 9 } as const;
const MAX_AWARDS = { post: 2, story: 4 } as const;

// The champion's name is the loudest thing; long names step down to fit.
function nameSize(name: string) {
	if (name.length <= 6) return 230;
	if (name.length <= 9) return 180;
	if (name.length <= 13) return 136;
	return 104;
}

function signed(value: number) {
	if (value === 0) return "±0";
	return `${value > 0 ? "+" : "−"}${Math.abs(value).toLocaleString()}`;
}

// The final standings of a series, printed as a receipt under the champion.
export function ChampionPoster({
	data,
	format,
}: Readonly<{ data: ChampionPosterData; format: CardFormat }>) {
	const [champion] = data.standings;
	const rows = data.standings.slice(0, MAX_ROWS[format]);
	const hidden = data.standings.length - rows.length;
	const awards = data.awards.slice(0, MAX_AWARDS[format]);

	return (
		<Slip format={format} tilt={1}>
			<SlipHeader room={data.roomName} context={`${data.seriesTitle}, final standings`} />
			<Cut />
			{champion ? (
				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<span style={{ fontSize: 34, fontWeight: 700 }}>Champion</span>
					<span
						style={{
							fontFamily: receipt.display,
							fontWeight: 800,
							fontSize: nameSize(champion.username),
							lineHeight: 0.88,
							letterSpacing: -2,
							color: receipt.brand,
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
						}}
					>
						{champion.username}
					</span>
					<div style={{ marginTop: 16 }}>
						<Leader label='Profit this series' value={`${signed(champion.netProfit)} pts`} />
					</div>
				</div>
			) : null}
			<Cut double />
			<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
				{rows.map((entry) => (
					<Leader
						key={entry.username}
						label={`${entry.rank}. ${entry.username}`}
						value={`${entry.balance.toLocaleString()} pts`}
						valueStyle={entry.rank === 1 ? { color: receipt.brand } : undefined}
					/>
				))}
				{hidden > 0 ? (
					<span style={{ color: receipt.faded }}>and {hidden} more</span>
				) : null}
			</div>
			{awards.length > 0 ? (
				<>
					<Cut />
					<div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 28 }}>
						{awards.map((award) => (
							<Leader
								key={award.label}
								label={award.label}
								value={`${award.username}, ${award.value}`}
							/>
						))}
					</div>
				</>
			) : null}
			<ReceiptFooter host={data.host} roomCode={data.roomCode} label='Next series at' />
		</Slip>
	);
}
