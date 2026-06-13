import { useMemo } from "react";
import { Calendar, Clock } from "lucide-react";
import type { WorkActivity, WorkHub, WorkTask } from "../../lib/api";
import { cn } from "../../lib/utils";

type TimelineItem = {
  id: string;
  label: string;
  kind: "project" | "activity" | "task";
  start: Date;
  end: Date;
  status: string;
  row: number;
};

const DAY_MS = 86400000;

function parseDate(value: string | null | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function collectTimelineItems(hub: WorkHub, filterProjectId: string | null): TimelineItem[] {
  const items: TimelineItem[] = [];
  let row = 0;
  const now = new Date();
  const defaultEnd = addDays(now, 14);

  const projects = filterProjectId
    ? hub.projects.filter((p) => p.id === filterProjectId)
    : hub.projects;

  for (const project of projects) {
    const start = parseDate(project.startDate, parseDate(project.createdAt, now));
    const end = parseDate(project.dueDate, addDays(start, 30));
    items.push({
      id: project.id,
      label: project.title,
      kind: "project",
      start,
      end: end > start ? end : addDays(start, 7),
      status: project.status,
      row: row++,
    });

    for (const activity of project.activities) {
      pushActivityItem(activity, row++, start, defaultEnd, items);
      for (const task of activity.tasks ?? []) {
        pushTaskItem(task, row++, activity, items);
      }
    }
  }

  if (!filterProjectId) {
    for (const activity of hub.standaloneActivities) {
      pushActivityItem(activity, row++, now, defaultEnd, items);
      for (const task of activity.tasks ?? []) {
        pushTaskItem(task, row++, activity, items);
      }
    }
    for (const task of hub.standaloneTasks) {
      pushTaskItem(task, row++, null, items);
    }
  }

  return items;
}

function pushActivityItem(
  activity: WorkActivity,
  row: number,
  fallbackStart: Date,
  fallbackEnd: Date,
  items: TimelineItem[]
) {
  const start = parseDate(activity.scheduledAt ?? activity.nextRunAt, fallbackStart);
  const end = addDays(start, activity.scheduleType === "recurring" ? 21 : 5);
  items.push({
    id: activity.id,
    label: activity.title,
    kind: "activity",
    start,
    end: end > start ? end : fallbackEnd,
    status: activity.status,
    row,
  });
}

function pushTaskItem(
  task: WorkTask,
  row: number,
  parentActivity: WorkActivity | null,
  items: TimelineItem[]
) {
  const fallback = parentActivity
    ? parseDate(parentActivity.scheduledAt, new Date())
    : new Date();
  const start = parseDate(task.scheduledAt ?? task.nextRunAt, fallback);
  items.push({
    id: task.id,
    label: task.title,
    kind: "task",
    start,
    end: addDays(start, 2),
    status: task.status,
    row,
  });
}

function formatAxisDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function barStyle(kind: TimelineItem["kind"], status: string) {
  if (status === "in_progress") {
    return "bg-gradient-to-r from-teal-600 to-teal-400 text-white";
  }
  if (kind === "project") {
    return status === "active"
      ? "bg-gradient-to-r from-teal-700 to-teal-500 text-white"
      : "bg-panel-elevated text-text-strong border border-border";
  }
  if (kind === "activity") {
    return "bg-white text-black";
  }
  return "bg-neutral-700 text-neutral-200";
}

export function WorkHubTimeline({
  hub,
  filterProjectId,
}: {
  hub: WorkHub;
  filterProjectId: string | null;
}) {
  const items = useMemo(
    () => collectTimelineItems(hub, filterProjectId),
    [hub, filterProjectId]
  );

  const { rangeStart, totalDays, nowOffset } = useMemo(() => {
    const now = new Date();
    if (items.length === 0) {
      const start = addDays(now, -7);
      return { rangeStart: start, totalDays: 28, nowOffset: 25 };
    }

    let min = items[0].start.getTime();
    let max = items[0].end.getTime();
    for (const item of items) {
      min = Math.min(min, item.start.getTime());
      max = Math.max(max, item.end.getTime());
    }

    const rangeStart = addDays(new Date(min), -3);
    const rangeEnd = addDays(new Date(max), 7);
    const totalDays = Math.max(14, Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / DAY_MS));
    const nowOffset = ((now.getTime() - rangeStart.getTime()) / DAY_MS / totalDays) * 100;

    return { rangeStart, totalDays, nowOffset: Math.min(98, Math.max(2, nowOffset)) };
  }, [items]);

  const axisTicks = useMemo(() => {
    const ticks: Date[] = [];
    const step = Math.max(1, Math.floor(totalDays / 8));
    for (let i = 0; i <= totalDays; i += step) {
      ticks.push(addDays(rangeStart, i));
    }
    return ticks;
  }, [rangeStart, totalDays]);

  const durationLabel = `${(totalDays / 30).toFixed(1).replace(".0", "")} month${totalDays > 45 ? "s" : ""}`;

  if (items.length === 0) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-border bg-panel text-sm text-text-muted">
        No scheduled work yet. Add dates to projects and activities to see the timeline.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[480px] flex-col overflow-hidden rounded-2xl border border-border bg-[#0a0a0a]">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h3 className="font-semibold text-text-strong">Workflow plan</h3>
          <p className="text-xs text-text-muted">Timeline view with schedule and duration</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Clock className="h-3.5 w-3.5" />
          {durationLabel}
        </div>
      </div>

      <div className="relative flex-1 overflow-auto p-5">
        <div className="relative min-w-[720px]">
          <div className="mb-4 flex border-b border-border pb-2 pl-36">
            {axisTicks.map((tick) => (
              <div
                key={tick.toISOString()}
                className="flex-1 text-[10px] text-text-faint"
                style={{ minWidth: 72 }}
              >
                {formatAxisDate(tick)}
              </div>
            ))}
          </div>

          <div className="relative space-y-3">
            <div
              className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-teal-400"
              style={{ left: `calc(9rem + ${nowOffset}%)` }}
            >
              <div className="absolute -left-1.5 -top-1 h-3 w-3 rotate-45 bg-teal-400" />
              <span className="absolute -top-6 left-2 text-[10px] text-teal-400">Now</span>
            </div>

            {items.map((item) => {
              const startOffset =
                ((item.start.getTime() - rangeStart.getTime()) / DAY_MS / totalDays) * 100;
              const width = Math.max(
                4,
                ((item.end.getTime() - item.start.getTime()) / DAY_MS / totalDays) * 100
              );
              const days = Math.max(1, Math.round((item.end.getTime() - item.start.getTime()) / DAY_MS));

              return (
                <div key={item.id} className="flex items-center gap-4">
                  <div className="w-32 shrink-0 truncate text-xs text-text-muted">{item.label}</div>
                  <div className="relative h-10 flex-1">
                    <div
                      className={cn(
                        "absolute top-1 flex h-8 items-center justify-between rounded-full px-3 text-[11px] font-medium shadow-sm",
                        barStyle(item.kind, item.status)
                      )}
                      style={{
                        left: `${startOffset}%`,
                        width: `${width}%`,
                        minWidth: 72,
                      }}
                    >
                      <span className="truncate">{item.label}</span>
                      <span className="ml-2 shrink-0 rounded-full bg-black/20 px-2 py-0.5 text-[10px]">
                        {days}d
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 border-t border-border px-5 py-3 text-[10px] text-text-faint">
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3 w-3" /> Timeline enabled
        </span>
        <span className="inline-flex h-2 w-6 rounded-full bg-gradient-to-r from-teal-700 to-teal-400" />
        Active project
        <span className="inline-flex h-2 w-6 rounded-full bg-white" />
        Activity
      </div>
    </div>
  );
}
