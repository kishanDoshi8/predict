import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import webpush from "npm:web-push@3.6.7";

type NotificationEventType =
	| "prediction_live"
	| "prediction_locked"
	| "deadline_1h"
	| "result_revealed"
	| "weekly_points_claim";

const EVENT_TO_COLUMN: Record<NotificationEventType, string> = {
	prediction_live: "prediction_live",
	prediction_locked: "prediction_locked",
	deadline_1h: "deadline_1h",
	result_revealed: "result_revealed",
	weekly_points_claim: "weekly_points_claim",
};

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type, x-notification-secret",
};
const PUSH_TTL_SECONDS = 60;

type RequestBody = {
	event_type: NotificationEventType;
	payload?: {
		title?: string;
		body?: string;
		url?: string;
		[key: string]: unknown;
	};
	target_player_token?: string;
};

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeaders, "Content-Type": "application/json" },
	});
}

function getStatusCode(error: unknown) {
	if (typeof error !== "object" || error === null) return undefined;
	if (!("statusCode" in error)) return undefined;

	const value = (error as { statusCode?: number }).statusCode;
	return typeof value === "number" ? value : undefined;
}

function getBearerToken(req: Request) {
	const authorization = req.headers.get("authorization");
	if (!authorization) return null;

	const [scheme, token] = authorization.split(" ");
	if (scheme?.toLowerCase() !== "bearer" || !token) return null;

	return token;
}

Deno.serve(async (req) => {
	if (req.method === "OPTIONS") {
		return new Response("ok", { headers: corsHeaders });
	}
	if (req.method !== "POST") {
		return jsonResponse({ error: "Method not allowed." }, 405);
	}

	const supabaseUrl = Deno.env.get("SUPABASE_URL");
	const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
	const vapidPublicKey = Deno.env.get("WEB_PUSH_PUBLIC_KEY");
	const vapidPrivateKey = Deno.env.get("WEB_PUSH_PRIVATE_KEY");
	const vapidSubject = Deno.env.get("WEB_PUSH_SUBJECT");

	if (
		!supabaseUrl ||
		!serviceRoleKey ||
		!vapidPublicKey ||
		!vapidPrivateKey ||
		!vapidSubject
	) {
		return jsonResponse(
			{ error: "Missing required environment variables." },
			500,
		);
	}

	const supabase = createClient(supabaseUrl, serviceRoleKey);

	webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

	let body: RequestBody;
	try {
		body = (await req.json()) as RequestBody;
	} catch {
		return jsonResponse({ error: "Invalid JSON body." }, 400);
	}

	const eventType = body.event_type;
	const preferenceColumn = EVENT_TO_COLUMN[eventType];
	if (!preferenceColumn) {
		return jsonResponse({ error: "Invalid event_type." }, 400);
	}

	const configuredSecret = Deno.env.get("NOTIFICATION_FUNCTION_SECRET");
	const providedSecret = req.headers.get("x-notification-secret");
	const isPrivilegedRequest =
		!!configuredSecret && providedSecret === configuredSecret;

	let targetPlayerId: string | null = null;
	if (body.target_player_token) {
		const { data: player, error: playerError } = await supabase
			.from("players")
			.select("id")
			.eq("player_token", body.target_player_token)
			.maybeSingle();

		if (playerError) {
			return jsonResponse(
				{ error: "Failed to resolve target user.", detail: playerError.message },
				500,
			);
		}

		if (!player) {
			return jsonResponse({ error: "Invalid target player token." }, 401);
		}

		targetPlayerId = player.id;
	}

	if (!isPrivilegedRequest && !targetPlayerId) {
		const bearerToken = getBearerToken(req);
		if (!bearerToken) {
			return jsonResponse(
				{
					error:
						"Unauthorized. Use x-notification-secret for broadcast calls or authenticate for self-test.",
				},
				401,
			);
		}

		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser(bearerToken);
		if (authError || !user) {
			return jsonResponse({ error: "Unauthorized. Invalid auth token." }, 401);
		}

		const { data: player, error: playerError } = await supabase
			.from("players")
			.select("id")
			.eq("user_id", user.id)
			.maybeSingle();

		if (playerError) {
			return jsonResponse(
				{
					error: "Failed to resolve authenticated user.",
					detail: playerError.message,
				},
				500,
			);
		}

		if (!player) {
			return jsonResponse({ error: "Player profile not found." }, 401);
		}

		targetPlayerId = player.id;
	}

	let playerPreferencesQuery = supabase
		.from("player_preferences")
		.select("player_id")
		.eq(preferenceColumn, true);

	if (targetPlayerId) {
		playerPreferencesQuery = playerPreferencesQuery.eq("player_id", targetPlayerId);
	}

	const { data: preferenceRows, error: preferenceError } =
		await playerPreferencesQuery;

	if (preferenceError) {
		return jsonResponse(
			{
				error: "Failed to fetch notification preferences.",
				detail: preferenceError.message,
			},
			500,
		);
	}

	const playerIds = [...new Set((preferenceRows ?? []).map((row) => row.player_id))];
	if (playerIds.length === 0) {
		return jsonResponse({
			sent_count: 0,
			failed_count: 0,
			pruned_count: 0,
			target_count: 0,
		});
	}

	const { data: subscriptions, error: subscriptionsError } = await supabase
		.from("user_push_subscriptions")
		.select("id, user_id, subscription")
		.in("user_id", playerIds);

	if (subscriptionsError) {
		return jsonResponse(
			{
				error: "Failed to fetch push subscriptions.",
				detail: subscriptionsError.message,
			},
			500,
		);
	}

	const payload = {
		title: body.payload?.title ?? "Predikt",
		body: body.payload?.body ?? "You have a new update.",
		data: {
			event_type: eventType,
			url: body.payload?.url ?? "/",
			...body.payload,
		},
	};

	let sentCount = 0;
	let failedCount = 0;
	const staleSubscriptionIds: string[] = [];

	await Promise.all(
		(subscriptions ?? []).map(async (row) => {
			try {
				await webpush.sendNotification(
					row.subscription as unknown as Record<string, unknown>,
					JSON.stringify(payload),
					{
						TTL: PUSH_TTL_SECONDS,
						urgency: "normal",
					},
				);
				sentCount += 1;
			} catch (error) {
				failedCount += 1;
				const statusCode = getStatusCode(error);

				if (statusCode === 404 || statusCode === 410) {
					staleSubscriptionIds.push(row.id);
				}
			}
		}),
	);

	let prunedCount = 0;
	if (staleSubscriptionIds.length > 0) {
		const { error: deleteError, count } = await supabase
			.from("user_push_subscriptions")
			.delete({ count: "exact" })
			.in("id", staleSubscriptionIds);

		if (!deleteError) {
			prunedCount = count ?? 0;
		}
	}

	return jsonResponse({
		sent_count: sentCount,
		failed_count: failedCount,
		pruned_count: prunedCount,
		target_count: subscriptions?.length ?? 0,
	});
});
