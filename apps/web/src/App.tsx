import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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

function AppRoutes() {
	return (
		<BrowserRouter>
			<Routes>
				{/* Public auth routes */}
				<Route path='/login' element={<LoginPage />} />
				<Route path='/signup' element={<SignupPage />} />
				<Route
					path='/forgot-password'
					element={<ForgotPasswordPage />}
				/>
				<Route path='/reset-password' element={<ResetPasswordPage />} />

				{/* Protected routes */}
				<Route element={<ProtectedRoute />}>
					<Route path='/' element={<HomePage />} />
					<Route path='/create-player' element={<CreatePlayer />} />

					<Route path='/rooms/:roomCode' element={<RoomLayout />}>
						{/* This renders at /rooms/:roomCode */}
						<Route index element={<RoomDashboard />} />

						{/* This renders at /rooms/:roomCode/predictions/:predictionId */}
						<Route
							path='predictions/:predictionId'
							element={<PredictionPage />}
						/>

						{/* This renders at /rooms/:roomCode/predictions/new */}
						<Route
							path='predictions/new'
							element={<PredictionNew />}
						/>

						{/* This renders at /rooms/:roomCode/leaderboard */}
						<Route
							path='leaderboard'
							element={<LeaderboardPage />}
						/>
					</Route>
				</Route>

				{/* Fallback */}
				<Route path='/404' element={<NotFoundPage />} />
				<Route path='*' element={<Navigate to='/404' replace />} />
			</Routes>
		</BrowserRouter>
	);
}

export default function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
				<AppRoutes />
				<Toaster />
			</AuthProvider>
		</QueryClientProvider>
	);
}
