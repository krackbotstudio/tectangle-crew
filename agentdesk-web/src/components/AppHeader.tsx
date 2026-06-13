import { LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function AppHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="text-sm text-slate-500">
        Signed in as <span className="font-medium text-slate-800">{user?.name}</span>
        {user?.role && (
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs uppercase">
            {user.role.replace("_", " ")}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={logout}
        className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </header>
  );
}
