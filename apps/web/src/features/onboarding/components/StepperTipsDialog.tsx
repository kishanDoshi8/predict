import React from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/shared/ui/dialog";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	type CarouselApi,
} from "@/shared/ui/carousel";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

type StepperTipsDialogSlide = {
	key: string;
	title: React.ReactNode;
	description: React.ReactNode;
};

type StepperTipsDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	dialogTitle: React.ReactNode;
	slides: readonly StepperTipsDialogSlide[];
	nextLabel?: string;
	doneLabel?: string;
	previousLabel?: string;
	className?: string;
};

export default function StepperTipsDialog({
	open,
	onOpenChange,
	dialogTitle,
	slides,
	nextLabel = "Next",
	doneLabel = "Done",
	previousLabel = "Previous",
	className = "bg-card",
}: Readonly<StepperTipsDialogProps>) {
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

	const isFirstSlide = current === 0;
	const isLastSlide = current === count - 1;

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) {
					api?.scrollTo(0);
				}
				onOpenChange(nextOpen);
			}}
		>
			<DialogContent
				className={cn("overflow-x-hidden overflow-y-auto", className)}
			>
				<DialogHeader>
					<DialogTitle className='text-center text-xl'>
						{dialogTitle}
					</DialogTitle>
				</DialogHeader>

				<Carousel
					setApi={setApi}
					opts={{ loop: false }}
					className='w-full max-w-full mx-auto overflow-x-hidden'
				>
					<CarouselContent className='ml-0'>
						{slides.map((slide) => (
							<CarouselItem
								key={slide.key}
								className='min-w-0 pl-0'
							>
								<div className='min-w-0 overflow-x-hidden flex flex-col gap-3 px-1 py-2'>
									<div className='text-lg font-semibold wrap-break-word **:max-w-full **:wrap-break-word'>
										{slide.title}
									</div>
									<div className='text-sm leading-relaxed text-muted-foreground wrap-break-word **:max-w-full **:wrap-break-word'>
										{slide.description}
									</div>
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
							aria-label={`Go to step ${index + 1}`}
						/>
					))}
				</div>

				<div className='flex gap-2'>
					<Button
						variant='ghost'
						className='flex-1 text-muted-foreground'
						onClick={() => api?.scrollPrev()}
						disabled={isFirstSlide}
					>
						{previousLabel}
					</Button>
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
						{isLastSlide ? doneLabel : nextLabel}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
