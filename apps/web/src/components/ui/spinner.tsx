import { Loader2Icon } from "lucide-react";
import { chaoticOrbit } from "ldrs";
chaoticOrbit.register();

import { cn } from "@/lib/utils";

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

function Spinner2({
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

export { Spinner2 as Spinner };
