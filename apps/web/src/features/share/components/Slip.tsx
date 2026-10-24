import type { CSSProperties, ReactNode } from "react";
import { CARD_SIZE, receipt, type CardFormat } from "@/features/share/tokens";

const TEETH = 28;

// The torn bottom edge of the slip.
function TornEdge() {
	const points = Array.from({ length: TEETH * 2 + 1 }, (_, i) => {
		const x = (i / (TEETH * 2)) * 100;
		const y = i % 2 === 0 ? 0 : 100;
		return `${x},${y}`;
	}).join(" ");
	return (
		<svg
			viewBox='0 0 100 100'
			preserveAspectRatio='none'
			style={{ display: "block", width: "100%", height: 22 }}
			aria-hidden='true'
		>
			<polygon points={`0,0 ${points} 100,0`} fill={receipt.paper} />
		</svg>
	);
}

// A paper slip lying on the ink field, slightly askew, sized for the format.
export function Slip({
	format,
	children,
	tilt = -1,
}: Readonly<{ format: CardFormat; children: ReactNode; tilt?: number }>) {
	const { width, height } = CARD_SIZE[format];
	return (
		<div
			style={{
				width,
				height,
				boxSizing: "border-box",
				background: receipt.ink,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				fontFamily: receipt.mono,
				color: receipt.print,
			}}
		>
			<div
				style={{
					width: 880,
					// Stories have room to spare; the slip fills more of it.
					transform: `rotate(${tilt}deg) scale(${format === "story" ? 1.1 : 1})`,
					filter: "drop-shadow(0 28px 40px rgba(0, 0, 0, 0.55))",
				}}
			>
				<div
					style={{
						background: receipt.paper,
						padding: "60px 64px 48px",
						display: "flex",
						flexDirection: "column",
						gap: 28,
						fontSize: 30,
						lineHeight: 1.35,
					}}
				>
					{children}
				</div>
				<TornEdge />
			</div>
		</div>
	);
}

// "Label ........ value": how a receipt pairs a label with a value.
export function Leader({
	label,
	value,
	valueStyle,
}: Readonly<{ label: ReactNode; value: ReactNode; valueStyle?: CSSProperties }>) {
	return (
		<div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
			<span style={{ whiteSpace: "nowrap" }}>{label}</span>
			<span
				style={{
					flex: 1,
					minWidth: 24,
					borderBottom: `4px dotted ${receipt.faded}`,
					transform: "translateY(-8px)",
					opacity: 0.6,
				}}
			/>
			<span
				style={{
					fontWeight: 700,
					textAlign: "right",
					maxWidth: "62%",
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
					...valueStyle,
				}}
			>
				{value}
			</span>
		</div>
	);
}

// The perforation-style break between sections.
export function Cut({ double = false }: Readonly<{ double?: boolean }>) {
	return (
		<div
			style={{
				borderTop: double
					? `8px double ${receipt.print}`
					: `3px dashed ${receipt.faded}`,
				opacity: double ? 1 : 0.7,
			}}
		/>
	);
}

// The slip's header: brand on the left, room on the right, context below.
export function SlipHeader({
	room,
	context,
}: Readonly<{ room: string; context?: string | null }>) {
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
			<div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
				<span style={{ fontWeight: 700 }}>Verdict</span>
				<span
					style={{
						fontWeight: 600,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{room}
				</span>
			</div>
			{context ? <span style={{ color: receipt.faded }}>{context}</span> : null}
		</div>
	);
}

// Where the barcode would be: how to get into the room.
export function ReceiptFooter({
	host,
	roomCode,
	label = "Join us at",
}: Readonly<{ host: string; roomCode: string; label?: string }>) {
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 28 }}>
			<Cut />
			<Leader label={label} value={host} />
			<Leader label='Room code' value={roomCode} valueStyle={{ letterSpacing: 4 }} />
		</div>
	);
}

// A rubber stamp pressed over the slip, for the rare moments worth marking.
export function Stamp({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<div
			style={{
				alignSelf: "flex-start",
				transform: "rotate(-8deg)",
				border: `6px solid ${receipt.brand}`,
				color: receipt.brand,
				borderRadius: 14,
				padding: "8px 20px",
				fontFamily: receipt.display,
				fontWeight: 800,
				fontSize: 44,
				lineHeight: 1.05,
				textAlign: "center",
				opacity: 0.9,
				background: "rgba(233, 235, 230, 0.6)",
			}}
		>
			{children}
		</div>
	);
}
