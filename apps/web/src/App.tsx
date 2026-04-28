import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HomePage } from "@/pages/home/HomePage";
import { LeaderboardPage } from "@/pages/LeaderboardPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { RoomPage } from "./pages/room/RoomPage";
import PredictionNew from "./pages/room/predictions/New";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import RoomLayout from "./pages/room/RoomLayout";
import CreatePlayer from "./pages/home/components/CreatePlayer";

const queryClient = new QueryClient();

export default function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<BrowserRouter>
				<Routes>
					{/* Home: join a room */}
					<Route path='/' element={<HomePage />} />

					<Route path='/create-player' element={<CreatePlayer />} />

					<Route path='/rooms/:roomCode' element={<RoomLayout />}>
						{/* This renders at /rooms/:roomCode */}
						<Route index element={<RoomPage />} />

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

					{/* Fallback */}
					<Route path='/404' element={<NotFoundPage />} />
					<Route path='*' element={<Navigate to='/404' replace />} />
				</Routes>
			</BrowserRouter>
			<Toaster />
		</QueryClientProvider>
	);
}
