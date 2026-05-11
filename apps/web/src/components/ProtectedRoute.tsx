import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Spinner } from "@/components";

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-dvh'>
        <Spinner className='size-10 text-primary' />
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate to='/login' state={{ from: location }} replace />
    );
  }

  return <Outlet />;
}
