import { NavLink, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, ListTodo, BookOpen, Settings, LayoutDashboard, Workflow } from "lucide-react";
import { api } from "../lib/api";
import { LOGO_WORDMARK, PRODUCT_TAGLINE } from "../lib/brand";
import { AGENT_ICONS, cn } from "../lib/utils";

const navItems = [
  { to: "chat", label: "Chat", icon: MessageSquare },
  { to: "tasks", label: "Tasks", icon: ListTodo },
  { to: "knowledge", label: "Knowledge", icon: BookOpen },
  { to: "automations", label: "Automations", icon: Workflow },
  { to: "settings", label: "Settings", icon: Settings },
];

export function AgentSidebar() {
  const { agentId } = useParams();
  const { data } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.getAgents(),
  });

  const agents = data?.agents ?? [];

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-5">
        <div className="text-lg font-semibold text-brand-700">{LOGO_WORDMARK}</div>
        <div className="text-xs text-slate-500">{PRODUCT_TAGLINE}</div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              "mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
              isActive
                ? "bg-brand-50 text-brand-700"
                : "text-slate-600 hover:bg-slate-50"
            )
          }
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </NavLink>

        <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Team Agents
        </div>

        {agents
          .filter((a) => a.slug !== "orchestrator")
          .map((agent) => (
            <NavLink
              key={agent.id}
              to={`/agents/${agent.slug}/chat`}
              className={({ isActive }) =>
                cn(
                  "mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                  isActive || agentId === agent.slug
                    ? "bg-brand-50 text-brand-700 font-medium"
                    : "text-slate-600 hover:bg-slate-50",
                  !agent.isActive && "opacity-60"
                )
              }
            >
              <span>{AGENT_ICONS[agent.slug] ?? "🤖"}</span>
              <span className="truncate">{agent.name}</span>
              {!agent.isActive && (
                <span className="ml-auto text-[10px] uppercase text-slate-400">off</span>
              )}
            </NavLink>
          ))}

        <div className="my-4 border-t border-slate-100" />

        <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Cross-team
        </div>
        {agents
          .filter((a) => a.slug === "orchestrator")
          .map((agent) => (
            <NavLink
              key={agent.id}
              to={`/agents/${agent.slug}/chat`}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                  isActive || agentId === agent.slug
                    ? "bg-brand-50 text-brand-700 font-medium"
                    : "text-slate-600 hover:bg-slate-50"
                )
              }
            >
              <span>{AGENT_ICONS.orchestrator}</span>
              {agent.name}
            </NavLink>
          ))}
      </nav>
    </aside>
  );
}

export function AgentTabs() {
  const { agentId } = useParams();

  return (
    <div className="mb-6 flex gap-1 border-b border-slate-200">
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={`/agents/${agentId}/${to}`}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition",
              isActive
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </div>
  );
}
