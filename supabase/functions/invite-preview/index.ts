// Serves /i/<code>: a tiny page whose link-preview tags show the room's name
// and counts, then sends the visitor on to the room's join page. Chat apps
// read the tags; people are redirected straight away.
//
// Reached through nginx on the app's own domain (see
// docs/deployment-caching.md), so links look like https://<app>/i/F4C36D.
// No sign-in needed: verify_jwt is off in supabase/config.toml, and only the
// room's name and counts ever leave the database.

type Preview = {
	name: string;
	room_code: string;
	member_count: number;
	active_prediction_count: number;
	series_title: string | null;
};

const CODE = /^[A-Za-z0-9]{4,12}$/;
const REF = /^[a-z][a-z-]{0,31}$/;

function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function plural(count: number, one: string, many: string) {
	return `${count} ${count === 1 ? one : many}`;
}

async function loadPreview(code: string): Promise<Preview | null> {
	const url = Deno.env.get("SUPABASE_URL");
	const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
	if (!url || !key) return null;
	const response = await fetch(`${url}/rest/v1/rpc/get_room_invite_preview`, {
		method: "POST",
		headers: {
			apikey: key,
			Authorization: `Bearer ${key}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ p_room_code: code }),
	});
	if (!response.ok) return null;
	return (await response.json()) as Preview | null;
}

// The app's public address: APP_URL when set, otherwise the host nginx forwarded.
function appOrigin(request: Request) {
	const configured = Deno.env.get("APP_URL");
	if (configured) return configured.replace(/\/$/, "");
	const host = request.headers.get("x-forwarded-host");
	const proto = request.headers.get("x-forwarded-proto") ?? "https";
	return host ? `${proto}://${host}` : new URL(request.url).origin;
}

function page(options: {
	title: string;
	description: string;
	destination: string;
	image: string;
	pageUrl: string;
}) {
	const title = escapeHtml(options.title);
	const description = escapeHtml(options.description);
	const destination = escapeHtml(options.destination);
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Verdict">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${escapeHtml(options.pageUrl)}">
<meta property="og:image" content="${escapeHtml(options.image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${escapeHtml(options.image)}">
<meta http-equiv="refresh" content="0;url=${destination}">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#09090b;color:#e9ebe6;font:16px ui-monospace,monospace}a{color:#f5a524}</style>
</head>
<body>
<p><a href="${destination}">Open ${title}</a></p>
<script>location.replace(${JSON.stringify(options.destination)});</script>
</body>
</html>`;
}

Deno.serve(async (request) => {
	const url = new URL(request.url);
	const code = url.pathname.split("/").filter(Boolean).pop() ?? "";
	const origin = appOrigin(request);
	const ref = url.searchParams.get("ref");
	const next = url.searchParams.get("next");

	const preview = CODE.test(code) ? await loadPreview(code).catch(() => null) : null;

	let destination = `${origin}/`;
	let title = "You're invited to Verdict";
	let description = "Join your friends' prediction series. Same points for everyone, top balance wins.";

	if (preview) {
		const params = new URLSearchParams();
		if (ref && REF.test(ref)) params.set("ref", ref);
		// Only paths inside this room, as the join page also checks.
		if (next?.startsWith(`/rooms/${preview.room_code}/`) && !next.includes("//")) {
			params.set("next", next);
		}
		const query = params.toString();
		destination = `${origin}/rooms/${preview.room_code}/join${query ? `?${query}` : ""}`;
		title = `Join ${preview.name} on Verdict`;
		const parts = [
			plural(preview.member_count, "friend playing", "friends playing"),
			plural(preview.active_prediction_count, "prediction live", "predictions live"),
		];
		if (preview.series_title) parts.push(preview.series_title);
		description = parts.join(" · ");
	}

	return new Response(
		page({
			title,
			description,
			destination,
			image: `${origin}/og-image.jpg`,
			pageUrl: `${origin}/i/${code}`,
		}),
		{
			status: preview ? 200 : 404,
			headers: {
				"Content-Type": "text/html; charset=utf-8",
				// Counts change; chat apps cache previews on their side anyway.
				"Cache-Control": "public, max-age=300",
			},
		},
	);
});
