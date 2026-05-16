import React from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	type CarouselApi,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";

const SLIDES = [
	{
		emoji: "🎯",
		title: "Make your prediction",
		description:
			"The room organizer posts a question. Pick the option you think will win and bet your points on it. No pressure — just vibes and gut feelings.",
	},
	{
		emoji: "🔒",
		title: "Betting closes",
		description:
			"Once the organizer locks the prediction, no more bets. Cross your fingers, argue with your friends, and wait for the result.",
	},
	{
		emoji: "🏆",
		title: "Winner takes the pot",
		description:
			"When the result is revealed, winners split the losers' points proportionally to how much they bet. More risk, more reward!",
	},
	{
		emoji: "🚀",
		title: "Build your streak",
		description:
			"Claim free weekly points every week to keep playing. Build a winning streak and climb the leaderboard. Let's go!",
	},
] as const;

type Props = {
	open: boolean;
	onClose: () => void;
};

export default function HowToPlayModal({ open, onClose }: Readonly<Props>) {
	const [api, setApi] = React.useState<CarouselApi>();
	const [current, setCurrent] = React.useState(0);
	const [count, setCount] = React.useState(0);

	React.useEffect(() => {
		if (!api) return;

		setCount(api.scrollSnapList().length);
		setCurrent(api.selectedScrollSnap());

		api.on("select", () => {
			setCurrent(api.selectedScrollSnap());
		});
	}, [api]);

	// Reset to first slide when modal opens
	React.useEffect(() => {
		if (open && api) {
			api.scrollTo(0);
		}
	}, [open, api]);

	const isLastSlide = current === count - 1;

	return (
		<Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
			<DialogContent className="max-w-sm gap-6" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle className="text-center text-xl">
						How to Play 🎮
					</DialogTitle>
				</DialogHeader>

				<Carousel
					setApi={setApi}
					opts={{ loop: false }}
					className="w-full"
				>
					<CarouselContent>
						{SLIDES.map((slide) => (
							<CarouselItem key={slide.title}>
								<div className="flex flex-col items-center gap-4 px-2 py-4 text-center">
									<span className="text-5xl">{slide.emoji}</span>
									<h3 className="text-lg font-semibold">
										{slide.title}
									</h3>
									<p className="text-muted-foreground text-sm leading-relaxed">
										{slide.description}
									</p>
								</div>
							</CarouselItem>
						))}
					</CarouselContent>
				</Carousel>

				{/* Dot indicators */}
				<div className="flex justify-center gap-2">
					{Array.from({ length: count }).map((_, index) => (
						<button
							key={index}
							onClick={() => api?.scrollTo(index)}
							className={`h-2 rounded-full transition-all duration-300 ${
								index === current
									? "w-6 bg-primary"
									: "w-2 bg-muted-foreground/30"
							}`}
							aria-label={`Go to slide ${index + 1}`}
						/>
					))}
				</div>

				<div className="flex gap-2">
					{!isLastSlide && (
						<Button
							variant="ghost"
							className="flex-1 text-muted-foreground"
							onClick={onClose}
						>
							Skip
						</Button>
					)}
					<Button
						className="flex-1"
						onClick={() => {
							if (isLastSlide) {
								onClose();
							} else {
								api?.scrollNext();
							}
						}}
					>
						{isLastSlide ? "Let's play! 🎉" : "Next"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
