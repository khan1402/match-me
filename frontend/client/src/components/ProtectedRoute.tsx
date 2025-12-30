import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";

interface ProtectedRouteProps {
  component: React.ComponentType<any>;
  [key: string]: any;
}

/**
 * ProtectedRoute component
 * 
 * Wraps protected pages and ensures the user is authenticated before rendering.
 * If the user is not authenticated, redirects to /login.
 * Shows a loading spinner while checking authentication status.
 */
export default function ProtectedRoute({ component: Component, ...rest }: ProtectedRouteProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Once loading is complete, check if user is authenticated
    if (!loading && !isAuthenticated) {
      // Redirect to login page
      setLocation("/login");
    }
  }, [loading, isAuthenticated, setLocation]);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  // If not authenticated, don't render anything (redirect will happen)
  if (!isAuthenticated) {
    return null;
  }

  // User is authenticated, render the component
  return <Component {...rest} />;
}
