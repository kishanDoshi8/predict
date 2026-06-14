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
import { CoinsIcon, ZapIcon } from "lucide-react";

type LeaderboardTipsDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

const SLIDES = [
	{
		key: "ratings",
		title: (
			<h3 className={`flex gap-2 items-center`}>
				<ZapIcon className={`text-cyan-500`} />
				Prediction Rating
			</h3>
		),
		description: (
			<p>
				Ratings measure prediction skill, not points earned. Correct
				predictions increase your rating, and harder predictions are
				worth more
				<br />
				<br />
				Everyone starts at 1500.
			</p>
		),
	},
	{
		key: "points",
		title: (
			<h3 className={`flex gap-2 items-center`}>
				<CoinsIcon className={`text-rank-1`} />
				Points
			</h3>
		),
		description: (
			<p>
				Points track how many points you've won from predictions.
				<br />
				<br />
				Points determine your winnings. Prediction Rating measures your
				prediction skill.
			</p>
		),
	},
] as const;

export default function LeaderboardTipsDialog({
	open,
	onOpenChange,
}: Readonly<LeaderboardTipsDialogProps>) {
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

	React.useEffect(() => {
		if (open && api) {
			api.scrollTo(0);
		}
	}, [open, api]);

	const isLastSlide = current === count - 1;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='bg-card'>
				<DialogHeader>
					<DialogTitle className='text-center text-xl'>
						Leaderboard Tips
					</DialogTitle>
				</DialogHeader>

				<Carousel
					setApi={setApi}
					opts={{ loop: false }}
					className='w-full mx-auto'
				>
					<CarouselContent>
						{SLIDES.map((slide) => (
							<CarouselItem key={slide.key}>
								<div className='flex flex-col gap-3 px-1 py-2'>
									<h3 className='text-lg font-semibold'>
										{slide.title}
									</h3>
									<p className='text-sm leading-relaxed'>
										{slide.description}
									</p>
								</div>
							</CarouselItem>
						))}
					</CarouselContent>
				</Carousel>

				<div className='flex justify-center gap-2'>
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

				<div className='flex gap-2'>
					{!isLastSlide && (
						<Button
							variant='ghost'
							className='flex-1 text-muted-foreground'
							onClick={() => onOpenChange(false)}
						>
							Close
						</Button>
					)}
					<Button
						variant='linear'
						className='flex-1'
						onClick={() => {
							if (isLastSlide) {
								onOpenChange(false);
							} else {
								api?.scrollNext();
							}
						}}
					>
						{isLastSlide ? "Done" : "Next"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
