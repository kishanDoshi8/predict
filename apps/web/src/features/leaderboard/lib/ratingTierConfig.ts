import {
	ChartColumn,
	Crown,
	Eye,
	Flag,
	Gem,
	ShieldCheck,
	type LucideIcon,
} from "lucide-react";

export type RatingTierConfig = {
	minimumRating: number;
	prefix: string;
	label: string;
	Icon: LucideIcon;
	className: string;
};

export const RATING_TIER_CONFIGS: RatingTierConfig[] = [
	{
		minimumRating: 2000,
		prefix: "2000+",
		label: "Grandmaster",
		Icon: Crown,
		className: "bg-gradient-to-r from-yellow-400 to-yellow-600 text-black",
	},
	{
		minimumRating: 1900,
		prefix: "1900+",
		label: "Oracle",
		Icon: Gem,
		className: "bg-gradient-to-r from-purple-500 to-purple-700 text-white",
	},
	{
		minimumRating: 1800,
		prefix: "1800+",
		label: "Expert",
		Icon: ShieldCheck,
		className: "bg-gradient-to-r from-green-500 to-green-700 text-white",
	},
	{
		minimumRating: 1700,
		prefix: "1700+",
		label: "Analyst",
		Icon: ChartColumn,
		className: "bg-gradient-to-r from-slate-500 to-slate-700 text-white",
	},
	{
		minimumRating: 1600,
		prefix: "1600+",
		label: "Sharp Eye",
		Icon: Eye,
		className: "bg-gradient-to-r from-cyan-500 to-cyan-700 text-white",
	},
	{
		minimumRating: 1500,
		prefix: "1500+",
		label: "Rising Star",
		Icon: Flag,
		className: "bg-gradient-to-r from-blue-400 to-blue-600 text-white",
	},
];

export function getRatingTierConfig(rating: number): RatingTierConfig {
	return (
		RATING_TIER_CONFIGS.find((tier) => rating >= tier.minimumRating) ??
		RATING_TIER_CONFIGS[RATING_TIER_CONFIGS.length - 1]
	);
}
