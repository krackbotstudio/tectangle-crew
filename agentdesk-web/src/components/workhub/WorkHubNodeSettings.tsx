import {
  Bot,
  Calendar,
  Copy,
  GitBranch,
  Link2,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { WorkActivity, WorkProject, WorkTask } from "../../lib/api";
import { cn } from "../../lib/utils";
import { AgentAvatar } from "../workspace/TagEditor";
import type { WorkNodeSelection } from "./workHubGraph";

function titleFor(selection: WorkNodeSelection) {
  if (selection.kind === "project") return (selection.item as WorkProject).title;
  if (selection.kind === "activity") return (selection.item as WorkActivity).title;
  return (selection.item as WorkTask).title;
}

export function WorkHubNodeSettings({
  selection,
  projects,
  onClose,
  onEdit,
  onDelete,
  onAddChild,
  onStatusChange,
  onDuplicate,
  onLinkToProject,
}: {
  selection: WorkNodeSelection;
  projects: WorkProject[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddChild?: (kind: "activity" | "task") => void;
  onStatusChange: (status: string) => void;
  onDuplicate?: (targetProjectId?: string | null) => void;
  onLinkToProject?: (projectId: string) => void;
}) {
  const [linkProjectId, setLinkProjectId] = useState("");
  const [duplicateProjectId, setDuplicateProjectId] = useState("");

  const { kind, item } = selection;
  const project = kind === "project" ? (item as WorkProject) : null;
  const activity = kind === "activity" ? (item as WorkActivity) : null;
  const task = kind === "task" ? (item as WorkTask) : null;

  const status = item.status as string;
  const agentName =
    kind === "project" ? null : (item as WorkActivity | WorkTask).agentName;
  const agentColor =
    kind === "project" ? null : (item as WorkActivity | WorkTask).agentColor;

  const scheduleType =
    kind === "project" ? null : (item as WorkActivity | WorkTask).scheduleType;
  const scheduledAt =
    kind === "project" ? null : (item as WorkActivity | WorkTask).scheduledAt;
  const priority =
    kind === "project" ? null : (item as WorkActivity | WorkTask).priority;

  const settingsItems = [
    {
      icon: Pencil,
      label: "Edit details",
      shortcut: "E",
      onClick: onEdit,
    },
    ...(kind === "project" && project?.projectGroupId
      ? [
          {
            icon: Link2,
            label: "Open agent group",
            shortcut: "G",
            href: `/projects/${project.projectGroupId}`,
          },
        ]
      : []),
    ...(kind === "project"
      ? [
          {
            icon: Plus,
            label: "Add activity",
            shortcut: "A",
            onClick: () => onAddChild?.("activity"),
          },
        ]
      : []),
    ...(kind === "activity"
      ? [
          {
            icon: GitBranch,
            label: "Add step",
            shortcut: "S",
            onClick: () => onAddChild?.("task"),
          },
          {
            icon: Copy,
            label: "Duplicate activity",
            shortcut: "D",
            onClick: () => onDuplicate?.(duplicateProjectId || null),
          },
        ]
      : []),
    ...(kind === "task"
      ? [
          {
            icon: Copy,
            label: "Duplicate step",
            shortcut: "D",
            onClick: () => onDuplicate?.(duplicateProjectId || null),
          },
        ]
      : []),
    {
      icon: Trash2,
      label: "Remove",
      shortcut: "Del",
      onClick: onDelete,
      danger: true,
    },
  ] as const;

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col border-l border-border bg-panel">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-text-strong">
          <Settings2 className="h-4 w-4 text-text-muted" />
          Node settings
        </div>
        <button type="button" onClick={onClose} className="rounded p-1 hover:bg-panel-hover">
          <X className="h-4 w-4 text-text-muted" />
        </button>
      </div>

      <div className="border-b border-border px-4 py-4">
        <div className="text-[10px] uppercase tracking-wider text-text-faint">{kind}</div>
        <h3 className="mt-1 text-base font-semibold text-text-strong">{titleFor(selection)}</h3>
        {"description" in item && item.description && (
          <p className="mt-2 text-xs leading-relaxed text-text-muted">{item.description}</p>
        )}
      </div>

      <div className="space-y-4 border-b border-border px-4 py-4">
        <Field label="Status">
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500"
          >
            {kind === "project" ? (
              <>
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </>
            ) : (
              <>
                <option value="todo">To do</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </>
            )}
          </select>
        </Field>

        {agentName !== undefined && kind !== "project" && (
          <Field label="Agent">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm">
              {agentName ? (
                <>
                  <AgentAvatar name={agentName} color={agentColor ?? undefined} size="sm" />
                  {agentName}
                </>
              ) : (
                <>
                  <Bot className="h-4 w-4 text-text-faint" />
                  <span className="text-text-muted">Unassigned</span>
                </>
              )}
            </div>
          </Field>
        )}

        {priority && (
          <Field label="Priority">
            <div className="rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm capitalize text-text">
              {priority}
            </div>
          </Field>
        )}

        {scheduleType && scheduleType !== "one_time" && (
          <Field label="Schedule">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text">
              <Calendar className="h-4 w-4 text-text-muted" />
              <span className="capitalize">{scheduleType}</span>
              {scheduledAt && (
                <span className="text-text-muted">
                  · {new Date(scheduledAt).toLocaleString()}
                </span>
              )}
            </div>
          </Field>
        )}

        {project?.dueDate && (
          <Field label="Due date">
            <div className="rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text">
              {new Date(project.dueDate).toLocaleDateString()}
            </div>
          </Field>
        )}

        {activity && (activity.linkedProjectIds?.length ?? 0) > 0 && (
          <Field label="Used in projects">
            <div className="flex flex-wrap gap-1">
              {activity.linkedProjectIds!.map((pid) => {
                const p = projects.find((proj) => proj.id === pid);
                return (
                  <span
                    key={pid}
                    className="rounded-full border border-border bg-panel-elevated px-2 py-0.5 text-[10px] text-text-muted"
                  >
                    {p?.title ?? pid.slice(0, 8)}
                  </span>
                );
              })}
            </div>
          </Field>
        )}

        {activity?.sourceActivityId && (
          <Field label="Copied from">
            <div className="text-xs text-text-faint">Template activity · {activity.sourceActivityId.slice(0, 8)}</div>
          </Field>
        )}

        {task?.sourceTaskId && (
          <Field label="Copied from">
            <div className="text-xs text-text-faint">Template step · {task.sourceTaskId.slice(0, 8)}</div>
          </Field>
        )}

        {kind === "activity" && onLinkToProject && (
          <Field label="Link to another project" hint="Reuse this activity in a different project without duplicating.">
            <div className="flex gap-2">
              <select
                value={linkProjectId}
                onChange={(e) => setLinkProjectId(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text"
              >
                <option value="">Pick project…</option>
                {projects
                  .filter((p) => !activity?.linkedProjectIds?.includes(p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                disabled={!linkProjectId}
                onClick={() => {
                  if (linkProjectId) onLinkToProject(linkProjectId);
                  setLinkProjectId("");
                }}
                className="shrink-0 rounded-xl border border-border px-3 py-2 text-xs text-text-muted hover:bg-panel-hover disabled:opacity-40"
              >
                Link
              </button>
            </div>
          </Field>
        )}

        {(kind === "activity" || kind === "task") && onDuplicate && (
          <Field label="Duplicate into project" hint="Creates an independent copy you can edit separately.">
            <select
              value={duplicateProjectId}
              onChange={(e) => setDuplicateProjectId(e.target.value)}
              className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text"
            >
              <option value="">Same context</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-faint">
          Actions
        </div>
        {settingsItems.map((entry) => {
          const Icon = entry.icon;
          const className = cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-panel-hover",
            "danger" in entry && entry.danger && "text-red-300 hover:bg-red-950/30"
          );

          if ("href" in entry && entry.href) {
            return (
              <Link key={entry.label} to={entry.href} className={className}>
                <Icon className="h-4 w-4 shrink-0 text-text-muted" />
                <span className="flex-1">{entry.label}</span>
                <span className="text-[10px] text-text-faint">{entry.shortcut}</span>
              </Link>
            );
          }

          return (
            <button key={entry.label} type="button" onClick={entry.onClick} className={className}>
              <Icon className="h-4 w-4 shrink-0 text-text-muted" />
              <span className="flex-1">{entry.label}</span>
              <span className="text-[10px] text-text-faint">{entry.shortcut}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-text-faint">
        {label}
      </div>
      {hint && <p className="mb-1.5 text-[11px] leading-relaxed text-text-faint">{hint}</p>}
      {children}
    </div>
  );
}
