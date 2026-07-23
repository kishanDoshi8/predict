import type { LucideIcon } from "lucide-react";
import {
	CalendarCheck,
	Coins,
	Crown,
	Flame,
	Medal,
	Swords,
	TrendingUp,
} from "lucide-react";
import type { SeriesAwardType } from "@/shared/lib/seriesRewards";

type ChampionshipPlacement = 1 | 2 | 3;

type RecognitionVisual = {
	Icon: LucideIcon;
	textClassName: string;
	ringClassName: string;
};

type ChampionshipVisual = RecognitionVisual & {
	tierLabel: string;
};

const championshipVisualMap: Record<ChampionshipPlacement, ChampionshipVisual> =
	{
		1: {
			Icon: Crown,
			tierLabel: "Champion",
			textClassName: "text-rank-1",
			ringClassName: "border-rank-1/40 bg-rank-1/10",
		},
		2: {
			Icon: Medal,
			tierLabel: "Runner-up",
			textClassName: "text-rank-2",
			ringClassName: "border-rank-2/40 bg-rank-2/10",
		},
		3: {
			Icon: Medal,
			tierLabel: "Third",
			textClassName: "text-rank-3",
			ringClassName: "border-rank-3/40 bg-rank-3/10",
		},
	};

const awardVisualMap: Record<SeriesAwardType, RecognitionVisual> = {
	LONGEST_STREAK: {
		Icon: Flame,
		textClassName: "text-hot",
		ringClassName: "border-hot/30 bg-hot/10",
	},
	BIGGEST_PROFIT: {
		Icon: TrendingUp,
		textClassName: "text-win",
		ringClassName: "border-win/30 bg-win/10",
	},
	EVER_PRESENT: {
		Icon: CalendarCheck,
		textClassName: "text-activity",
		ringClassName: "border-activity/30 bg-activity/10",
	},
	MOST_DUEL_WINS: {
		Icon: Swords,
		textClassName: "text-primary",
		ringClassName: "border-primary/30 bg-primary/10",
	},
	MOST_POINTS_RISKED: {
		Icon: Coins,
		textClassName: "text-accent",
		ringClassName: "border-accent/30 bg-accent/10",
	},
};

const fallbackChampionshipVisual: ChampionshipVisual = {
	Icon: Medal,
	tierLabel: "Placement",
	textClassName: "text-muted-foreground",
	ringClassName: "border-border/40 bg-secondary/40",
};

const fallbackAwardVisual: RecognitionVisual = {
	Icon: Medal,
	textClassName: "text-muted-foreground",
	ringClassName: "border-border/30 bg-secondary/40",
};

export function getChampionshipVisual(placement: number): ChampionshipVisual {
	if (placement === 1 || placement === 2 || placement === 3) {
		return championshipVisualMap[placement];
	}

	return fallbackChampionshipVisual;
}

export function getAwardVisual(awardType: SeriesAwardType): RecognitionVisual {
	return awardVisualMap[awardType] ?? fallbackAwardVisual;
}
