import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Agent, Project, Task, TeamGroup } from "../../lib/api";
import { cn } from "../../lib/utils";
import { GlassCard, SectionLabel } from "./GlassCard";
import {
  CHART_AXIS,
  CHART_COLORS,
  CHART_GRID,
  CHART_MUTED,
  CHART_PRIMARY,
  CHART_SECONDARY,
  CHART_STATUS_COLORS,
  CHART_TOOLTIP_STYLE,
} from "./chartTheme";

function ChartGradientDefs({ id, color }: { id: string; color: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity={0.35} />
        <stop offset="100%" stopColor={color} stopOpacity={0} />
      </linearGradient>
    </defs>
  );
}

type TimeRange = "7d" | "14d" | "30d";

function ChartShell({
  title,
  subtitle,
  children,
  className,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <GlassCard className={className} padding={false}>
      <div className="border-b border-border-subtle px-5 py-4">
        <SectionLabel title={title} subtitle={subtitle} action={action} />
      </div>
      <div className="px-2 pb-4 pt-2">{children}</div>
    </GlassCard>
  );
}

function EmptyChart({ message, tall }: { message: string; tall?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center text-sm text-text-muted",
        tall ? "h-[280px]" : "h-[200px]"
      )}
    >
      {message}
    </div>
  );
}

function TimeRangeTabs({
  value,
  onChange,
}: {
  value: TimeRange;
  onChange: (v: TimeRange) => void;
}) {
  const tabs: { id: TimeRange; label: string }[] = [
    { id: "7d", label: "7 days" },
    { id: "14d", label: "14 days" },
    { id: "30d", label: "30 days" },
  ];
  return (
    <div className="flex gap-1 rounded-xl border border-border bg-panel-elevated p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "rounded-lg px-3 py-1 text-xs font-medium transition",
            value === tab.id
              ? "bg-list-selected text-text-strong"
              : "text-text-muted hover:bg-panel-hover hover:text-text-strong"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function buildTrendBuckets(tasks: Task[], days: number) {
  const buckets = new Map<string, { label: string; tasks: number; done: number }>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, {
      label:
        days <= 7
          ? d.toLocaleDateString(undefined, { weekday: "short" })
          : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      tasks: 0,
      done: 0,
    });
  }
  for (const task of tasks) {
    const key = task.createdAt.slice(0, 10);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.tasks += 1;
      if (task.status === "done") bucket.done += 1;
    }
  }
  return [...buckets.values()];
}

export function ActivityHeroChart({ tasks }: { tasks: Task[] }) {
  const [range, setRange] = useState<TimeRange>("7d");
  const days = range === "7d" ? 7 : range === "14d" ? 14 : 30;

  const data = useMemo(() => buildTrendBuckets(tasks, days), [tasks, days]);
  const total = data.reduce((s, d) => s + d.tasks, 0);
  const completed = data.reduce((s, d) => s + d.done, 0);
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const hasActivity = total > 0;

  return (
    <ChartShell
      title="Workspace activity"
      subtitle="Automation runs across all agents"
      className="h-full"
      action={<TimeRangeTabs value={range} onChange={setRange} />}
    >
      <div className="px-4 pb-2">
        <div className="mb-4 flex flex-wrap items-end gap-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-text-muted">Total runs</p>
            <p className="text-3xl font-semibold tracking-tight text-text-strong">{total}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-text-muted">Completion</p>
            <p className="text-3xl font-semibold tracking-tight text-text-strong">{rate}%</p>
          </div>
        </div>
        {!hasActivity ? (
          <EmptyChart message="No runs in this period — start a chat with an agent" tall />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
              <ChartGradientDefs id="activityFill" color={CHART_PRIMARY} />
              <ChartGradientDefs id="doneFill" color={CHART_SECONDARY} />
              <CartesianGrid {...CHART_GRID} vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={CHART_AXIS.tick} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={CHART_AXIS.tick} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Area
                type="monotone"
                dataKey="tasks"
                name="All runs"
                stroke={CHART_PRIMARY}
                strokeWidth={2.5}
                fill="url(#activityFill)"
                dot={false}
                activeDot={{ r: 5, fill: CHART_PRIMARY, stroke: "#dcdcdc", strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="done"
                name="Completed"
                stroke={CHART_SECONDARY}
                strokeWidth={2}
                fill="url(#doneFill)"
                dot={false}
                activeDot={{ r: 4, fill: CHART_SECONDARY }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartShell>
  );
}

export function AgentsByTeamPieChart({ teams }: { teams: TeamGroup[] }) {
  const data = useMemo(
    () =>
      teams
        .filter((t) => t.agentCount > 0)
        .map((t, i) => ({
          name: t.name,
          value: t.agentCount,
          color: t.color || CHART_COLORS[i % CHART_COLORS.length],
        })),
    [teams]
  );

  return (
    <ChartShell title="Agents by team" subtitle="Distribution">
      {data.length === 0 ? (
        <EmptyChart message="No agents in teams yet" />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              innerRadius={48}
              outerRadius={78}
              paddingAngle={3}
              dataKey="value"
              stroke="rgba(0,0,0,0.3)"
              strokeWidth={1}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip {...CHART_TOOLTIP_STYLE} />
            <Legend
              verticalAlign="bottom"
              height={40}
              formatter={(value) => <span className="text-xs text-text-muted">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
}

export function AgentStatusPieChart({ agents }: { agents: Agent[] }) {
  const workingAgents = agents.filter((a) => !a.isTemplate);
  const active = workingAgents.filter((a) => a.isActive).length;
  const inactive = workingAgents.length - active;

  const data = [
    { name: "Active", value: active, color: CHART_PRIMARY },
    { name: "Inactive", value: inactive, color: "#404040" },
  ].filter((d) => d.value > 0);

  return (
    <ChartShell title="Agent status" subtitle="Active vs paused">
      {workingAgents.length === 0 ? (
        <EmptyChart message="No agents configured" />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              innerRadius={48}
              outerRadius={78}
              paddingAngle={4}
              dataKey="value"
              stroke="transparent"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip {...CHART_TOOLTIP_STYLE} />
            <Legend
              verticalAlign="bottom"
              height={40}
              formatter={(value) => <span className="text-xs text-text-muted">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
}

export function TaskStatusBarChart({ tasks }: { tasks: Task[] }) {
  const statusLabels: Record<Task["status"], string> = {
    queued: "Queued",
    running: "Running",
    done: "Done",
    failed: "Failed",
    pending_approval: "Pending",
  };

  const statusColors = CHART_STATUS_COLORS;

  const data = useMemo(() => {
    const counts = new Map<Task["status"], number>();
    for (const task of tasks) {
      counts.set(task.status, (counts.get(task.status) ?? 0) + 1);
    }
    return (Object.keys(statusLabels) as Task["status"][])
      .map((status) => ({
        status: statusLabels[status],
        count: counts.get(status) ?? 0,
        fill: statusColors[status],
      }))
      .filter((d) => d.count > 0);
  }, [tasks]);

  return (
    <ChartShell title="Run status" subtitle="Current pipeline">
      {data.length === 0 ? (
        <EmptyChart message="No tasks yet" />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid {...CHART_GRID} vertical={false} />
            <XAxis dataKey="status" axisLine={false} tickLine={false} tick={CHART_AXIS.tick} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={CHART_AXIS.tick} />
            <Tooltip {...CHART_TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar dataKey="count" radius={[8, 8, 0, 0]} name="Tasks">
              {data.map((entry) => (
                <Cell key={entry.status} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
}

export function TeamAgentsBarChart({ teams }: { teams: TeamGroup[] }) {
  const data = useMemo(
    () =>
      [...teams]
        .sort((a, b) => b.agentCount - a.agentCount)
        .map((t, i) => ({
          name: t.name.length > 10 ? `${t.name.slice(0, 9)}…` : t.name,
          fullName: t.name,
          agents: t.agentCount,
          fill: t.color || CHART_COLORS[i % CHART_COLORS.length],
        })),
    [teams]
  );

  return (
    <ChartShell title="Team capacity" subtitle="Agents per team">
      {data.length === 0 ? (
        <EmptyChart message="No teams yet" />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
            <CartesianGrid {...CHART_GRID} horizontal={false} />
            <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={CHART_AXIS.tick} />
            <YAxis
              type="category"
              dataKey="name"
              width={68}
              axisLine={false}
              tickLine={false}
              tick={CHART_AXIS.tick}
            />
            <Tooltip
              {...CHART_TOOLTIP_STYLE}
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
              labelFormatter={(_, payload) =>
                (payload?.[0]?.payload as { fullName?: string })?.fullName ?? ""
              }
            />
            <Bar dataKey="agents" name="Agents" radius={[0, 8, 8, 0]}>
              {data.map((entry) => (
                <Cell key={entry.fullName} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
}

export function ProjectAgentsBarChart({ projects }: { projects: Project[] }) {
  const data = useMemo(
    () =>
      [...projects]
        .sort((a, b) => b.agentCount - a.agentCount)
        .slice(0, 6)
        .map((p) => ({
          name: p.title.length > 14 ? `${p.title.slice(0, 13)}…` : p.title,
          fullName: p.title,
          agents: p.agentCount,
        })),
    [projects]
  );

  return (
    <ChartShell title="Project groups" subtitle="Agents per group">
      {data.length === 0 ? (
        <EmptyChart message="No project groups" />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid {...CHART_GRID} vertical={false} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={CHART_AXIS.tick} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={CHART_AXIS.tick} />
            <Tooltip
              {...CHART_TOOLTIP_STYLE}
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
              labelFormatter={(_, payload) =>
                (payload?.[0]?.payload as { fullName?: string })?.fullName ?? ""
              }
            />
            <Bar dataKey="agents" name="Agents" fill={CHART_MUTED} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
}

export function TasksByAgentBarChart({ tasks }: { tasks: Task[] }) {
  const data = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const task of tasks) {
      const existing = counts.get(task.agentSlug);
      if (existing) existing.count += 1;
      else counts.set(task.agentSlug, { name: task.agentName, count: 1 });
    }
    return [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((entry, i) => ({
        name: entry.name.length > 12 ? `${entry.name.slice(0, 11)}…` : entry.name,
        fullName: entry.name,
        runs: entry.count,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }));
  }, [tasks]);

  return (
    <ChartShell title="Top agents" subtitle="By run volume">
      {data.length === 0 ? (
        <EmptyChart message="No agent runs yet" />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid {...CHART_GRID} vertical={false} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={CHART_AXIS.tick} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={CHART_AXIS.tick} />
            <Tooltip
              {...CHART_TOOLTIP_STYLE}
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
              labelFormatter={(_, payload) =>
                (payload?.[0]?.payload as { fullName?: string })?.fullName ?? ""
              }
            />
            <Bar dataKey="runs" name="Runs" radius={[8, 8, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.fullName} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
}
