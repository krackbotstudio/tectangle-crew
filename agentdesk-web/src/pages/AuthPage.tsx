import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { LogIn, Mail, Lock, User, ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { AppLogo } from "../components/AppLogo";
import { SocialAuthButtons } from "../components/auth/SocialAuthButtons";
import { LOGO_WORDMARK } from "../lib/brand";
import { cn } from "../lib/utils";

type AuthMode = "signin" | "signup";

export function AuthPage({ mode }: { mode: AuthMode }) {
  const { login, register, user, loading } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/dashboard";
  const isSignup = mode === "signup";

  useEffect(() => {
    const urlError = searchParams.get("error");
    if (urlError) setError(decodeURIComponent(urlError));
  }, [searchParams]);

  if (!loading && user) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isSignup) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full bg-canvas">
      <div className="hidden w-1/2 flex-col justify-between border-r border-border-subtle bg-sidebar p-10 lg:flex">
        <AppLogo showWordmark linkToHome />
        <div>
          <h1 className="text-3xl font-semibold leading-tight text-text-strong">
            {isSignup ? "Create your workspace account" : "Welcome back"}
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-text-muted">
            {isSignup
              ? "Join your team’s AI hub — chat with agents, run automations, and collaborate on projects."
              : "Sign in to manage agents, teams, and n8n automations from one place."}
          </p>
        </div>
        <p className="text-xs text-text-faint">Secure sign-in · Role-based access · n8n integration</p>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-strong"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
          <div className="lg:hidden">
            <AppLogo size="sm" linkToHome homeHref="/" />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 pb-10 sm:px-6">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <h1 className="text-2xl font-semibold text-text-strong">
                {isSignup ? "Create account" : "Sign in"}
              </h1>
              <p className="mt-1 text-sm text-text-muted">
                {isSignup ? `Get started with ${LOGO_WORDMARK}` : "Access your workspace"}
              </p>
            </div>

            <SocialAuthButtons />

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-text-faint">or continue with email</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="mb-6 flex rounded-xl border border-border bg-panel p-1">
              <Link
                to="/login"
                className={cn(
                  "flex-1 rounded-lg py-2 text-center text-sm transition",
                  !isSignup
                    ? "bg-list-selected text-text-strong"
                    : "text-text-muted hover:text-text-strong"
                )}
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className={cn(
                  "flex-1 rounded-lg py-2 text-center text-sm transition",
                  isSignup
                    ? "bg-list-selected text-text-strong"
                    : "text-text-muted hover:text-text-strong"
                )}
              >
                Sign up
              </Link>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-panel p-6">
              {isSignup && (
                <Field label="Full name" icon={User}>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    placeholder="Jane Smith"
                    required
                  />
                </Field>
              )}

              <Field label="Email" icon={Mail}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@company.com"
                  required
                  autoComplete="email"
                />
              </Field>

              <Field label="Password" icon={Lock}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder={isSignup ? "At least 6 characters" : "••••••••"}
                  required
                  minLength={isSignup ? 6 : undefined}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                />
              </Field>

              {error && (
                <div className="rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text-strong">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-muted-fg hover:bg-accent-hover disabled:opacity-60"
              >
                <LogIn className="h-4 w-4" />
                {submitting
                  ? isSignup
                    ? "Creating account…"
                    : "Signing in…"
                  : isSignup
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-text-faint">
              {isSignup ? (
                <>
                  Already have an account?{" "}
                  <Link to="/login" className="text-text-muted underline underline-offset-2 hover:text-text-strong">
                    Sign in
                  </Link>
                </>
              ) : (
                <>
                  Demo: admin@agentdesk.local / admin123 ·{" "}
                  <Link to="/signup" className="text-text-muted underline underline-offset-2 hover:text-text-strong">
                    Create account
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-text-muted">
        <Icon className="h-3.5 w-3.5" /> {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none placeholder:text-text-faint focus:border-neutral-500";
