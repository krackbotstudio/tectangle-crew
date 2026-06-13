import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, Check, Pencil, Settings2, Trash2, UserMinus } from "lucide-react";
import type { Agent, WorkActivity, WorkProject, WorkTask } from "../../lib/api";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";
import { AgentAvatar } from "../workspace/TagEditor";
import { NODE_KIND_META } from "./workNodeStyles";
import type { WorkNodeSelection } from "./workHubGraph";

type ContextMenuProps = {
  selection: WorkNodeSelection;
  position: { x: number; y: number };
  agents: Agent[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: string) => void;
  onPriorityChange?: (priority: string) => void;
  onAgentChange: (agentId: string | null) => void;
  onProjectAgentAdd: (agentId: string) => void;
  onProjectAgentRemove: (agentId: string) => void;
};

function projectParams(project: WorkProject) {
  return [
    { key: "status", label: "Status", value: project.status, type: "status-project" as const },
    { key: "startDate", label: "Start", value: project.startDate ?? "—", type: "text" as const },
    { key: "dueDate", label: "Due", value: project.dueDate ?? "—", type: "text" as const },
    { key: "activities", label: "Activities", value: String(project.activityCount), type: "text" as const },
  ];
}

function activityParams(activity: WorkActivity) {
  return [
    { key: "status", label: "Status", value: activity.status, type: "status-item" as const },
    { key: "priority", label: "Priority", value: activity.priority, type: "priority" as const },
    { key: "schedule", label: "Schedule", value: activity.scheduleType, type: "text" as const },
    { key: "steps", label: "Steps", value: String(activity.tasks?.length ?? 0), type: "text" as const },
  ];
}

function taskParams(task: WorkTask) {
  return [
    { key: "status", label: "Status", value: task.status, type: "status-item" as const },
    { key: "priority", label: "Priority", value: task.priority, type: "priority" as const },
    { key: "schedule", label: "Schedule", value: task.scheduleType, type: "text" as const },
    {
      key: "linked",
      label: "Activity link",
      value: task.activityId ? "Attached" : "Standalone",
      type: "text" as const,
    },
  ];
}

export function WorkNodeContextMenu({
  selection,
  position,
  agents,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
  onPriorityChange,
  onAgentChange,
  onProjectAgentAdd,
  onProjectAgentRemove,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { kind, item } = selection;
  const meta = NODE_KIND_META[kind];

  const project = kind === "project" ? (item as WorkProject) : null;
  const activity = kind === "activity" ? (item as WorkActivity) : null;
  const task = kind === "task" ? (item as WorkTask) : null;

  const assignedAgentId =
    kind === "activity" ? activity?.agentId : kind === "task" ? task?.agentId : null;

  const { data: projectAgentsData } = useQuery({
    queryKey: ["project-agents", project?.projectGroupId],
    queryFn: () => api.getProject(project!.projectGroupId!),
    enabled: kind === "project" && !!project?.projectGroupId,
  });

  const projectAgentIds = new Set(
    (projectAgentsData?.agents ?? []).map((membership) => membership.agentId)
  );

  const title =
    kind === "project"
      ? project!.title
      : kind === "activity"
        ? activity!.title
        : task!.title;

  const params =
    kind === "project"
      ? projectParams(project!)
      : kind === "activity"
        ? activityParams(activity!)
        : taskParams(task!);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const clampedX = Math.min(position.x, window.innerWidth - 320);
  const clampedY = Math.min(position.y, window.innerHeight - 520);

  return (
    <div
      ref={ref}
      className="fixed z-[100] w-[300px] overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl"
      style={{ left: clampedX, top: clampedY }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className={cn("border-b border-border px-4 py-3", meta.headerBg)}>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-muted">
          <Settings2 className="h-3.5 w-3.5" />
          {meta.label} properties
        </div>
        <div className="mt-1 truncate text-sm font-semibold text-text-strong">{title}</div>
      </div>

      <div className="max-h-[220px] overflow-y-auto p-2">
        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-faint">
          Parameters
        </div>
        {params.map((param) => (
          <div
            key={param.key}
            className="mb-1 rounded-xl border border-border-subtle bg-panel-elevated/60 px-3 py-2"
          >
            <div className="text-[10px] uppercase tracking-wide text-text-faint">{param.label}</div>
            {param.type === "status-project" ? (
              <select
                value={param.value}
                onChange={(e) => onStatusChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-panel px-2 py-1 text-xs text-text"
              >
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            ) : param.type === "status-item" ? (
              <select
                value={param.value}
                onChange={(e) => onStatusChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-panel px-2 py-1 text-xs text-text"
              >
                <option value="todo">To do</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </select>
            ) : param.type === "priority" ? (
              <select
                value={param.value}
                onChange={(e) => onPriorityChange?.(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-panel px-2 py-1 text-xs capitalize text-text"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            ) : (
              <div className="mt-1 text-xs capitalize text-text">{param.value}</div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-border p-2">
        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-faint">
          {kind === "project" ? "Agent group" : "Assign agent"}
        </div>
        {kind === "project" && !project?.projectGroupId ? (
          <p className="px-2 py-2 text-xs text-text-muted">
            This project is not linked to an agent group yet.
          </p>
        ) : agents.length === 0 ? (
          <p className="px-2 py-2 text-xs text-text-muted">No active agents available.</p>
        ) : (
          <div className="max-h-[160px] overflow-y-auto">
            {kind !== "project" && (
              <button
                type="button"
                onClick={() => onAgentChange(null)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs hover:bg-panel-hover",
                  !assignedAgentId && "bg-panel-hover"
                )}
              >
                <UserMinus className="h-3.5 w-3.5 text-text-faint" />
                <span className="text-text-muted">Unassigned</span>
                {!assignedAgentId && <Check className="ml-auto h-3.5 w-3.5 text-teal-400" />}
              </button>
            )}
            {agents.map((agent) => {
              const isAssigned =
                kind === "project"
                  ? projectAgentIds.has(agent.id)
                  : assignedAgentId === agent.id;

              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => {
                    if (kind === "project") {
                      if (isAssigned) onProjectAgentRemove(agent.id);
                      else onProjectAgentAdd(agent.id);
                    } else {
                      onAgentChange(isAssigned ? null : agent.id);
                    }
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs hover:bg-panel-hover",
                    isAssigned && "bg-panel-hover"
                  )}
                >
                  <AgentAvatar name={agent.name} color={agent.avatarColor} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-text">{agent.name}</span>
                  {isAssigned ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-teal-400" />
                  ) : (
                    <Bot className="h-3.5 w-3.5 shrink-0 text-text-faint" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex border-t border-border p-2">
        <button
          type="button"
          onClick={() => {
            onEdit();
            onClose();
          }}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs text-text hover:bg-panel-hover"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit all
        </button>
        <button
          type="button"
          onClick={() => {
            onDelete();
            onClose();
          }}
          className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs text-red-300 hover:bg-red-950/30"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
