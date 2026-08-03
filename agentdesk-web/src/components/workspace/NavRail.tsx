import { NavLink } from "react-router-dom";
import {
  Home,
  Users,
  Bot,
  FolderKanban,
  ClipboardList,
  Settings,
  Search,
  LayoutGrid,
  Share2,
  Network,
  Palette,
  Layers,
  Store,
  Terminal,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { listItemNavClass } from "./DashboardUI";
import { AppLogo } from "../AppLogo";

const items = [
  { to: "/dashboard", icon: Home, label: "Dashboard", end: true },
  { to: "/teams", icon: Users, label: "Teams", end: true },
  { to: "/agents", icon: Bot, label: "Agents" },
  { to: "/projects", icon: FolderKanban, label: "Groups" },
  { to: "/work", icon: ClipboardList, label: "Work" },
  { to: "/social", icon: Share2, label: "Social" },
  { to: "/networks", icon: Network, label: "Networks" },
  { to: "/brand", icon: Palette, label: "Brand" },
  { to: "/templates", icon: Layers, label: "Templates" },
  { to: "/app-store", icon: Store, label: "App Store" },
];

export function NavRail() {
  const { user, logout } = useAuth();

  return (
    <aside className="hidden w-[240px] shrink-0 flex-col border-r border-border-subtle bg-sidebar px-4 py-5 lg:flex">
      <div className="mb-6 px-1">
        <AppLogo showWordmark linkToHome />
      </div>

      <div className="relative mb-5">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-faint" />
        <input
          type="text"
          placeholder="Search…"
          className="w-full rounded-xl border border-border bg-panel py-2 pl-9 pr-3 text-sm text-text outline-none placeholder:text-text-faint focus:border-neutral-500"
          readOnly
          title="Global search coming soon"
        />
      </div>

      <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-text-faint">
        Essentials
      </div>

      <nav className="flex flex-col gap-0.5">
        {items.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              listItemNavClass(isActive, "flex items-center gap-3 px-3 py-2.5 text-sm")
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-6 mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-text-faint">
        Management
      </div>

      <NavLink
        to="/console"
        className={({ isActive }) =>
          listItemNavClass(isActive, "flex items-center gap-3 px-3 py-2.5 text-sm")
        }
      >
        <Terminal className="h-4 w-4 shrink-0" />
        <span>Console</span>
      </NavLink>

      <NavLink
        to="/settings"
        className={({ isActive }) =>
          listItemNavClass(isActive, "flex items-center gap-3 px-3 py-2.5 text-sm")
        }
      >
        <Settings className="h-4 w-4 shrink-0" />
        <span>Settings</span>
      </NavLink>

      <div className="mt-auto space-y-3 pt-6">
        <div className="rounded-2xl border border-border bg-panel p-4">
          <div className="mb-2 flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-text-muted" />
            <span className="text-xs font-medium text-text-strong">Multi-agent hub</span>
          </div>
          <p className="text-[11px] leading-relaxed text-text-faint">
            Organize teams, clone agents, and run project groups from one place.
          </p>
        </div>

        <button
          type="button"
          title={`${user?.name} — Sign out`}
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left transition hover:bg-panel-hover"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-light text-xs font-semibold text-accent-fg">
            {user?.name?.charAt(0) ?? "U"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-text-strong">{user?.name ?? "User"}</div>
            <div className="truncate text-xs text-text-faint">Sign out</div>
          </div>
        </button>
      </div>
    </aside>
  );
}
