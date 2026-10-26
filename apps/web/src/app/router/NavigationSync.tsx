import {
	navCoordinator,
	navState,
	pathOf,
	roomOf,
} from "@/shared/lib/navigation";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";

// Keeps every history entry's depth right (see shared/lib/navigation):
// - finishes multi-step moves once their pop lands,
// - gives plain <Link> pushes their depth,
// - moves a page pushed on top of a sheet's marker down to the page below,
// - puts the room's Home under a room page opened from outside (a shared
//   link, a notification), so Back goes Home before leaving.
export function NavigationSync() {
	const location = useLocation();
	const navigationType = useNavigationType();
	const navigate = useNavigate();
	const previous = useRef<{ pathname: string; depth: number; sheets: number } | null>(
		null,
	);

	useEffect(() => {
		navCoordinator.inFlight = false;
		const state = navState(location);
		const here = pathOf(location);
		const prev = previous.current;
		const record = (depth: number) => {
			previous.current = {
				pathname: location.pathname,
				depth,
				sheets: state.sheets?.length ?? 0,
			};
		};

		const pending = navCoordinator.pending;
		if (pending) {
			navCoordinator.pending = null;
			const landed = state.depth ?? 0;
			if (pending.kind === "replace") {
				if (here !== pending.to) {
					navigate(pending.to, {
						replace: true,
						state: { ...pending.state, depth: landed },
					});
				} else {
					record(landed);
				}
			} else {
				navigate(pending.to, {
					state: { ...pending.state, depth: landed + 1 },
				});
			}
			return;
		}

		if (state.depth !== undefined) {
			record(state.depth);
			return;
		}

		// An entry without a depth: a plain push or replace, or a page loaded
		// from outside the app.
		const room = roomOf(location.pathname);
		const prevRoom = prev ? roomOf(prev.pathname) : null;
		// The join page isn't inside the room yet.
		const sameRoom =
			room !== null && prevRoom !== null && !prevRoom.isJoin && prevRoom.code === room.code;

		if (navigationType === "PUSH" && prev) {
			if (prev.sheets > 0) {
				// Pushed from inside an open sheet: drop the sheet's markers so
				// Back from this page returns to the page, not the closed sheet.
				navCoordinator.go(-(prev.sheets + 1), {
					kind: "push",
					to: here,
					state: { ...state },
				});
				return;
			}
			navigate(here, {
				replace: true,
				state: { ...state, depth: prev.depth + 1 },
				preventScrollReset: true,
			});
			return;
		}

		if (navigationType === "REPLACE" && prev && (sameRoom || !room)) {
			navigate(here, {
				replace: true,
				state: { ...state, depth: prev.depth - prev.sheets },
				preventScrollReset: true,
			});
			return;
		}

		if (room && !room.isJoin && !room.isHome) {
			// Arrived inside a room from outside: Home goes underneath.
			navigate(room.home, { replace: true, state: { depth: 0 } });
			navCoordinator.pending = { kind: "push", to: here, state: { ...state } };
			return;
		}

		record(0);
	}, [location, navigationType, navigate]);

	return null;
}
