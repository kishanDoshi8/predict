import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ChartColumn, Crown, Eye, Flag, Gem, ShieldCheck } from "lucide-react";

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
					{badge.icon}
					{badge.label}
				</motion.span>
			</div>
		</Badge>
	);
}

function getBadgeConfig(rating: number) {
	if (rating >= 2000) {
		return {
			prefix: "2000+",
			label: "Grandmaster",
			icon: <Crown size={12} />,
			className:
				"bg-gradient-to-r from-yellow-400 to-yellow-600 text-black",
		};
	}

	if (rating >= 1900) {
		return {
			prefix: "1900+",
			label: "Oracle",
			icon: <Gem size={12} />,
			className:
				"bg-gradient-to-r from-purple-500 to-purple-700 text-white",
		};
	}

	if (rating >= 1800) {
		return {
			prefix: "1800+",
			label: "Expert",
			icon: <ShieldCheck size={12} />,
			className:
				"bg-gradient-to-r from-green-500 to-green-700 text-white",
		};
	}

	if (rating >= 1700) {
		return {
			prefix: "1700+",
			label: "Analyst",
			icon: <ChartColumn size={12} />,
			className:
				"bg-gradient-to-r from-slate-500 to-slate-700 text-white",
		};
	}

	if (rating >= 1600) {
		return {
			prefix: "1600+",
			label: "Sharp Eye",
			icon: <Eye size={12} />,
			className: "bg-gradient-to-r from-cyan-500 to-cyan-700 text-white",
		};
	}

	return {
		prefix: "1500+",
		label: "Rising star",
		icon: <Flag size={12} />,
		className: "bg-gradient-to-r from-blue-400 to-blue-600 text-white",
	};
}
