import { Loader2Icon } from "lucide-react";
import { chaoticOrbit, ping } from "ldrs";
ping.register();
chaoticOrbit.register();

import { cn } from "@/shared/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
	return (
		<Loader2Icon
			role='status'
			aria-label='Loading'
			className={cn("size-4 animate-spin", className)}
			{...props}
		/>
	);
}

function Loading({
	className,
	...props
}: Readonly<React.ComponentProps<"svg">>) {
	return (
		<l-chaotic-orbit
			size='32'
			color={props.color ?? "cyan"}
			speed={props.speed ?? 1.5}
			{...props}
		/>
	);
}

// Default values shown
function PingLoading({
	className,
	size = 32,
	...props
}: Readonly<React.ComponentProps<"svg"> & { size?: number }>) {
	return (
		<l-ping
			size={size}
			speed={props.speed ?? 1.5}
			color={props.color ?? "cyan"}
		></l-ping>
	);
}

export { Loading, Spinner, PingLoading };
