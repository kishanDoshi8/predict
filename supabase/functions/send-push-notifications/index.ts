import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import webpush from "npm:web-push@3.6.7";

type NotificationEventType =
	| "prediction_live"
	| "prediction_locked"
	| "deadline_1h"
	| "result_revealed"
	| "weekly_points_claim"
	| "result_needed";

const EVENT_TO_COLUMN: Record<NotificationEventType, string> = {
	prediction_live: "prediction_live",
	prediction_locked: "prediction_locked",
	deadline_1h: "deadline_1h",
	result_revealed: "result_revealed",
	weekly_points_claim: "weekly_points_claim",
	result_needed: "result_needed",
};

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type, x-notification-secret",
};
const PUSH_TTL_SECONDS = 60;

type RequestBody = {
	event_type: NotificationEventType;
	/**
	 * When provided by a privileged backend call, limits the broadcast to
	 * players who are members of this room (and have the preference enabled).
	 */
	room_id?: string;
	payload?: {
		title?: string;
		body?: string;
		url?: string;
		/** With room_id: only members with one of these roles, e.g. staff. */
		roles?: string[];
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
	const authorization = req.headers.get("authorization")?.trim();
	if (!authorization) return null;

	const match = authorization.match(/^Bearer\s+(.+)$/i);
	const token = match?.[1]?.trim();
	return token || null;
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
		if (authError) {
			return jsonResponse({ error: "Unauthorized. Invalid auth token." }, 401);
		}

		if (!user) {
			return jsonResponse({ error: "Unauthorized. User not found." }, 401);
		}

		const { data: player, error: playerError } = await supabase
			.from("players")
			.select("id")
			.eq("user_id", user.id)
			.maybeSingle();

		if (playerError) {
			return jsonResponse(
				{
					error: "Failed to retrieve player profile.",
					detail: playerError.message,
				},
				500,
			);
		}

		if (!player) {
			return jsonResponse({ error: "Player profile not found." }, 404);
		}

		targetPlayerId = player.id;
	}

	// Each player's default for this event; filtered below, after any room
	// override is applied.
	let playerPreferencesQuery = supabase
		.from("player_preferences")
		.select(`player_id, ${preferenceColumn}`);
	let overrideRoomId: string | null = null;

	if (targetPlayerId) {
		playerPreferencesQuery = playerPreferencesQuery.eq("player_id", targetPlayerId);
	} else if (isPrivilegedRequest && body.room_id) {
		// Scope broadcast to members of the specified room only.
		let memberQuery = supabase
			.from("room_members")
			.select("player_id")
			.eq("room_id", body.room_id);
		const roles = body.payload?.roles;
		if (Array.isArray(roles) && roles.length > 0) {
			memberQuery = memberQuery.in("role", roles);
		}
		const { data: memberRows, error: memberError } = await memberQuery;

		if (memberError) {
			return jsonResponse(
				{
					error: "Failed to fetch room members.",
					detail: memberError.message,
				},
				500,
			);
		}

		const roomPlayerIds = (memberRows ?? [])
			.map((r) => r.player_id)
			.filter((id): id is string => id != null);
		if (roomPlayerIds.length === 0) {
			return jsonResponse({
				sent_count: 0,
				failed_count: 0,
				pruned_count: 0,
				target_count: 0,
			});
		}

		playerPreferencesQuery = playerPreferencesQuery.in("player_id", roomPlayerIds);
		overrideRoomId = body.room_id;
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

	// The selected column is only known at runtime, so the rows are untyped.
	type PreferenceRow = { player_id: string } & Record<string, unknown>;
	const preferences = (preferenceRows ?? []) as unknown as PreferenceRow[];

	// A room's own setting (Notifications > This room) wins over the default.
	const roomOverrides = new Map<string, boolean | null>();
	if (overrideRoomId) {
		const { data: overrideRows, error: overrideError } = await supabase
			.from("room_preferences")
			.select(`player_id, ${preferenceColumn}`)
			.eq("room_id", overrideRoomId)
			.in(
				"player_id",
				preferences.map((row) => row.player_id),
			);

		if (overrideError) {
			return jsonResponse(
				{
					error: "Failed to fetch room notification preferences.",
					detail: overrideError.message,
				},
				500,
			);
		}

		for (const row of (overrideRows ?? []) as unknown as PreferenceRow[]) {
			const value = row[preferenceColumn];
			roomOverrides.set(row.player_id, typeof value === "boolean" ? value : null);
		}
	}

	const playerIds = [
		...new Set(
			preferences
				.filter((row) => {
					const override = roomOverrides.get(row.player_id) ?? null;
					return (override ?? row[preferenceColumn]) === true;
				})
				.map((row) => row.player_id),
		),
	];
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
