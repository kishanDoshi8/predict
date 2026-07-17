import { Suspense, lazy, type ReactElement } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { HomePage } from "@/features/home";
import { ProtectedRoute } from "@/features/auth";
import { RouteFallback } from "@/app/router/RouteFallback";
import { RouteErrorBoundary } from "@/app/router/RouteErrorBoundary";
import RoomLayout from "@/app/layouts/RoomLayout";
import RoomTabsLayout from "@/app/layouts/RoomTabsLayout";
import { RequireRoomMember } from "@/features/rooms";

const LoginPage = lazy(() =>
	import("@/features/auth/pages/LoginPage").then((module) => ({
		default: module.LoginPage,
	})),
);
const SignupPage = lazy(() =>
	import("@/features/auth/pages/SignupPage").then((module) => ({
		default: module.SignupPage,
	})),
);
const ForgotPasswordPage = lazy(() =>
	import("@/features/auth/pages/ForgotPasswordPage").then((module) => ({
		default: module.ForgotPasswordPage,
	})),
);
const ResetPasswordPage = lazy(() =>
	import("@/features/auth/pages/ResetPasswordPage").then((module) => ({
		default: module.ResetPasswordPage,
	})),
);
const CreatePlayer = lazy(
	() => import("@/features/home/components/CreatePlayer"),
);
const RoomDashboard = lazy(
	() => import("@/features/rooms/pages/RoomDashboard"),
);
const RoomHistoryPage = lazy(
	() => import("@/features/rooms/pages/RoomHistoryPage"),
);
const RoomActivitiesPage = lazy(
	() => import("@/features/rooms/pages/RoomActivitiesPage"),
);
const RoomProfilePage = lazy(
	() => import("@/features/rooms/pages/RoomProfilePage"),
);
const JoinRoomPage = lazy(() =>
	import("@/features/rooms/pages/JoinRoomPage").then((module) => ({
		default: module.JoinRoomPage,
	})),
);
const PredictionNew = lazy(() => import("@/features/predictions/pages/New"));
const PredictionPage = lazy(() =>
	import("@/features/predictions/pages/PredictionPage").then((module) => ({
		default: module.PredictionPage,
	})),
);
const PredictionDuelsPage = lazy(() =>
	import("@/features/duels/pages/PredictionDuelsPage").then((module) => ({
		default: module.PredictionDuelsPage,
	})),
);
const PredictionDuelCreatePage = lazy(() =>
	import("@/features/duels/pages/PredictionDuelCreatePage").then(
		(module) => ({
			default: module.PredictionDuelCreatePage,
		}),
	),
);
const PredictionDuelDetailPage = lazy(() =>
	import("@/features/duels/pages/PredictionDuelDetailPage").then(
		(module) => ({
			default: module.PredictionDuelDetailPage,
		}),
	),
);
const LeaderboardPage = lazy(() =>
	import("@/features/leaderboard/pages/LeaderboardPage").then((module) => ({
		default: module.LeaderboardPage,
	})),
);
const NotFoundPage = lazy(() =>
	import("@/app/router/NotFoundPage").then((module) => ({
		default: module.NotFoundPage,
	})),
);

const withSuspense = (element: ReactElement) => (
	<Suspense fallback={<RouteFallback />}>{element}</Suspense>
);

export const router = createBrowserRouter([
	{
		path: "/login",
		element: withSuspense(<LoginPage />),
		errorElement: <RouteErrorBoundary />,
	},
	{
		path: "/signup",
		element: withSuspense(<SignupPage />),
		errorElement: <RouteErrorBoundary />,
	},
	{
		path: "/forgot-password",
		element: withSuspense(<ForgotPasswordPage />),
		errorElement: <RouteErrorBoundary />,
	},
	{
		path: "/reset-password",
		element: withSuspense(<ResetPasswordPage />),
		errorElement: <RouteErrorBoundary />,
	},
	{
		element: <ProtectedRoute />,
		errorElement: <RouteErrorBoundary />,
		children: [
			{ path: "/", element: <HomePage /> },
			{ path: "/create-player", element: withSuspense(<CreatePlayer />) },
			{
				path: "/rooms/:roomCode",
				children: [
					{
						path: "join",
						element: withSuspense(<JoinRoomPage />),
					},
					{
						element: <RequireRoomMember />,
						errorElement: <RouteErrorBoundary />,
						children: [
							{
								element: <RoomLayout />,
								errorElement: <RouteErrorBoundary />,
								children: [
									{
										element: <RoomTabsLayout />,
										children: [
											{
												index: true,
												element: withSuspense(
													<RoomDashboard />,
												),
												handle: {
													header: {
														leftAction: "home",
													},
												},
											},
											{
												path: "leaderboard",
												element: withSuspense(
													<LeaderboardPage />,
												),
												handle: {
													header: {
														// title: "Leaderboard",
													},
												},
											},
											{
												path: "history",
												element: withSuspense(
													<RoomHistoryPage />,
												),
												handle: {
													header: {
														// title: "History",
													},
												},
											},
											{
												path: "activities",
												element: withSuspense(
													<RoomActivitiesPage />,
												),
												handle: {
													header: {},
												},
											},
											{
												path: "profile",
												element: withSuspense(
													<RoomProfilePage />,
												),
												handle: {
													header: {
														title: "Series",
													},
												},
											},
										],
									},
									{
										path: "predictions/new",
										element: withSuspense(
											<PredictionNew />,
										),
										handle: {
											header: {
												leftAction: "back",
											},
										},
									},
									{
										path: "predictions/:predictionId",
										element: withSuspense(
											<PredictionPage />,
										),
										handle: {
											header: {
												leftAction: "back",
											},
										},
									},
									{
										path: "predictions/:predictionId/duels",
										element: withSuspense(
											<PredictionDuelsPage />,
										),
										handle: {
											header: {
												leftAction: "back",
											},
										},
									},
									{
										path: "predictions/:predictionId/duels/create",
										element: withSuspense(
											<PredictionDuelCreatePage />,
										),
										handle: {
											header: {
												leftAction: "back",
											},
										},
									},
									{
										path: "predictions/:predictionId/duels/:duelId",
										element: withSuspense(
											<PredictionDuelDetailPage />,
										),
										handle: {
											header: {
												leftAction: "back",
											},
										},
									},
								],
							},
						],
					},
				],
			},
		],
	},
	{
		path: "/404",
		element: withSuspense(<NotFoundPage />),
		errorElement: <RouteErrorBoundary />,
	},
	{ path: "*", element: <Navigate to='/404' replace /> },
]);
