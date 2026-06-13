import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  api,
  type Agent,
  type WorkActivity,
  type WorkPriority,
  type WorkProject,
  type WorkScheduleType,
  type WorkTask,
} from "../../lib/api";
import { DateTimePicker, datetimeLocalToIso, isoToDatetimeLocal } from "./DateTimePicker";

export type WorkItemKind = "project" | "activity" | "task";

const RECURRENCE_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

function defaultScheduledValue(existing?: string | null) {
  if (existing) return isoToDatetimeLocal(existing);
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return isoToDatetimeLocal(d.toISOString());
}

export function WorkItemModal({
  mode,
  kind,
  context = {},
  editActivity,
  editTask,
  editProject,
  agents,
  projects,
  activities,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  kind: WorkItemKind;
  context?: { workProjectId?: string; activityId?: string };
  editActivity?: WorkActivity;
  editTask?: WorkTask;
  editProject?: WorkProject;
  agents: Agent[];
  projects: WorkProject[];
  activities: WorkActivity[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = mode === "edit";
  const isStandaloneTask = kind === "task" && !context.activityId && !(editTask?.activityId);

  const [title, setTitle] = useState(
    () => editActivity?.title ?? editTask?.title ?? editProject?.title ?? ""
  );
  const [description, setDescription] = useState(
    () => editActivity?.description ?? editTask?.description ?? editProject?.description ?? ""
  );
  const [workProjectId, setWorkProjectId] = useState(
    () => editActivity?.workProjectId ?? editTask?.workProjectId ?? context.workProjectId ?? ""
  );
  const [activityId, setActivityId] = useState(
    () => editTask?.activityId ?? context.activityId ?? ""
  );
  const parentActivity = activities.find(
    (a) => a.id === (activityId || context.activityId || editTask?.activityId)
  );
  const parentProject = projects.find(
    (p) => p.id === (workProjectId || parentActivity?.workProjectId)
  );
  const isActivityTask = kind === "task" && !isStandaloneTask;
  const lockActivity = !!context.activityId && !isEdit;

  const [agentId, setAgentId] = useState(() => {
    if (editActivity?.agentId ?? editTask?.agentId) {
      return editActivity?.agentId ?? editTask?.agentId ?? "";
    }
    if (!isEdit && isActivityTask && parentActivity?.agentId) {
      return parentActivity.agentId;
    }
    return "";
  });
  const [scheduleType, setScheduleType] = useState<WorkScheduleType>(
    () => editActivity?.scheduleType ?? editTask?.scheduleType ?? "one_time"
  );
  const [scheduledAt, setScheduledAt] = useState(() =>
    defaultScheduledValue(editActivity?.scheduledAt ?? editTask?.scheduledAt ?? editTask?.nextRunAt)
  );
  const [recurrenceRule, setRecurrenceRule] = useState(
    () => editActivity?.recurrenceRule ?? editTask?.recurrenceRule ?? "daily"
  );
  const [priority, setPriority] = useState<WorkPriority>(
    () => editActivity?.priority ?? editTask?.priority ?? "medium"
  );
  const [startDate, setStartDate] = useState(() => editProject?.startDate ?? "");
  const [dueDate, setDueDate] = useState(() => editProject?.dueDate ?? "");
  const [error, setError] = useState("");

  const lockProject = !!context.workProjectId && !isEdit;

  const mutation = useMutation({
    mutationFn: async () => {
      const scheduledIso = scheduledAt ? datetimeLocalToIso(scheduledAt) : null;

      if (kind === "project") {
        if (isEdit && editProject) {
          await api.updateWorkProject(editProject.id, {
            title,
            description: description || undefined,
            startDate: startDate || null,
            dueDate: dueDate || null,
          });
        } else {
          await api.createWorkProject({
            title,
            description: description || undefined,
            startDate: startDate || null,
            dueDate: dueDate || null,
          });
        }
        return;
      }

      if (kind === "activity") {
        const payload = {
          title,
          description: description || undefined,
          workProjectId: workProjectId || null,
          agentId: agentId || null,
          scheduleType,
          scheduledAt: scheduledIso,
          recurrenceRule: scheduleType === "recurring" ? recurrenceRule : null,
          priority,
        };
        if (isEdit && editActivity) {
          await api.updateWorkActivity(editActivity.id, payload);
        } else {
          await api.createWorkActivity(payload);
        }
        return;
      }

      const resolvedAgentId =
        agentId || (isActivityTask ? parentActivity?.agentId ?? null : null);

      const taskPayload = {
        title,
        description: description || undefined,
        activityId: isStandaloneTask ? null : activityId || context.activityId || null,
        workProjectId: isStandaloneTask ? null : workProjectId || null,
        agentId: resolvedAgentId,
        scheduleType,
        scheduledAt: scheduledIso,
        recurrenceRule: scheduleType === "recurring" ? recurrenceRule : null,
        priority,
      };

      if (isEdit && editTask) {
        await api.updateWorkTask(editTask.id, taskPayload);
      } else {
        await api.createWorkTask(taskPayload);
      }
    },
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message),
  });

  const titles: Record<WorkItemKind, string> = {
    project: isEdit ? "Edit project" : "New project",
    activity: isEdit ? "Edit activity" : "New activity",
    task: isEdit ? "Edit task" : "New task",
  };

  const descriptions: Record<WorkItemKind, string> = {
    project: "A project groups related activities.",
    activity:
      "An initiative like “Draft weekly newsletter”. Assign an agent to own the whole activity, or break it into steps below.",
    task: isStandaloneTask
      ? "A one-off piece of work assigned directly to an agent — not part of an activity."
      : "Connect this step to any activity in any project. The same activity can be reused elsewhere.",
  };

  const showSchedulePicker = kind !== "project" && (scheduleType === "scheduled" || scheduleType === "recurring");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-panel p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-text-strong">{titles[kind]}</h2>
        <p className="mt-1 text-sm text-text-muted">{descriptions[kind]}</p>

        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) {
              setError("Title is required");
              return;
            }
            if (kind === "task" && !isStandaloneTask && !activityId && !context.activityId) {
              setError("Pick an activity to connect this task to");
              return;
            }
            if (scheduleType === "scheduled" && !scheduledAt) {
              setError("Pick a date and time for scheduled items");
              return;
            }
            mutation.mutate();
          }}
        >
          <Field label={kind === "activity" ? "Activity name" : kind === "task" && isActivityTask ? "Step name" : "Title"}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500"
              placeholder={
                kind === "project"
                  ? "Q2 product launch"
                  : kind === "activity"
                    ? "Draft weekly newsletter"
                    : isActivityTask
                      ? "Research topics, write draft…"
                      : "Follow up with client"
              }
              autoFocus
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500"
            />
          </Field>

          {kind === "project" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Start date">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text"
                />
              </Field>
              <Field label="Due date">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text"
                />
              </Field>
            </div>
          )}

          {kind === "activity" && (
            <Field
              label="Project (optional)"
              hint="Leave empty for a standalone activity, or pick a project to group it with others."
            >
              {lockProject && parentProject ? (
                <div className="rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text-muted">
                  {parentProject.title}
                </div>
              ) : (
                <select
                  value={workProjectId}
                  onChange={(e) => setWorkProjectId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text"
                >
                  <option value="">None — standalone activity</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}

          {kind === "task" && !isStandaloneTask && (
            <Field
              label="Connected activity"
              hint="Tasks can link to any activity across projects."
            >
              {lockActivity && parentActivity ? (
                <div className="rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text-muted">
                  {parentActivity.title}
                  {parentActivity.projectTitle && (
                    <span className="text-text-faint"> · {parentActivity.projectTitle}</span>
                  )}
                </div>
              ) : (
                <select
                  value={activityId}
                  onChange={(e) => setActivityId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text"
                >
                  <option value="">Select activity…</option>
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                      {a.projectTitle ? ` · ${a.projectTitle}` : a.workProjectId ? "" : " · standalone"}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}

          {kind === "task" && !isStandaloneTask && !lockActivity && (
            <Field label="Show in project (optional)" hint="Optional — for organizing in a project view.">
              <select
                value={workProjectId}
                onChange={(e) => setWorkProjectId(e.target.value)}
                className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text"
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {kind !== "project" && (
            <>
              <Field
                label={kind === "activity" ? "Agent responsible for this activity" : "Performing agent"}
                hint={
                  kind === "activity"
                    ? "This agent owns and completes the activity. Add steps below if you want them to follow a checklist."
                    : isActivityTask
                      ? "Defaults to the activity’s agent. Pick another agent only if a different one should run this step."
                      : undefined
                }
              >
                <select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text"
                >
                  <option value="">
                    {kind === "activity" ? "No agent — add steps manually" : "Use activity agent"}
                  </option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.team})
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Priority">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as WorkPriority)}
                  className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </Field>

              <Field label="Schedule">
                <select
                  value={scheduleType}
                  onChange={(e) => {
                    const next = e.target.value as WorkScheduleType;
                    setScheduleType(next);
                    if (next !== "one_time" && !scheduledAt) {
                      setScheduledAt(defaultScheduledValue());
                    }
                  }}
                  className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text"
                >
                  <option value="one_time">One-time</option>
                  <option value="scheduled">Scheduled (specific date/time)</option>
                  <option value="recurring">Recurring</option>
                </select>
              </Field>

              {scheduleType === "recurring" && (
                <Field label="Repeat">
                  <select
                    value={recurrenceRule}
                    onChange={(e) => setRecurrenceRule(e.target.value)}
                    className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text"
                  >
                    {RECURRENCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              {showSchedulePicker && (
                <Field label={scheduleType === "recurring" ? "First run" : "Run at"}>
                  <DateTimePicker
                    key={`${scheduleType}-${scheduledAt}`}
                    value={scheduledAt}
                    onChange={setScheduledAt}
                  />
                </Field>
              )}
            </>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-sm text-text-muted hover:bg-panel-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-muted-fg hover:bg-accent-hover disabled:opacity-60"
            >
              {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-text-muted">{label}</span>
      {hint && <p className="mb-1.5 text-[11px] leading-relaxed text-text-faint">{hint}</p>}
      {children}
    </label>
  );
}
