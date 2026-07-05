import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Loading } from "./ui/spinner";

export function ProtectedRoute() {
	const { user, isLoading } = useAuth();
	const location = useLocation();

	if (isLoading) {
		return (
			<div className='flex items-center justify-center h-dvh'>
				<Loading className='size-10 text-primary' />
			</div>
		);
	}

	if (!user) {
		return <Navigate to='/login' state={{ from: location }} replace />;
	}

	return <Outlet />;
}
