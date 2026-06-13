import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Copy, Trash2, MoreVertical, Users, FolderKanban, Settings2 } from "lucide-react";
import { api, type Agent } from "../../lib/api";
import { cn } from "../../lib/utils";
import { AgentAvatar } from "./TagEditor";
import { AgentIdentityBadge } from "./AgentIdentity";
import { EmptyGroupsIllustration } from "../Illustrations";
import { listItemNavClass } from "./DashboardUI";
import { useWorkspaceLayout } from "../../context/WorkspaceLayoutContext";

export function ContextPanel({ mode = "inline" }: { mode?: "inline" | "overlay" }) {
  const { isDesktop, closeContext } = useWorkspaceLayout();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const isTeams = location.pathname.startsWith("/teams");
  const isProjects = location.pathname.startsWith("/projects");

  const { data: teamsData } = useQuery({
    queryKey: ["teams"],
    queryFn: () => api.getTeams(),
    enabled: isTeams,
  });

  const { data: projectsData } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.getProjects(),
    enabled: isProjects,
  });

  const teamSlug = location.pathname.match(/\/teams\/([^/]+)/)?.[1];
  const { data: teamData } = useQuery({
    queryKey: ["team", teamSlug],
    queryFn: () => api.getTeam(teamSlug!),
    enabled: !!teamSlug,
  });

  const filteredAgents = (teamData?.agents ?? [])
    .filter((a) => a.isActive)
    .filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.slug.toLowerCase().includes(search.toLowerCase()) ||
    (a.shortId ?? "").includes(search.toLowerCase())
  );

  const closeIfMobile = () => {
    if (!isDesktop) closeContext();
  };

  const panelClass =
    mode === "inline"
      ? "flex w-[280px] shrink-0 flex-col border-r border-border-subtle bg-panel"
      : "flex h-full w-full flex-col bg-panel";

  if (isTeams) {
    return (
      <aside className={panelClass}>
        <div className="border-b border-border px-4 py-4">
          <div className="text-base font-semibold text-text-strong">Teams</div>
          {teamSlug && (
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search agents…"
                className="w-full rounded-xl border border-border bg-panel-elevated py-2 pl-8 pr-3 text-sm text-text outline-none placeholder:text-text-faint focus:border-neutral-500"
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {!teamSlug ? (
            <>
              <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-text-faint">Your teams</div>
              {(teamsData?.teams ?? []).map((team) => (
                <NavLink
                  key={team.id}
                  to={`/teams/${team.slug}`}
                  onClick={closeIfMobile}
                  className={({ isActive }) =>
                    listItemNavClass(
                      isActive,
                      "mb-0.5 flex items-center gap-3 px-3 py-2.5 transition"
                    )
                  }
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-panel-elevated text-neutral-300">
                    <Users className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{team.name}</div>
                    <div className="truncate text-xs text-neutral-500">
                      {team.agentCount} agent{team.agentCount !== 1 ? "s" : ""}
                    </div>
                  </div>
                </NavLink>
              ))}
            </>
          ) : (
            <>
              <NavLink
                to="/teams"
                onClick={closeIfMobile}
                className="mb-2 block px-2 text-xs text-text-muted underline-offset-2 hover:text-text-strong hover:underline"
              >
                ← All teams
              </NavLink>
              <NavLink
                to={`/teams/${teamSlug}`}
                end
                onClick={closeIfMobile}
                className={({ isActive }) =>
                  listItemNavClass(
                    isActive,
                    "mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
                  )
                }
              >
                <Settings2 className="h-4 w-4 shrink-0" />
                Team setup
              </NavLink>
              <div className="mb-1 flex items-center justify-between px-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">
                  Active agents
                </span>
                <button
                  type="button"
                  title="Clone new agent"
                  onClick={() => {
                    const template = teamData?.agents.find((a) => a.isTemplate) ?? teamData?.agents[0];
                    if (template) handleClone(template, teamData!.team.id, queryClient, teamSlug);
                  }}
                  className="rounded-lg p-1 hover:bg-panel-hover"
                >
                  <Plus className="h-4 w-4 text-neutral-500" />
                </button>
              </div>
              {filteredAgents.map((agent) => (
                <AgentListItem
                  key={agent.id}
                  agent={agent}
                  teamSlug={teamSlug}
                  onNavigate={closeIfMobile}
                  onClone={() => handleClone(agent, teamData!.team.id, queryClient, teamSlug)}
                  onDelete={async () => {
                    if (!confirm(`Delete "${agent.name}"?`)) return;
                    try {
                      await api.deleteAgent(agent.slug);
                      queryClient.invalidateQueries({ queryKey: ["team", teamSlug] });
                    } catch (e) {
                      alert(e instanceof Error ? e.message : "Delete failed");
                    }
                  }}
                />
              ))}
              {filteredAgents.length === 0 && teamSlug && (
                <div className="px-3 py-6 text-center text-xs text-text-muted">
                  No active agents. Manage all agents in{" "}
                  <NavLink to="/agents" className="text-text-strong underline underline-offset-2">
                    Agents
                  </NavLink>
                  .
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    );
  }

  if (isProjects) {
    const projectId = location.pathname.match(/\/projects\/([^/]+)/)?.[1];
    const isCreatePage = projectId === "new";
    return (
      <aside className={panelClass}>
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-base font-semibold text-text-strong">Project groups</div>
              <div className="text-xs text-text-muted">Same agent can join multiple groups</div>
            </div>
            <button
              type="button"
              onClick={() => {
                closeIfMobile();
                navigate("/projects/new");
              }}
              className="rounded-xl bg-accent-light p-1.5 text-accent-fg hover:bg-accent-light-hover"
              title="New project group"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {isCreatePage && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-panel-elevated px-3 py-2 text-xs text-text-muted">
              <FolderKanban className="h-3.5 w-3.5 shrink-0" />
              Creating new group…
            </div>
          )}
          {(projectsData?.projects ?? []).map((p) => (
            <ProjectListItem key={p.id} project={p} active={projectId === p.id} onNavigate={closeIfMobile} />
          ))}
          {(projectsData?.projects ?? []).length === 0 && !isCreatePage && (
            <div className="flex flex-col items-center gap-3 px-4 py-6">
              <EmptyGroupsIllustration className="h-16 w-24 text-text-faint" />
              <button
                type="button"
                onClick={() => {
                  closeIfMobile();
                  navigate("/projects/new");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-2 text-xs text-text-muted hover:border-neutral-500 hover:text-text-strong"
              >
                <Plus className="h-3.5 w-3.5" />
                Create your first group
              </button>
            </div>
          )}
        </div>
      </aside>
    );
  }

  return null;
}

function ProjectListItem({
  project,
  active,
  onNavigate,
}: {
  project: { id: string; title: string; agentCount: number; status: string; workProjectId?: string | null };
  active: boolean;
  onNavigate?: () => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete project group "${project.title}"?`)) return;
    await api.deleteProject(project.id);
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["work-hub"] });
    navigate("/projects");
  }

  return (
    <div className="group relative mb-0.5">
      <NavLink
        to={`/projects/${project.id}`}
        onClick={onNavigate}
        className={cn(
          listItemNavClass(active, "block px-3 py-2.5 pr-8 transition"),
        )}
      >
        <div className="text-sm font-medium">{project.title}</div>
        <div className="text-xs text-neutral-500">
          {project.agentCount} agent{project.agentCount !== 1 ? "s" : ""}
          {project.workProjectId ? " · Work project" : ""}
        </div>
      </NavLink>
      <button
        type="button"
        onClick={() => setMenuOpen(!menuOpen)}
        className="absolute right-2 top-2 rounded p-1 opacity-0 hover:bg-panel-hover group-hover:opacity-100"
      >
        <MoreVertical className="h-4 w-4 text-neutral-500" />
      </button>
      {menuOpen && (
        <div className="absolute right-2 top-8 z-20 rounded-xl border border-border bg-panel-elevated py-1 shadow-xl">
          <button
            type="button"
            onClick={handleDelete}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-text hover:bg-panel-hover"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete group
          </button>
        </div>
      )}
    </div>
  );
}

function AgentListItem({
  agent,
  teamSlug,
  onNavigate,
  onClone,
  onDelete,
}: {
  agent: Agent;
  teamSlug: string;
  onNavigate?: () => void;
  onClone: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group mb-1 flex items-start gap-1">
      <NavLink
        to={`/teams/${teamSlug}/agents/${agent.slug}`}
        onClick={onNavigate}
        className={({ isActive }) =>
          listItemNavClass(isActive, "flex min-w-0 flex-1 gap-2.5 rounded-xl px-2 py-2 transition")
        }
      >
        <AgentAvatar name={agent.name} color={agent.avatarColor} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{agent.name}</div>
          <AgentIdentityBadge agent={agent} />
          {(agent.projectGroupCount ?? 0) > 0 && (
            <div className="mt-0.5 text-[10px] text-text-muted">
              {agent.projectGroupCount} project group{(agent.projectGroupCount ?? 0) !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </NavLink>
      <div className="flex flex-col gap-0.5 opacity-0 transition group-hover:opacity-100">
        <button type="button" title="Clone" onClick={onClone} className="rounded p-1 hover:bg-panel-hover">
          <Copy className="h-3.5 w-3.5 text-text-muted" />
        </button>
        {!agent.isTemplate && (
          <button type="button" title="Delete" onClick={onDelete} className="rounded p-1 hover:bg-panel-hover">
            <Trash2 className="h-3.5 w-3.5 text-text-muted" />
          </button>
        )}
      </div>
    </div>
  );
}

async function handleClone(
  agent: Agent,
  teamGroupId: string,
  queryClient: ReturnType<typeof useQueryClient>,
  teamSlug: string
) {
  const name = prompt("Name for cloned agent:", `${agent.name} (Copy)`);
  if (!name) return;
  try {
    const { agent: cloned } = await api.cloneAgent(agent.slug, { name, teamGroupId });
    await queryClient.invalidateQueries({ queryKey: ["team", teamSlug] });
    window.location.href = `/teams/${teamSlug}/agents/${cloned.slug}`;
  } catch (e) {
    alert(e instanceof Error ? e.message : "Clone failed");
  }
}
