import { NavLink } from "react-router-dom";
import { Home, Users, Bot, FolderKanban, ClipboardList, LogOut } from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../context/AuthContext";

const items = [
  { to: "/dashboard", icon: Home, label: "Home", end: true },
  { to: "/teams", icon: Users, label: "Teams", end: true },
  { to: "/agents", icon: Bot, label: "Agents" },
  { to: "/projects", icon: FolderKanban, label: "Groups" },
  { to: "/work", icon: ClipboardList, label: "Work" },
];

export function BottomNav() {
  const { logout } = useAuth();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border-subtle bg-sidebar pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Main navigation"
    >
      {items.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              "flex flex-1 flex-col items-center gap-0.5 px-0.5 py-2.5 text-[10px] font-medium transition",
              isActive ? "text-text-strong" : "text-text-muted"
            )
          }
        >
          <Icon className="h-5 w-5 shrink-0" />
          <span className="truncate">{label}</span>
        </NavLink>
      ))}
      <button
        type="button"
        onClick={logout}
        className="flex flex-1 flex-col items-center gap-0.5 px-0.5 py-2.5 text-[10px] font-medium text-text-muted transition hover:text-text-strong"
        title="Sign out"
      >
        <LogOut className="h-5 w-5 shrink-0" />
        <span className="truncate">Sign out</span>
      </button>
    </nav>
  );
}
