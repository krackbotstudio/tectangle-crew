import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bot, Sparkles, TrendingUp, Zap } from "lucide-react";
import type { Agent, TeamGroup, Task } from "../../lib/api";
import { cn } from "../../lib/utils";
import { GlassCard } from "./GlassCard";
import { Sparkline, buildDailySparkline } from "./Sparkline";
import { CHART_COLORS, CHART_PRIMARY } from "./chartTheme";

export function StatsTicker({
  items,
}: {
  items: { label: string; value: string | number; delta?: string; positive?: boolean }[];
}) {
  return (
    <div className="dash-ticker flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex min-w-[140px] shrink-0 items-center gap-3 rounded-xl border border-border bg-panel px-4 py-3"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
              {item.label}
            </p>
            <p className="text-lg font-semibold text-text-strong">{item.value}</p>
          </div>
          {item.delta && (
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-xs font-medium",
                item.positive
                  ? "border border-border bg-panel-elevated text-text-strong"
                  : "bg-panel-elevated text-text-muted"
              )}
            >
              {item.delta}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function HeroMetricCard({
  label,
  value,
  sub,
  sparkData,
  color = CHART_PRIMARY,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  sparkData: number[];
  color?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  const trend = sparkData.at(-1)! - (sparkData.at(0) ?? 0);
  const positive = trend >= 0;
  const lineColor = accent ? CHART_PRIMARY : color;

  return (
    <GlassCard className="relative overflow-hidden" hover>
      {accent && (
        <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-brand-purple/10 blur-2xl" />
      )}
      <div className="relative flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-text-strong">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-text-muted">{sub}</p>}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-panel-elevated">
          <Icon
            className={cn("h-4 w-4", accent ? "text-brand-purple" : "text-text-muted")}
          />
        </div>
      </div>
      <div className="relative mt-3 -mx-1">
        <Sparkline data={sparkData} color={lineColor} height={44} />
      </div>
      <div className="relative mt-2 flex items-center gap-1 text-xs text-text-muted">
        <TrendingUp className={cn("h-3 w-3", !positive && "rotate-180")} />
        <span>
          {positive ? "+" : ""}
          {trend} this week
        </span>
      </div>
    </GlassCard>
  );
}

export function TeamSparklineCard({
  team,
  tasks,
  index,
}: {
  team: TeamGroup;
  tasks: Task[];
  index: number;
}) {
  const color = team.color || CHART_COLORS[index % CHART_COLORS.length];
  const teamTasks = useMemo(() => tasks, [tasks]);
  const spark = buildDailySparkline(teamTasks);

  return (
    <Link to={`/teams/${team.slug}`} className="block shrink-0">
      <GlassCard className="w-[200px]" hover padding>
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-panel-elevated text-xs font-bold text-text-strong"
            style={team.color ? { borderColor: `${color}66`, color } : undefined}
          >
            {team.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-strong">{team.name}</p>
            <p className="text-xs text-text-muted">{team.agentCount} agents</p>
          </div>
        </div>
        <div className="mt-3 -mx-1">
          <Sparkline data={spark} color={color} height={40} />
        </div>
      </GlassCard>
    </Link>
  );
}

export function WorkspaceSummaryCard({
  agents,
  tasks,
  runningCount,
}: {
  agents: Agent[];
  tasks: Task[];
  runningCount: number;
}) {
  const active = agents.filter((a) => a.isActive && !a.isTemplate).length;
  const done = tasks.filter((t) => t.status === "done").length;
  const rate = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <GlassCard variant="brand" className="flex h-full flex-col justify-between">
      <div>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-text-muted">
          <Sparkles className="h-3.5 w-3.5 text-brand-purple" />
          AI workspace
        </div>
        <p className="mt-3 text-4xl font-semibold tracking-tight text-text-strong">{active}</p>
        <p className="text-sm text-text-muted">active agents online</p>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between border-b border-border-subtle pb-2">
            <span className="text-text-muted">Success rate</span>
            <span className="font-medium text-text-strong">{rate}%</span>
          </div>
          <div className="flex justify-between border-b border-border-subtle pb-2">
            <span className="text-text-muted">Running now</span>
            <span className="font-medium text-text-strong">{runningCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Total runs</span>
            <span className="font-medium text-text-strong">{tasks.length}</span>
          </div>
        </div>
      </div>
      <div className="relative mt-6 flex justify-center">
        <div className="dash-orb h-20 w-20 rounded-full" />
        <Bot className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-brand-purple" />
      </div>
      <Link
        to="/agents"
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-muted-fg transition hover:bg-accent-hover"
      >
        <Zap className="h-4 w-4" />
        Manage agents
      </Link>
    </GlassCard>
  );
}

export function PromoCard() {
  return (
    <GlassCard variant="elevated" className="relative overflow-hidden">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Pro tip</p>
      <h3 className="mt-2 text-lg font-semibold text-text-strong">Connect your tools</h3>
      <p className="mt-1 text-sm text-text-muted">
        Link Notion, Sheets, Slack & more so agents can read and write real data.
      </p>
      <Link
        to="/app-store"
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-text-strong hover:text-brand-purple"
      >
        Open App Store <ArrowRight className="h-4 w-4" />
      </Link>
    </GlassCard>
  );
}
