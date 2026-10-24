import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/shared/lib/supabase";
import { takePostAuthRedirect } from "@/shared/lib/postAuthRedirect";
import { Button, Loading } from "@/shared/ui";
import { Brand } from "@/features/home";

// Google (and "Connect Google") return here. supabase-js reads the session from
// the URL on load; this page waits for it, then continues to the saved destination.
function readOAuthError() {
	const params = new URLSearchParams(window.location.search);
	const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
	return (
		params.get("error_description") ??
		hash.get("error_description") ??
		params.get("error") ??
		hash.get("error")
	);
}

export function AuthCallbackPage() {
	const navigate = useNavigate();
	const [error, setError] = useState<string | null>(() => readOAuthError());

	useEffect(() => {
		if (error) return;
		let cancelled = false;

		void supabase.auth.getSession().then(({ data, error: sessionError }) => {
			if (cancelled) return;
			if (sessionError || !data.session) {
				setError(sessionError?.message ?? "Google sign-in didn't finish. Try again.");
				return;
			}
			navigate(takePostAuthRedirect(), { replace: true });
		});

		return () => {
			cancelled = true;
		};
	}, [error, navigate]);

	if (!error) {
		return (
			<div className='flex items-center justify-center h-dvh'>
				<Loading className='size-10 text-primary' />
			</div>
		);
	}

	return (
		<div className='p-8 mt-4 flex flex-col items-center gap-8'>
			<Brand />
			<div className='flex flex-col gap-4 border-2 p-8 w-full max-w-sm'>
				<h2 className='text-xl font-bold'>Google sign-in didn't work</h2>
				<p className='text-sm text-muted-foreground' role='alert'>
					{error.replace(/\+/g, " ")}
				</p>
				<Button variant='linear' asChild>
					<Link to='/login' replace>
						Back to sign in
					</Link>
				</Button>
			</div>
		</div>
	);
}
