import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Bot, Circle } from "lucide-react";
import { api, type Agent } from "../../lib/api";
import { cn } from "../../lib/utils";
import { AgentAvatar } from "./TagEditor";
import { AgentIdentityBadge } from "./AgentIdentity";
import { listItemNavClass } from "./DashboardUI";
import { useWorkspaceLayout } from "../../context/WorkspaceLayoutContext";

type AgentFilter = "all" | "active" | "inactive";

export function AgentsContextPanel({ mode = "inline" }: { mode?: "inline" | "overlay" }) {
  const navigate = useNavigate();
  const { isDesktop, closeContext } = useWorkspaceLayout();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AgentFilter>("all");

  const { data } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.getAgents(),
  });

  const closeIfMobile = () => {
    if (!isDesktop) closeContext();
  };

  const panelClass =
    mode === "inline"
      ? "flex w-[280px] shrink-0 flex-col border-r border-border-subtle bg-panel"
      : "flex h-full w-full flex-col bg-panel";

  const agents = (data?.agents ?? []).filter((a) => {
    if (filter === "active" && !a.isActive) return false;
    if (filter === "inactive" && a.isActive) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      a.name.toLowerCase().includes(q) ||
      a.slug.toLowerCase().includes(q) ||
      (a.shortId ?? "").includes(q) ||
      (a.teamGroup?.name ?? a.team).toLowerCase().includes(q)
    );
  });

  const activeCount = (data?.agents ?? []).filter((a) => a.isActive).length;

  return (
    <aside className={panelClass}>
      <div className="border-b border-border px-4 py-4">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-text-muted" />
          <div>
            <div className="text-base font-semibold text-text-strong">All agents</div>
            <div className="text-xs text-text-muted">
              {activeCount} active · {(data?.agents ?? []).length} total
            </div>
          </div>
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-text-faint" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents…"
            className="w-full rounded-xl border border-border bg-panel-elevated py-2 pl-8 pr-3 text-sm text-text outline-none placeholder:text-text-faint focus:border-neutral-500"
          />
        </div>
        <div className="mt-2 flex gap-1">
          {(["all", "active", "inactive"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-lg px-2 py-1 text-[11px] font-medium capitalize transition",
                filter === f
                  ? "bg-list-selected text-text-strong"
                  : "text-text-muted hover:bg-panel-hover hover:text-text-strong"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {agents.map((agent) => (
          <AgentListItem key={agent.id} agent={agent} onNavigate={closeIfMobile} />
        ))}
        {agents.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-text-muted">
            No agents match this filter.
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={() => {
            closeIfMobile();
            navigate("/teams");
          }}
          className="w-full rounded-xl border border-dashed border-border px-3 py-2 text-xs text-text-muted hover:border-neutral-500 hover:text-text-strong"
        >
          Clone new agent from a team →
        </button>
      </div>
    </aside>
  );
}

function AgentListItem({ agent, onNavigate }: { agent: Agent; onNavigate?: () => void }) {
  return (
    <NavLink
      to={`/agents/${agent.slug}`}
      onClick={onNavigate}
      className={({ isActive }) =>
        listItemNavClass(isActive, "mb-0.5 flex items-start gap-2.5 px-2 py-2.5 transition")
      }
    >
      <AgentAvatar name={agent.name} color={agent.avatarColor} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{agent.name}</span>
          <Circle
            className={cn(
              "h-2 w-2 shrink-0 fill-current",
              agent.isActive ? "text-emerald-500" : "text-text-faint"
            )}
          />
        </div>
        <div className="mt-0.5 text-[10px] text-text-muted">
          {agent.teamGroup?.name ?? agent.team}
        </div>
        <div className="mt-1">
          <AgentIdentityBadge agent={agent} />
        </div>
      </div>
    </NavLink>
  );
}
