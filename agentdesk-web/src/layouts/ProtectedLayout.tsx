import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LOGO_WORDMARK } from "../lib/brand";
import { WorkspaceLayout } from "./WorkspaceLayout";

export function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-canvas text-text-muted">
        Loading {LOGO_WORDMARK}…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <WorkspaceLayout>
      <Outlet />
    </WorkspaceLayout>
  );
}
