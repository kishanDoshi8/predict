import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/shared/ui";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";

export function RouteErrorBoundary() {
	const navigate = useNavigate();
	const error = useRouteError();

	const title = isRouteErrorResponse(error)
		? `${error.status} ${error.statusText}`
		: "Something went wrong";
	const description = isRouteErrorResponse(error)
		? "We couldn't load this page."
		: "Please try again or go back to the previous page.";

	return (
		<div className='mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center'>
			<AlertTriangleIcon className='size-6 text-destructive' />
			<h2 className='text-lg font-semibold'>{title}</h2>
			<p className='text-sm text-muted-foreground'>{description}</p>
			<Button size='sm' variant='outline' onClick={() => navigate(-1)}>
				Go back
			</Button>
		</div>
	);
}
