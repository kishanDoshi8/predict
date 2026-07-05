import { Loading } from "@/shared/ui";

export function RouteFallback() {
	return (
		<div className='flex min-h-[40vh] items-center justify-center p-4'>
			<Loading className='size-8 text-primary' />
		</div>
	);
}
