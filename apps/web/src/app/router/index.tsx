import { createBrowserRouter, Navigate } from "react-router-dom";
import { HomePage } from "@/features/dashboard/home/HomePage";
import { LeaderboardPage } from "@/features/dashboard/pages/LeaderboardPage";
import { NotFoundPage } from "@/app/router/NotFoundPage";
import { PredictionPage } from "@/features/prediction-details/pages/PredictionPage";
import PredictionNew from "@/features/create-prediction/pages/New";
import RoomLayout from "@/app/layouts/RoomLayout";
import CreatePlayer from "@/features/dashboard/home/components/CreatePlayer";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { SignupPage } from "@/features/auth/pages/SignupPage";
import { ForgotPasswordPage } from "@/features/auth/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/features/auth/pages/ResetPasswordPage";
import RoomDashboard from "@/features/dashboard/pages/RoomDashboard";
import { PredictionDuelsPage } from "@/features/duel-details/pages/PredictionDuelsPage";
import { PredictionDuelCreatePage } from "@/features/create-duel/pages/PredictionDuelCreatePage";
import { PredictionDuelDetailPage } from "@/features/duel-details/pages/PredictionDuelDetailPage";

export const router = createBrowserRouter([
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
            handle: { header: { leftAction: "home" } },
          },
          {
            path: "predictions/new",
            element: <PredictionNew />,
            handle: { header: { leftAction: "back", title: "Create Prediction" } },
          },
          {
            path: "predictions/:predictionId",
            element: <PredictionPage />,
            handle: { header: { leftAction: "back", title: "Prediction" } },
          },
          {
            path: "predictions/:predictionId/duels",
            element: <PredictionDuelsPage />,
            handle: { header: { leftAction: "back", title: "Duels" } },
          },
          {
            path: "predictions/:predictionId/duels/create",
            element: <PredictionDuelCreatePage />,
            handle: { header: { leftAction: "back", title: "Create Duel" } },
          },
          {
            path: "predictions/:predictionId/duels/:duelId",
            element: <PredictionDuelDetailPage />,
            handle: { header: { leftAction: "back", title: "Duel" } },
          },
          {
            path: "leaderboard",
            element: <LeaderboardPage />,
            handle: { header: { leftAction: "back", title: "Leaderboard" } },
          },
        ],
      },
    ],
  },
  { path: "/404", element: <NotFoundPage /> },
  { path: "*", element: <Navigate to="/404" replace /> },
]);
