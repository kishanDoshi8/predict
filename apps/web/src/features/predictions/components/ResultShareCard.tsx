import { forwardRef } from "react";
import { formatSignedPoints } from "@/shared/lib/utils";

export type ResultShareData = {
	seriesLabel: string | null;
	question: string;
	winner: string;
	calledIt: number;
	participants: number;
	pool: number;
	// The sharer's own result; null when they didn't bet.
	player: { username: string; pick: string; net: number } | null;
};

// A 1080×1350 image (portrait, fits Instagram and WhatsApp) built from plain
// elements with inline colours, so the image capture matches what's shown.
export const ResultShareCard = forwardRef<HTMLDivElement, { data: ResultShareData }>(
	function ResultShareCard({ data }, ref) {
		const { player } = data;
		const won = player !== null && player.net > 0;
		const lost = player !== null && player.net < 0;
		const resultColor = won ? "#4ade80" : lost ? "#fb7185" : "#e4e4e7";

		return (
			<div
				ref={ref}
				style={{
					width: 1080,
					height: 1350,
					boxSizing: "border-box",
					padding: 88,
					display: "flex",
					flexDirection: "column",
					justifyContent: "space-between",
					background:
						"radial-gradient(circle at 90% 8%, rgba(255,45,85,0.28), transparent 42%), radial-gradient(circle at 0% 100%, rgba(255,159,10,0.2), transparent 48%), #09090b",
					color: "#fafafa",
					fontFamily: '"Fira Code Variable", ui-monospace, monospace',
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 20 }}>
					<img src='/pwa-192x192.png' alt='' width={72} height={72} style={{ borderRadius: 16 }} />
					<div>
						<div style={{ fontSize: 36, fontWeight: 600 }}>Verdict</div>
						{data.seriesLabel ? (
							<div style={{ fontSize: 26, color: "#a1a1aa" }}>{data.seriesLabel}</div>
						) : null}
					</div>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
					<div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.15, letterSpacing: -1 }}>
						{data.question}
					</div>
					<div style={{ display: "flex", alignItems: "center", gap: 18 }}>
						<span style={{ fontSize: 28, color: "#a1a1aa" }}>Result</span>
						<span
							style={{
								fontSize: 40,
								fontWeight: 700,
								color: "#4ade80",
								background: "rgba(74,222,128,0.14)",
								border: "2px solid rgba(74,222,128,0.4)",
								borderRadius: 18,
								padding: "10px 26px",
							}}
						>
							👑 {data.winner}
						</span>
					</div>
					<div style={{ display: "flex", gap: 40, fontSize: 30, color: "#d4d4d8" }}>
						<span>
							<b style={{ color: "#fafafa" }}>{data.calledIt}</b> of {data.participants} called it
						</span>
						<span>
							Pool <b style={{ color: "#fafafa" }}>{data.pool.toLocaleString()}</b> pts
						</span>
					</div>
				</div>

				<div
					style={{
						borderRadius: 32,
						padding: "40px 48px",
						background: "rgba(255,255,255,0.05)",
						border: "2px solid rgba(255,255,255,0.1)",
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
					}}
				>
					{player ? (
						<>
							<div>
								<div style={{ fontSize: 32, fontWeight: 600 }}>{player.username}</div>
								<div style={{ fontSize: 26, color: "#a1a1aa" }}>picked {player.pick}</div>
							</div>
							<div style={{ fontSize: 88, fontWeight: 700, color: resultColor }}>
								{player.net === 0 ? "±0" : formatSignedPoints(player.net)}
							</div>
						</>
					) : (
						<div style={{ fontSize: 34, color: "#d4d4d8" }}>Settled. Who called it?</div>
					)}
				</div>
			</div>
		);
	},
);
