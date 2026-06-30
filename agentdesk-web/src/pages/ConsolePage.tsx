import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  FolderKanban,
  Plug,
  Settings,
  Store,
  Terminal,
  Workflow,
  XCircle,
} from "lucide-react";
import { api } from "../lib/api";
import { AGENT_ICONS, STATUS_STYLES, cn, formatRelativeTime } from "../lib/utils";
import { DashboardCard, MetricCard, PageHeader } from "../components/workspace/DashboardUI";
import { AgentAvatar } from "../components/workspace/TagEditor";

export function ConsolePage() {
  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks", "recent"],
    queryFn: () => api.getRecentTasks(),
    refetchInterval: 15000,
  });

  const { data: agentsData } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.getAgents(),
  });

  const { data: projectsData } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.getProjects(),
  });

  const { data: appStoreData } = useQuery({
    queryKey: ["console"],
    queryFn: () => api.getConsole(),
  });

  const { data: n8nHealth } = useQuery({
    queryKey: ["n8n", "health"],
    queryFn: () => api.getN8nHealth(),
    refetchInterval: 60000,
  });

  const agents = agentsData?.agents ?? [];
  const activeAgents = agents.filter((a) => a.isActive);
  const tasks = tasksData?.tasks ?? [];
  const runningTasks = tasks.filter((t) => t.status === "running");
  const stats = appStoreData?.stats;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Console"
          subtitle="Monitor agent activity, automations, and workspace health in one place."
        />

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Active agents" value={activeAgents.length} icon={Bot} />
          <MetricCard label="Running tasks" value={runningTasks.length} icon={Activity} />
          <MetricCard
            label="Connected apps"
            value={stats?.connectedCount ?? 0}
            icon={Plug}
          />
          <MetricCard
            label="Project groups"
            value={projectsData?.projects.length ?? 0}
            icon={FolderKanban}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-semibold text-text-strong">Recent agent activity</h2>
              <Link
                to="/work"
                className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-strong"
              >
                Work hub <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <DashboardCard className="overflow-hidden p-0">
              {tasksLoading ? (
                <p className="p-6 text-sm text-text-muted">Loading activity…</p>
              ) : tasks.length === 0 ? (
                <p className="p-6 text-sm text-text-muted">
                  No agent runs yet. Start a conversation in a project group or team workspace.
                </p>
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {tasks.slice(0, 12).map((task) => (
                    <li key={task.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="text-lg">{AGENT_ICONS[task.agentSlug] ?? "🤖"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-text-strong">
                          {task.title}
                        </div>
                        <div className="text-xs text-text-muted">
                          {task.agentName} · {formatRelativeTime(task.createdAt)}
                        </div>
                        {task.currentStep && (
                          <div className="truncate text-[11px] text-text-faint">
                            {task.currentStep}
                          </div>
                        )}
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                          STATUS_STYLES[task.status] ?? "bg-panel-elevated text-text-muted"
                        )}
                      >
                        {task.status.replace("_", " ")}
                      </span>
                      <Link
                        to={`/agents/${task.agentSlug}/tasks`}
                        className="shrink-0 text-xs text-text-muted hover:text-text-strong"
                      >
                        Open
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </DashboardCard>
          </section>

          <aside className="space-y-4">
            <section>
              <h2 className="mb-3 font-semibold text-text-strong">System status</h2>
              <DashboardCard className="space-y-3">
                <StatusRow
                  label="n8n automations"
                  ok={n8nHealth?.reachable}
                  detail={
                    n8nHealth?.reachable
                      ? "Connected"
                      : n8nHealth?.apiConfigured
                        ? "Unreachable"
                        : "Not configured"
                  }
                />
                <StatusRow
                  label="App integrations"
                  ok={(stats?.connectedCount ?? 0) > 0}
                  detail={`${stats?.connectedCount ?? 0} connected · ${stats?.configuredCount ?? 0} configured`}
                />
                <StatusRow
                  label="MCP connectors"
                  ok={(stats?.mcpCount ?? 0) > 0}
                  detail={`${stats?.mcpCount ?? 0} configured`}
                  neutral={(stats?.mcpCount ?? 0) === 0}
                />
              </DashboardCard>
            </section>

            <section>
              <h2 className="mb-3 font-semibold text-text-strong">Quick links</h2>
              <div className="space-y-2">
                <QuickLink
                  to="/app-store"
                  icon={Store}
                  title="App Store"
                  desc="Connect workspace apps & OAuth"
                />
                <QuickLink
                  to="/settings"
                  icon={Settings}
                  title="Settings"
                  desc="Members, AI models, access"
                />
                <QuickLink
                  to="/agents"
                  icon={Bot}
                  title="Agents"
                  desc="Configure agents & automations"
                />
                <QuickLink
                  to="/work"
                  icon={Workflow}
                  title="Work hub"
                  desc="Canvas, timeline & tasks"
                />
              </div>
            </section>

            {activeAgents.length > 0 && (
              <section>
                <h2 className="mb-3 font-semibold text-text-strong">Active agents</h2>
                <DashboardCard className="space-y-2">
                  {activeAgents.slice(0, 6).map((agent) => (
                    <Link
                      key={agent.id}
                      to={`/agents/${agent.slug}`}
                      className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-panel-hover"
                    >
                      <AgentAvatar name={agent.name} color={agent.avatarColor} size="sm" />
                      <span className="truncate text-sm text-text-strong">{agent.name}</span>
                    </Link>
                  ))}
                  {activeAgents.length > 6 && (
                    <Link to="/agents" className="block pt-1 text-xs text-text-muted hover:text-text-strong">
                      +{activeAgents.length - 6} more
                    </Link>
                  )}
                </DashboardCard>
              </section>
            )}
          </aside>
        </div>

        <p className="mt-8 flex items-center gap-2 text-xs text-text-faint">
          <Terminal className="h-3.5 w-3.5" />
          Console is your operations view. Use the App Store to connect third-party apps agents can use in
          project groups.
        </p>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  ok,
  detail,
  neutral,
}: {
  label: string;
  ok?: boolean;
  detail: string;
  neutral?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      {neutral ? (
        <div className="mt-0.5 h-4 w-4 rounded-full border border-border" />
      ) : ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
      )}
      <div>
        <div className="text-sm font-medium text-text-strong">{label}</div>
        <div className="text-xs text-text-muted">{detail}</div>
      </div>
    </div>
  );
}

function QuickLink({
  to,
  icon: Icon,
  title,
  desc,
}: {
  to: string;
  icon: typeof Store;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-xl border border-border bg-panel px-3 py-2.5 transition hover:bg-panel-hover"
    >
      <Icon className="h-4 w-4 shrink-0 text-text-muted" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-text-strong">{title}</span>
        <span className="block text-[11px] text-text-faint">{desc}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-text-faint" />
    </Link>
  );
}
