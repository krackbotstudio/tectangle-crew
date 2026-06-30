import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Activity,
  Bot,
  ChevronRight,
  FolderKanban,
  Search,
  Users,
} from "lucide-react";
import { api } from "../lib/api";
import { STATUS_STYLES, formatRelativeTime } from "../lib/utils";
import { AgentAvatar } from "../components/workspace/TagEditor";
import {
  ActivityHeroChart,
  AgentStatusPieChart,
  AgentsByTeamPieChart,
  ProjectAgentsBarChart,
  TaskStatusBarChart,
  TasksByAgentBarChart,
  TeamAgentsBarChart,
} from "../components/dashboard/DashboardCharts";
import { GlassCard, SectionLabel } from "../components/dashboard/GlassCard";
import {
  HeroMetricCard,
  PromoCard,
  StatsTicker,
  TeamSparklineCard,
  WorkspaceSummaryCard,
} from "../components/dashboard/DashboardWidgets";
import { buildDailySparkline } from "../components/dashboard/Sparkline";
import { CHART_COLORS } from "../components/dashboard/chartTheme";
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
  const doneCount = tasks.filter((t) => t.status === "done").length;

  const taskSpark = useMemo(() => buildDailySparkline(tasks), [tasks]);
  const agentSpark = useMemo(
    () => buildDailySparkline(tasks.map((t) => ({ createdAt: t.createdAt }))),
    [tasks]
  );

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="dash-page relative h-full overflow-y-auto">
      <div className="dash-ambient pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
        {/* Top bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <span>Overview</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-text-strong">Dashboard</span>
            </div>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-text-strong sm:text-2xl">
              Welcome back, {user?.name?.split(" ")[0] ?? "there"}
            </h1>
            <p className="mt-0.5 text-sm text-text-muted">{today}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-xl border border-border bg-panel-elevated px-3 py-2 sm:flex">
              <Search className="h-4 w-4 text-text-muted" />
              <span className="text-sm text-text-faint">Search workspace…</span>
            </div>
          </div>
        </div>

        <StatsTicker
          items={[
            { label: "Teams", value: teams.length },
            { label: "Groups", value: projects.length },
            { label: "Agents", value: agents.length, delta: `${agents.filter((a) => a.isActive).length} live`, positive: true },
            { label: "Runs", value: tasks.length, delta: `${doneCount} done`, positive: doneCount > 0 },
            { label: "Active", value: runningCount, delta: runningCount > 0 ? "live" : "idle", positive: runningCount > 0 },
          ]}
        />

        {/* Hero metrics with sparklines */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <HeroMetricCard
            label="Automation runs"
            value={tasks.length}
            sub="Last 7 days"
            sparkData={taskSpark}
            accent
            icon={Activity}
          />
          <HeroMetricCard
            label="Agents"
            value={agents.filter((a) => !a.isTemplate).length}
            sub={`${agents.filter((a) => a.isActive).length} active`}
            sparkData={agentSpark.length ? agentSpark : [0, 1, 1, 2, agents.length]}
            color={CHART_COLORS[2]}
            icon={Bot}
          />
          <HeroMetricCard
            label="Teams"
            value={teams.length}
            sub={`${teams.reduce((s, t) => s + t.agentCount, 0)} agents assigned`}
            sparkData={teams.map((t) => t.agentCount)}
            color={CHART_COLORS[3]}
            icon={Users}
          />
          <HeroMetricCard
            label="Project groups"
            value={projects.length}
            sub={`${projects.reduce((s, p) => s + p.agentCount, 0)} collaborators`}
            sparkData={projects.map((p) => p.agentCount).concat([0, 0]).slice(0, 7)}
            color={CHART_COLORS[4]}
            icon={FolderKanban}
          />
        </div>

        {/* Main feature row */}
        <div className="mt-6 grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <ActivityHeroChart tasks={tasks} />
          </div>
          <div className="flex flex-col gap-4 lg:col-span-4">
            <WorkspaceSummaryCard agents={agents} tasks={tasks} runningCount={runningCount} />
            <PromoCard />
          </div>
        </div>

        {/* Top teams carousel */}
        {teams.length > 0 && (
          <section className="mt-8">
            <SectionLabel
              title="Your teams"
              subtitle="Agent capacity by department"
              action={
                <Link to="/teams" className="text-xs text-text-muted hover:text-text-strong">
                  View all →
                </Link>
              }
            />
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {teams.map((team, i) => (
                <TeamSparklineCard key={team.id} team={team} tasks={tasks} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* Analytics grid */}
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AgentsByTeamPieChart teams={teams} />
          <AgentStatusPieChart agents={agents} />
          <TaskStatusBarChart tasks={tasks} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <TeamAgentsBarChart teams={teams} />
          <ProjectAgentsBarChart projects={projects} />
        </div>

        <div className="mt-4">
          <TasksByAgentBarChart tasks={tasks} />
        </div>

        {/* Activity table */}
        <section className="mt-8">
          <GlassCard padding={false}>
            <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <SectionLabel title="Recent runs" subtitle="Latest agent automation activity" />
              <Link to="/tasks" className="text-xs font-medium text-text-muted hover:text-text-strong">
                View all
              </Link>
            </div>
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-12 text-center text-sm text-text-muted">
                <Activity className="h-8 w-8 text-text-faint" />
                No runs yet — chat with an agent to get started
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle text-xs uppercase tracking-wider text-text-muted">
                      <th className="px-5 py-3 font-medium">#</th>
                      <th className="px-5 py-3 font-medium">Run</th>
                      <th className="px-5 py-3 font-medium">Agent</th>
                      <th className="px-5 py-3 font-medium">When</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {tasks.slice(0, 10).map((task, i) => (
                      <tr key={task.id} className="transition hover:bg-panel-hover">
                        <td className="px-5 py-3 text-text-faint">{i + 1}</td>
                        <td className="max-w-[200px] truncate px-5 py-3 font-medium text-text-strong">
                          {task.title}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <AgentAvatar name={task.agentName} size="sm" />
                            <span className="text-text-muted">{task.agentName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-text-muted">
                          {formatRelativeTime(task.createdAt)}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs capitalize ${STATUS_STYLES[task.status]}`}
                          >
                            {task.status.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </section>
      </div>
    </div>
  );
}
