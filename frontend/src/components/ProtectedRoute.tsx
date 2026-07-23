import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Spinner from "@/components/Spinner";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Required roles. If not provided, any authenticated user can access. */
  roles?: string[];
}

/**
 * ProtectedRoute — Guards a route behind authentication.
 *
 * - If session is still loading (token validation in progress), shows a spinner.
 * - If user is not authenticated, redirects to /login, preserving the intended URL.
 * - If user is authenticated but does not have a required role, redirects to /.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles }) => {
  const { user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  // Session restoration in progress — don't flash the login page
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-8 w-8 text-primary" />
          <p className="text-sm text-muted-foreground font-medium">Authenticating...</p>
        </div>
      </div>
    );
  }

  // Not authenticated — redirect to login, preserving intended destination
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authenticated but insufficient role
  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
