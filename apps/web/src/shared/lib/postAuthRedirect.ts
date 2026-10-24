// Where to send someone after they sign in, sign up or pick a username.
// Kept in localStorage so it survives the round trip to Google and back.
const KEY = "postAuthRedirect";

// Only same-app paths, so a crafted link can't bounce people to another site.
function isSafePath(path: string) {
	return path.startsWith("/") && !path.startsWith("//");
}

export function savePostAuthRedirect(path: string) {
	if (!isSafePath(path) || path.startsWith("/login") || path.startsWith("/auth/")) {
		return;
	}
	try {
		localStorage.setItem(KEY, path);
	} catch {
		// Storage unavailable (private mode): the user lands on Home instead.
	}
}

export function peekPostAuthRedirect(): string | null {
	try {
		const path = localStorage.getItem(KEY);
		return path && isSafePath(path) ? path : null;
	} catch {
		return null;
	}
}

// Returns the saved destination (or the fallback) and forgets it.
export function takePostAuthRedirect(fallback = "/"): string {
	const path = peekPostAuthRedirect();
	try {
		localStorage.removeItem(KEY);
	} catch {
		// ignore
	}
	return path ?? fallback;
}
