import { useEffect, useState } from "react";
import { Badge } from "@/shared/ui/badge";
import { motion } from "framer-motion";
import { getRatingTierConfig } from "@/features/leaderboard/lib/ratingTierConfig";

type Props = {
	rating: number;
};

export function RatingBadge({ rating }: Readonly<Props>) {
	const [revealed, setRevealed] = useState(false);

	useEffect(() => {
		const timer = setTimeout(() => {
			setRevealed(true);
		}, 2000);

		return () => clearTimeout(timer);
	}, []);

	const badge = getBadgeConfig(rating);

	return (
		<Badge className={`${badge.className} overflow-hidden`}>
			<div className='relative flex items-center justify-center'>
				{/* Prefix View */}
				<motion.span
					initial={{ opacity: 0, y: -10, filter: "blur(6px)" }}
					animate={{
						opacity: revealed ? 0 : 1,
						y: revealed ? 10 : 0,
						filter: revealed ? "blur(6px)" : "blur(0px)",
					}}
					transition={{ duration: 0.4 }}
					className={revealed ? "pointer-events-none absolute" : ""}
				>
					{badge.prefix}
				</motion.span>

				<motion.span
					initial={{ y: -10, opacity: 0, filter: "blur(6px)" }}
					animate={{
						opacity: revealed ? 1 : 0,
						y: revealed ? 0 : -10,
						filter: revealed ? "blur(0px)" : "blur(6px)",
					}}
					transition={{ duration: 0.4 }}
					className={`flex items-center gap-1 ${revealed ? "" : "pointer-events-none absolute"}`}
				>
					<badge.Icon size={12} />
					{badge.label}
				</motion.span>
			</div>
		</Badge>
	);
}

function getBadgeConfig(rating: number) {
	return getRatingTierConfig(rating);
}
