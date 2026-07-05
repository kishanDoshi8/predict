import { createBrowserRouter, Navigate } from "react-router-dom";
import { CreatePlayer, HomePage } from "@/features/home";
import { LeaderboardPage } from "@/features/leaderboard";
import { NotFoundPage } from "@/app/router/NotFoundPage";
import { PredictionNew, PredictionPage } from "@/features/predictions";
import RoomLayout from "@/app/layouts/RoomLayout";
import { ProtectedRoute } from "@/features/auth";
import { LoginPage } from "@/features/auth";
import { SignupPage } from "@/features/auth";
import { ForgotPasswordPage } from "@/features/auth";
import { ResetPasswordPage } from "@/features/auth";
import { RoomDashboard } from "@/features/rooms";
import { PredictionDuelsPage } from "@/features/duels";
import { PredictionDuelCreatePage } from "@/features/duels";
import { PredictionDuelDetailPage } from "@/features/duels";

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
