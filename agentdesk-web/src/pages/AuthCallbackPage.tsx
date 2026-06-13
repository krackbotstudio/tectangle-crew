import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { AppLogo } from "../components/AppLogo";

export function AuthCallbackPage() {
  const { completeOAuthLogin, user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    const urlError = searchParams.get("error");

    if (urlError) {
      setError(decodeURIComponent(urlError));
      return;
    }

    if (!token) {
      setError("Missing authentication token");
      return;
    }

    completeOAuthLogin(token).catch((err) => {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    });
  }, [searchParams, completeOAuthLogin]);

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  if (error) {
    return <Navigate to={`/login?error=${encodeURIComponent(error)}`} replace />;
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-canvas p-6 text-text-muted">
      <AppLogo size="lg" />
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">Completing sign-in…</p>
    </div>
  );
}
