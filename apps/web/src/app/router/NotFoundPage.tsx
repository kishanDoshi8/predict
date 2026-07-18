import { CompassIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui";

export function NotFoundPage() {
	const navigate = useNavigate();

	return (
		<div className='mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center'>
			<CompassIcon className='size-6 text-muted-foreground' />
			<h1 className='text-lg font-semibold'>404: Page not found</h1>
			<p className='text-sm text-muted-foreground'>
				The page you are looking for does not exist or may have been
				moved.
			</p>
			<Button size='sm' onClick={() => navigate("/")}>
				Go to home
			</Button>
		</div>
	);
}
