import { Cut, Leader, ReceiptFooter, Slip, SlipHeader } from "@/features/share/components/Slip";
import { receipt, type CardFormat } from "@/features/share/tokens";

export type InviteTicketData = {
	roomName: string;
	roomCode: string;
	host: string;
	memberCount: number;
	livePredictions: number;
	// The active series, if there is one: what a new player would join.
	series: { title: string; startingStack: number } | null;
};

// The room's name is the loudest thing; long names step down to fit.
function nameSize(name: string) {
	if (name.length <= 8) return 200;
	if (name.length <= 12) return 150;
	if (name.length <= 18) return 112;
	return 84;
}

// An admission ticket to the room: who's playing, what's live, how to get in.
export function InviteTicket({
	data,
	format,
}: Readonly<{ data: InviteTicketData; format: CardFormat }>) {
	return (
		<Slip format={format} tilt={-1.5}>
			<SlipHeader room='Admit one' context={data.series ? `Now playing ${data.series.title}` : null} />
			<Cut />
			<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
				<span style={{ fontSize: 34, fontWeight: 700 }}>You're invited to</span>
				<span
					style={{
						fontFamily: receipt.display,
						fontWeight: 800,
						fontSize: nameSize(data.roomName),
						lineHeight: 0.92,
						letterSpacing: -1,
						color: receipt.brand,
						overflowWrap: "anywhere",
					}}
				>
					{data.roomName}
				</span>
			</div>
			<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
				<Leader label='Friends playing' value={data.memberCount.toLocaleString()} />
				<Leader label='Predictions live' value={data.livePredictions.toLocaleString()} />
				{data.series ? (
					<Leader
						label='Everyone starts with'
						value={`${data.series.startingStack.toLocaleString()} pts`}
					/>
				) : null}
			</div>
			<span style={{ color: receipt.faded }}>
				Same points for everyone. Top balance when the series ends takes the title.
			</span>
			<ReceiptFooter host={data.host} roomCode={data.roomCode} />
		</Slip>
	);
}
