import { format as formatDate } from "date-fns";
import { Cut, Leader, ReceiptFooter, Slip, SlipHeader, Stamp } from "@/features/share/components/Slip";
import { receipt, type CardFormat } from "@/features/share/tokens";

export type BragReceiptData = {
	roomName: string;
	roomCode: string;
	host: string;
	seriesTitle: string | null;
	predictionNumber: number | null;
	question: string;
	winner: string;
	calledIt: number;
	participants: number;
	// The sharer's own call; null when they didn't bet.
	call: { pick: string; stake: number; calledAt: string; net: number } | null;
};

function seriesContext(data: BragReceiptData) {
	if (!data.seriesTitle) return null;
	return data.predictionNumber
		? `${data.seriesTitle}, prediction ${data.predictionNumber}`
		: data.seriesTitle;
}

// The total is the loudest thing on the slip; longer values step down so
// they always fit on one line.
function totalSize(text: string, withUnit: boolean) {
	const length = text.length + (withUnit ? 2 : 0);
	if (length <= 6) return 220;
	if (length <= 8) return 170;
	if (length <= 11) return 130;
	return 96;
}

// The rare results worth a stamp.
function stampFor(data: BragReceiptData) {
	if (!data.call || data.call.pick !== data.winner || data.participants < 3) return null;
	if (data.calledIt === 1) return "Only one\nwho called it";
	if (data.calledIt / data.participants < 1 / 3) return "Called\nthe upset";
	return null;
}

// Printed proof of a call: what you picked, when, for how much, and the total.
export function BragReceipt({
	data,
	format,
}: Readonly<{ data: BragReceiptData; format: CardFormat }>) {
	const { call } = data;
	const stamp = stampFor(data);
	const totalColor = !call
		? receipt.print
		: call.net > 0
			? receipt.win
			: call.net < 0
				? receipt.loss
				: receipt.print;
	const total = !call
		? data.winner
		: call.net === 0
			? "±0"
			: `${call.net > 0 ? "+" : "−"}${Math.abs(call.net).toLocaleString()}`;

	return (
		<Slip format={format}>
			<SlipHeader room={data.roomName} context={seriesContext(data)} />
			<Cut />
			<div
				style={{
					fontSize: 42,
					fontWeight: 700,
					lineHeight: 1.22,
					display: "-webkit-box",
					WebkitLineClamp: 3,
					WebkitBoxOrient: "vertical",
					overflow: "hidden",
				}}
			>
				{data.question}
			</div>
			<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
				{call ? (
					<>
						<Leader label='Called' value={call.pick} />
						<Leader label='Stake' value={`${call.stake.toLocaleString()} pts`} />
						<Leader
							label='Called on'
							value={formatDate(new Date(call.calledAt), "EEE d MMM, HH:mm")}
						/>
					</>
				) : (
					<Leader label='Stake' value='Watched from the stands' />
				)}
				<Leader label='Result' value={data.winner} />
				<span style={{ color: receipt.faded }}>
					{data.calledIt} of {data.participants} called it
				</span>
			</div>
			<Cut double />
			<div
				style={{
					position: "relative",
					display: "flex",
					alignItems: "flex-end",
					justifyContent: "space-between",
					gap: 24,
					paddingTop: stamp ? 150 : 0,
				}}
			>
				{stamp ? (
					<div style={{ position: "absolute", left: 0, top: 0 }}>
						<Stamp>
							{stamp.split("\n").map((line) => (
								<div key={line}>{line}</div>
							))}
						</Stamp>
					</div>
				) : null}
				<span style={{ fontSize: 34, fontWeight: 700, paddingBottom: 28 }}>
					{call ? "Total" : "Winner"}
				</span>
				<span
					style={{
						fontFamily: receipt.display,
						fontWeight: 800,
						fontSize: totalSize(total, !!call),
						lineHeight: 0.9,
						color: totalColor,
						letterSpacing: -2,
						textAlign: "right",
						whiteSpace: "nowrap",
					}}
				>
					{total}
					{call ? (
						<span style={{ fontSize: 64, marginLeft: 12, letterSpacing: 0 }}>pts</span>
					) : null}
				</span>
			</div>
			<ReceiptFooter host={data.host} roomCode={data.roomCode} />
		</Slip>
	);
}
