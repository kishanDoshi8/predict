import { useRef } from "react";
import { useInView } from "framer-motion";
import type { ReactNode } from "react";

interface FadeContentProps {
	children: ReactNode;
	blur?: boolean;
	duration?: number;
	easing?: string;
	delay?: number;
	threshold?: number;
	initialOpacity?: number;
	className?: string;
}

const FadeContent: React.FC<FadeContentProps> = ({
	children,
	blur = false,
	duration = 1000,
	easing = "ease-out",
	delay = 0,
	threshold = 0.1,
	initialOpacity = 0,
	className = "",
}) => {
	const ref = useRef<HTMLDivElement | null>(null);
	const isInView = useInView(ref, { once: true, amount: threshold });

	return (
		<div
			ref={ref}
			className={className}
			style={{
				opacity: isInView ? 1 : initialOpacity,
				transition: `opacity ${duration}ms ${easing} ${delay}ms, filter ${duration}ms ${easing} ${delay}ms`,
				filter: blur ? (isInView ? "blur(0px)" : "blur(10px)") : "none",
			}}
		>
			{children}
		</div>
	);
};

export default FadeContent;
