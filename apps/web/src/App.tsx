import {
	createBrowserRouter,
	Navigate,
	RouterProvider,
} from "react-router-dom";
import { HomePage } from "@/pages/home/HomePage";
import { LeaderboardPage } from "@/pages/LeaderboardPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PredictionPage } from "./pages/room/PredictionPage";
import PredictionNew from "./pages/room/predictions/New";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import RoomLayout from "./pages/room/RoomLayout";
import CreatePlayer from "./pages/home/components/CreatePlayer";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LoginPage } from "@/pages/auth/LoginPage";
import { SignupPage } from "@/pages/auth/SignupPage";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage";
import RoomDashboard from "./pages/room/RoomDashboard";

const queryClient = new QueryClient();

const router = createBrowserRouter([
	{ path: "/login", element: <LoginPage /> },
	{ path: "/signup", element: <SignupPage /> },
	{ path: "/forgot-password", element: <ForgotPasswordPage /> },
	{ path: "/reset-password", element: <ResetPasswordPage /> },
	{
		element: <ProtectedRoute />,
		children: [
			{ path: "/", element: <HomePage /> },
			{ path: "/create-player", element: <CreatePlayer /> },
			{
				path: "/rooms/:roomCode",
				element: <RoomLayout />,
				children: [
					{
						index: true,
						element: <RoomDashboard />,
						handle: {
							header: {
								leftAction: "home",
							},
						},
					},
					{
						path: "predictions/new",
						element: <PredictionNew />,
						handle: {
							header: {
								leftAction: "back",
								title: "Create Prediction",
							},
						},
					},
					{
						path: "predictions/:predictionId",
						element: <PredictionPage />,
						handle: {
							header: {
								leftAction: "back",
								title: "Prediction",
							},
						},
					},
					{
						path: "leaderboard",
						element: <LeaderboardPage />,
						handle: {
							header: {
								leftAction: "back",
								title: "Leaderboard",
							},
						},
					},
				],
			},
		],
	},
	{ path: "/404", element: <NotFoundPage /> },
	{ path: "*", element: <Navigate to='/404' replace /> },
]);

export default function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
				<RouterProvider router={router} />
				<Toaster />
			</AuthProvider>
		</QueryClientProvider>
	);
}
