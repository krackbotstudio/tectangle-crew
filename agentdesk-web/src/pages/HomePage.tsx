import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Users,
  Bot,
  FolderKanban,
  Activity,
  Download,
  Folder,
} from "lucide-react";
import { api } from "../lib/api";
import { STATUS_STYLES, formatRelativeTime } from "../lib/utils";
import { AgentAvatar } from "../components/workspace/TagEditor";
import { DashboardCard, MetricCard, PageHeader } from "../components/workspace/DashboardUI";
import { useAuth } from "../context/AuthContext";

export function HomePage() {
  const { user } = useAuth();
  const { data: teamsData } = useQuery({ queryKey: ["teams"], queryFn: () => api.getTeams() });
  const { data: projectsData } = useQuery({ queryKey: ["projects"], queryFn: () => api.getProjects() });
  const { data: agentsData } = useQuery({ queryKey: ["agents"], queryFn: () => api.getAgents() });
  const { data: tasksData } = useQuery({
    queryKey: ["tasks", "recent"],
    queryFn: () => api.getRecentTasks(),
    refetchInterval: 15000,
  });

  const teams = teamsData?.teams ?? [];
  const projects = projectsData?.projects ?? [];
  const agents = agentsData?.agents ?? [];
  const tasks = tasksData?.tasks ?? [];
  const runningCount = tasks.filter((t) => t.status === "running").length;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title={`Welcome back, ${user?.name?.split(" ")[0] ?? "there"}!`}
          subtitle="Organize AI agents into teams, clone and customize them, and assign groups to projects."
          action={
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-panel px-4 py-2 text-sm text-text-strong hover:bg-panel-hover"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Teams" value={teams.length} icon={Users} />
          <MetricCard label="Project groups" value={projects.length} icon={FolderKanban} />
          <MetricCard label="Agents" value={agents.length} icon={Bot} />
          <MetricCard label="Active runs" value={runningCount} icon={Activity} />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link to="/teams" className="block">
            <DashboardCard hover className="h-full">
              <Users className="h-8 w-8 text-text-muted" />
              <h2 className="mt-4 font-semibold text-text-strong">Teams</h2>
              <p className="mt-1 text-sm text-text-muted">
                Chat with active agents organized by team — your day-to-day workspace.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm text-text-strong">
                Open teams <ArrowRight className="h-4 w-4" />
              </span>
            </DashboardCard>
          </Link>

          <Link to="/agents" className="block">
            <DashboardCard hover className="h-full">
              <Bot className="h-8 w-8 text-text-muted" />
              <h2 className="mt-4 font-semibold text-text-strong">Agents</h2>
              <p className="mt-1 text-sm text-text-muted">
                Configure all agents, n8n workflows, webhooks, skills, and activation status.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm text-text-strong">
                Manage agents <ArrowRight className="h-4 w-4" />
              </span>
            </DashboardCard>
          </Link>

          <Link to="/projects" className="block sm:col-span-2 lg:col-span-1">
            <DashboardCard hover className="h-full">
              <FolderKanban className="h-8 w-8 text-text-muted" />
              <h2 className="mt-4 font-semibold text-text-strong">Project groups</h2>
              <p className="mt-1 text-sm text-text-muted">
                Group agents from different teams to collaborate on a shared goal.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm text-text-strong">
                Browse groups <ArrowRight className="h-4 w-4" />
              </span>
            </DashboardCard>
          </Link>
        </div>

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-text-strong">Your project groups</h2>
            <Link to="/projects" className="text-sm text-text-muted hover:text-text-strong">
              View all
            </Link>
          </div>
          {projects.length === 0 ? (
            <DashboardCard className="text-sm text-text-muted">
              No project groups yet. Create a project in{" "}
              <Link to="/work" className="text-text-strong hover:underline">
                Work
              </Link>{" "}
              or{" "}
              <Link to="/projects/new" className="text-text-strong hover:underline">
                add a group
              </Link>
              .
            </DashboardCard>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Link key={project.id} to={`/projects/${project.id}`}>
                  <DashboardCard hover className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-panel-elevated">
                      <FolderKanban className="h-5 w-5 text-text-muted" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-text-strong">{project.title}</div>
                      <div className="text-xs text-text-muted">
                        {project.agentCount} agent{project.agentCount !== 1 ? "s" : ""}
                        {project.workProjectId ? " · from Work" : ""}
                      </div>
                    </div>
                  </DashboardCard>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-text-strong">Your teams</h2>
            <Link to="/teams" className="text-sm text-text-muted hover:text-text-strong">
              View all
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <Link key={team.id} to={`/teams/${team.slug}`}>
                <DashboardCard hover className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-panel-elevated">
                    <Folder className="h-5 w-5 text-text-muted" />
                  </div>
                  <div>
                    <div className="font-medium text-text-strong">{team.name}</div>
                    <div className="text-xs text-text-muted">{team.agentCount} agents</div>
                  </div>
                </DashboardCard>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <DashboardCard className="p-0">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4 font-semibold text-text-strong">
              <Activity className="h-4 w-4" />
              Recent activity
            </div>
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-text-muted">
                <Activity className="h-8 w-8 text-text-faint" />
                No activity yet
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {tasks.slice(0, 8).map((task) => (
                  <li key={task.id} className="flex items-center gap-3 px-5 py-3">
                    <AgentAvatar name={task.agentName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-text-strong">{task.title}</div>
                      <div className="text-xs text-text-muted">
                        {task.agentName} · {formatRelativeTime(task.createdAt)}
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[task.status]}`}>
                      {task.status.replace("_", " ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DashboardCard>
        </section>
      </div>
    </div>
  );
}
