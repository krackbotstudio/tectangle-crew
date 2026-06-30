import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, getToken, setToken, type User } from "../lib/api";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  completeOAuthLogin: (token: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrateSession = useCallback(async (token: string) => {
    setToken(token);
    const { user: me } = await api.me();
    setUser(me);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    hydrateSession(token)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, [hydrateSession]);

  useEffect(() => {
    const onSessionExpired = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener("agentdesk:session-expired", onSessionExpired);
    return () => window.removeEventListener("agentdesk:session-expired", onSessionExpired);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await api.login(email, password);
    setToken(token);
    setUser(user);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const { token, user } = await api.register(name, email, password);
    setToken(token);
    setUser(user);
  }, []);

  const completeOAuthLogin = useCallback(
    async (token: string) => {
      await hydrateSession(token);
    },
    [hydrateSession]
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      completeOAuthLogin,
      logout,
      isAdmin: user?.role === "admin",
    }),
    [user, loading, login, register, completeOAuthLogin, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
