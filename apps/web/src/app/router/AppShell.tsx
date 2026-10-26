import { NavigationSync } from "@/app/router/NavigationSync";
import { Outlet, ScrollRestoration } from "react-router-dom";

// Signed-in pages: native-feeling history and scroll positions kept on Back.
export function AppShell() {
	return (
		<>
			<NavigationSync />
			<ScrollRestoration />
			<Outlet />
		</>
	);
}
