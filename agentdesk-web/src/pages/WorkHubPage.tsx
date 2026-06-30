import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Node } from "@xyflow/react";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  ListTodo,
  Zap,
  Bot,
  Trash2,
  RefreshCw,
  Pencil,
  Workflow,
  GanttChart,
  List,
} from "lucide-react";
import {
  api,
  type WorkActivity,
  type WorkProject,
  type WorkScheduleType,
  type WorkTask,
} from "../lib/api";
import { cn, formatRelativeTime, STATUS_STYLES } from "../lib/utils";
import { DashboardCard, PageHeader } from "../components/workspace/DashboardUI";
import { AgentAvatar } from "../components/workspace/TagEditor";
import { WorkItemModal, type WorkItemKind } from "../components/workspace/WorkItemModal";
import { WorkHubCanvas } from "../components/workhub/WorkHubCanvas";
import { WorkHubTimeline } from "../components/workhub/WorkHubTimeline";
import { WorkHubNodeSettings } from "../components/workhub/WorkHubNodeSettings";
import { AddExistingProjectModal } from "../components/workhub/AddExistingProjectModal";
import {
  parseNodeSelection,
  type WorkNodeData,
  type WorkNodeSelection,
} from "../components/workhub/workHubGraph";
import {
  loadCanvasNestState,
  nestActivity,
  nestTask,
  unnestActivity,
  unnestTask,
  type CanvasNestState,
} from "../components/workhub/workHubCanvasLayout";

type ViewMode = "canvas" | "timeline" | "list";
type ListTab = "all" | "projects" | "activities" | "tasks" | "runs";

type ModalState =
  | { mode: "create"; kind: WorkItemKind; context?: { workProjectId?: string; activityId?: string } }
  | { mode: "edit"; kind: "activity"; item: WorkActivity }
  | { mode: "edit"; kind: "task"; item: WorkTask }
  | { mode: "edit"; kind: "project"; item: WorkProject }
  | null;

const WORK_STATUS_STYLES: Record<string, string> = {
  todo: "bg-panel-elevated text-text-muted border border-border",
  in_progress: "bg-accent-light text-accent-fg",
  done: "bg-neutral-700 text-neutral-200",
  cancelled: "bg-transparent text-text-faint border border-border",
  scheduled: "bg-panel-elevated text-text-strong border border-dashed border-neutral-500",
};

const SCHEDULE_LABELS: Record<WorkScheduleType, string> = {
  one_time: "One-time",
  scheduled: "Scheduled",
  recurring: "Recurring",
};


export function WorkHubPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewMode>("canvas");
  const [tab, setTab] = useState<ListTab>("all");
  const [filterProjectId, setFilterProjectId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeSelection, setNodeSelection] = useState<WorkNodeSelection | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalState>(null);
  const [addExistingOpen, setAddExistingOpen] = useState(false);
  const [nestState, setNestState] = useState<CanvasNestState>(() => loadCanvasNestState());

  const { data: hub, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["work-hub"],
    queryFn: () => api.getWorkHub(),
  });

  const { data: agentsData } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.getAgents(),
  });

  const { data: runsData } = useQuery({
    queryKey: ["tasks", "recent"],
    queryFn: () => api.getRecentTasks(),
    enabled: view === "list" && (tab === "all" || tab === "runs"),
    refetchInterval: view === "list" && tab === "runs" ? 15000 : false,
  });

  const agents = agentsData?.agents.filter((a) => a.isActive) ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["work-hub"] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  };

  function openCreate(kind: WorkItemKind, ctx: { workProjectId?: string; activityId?: string } = {}) {
    setModal({ mode: "create", kind, context: ctx });
  }

  function handleSelectNode(node: Node<WorkNodeData> | null) {
    setSelectedNodeId(node?.id ?? null);
    setNodeSelection(parseNodeSelection(node));
  }

  function openEditFromSelection(selection: WorkNodeSelection) {
    if (selection.kind === "project") {
      setModal({ mode: "edit", kind: "project", item: selection.item as WorkProject });
    } else if (selection.kind === "activity") {
      setModal({ mode: "edit", kind: "activity", item: selection.item as WorkActivity });
    } else {
      setModal({ mode: "edit", kind: "task", item: selection.item as WorkTask });
    }
  }

  async function handleDeleteSelection(selection: WorkNodeSelection) {
    const label =
      selection.kind === "project"
        ? (selection.item as WorkProject).title
        : selection.kind === "activity"
          ? (selection.item as WorkActivity).title
          : (selection.item as WorkTask).title;
    if (!confirm(`Delete ${selection.kind} "${label}"?`)) return;

    if (selection.kind === "project") {
      await api.deleteWorkProject(selection.item.id);
    } else if (selection.kind === "activity") {
      await api.deleteWorkActivity(selection.item.id);
    } else {
      await api.deleteWorkTask(selection.item.id);
    }
    setNodeSelection(null);
    setSelectedNodeId(null);
    invalidate();
  }

  async function handleStatusChange(selection: WorkNodeSelection, status: string) {
    if (selection.kind === "project") {
      await api.updateWorkProject(selection.item.id, { status });
    } else if (selection.kind === "activity") {
      await api.updateWorkActivity(selection.item.id, { status: status as WorkActivity["status"] });
    } else {
      await api.updateWorkTask(selection.item.id, { status: status as WorkTask["status"] });
    }
    invalidate();
  }

  async function handleDuplicateSelection(
    selection: WorkNodeSelection,
    targetProjectId?: string | null
  ) {
    if (selection.kind === "activity") {
      await api.duplicateWorkActivity(selection.item.id, {
        workProjectId: targetProjectId ?? null,
        copyTasks: true,
      });
    } else if (selection.kind === "task") {
      await api.duplicateWorkTask(selection.item.id, {
        workProjectId: targetProjectId ?? null,
        activityId: (selection.item as WorkTask).activityId,
      });
    }
    invalidate();
  }

  async function handleLinkActivity(activityId: string, workProjectId: string) {
    await api.linkWorkActivity(activityId, workProjectId);
    invalidate();
  }

  async function handleDetachActivity(activityId: string, workProjectId: string) {
    await api.unlinkWorkActivity(activityId, workProjectId);
    invalidate();
  }

  async function handleNestActivity(activityId: string, projectId: string) {
    await api.linkWorkActivity(activityId, projectId);
    setNestState((state) => nestActivity(state, activityId, projectId));
    invalidate();
  }

  async function handleUnnestActivity(activityId: string) {
    setNestState((state) => unnestActivity(state, activityId));
    invalidate();
  }

  async function handleConnectActivity(activityId: string, projectId: string) {
    await api.linkWorkActivity(activityId, projectId);
    setNestState((state) => unnestActivity(state, activityId));
    invalidate();
  }

  async function handleNestTask(taskId: string, activityId: string) {
    await api.updateWorkTask(taskId, { activityId });
    setNestState((state) => nestTask(state, taskId, activityId));
    invalidate();
  }

  async function handleUnnestTask(taskId: string) {
    setNestState((state) => unnestTask(state, taskId));
    invalidate();
  }

  async function handleConnectTask(taskId: string, activityId: string) {
    await api.updateWorkTask(taskId, { activityId });
    setNestState((state) => unnestTask(state, taskId));
    invalidate();
  }

  async function handleDetachTask(taskId: string) {
    await api.updateWorkTask(taskId, { activityId: null });
    setNestState((state) => unnestTask(state, taskId));
    invalidate();
  }

  async function handlePriorityChange(selection: WorkNodeSelection, priority: string) {
    if (selection.kind === "activity") {
      await api.updateWorkActivity(selection.item.id, {
        priority: priority as WorkActivity["priority"],
      });
    } else if (selection.kind === "task") {
      await api.updateWorkTask(selection.item.id, {
        priority: priority as WorkTask["priority"],
      });
    }
    invalidate();
  }

  async function handleAgentChange(selection: WorkNodeSelection, agentId: string | null) {
    if (selection.kind === "activity") {
      await api.updateWorkActivity(selection.item.id, { agentId });
    } else if (selection.kind === "task") {
      await api.updateWorkTask(selection.item.id, { agentId });
    }
    invalidate();
  }

  async function handleProjectAgentAdd(project: WorkProject, agentId: string) {
    if (!project.projectGroupId) return;
    await api.addProjectAgent(project.projectGroupId, { agentId });
    invalidate();
    queryClient.invalidateQueries({ queryKey: ["project-agents", project.projectGroupId] });
  }

  async function handleProjectAgentRemove(project: WorkProject, agentId: string) {
    if (!project.projectGroupId) return;
    await api.removeProjectAgent(project.projectGroupId, agentId);
    invalidate();
    queryClient.invalidateQueries({ queryKey: ["project-agents", project.projectGroupId] });
  }

  const viewModes: { id: ViewMode; label: string; icon: typeof Workflow }[] = [
    { id: "canvas", label: "Canvas", icon: Workflow },
    { id: "timeline", label: "Timeline", icon: GanttChart },
    { id: "list", label: "List", icon: List },
  ];

  const tabs: { id: ListTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "projects", label: "Projects" },
    { id: "activities", label: "Activities" },
    { id: "tasks", label: "Tasks" },
    { id: "runs", label: "Agent runs" },
  ];

  function toggleProject(id: string) {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border-subtle px-4 py-4 sm:px-6">
        <PageHeader
          title="Work hub"
          subtitle="Drop cards into dashed zones to nest them. Drag dot-to-dot to link without nesting. Delete a line to disconnect."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterProjectId ?? ""}
                onChange={(e) => setFilterProjectId(e.target.value || null)}
                className="rounded-xl border border-border bg-panel px-3 py-2 text-sm text-text-muted outline-none focus:border-neutral-500"
              >
                <option value="">All projects</option>
                {(hub?.projects ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-panel px-3 py-2 text-sm text-text-muted hover:bg-panel-hover"
              >
                <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
                Refresh
              </button>
              <CreateMenu
                onSelect={(kind) => openCreate(kind)}
                onAddExisting={() => setAddExistingOpen(true)}
              />
            </div>
          }
        />

        <div className="mt-4 flex flex-wrap gap-2">
          {viewModes.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition",
                view === id
                  ? "bg-accent-light text-accent-fg"
                  : "border border-border bg-panel text-text-muted hover:text-text-strong"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-text-muted">
          Loading work hub…
        </div>
      ) : !hub ? null : view === "canvas" || view === "timeline" ? (
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 p-4 sm:p-6">
            {view === "canvas" ? (
              <WorkHubCanvas
                hub={hub}
                filterProjectId={filterProjectId}
                nestState={nestState}
                selectedNodeId={selectedNodeId}
                onSelectNode={handleSelectNode}
                onNestTask={handleNestTask}
                onUnnestTask={handleUnnestTask}
                onNestActivity={handleNestActivity}
                onUnnestActivity={handleUnnestActivity}
                onConnectActivity={handleConnectActivity}
                onConnectTask={handleConnectTask}
                onDisconnectActivity={handleDetachActivity}
                onDisconnectTask={handleDetachTask}
                onCreateCard={openCreate}
                onAddExistingProject={() => setAddExistingOpen(true)}
                agents={agents}
                onAgentChange={handleAgentChange}
                onProjectAgentAdd={handleProjectAgentAdd}
                onProjectAgentRemove={handleProjectAgentRemove}
                onEditSelection={openEditFromSelection}
                onDeleteSelection={handleDeleteSelection}
                onStatusChange={handleStatusChange}
                onPriorityChange={handlePriorityChange}
              />
            ) : (
              <WorkHubTimeline hub={hub} filterProjectId={filterProjectId} />
            )}
          </div>
          {nodeSelection && view === "canvas" && (
            <WorkHubNodeSettings
              selection={nodeSelection}
              projects={hub.projects}
              onClose={() => {
                setNodeSelection(null);
                setSelectedNodeId(null);
              }}
              onEdit={() => openEditFromSelection(nodeSelection)}
              onDelete={() => handleDeleteSelection(nodeSelection)}
              onAddChild={(childKind) => {
                if (nodeSelection.kind === "project" && childKind === "activity") {
                  openCreate("activity", { workProjectId: nodeSelection.item.id });
                } else if (nodeSelection.kind === "activity" && childKind === "task") {
                  openCreate("task", {
                    activityId: nodeSelection.item.id,
                    workProjectId: (nodeSelection.item as WorkActivity).workProjectId ?? undefined,
                  });
                }
              }}
              onStatusChange={(status) => handleStatusChange(nodeSelection, status)}
              onDuplicate={(targetProjectId) =>
                handleDuplicateSelection(nodeSelection, targetProjectId)
              }
              onLinkToProject={
                nodeSelection.kind === "activity"
                  ? (projectId) => handleLinkActivity(nodeSelection.item.id, projectId)
                  : undefined
              }
            />
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 flex flex-wrap gap-2">
              {tabs.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    "rounded-xl px-4 py-2 text-sm font-medium transition",
                    tab === id
                      ? "bg-accent-light text-accent-fg"
                      : "border border-border bg-panel text-text-muted hover:text-text-strong"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {(tab === "all" || tab === "projects") && (
              <Section
                title="Projects"
                count={hub?.projects.length ?? 0}
                empty="No projects yet. Create one to group activities and tasks."
                action={
                  <button
                    type="button"
                    onClick={() => openCreate("project")}
                    className="text-xs text-text-muted hover:text-text-strong"
                  >
                    + New project
                  </button>
                }
              >
                {(hub?.projects ?? []).map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    expanded={expandedProjects.has(project.id)}
                    onToggle={() => toggleProject(project.id)}
                    onAddActivity={() => openCreate("activity", { workProjectId: project.id })}
                    onAddTask={(activityId, workProjectId) =>
                      openCreate("task", { activityId, workProjectId })
                    }
                    onDelete={async () => {
                      if (!confirm(`Delete project "${project.title}"?`)) return;
                      await api.deleteWorkProject(project.id);
                      invalidate();
                    }}
                    onStatusChange={async (status) => {
                      await api.updateWorkProject(project.id, { status });
                      invalidate();
                    }}
                    onMutated={invalidate}
                    onEditActivity={(a) => setModal({ mode: "edit", kind: "activity", item: a })}
                    onEditTask={(t) => setModal({ mode: "edit", kind: "task", item: t })}
                  />
                ))}
              </Section>
            )}

            {(tab === "all" || tab === "activities") && (
              <Section
                title="Standalone activities"
                count={hub?.standaloneActivities.length ?? 0}
                empty="No standalone activities. Create one outside any project — e.g. “Draft weekly newsletter”."
                action={
                  <button
                    type="button"
                    onClick={() => openCreate("activity")}
                    className="text-xs text-text-muted hover:text-text-strong"
                  >
                    + New activity
                  </button>
                }
              >
                {(hub?.standaloneActivities ?? []).map((activity) => (
                  <ActivityRow
                    key={activity.id}
                    activity={activity}
                    tasks={activity.tasks ?? []}
                    onAddTask={() => openCreate("task", { activityId: activity.id })}
                    onDelete={async () => {
                      if (!confirm(`Delete activity "${activity.title}"?`)) return;
                      await api.deleteWorkActivity(activity.id);
                      invalidate();
                    }}
                    onStatusChange={async (status) => {
                      await api.updateWorkActivity(activity.id, { status });
                      invalidate();
                    }}
                    onMutated={invalidate}
                    onEdit={() => setModal({ mode: "edit", kind: "activity", item: activity })}
                    onEditTask={(t) => setModal({ mode: "edit", kind: "task", item: t })}
                  />
                ))}
              </Section>
            )}

            {tab === "activities" && (hub?.projectActivities.length ?? 0) > 0 && (
              <Section
                title="Activities in projects"
                count={hub?.projectActivities.length ?? 0}
                empty=""
              >
                {(hub?.projectActivities ?? []).map((activity) => (
                  <ActivityRow
                    key={activity.id}
                    activity={activity}
                    tasks={activity.tasks ?? []}
                    projectTitle={activity.projectTitle}
                    onAddTask={() =>
                      openCreate("task", {
                        activityId: activity.id,
                        workProjectId: activity.workProjectId ?? undefined,
                      })
                    }
                    onDelete={async () => {
                      if (!confirm(`Delete activity "${activity.title}"?`)) return;
                      await api.deleteWorkActivity(activity.id);
                      invalidate();
                    }}
                    onStatusChange={async (status) => {
                      await api.updateWorkActivity(activity.id, { status });
                      invalidate();
                    }}
                    onMutated={invalidate}
                    onEdit={() => setModal({ mode: "edit", kind: "activity", item: activity })}
                    onEditTask={(t) => setModal({ mode: "edit", kind: "task", item: t })}
                  />
                ))}
              </Section>
            )}

            {(tab === "all" || tab === "tasks") && (
              <Section
                title="Standalone tasks"
                count={hub?.standaloneTasks.length ?? 0}
                empty="No standalone tasks. These are individual work items outside projects and activities."
                action={
                  <button
                    type="button"
                    onClick={() => openCreate("task")}
                    className="text-xs text-text-muted hover:text-text-strong"
                  >
                    + New task
                  </button>
                }
              >
                {(hub?.standaloneTasks ?? []).map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onDelete={async () => {
                      if (!confirm(`Delete task "${task.title}"?`)) return;
                      await api.deleteWorkTask(task.id);
                      invalidate();
                    }}
                    onStatusChange={async (status) => {
                      await api.updateWorkTask(task.id, { status });
                      invalidate();
                    }}
                    onEdit={() => setModal({ mode: "edit", kind: "task", item: task })}
                  />
                ))}
              </Section>
            )}

            {(tab === "all" || tab === "runs") && (
              <Section
                title="Recent agent runs"
                count={(runsData?.tasks ?? []).length}
                empty="No automation runs logged yet."
              >
                <DashboardCard className="overflow-hidden p-0">
                  {(runsData?.tasks ?? []).length === 0 ? (
                    <div className="p-8 text-center text-sm text-text-muted">No runs yet.</div>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-border bg-panel-elevated text-xs uppercase text-text-faint">
                        <tr>
                          <th className="px-4 py-3 font-medium">Title</th>
                          <th className="px-4 py-3 font-medium">Agent</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">When</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(runsData?.tasks ?? []).slice(0, 15).map((task) => (
                          <tr key={task.id} className="hover:bg-panel-hover/50">
                            <td className="px-4 py-3 font-medium text-text-strong">{task.title}</td>
                            <td className="px-4 py-3 text-text-muted">{task.agentName}</td>
                            <td className="px-4 py-3">
                              <StatusBadge status={task.status} styles={STATUS_STYLES} />
                            </td>
                            <td className="px-4 py-3 text-text-muted">{formatRelativeTime(task.updatedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </DashboardCard>
              </Section>
            )}
          </div>
        </div>
      )}

      {addExistingOpen && (
        <AddExistingProjectModal onClose={() => setAddExistingOpen(false)} onAdded={invalidate} />
      )}

      {modal && (
        <WorkItemModal
          mode={modal.mode}
          kind={modal.kind}
          context={modal.mode === "create" ? modal.context : undefined}
          editActivity={modal.mode === "edit" && modal.kind === "activity" ? modal.item : undefined}
          editTask={modal.mode === "edit" && modal.kind === "task" ? modal.item : undefined}
          editProject={modal.mode === "edit" && modal.kind === "project" ? modal.item : undefined}
          agents={agents}
          projects={hub?.projects ?? []}
          activities={hub?.allActivities ?? []}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            invalidate();
          }}
        />
      )}
    </div>
  );
}

function CreateMenu({
  onSelect,
  onAddExisting,
}: {
  onSelect: (kind: WorkItemKind) => void;
  onAddExisting: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-muted-fg hover:bg-accent-hover"
      >
        <Plus className="h-4 w-4" />
        Create
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className="absolute right-0 z-50 mt-2 w-52 rounded-xl border border-border bg-panel-elevated py-1 shadow-xl">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onAddExisting();
              }}
              className="block w-full border-b border-border px-4 py-2.5 text-left text-sm text-text hover:bg-panel-hover"
            >
              <span className="font-medium">Existing project group</span>
              <span className="mt-0.5 block text-[10px] text-text-faint">From Groups — add to canvas</span>
            </button>
            {(
              [
                ["project", "New project"],
                ["activity", "Activity"],
                ["task", "Standalone task"],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSelect(kind);
                }}
                className="block w-full px-4 py-2 text-left text-sm text-text hover:bg-panel-hover"
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Section({
  title,
  empty,
  count,
  action,
  children,
}: {
  title: string;
  empty: string;
  count: number;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold text-text-strong">{title}</h2>
        {action}
      </div>
      {count === 0 ? (
        <DashboardCard className="text-center text-sm text-text-muted">{empty}</DashboardCard>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </section>
  );
}

function ProjectCard({
  project,
  expanded,
  onToggle,
  onAddActivity,
  onAddTask,
  onDelete,
  onStatusChange,
  onMutated,
  onEditActivity,
  onEditTask,
}: {
  project: WorkProject;
  expanded: boolean;
  onToggle: () => void;
  onAddActivity: () => void;
  onAddTask: (activityId: string, workProjectId: string) => void;
  onDelete: () => void;
  onStatusChange: (status: string) => void;
  onMutated: () => void;
  onEditActivity: (activity: WorkActivity) => void;
  onEditTask: (task: WorkTask) => void;
}) {
  return (
    <DashboardCard className="p-0">
      <div className="flex items-start gap-3 p-4">
        <button type="button" onClick={onToggle} className="mt-0.5 rounded p-1 hover:bg-panel-hover">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <FolderKanban className="h-4 w-4 text-text-muted" />
            <h3 className="font-medium text-text-strong">{project.title}</h3>
            <StatusBadge status={project.status} styles={WORK_STATUS_STYLES} />
            {project.projectGroupId && (
              <Link
                to={`/projects/${project.projectGroupId}`}
                className="rounded-full border border-border px-2 py-0.5 text-[10px] text-text-muted hover:border-neutral-500 hover:text-text-strong"
              >
                Open group
              </Link>
            )}
          </div>
          {project.description && <p className="mt-1 text-sm text-text-muted">{project.description}</p>}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-text-faint">
            <span>{project.activityCount} activit{project.activityCount === 1 ? "y" : "ies"}</span>
            <span>{project.taskCount} task{project.taskCount === 1 ? "" : "s"}</span>
            {project.dueDate && <span>Due {project.dueDate}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <select
            value={project.status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="rounded-lg border border-border bg-panel px-2 py-1 text-xs text-text-muted"
          >
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
          <button type="button" onClick={onDelete} className="rounded p-2 hover:bg-panel-hover" title="Delete project">
            <Trash2 className="h-4 w-4 text-text-muted" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border-subtle bg-panel-elevated/30 px-4 py-3">
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onAddActivity}
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-text-muted hover:border-neutral-500 hover:text-text-strong"
            >
              <Plus className="h-3.5 w-3.5" /> Activity
            </button>
          </div>

          {project.activities.length === 0 ? (
            <p className="text-xs text-text-faint">No activities in this project yet. Add an activity, then add tasks inside it.</p>
          ) : (
            <div className="space-y-2">
              {project.activities.map((activity) => (
                <ActivityRow
                  key={activity.id}
                  activity={activity}
                  nested
                  tasks={activity.tasks ?? []}
                  onAddTask={() => onAddTask(activity.id, project.id)}
                  onDelete={async () => {
                    if (!confirm(`Delete activity "${activity.title}"?`)) return;
                    await api.deleteWorkActivity(activity.id);
                    onMutated();
                  }}
                  onStatusChange={async (status) => {
                    await api.updateWorkActivity(activity.id, { status });
                    onMutated();
                  }}
                  onMutated={onMutated}
                  onEdit={() => onEditActivity(activity)}
                  onEditTask={onEditTask}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </DashboardCard>
  );
}

function ActivityRow({
  activity,
  tasks,
  nested,
  onAddTask,
  onDelete,
  onStatusChange,
  onMutated,
  onEdit,
  onEditTask,
  projectTitle,
}: {
  activity: WorkActivity;
  tasks: WorkTask[];
  nested?: boolean;
  projectTitle?: string;
  onAddTask?: () => void;
  onDelete: () => void | Promise<void>;
  onStatusChange: (status: WorkActivity["status"]) => void | Promise<void>;
  onMutated?: () => void;
  onEdit?: () => void;
  onEditTask?: (task: WorkTask) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn("rounded-xl border border-border bg-panel", nested && "ml-4")}>
      <div className="flex items-start gap-3 p-3">
        {tasks.length > 0 ? (
          <button type="button" onClick={() => setExpanded(!expanded)} className="mt-0.5 rounded p-1 hover:bg-panel-hover">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <button type="button" onClick={() => setExpanded(!expanded)} className="mt-0.5 rounded p-1 hover:bg-panel-hover" title="Show steps">
            <Zap className="h-4 w-4 shrink-0 text-text-muted" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-text-strong">{activity.title}</span>
            <ScheduleBadge scheduleType={activity.scheduleType} recurrenceRule={activity.recurrenceRule} />
            <StatusBadge status={activity.status} styles={WORK_STATUS_STYLES} />
          </div>
          {activity.description && <p className="mt-1 text-xs text-text-muted">{activity.description}</p>}
          {(projectTitle ?? activity.projectTitle) && !nested ? (
            <p className="mt-1 text-[11px] text-text-faint">
              In project: {projectTitle ?? activity.projectTitle}
              {(activity.linkedProjectIds?.length ?? 0) > 1 &&
                ` · also in ${activity.linkedProjectIds!.length - 1} other project${activity.linkedProjectIds!.length > 2 ? "s" : ""}`}
            </p>
          ) : (activity.linkedProjectIds?.length ?? 0) > 0 && !nested ? (
            <p className="mt-1 text-[11px] text-text-faint">
              Linked to {activity.linkedProjectIds!.length} project{activity.linkedProjectIds!.length !== 1 ? "s" : ""}
            </p>
          ) : !nested && !activity.workProjectId ? (
            <p className="mt-1 text-[11px] text-text-faint">Standalone activity</p>
          ) : null}
          <ItemMeta item={activity} role="activity" taskCount={tasks.length} />
        </div>
        <RowActions
          status={activity.status}
          onStatusChange={onStatusChange}
          onDelete={onDelete}
          onEdit={onEdit}
          onAdd={onAddTask ? { label: "Step", onClick: onAddTask } : undefined}
        />
      </div>
      {expanded && (
        <div className="space-y-2 border-t border-border-subtle px-3 py-2">
          {tasks.length === 0 ? (
            <p className="px-1 py-2 text-[11px] text-text-faint">
              {activity.agentName
                ? `${activity.agentName} is assigned to complete this activity. Add steps if you want a checklist.`
                : "No steps yet. Add steps for the agent to perform, or assign an agent to own the activity."}
            </p>
          ) : (
            <>
              <div className="px-1 text-[10px] font-medium uppercase tracking-wider text-text-faint">
                Steps ({tasks.length})
              </div>
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  nested
                  activityAgent={
                    activity.agentId
                      ? {
                          name: activity.agentName ?? "",
                          color: activity.agentColor,
                        }
                      : undefined
                  }
                  onDelete={async () => {
                    if (!confirm(`Delete step "${task.title}"?`)) return;
                    await api.deleteWorkTask(task.id);
                    onMutated?.();
                  }}
                  onStatusChange={async (status) => {
                    await api.updateWorkTask(task.id, { status });
                    onMutated?.();
                  }}
                  onEdit={onEditTask ? () => onEditTask(task) : undefined}
                />
              ))}
            </>
          )}
        </div>
      )}
      {!expanded && tasks.length > 0 && (
        <div className="border-t border-border-subtle px-3 py-1.5 text-[10px] text-text-faint">
          {tasks.length} step{tasks.length !== 1 ? "s" : ""}
          {activity.agentName ? ` · owned by ${activity.agentName}` : ""}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  nested,
  activityAgent,
  onDelete,
  onStatusChange,
  onEdit,
}: {
  task: WorkTask;
  nested?: boolean;
  activityAgent?: { name: string; color: string | null };
  onDelete: () => void | Promise<void>;
  onStatusChange: (status: WorkTask["status"]) => void | Promise<void>;
  onEdit?: () => void;
}) {
  const displayAgent =
    task.agentName ??
    (activityAgent?.name && !task.agentId ? activityAgent.name : null);
  const displayColor = task.agentColor ?? activityAgent?.color ?? undefined;
  const agentInherited = !task.agentId && !!activityAgent?.name;

  return (
    <div className={cn("flex items-start gap-3 rounded-xl border border-border bg-panel p-3", nested && "ml-2 border-border-subtle bg-panel-elevated/40")}>
      <ListTodo className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {nested && (
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-faint">Step</span>
          )}
          <span className="text-sm font-medium text-text-strong">{task.title}</span>
          <ScheduleBadge scheduleType={task.scheduleType} recurrenceRule={task.recurrenceRule} />
          <StatusBadge status={task.status} styles={WORK_STATUS_STYLES} />
        </div>
        {task.description && <p className="mt-1 text-xs text-text-muted">{task.description}</p>}
        <ItemMeta
          item={task}
          role={nested ? "step" : "standalone-task"}
          displayAgent={displayAgent}
          displayColor={displayColor}
          agentInherited={agentInherited}
        />
      </div>
      <RowActions status={task.status} onStatusChange={onStatusChange} onDelete={onDelete} onEdit={onEdit} />
    </div>
  );
}

function ItemMeta({
  item,
  role = "standalone-task",
  taskCount,
  displayAgent,
  displayColor,
  agentInherited,
}: {
  item: WorkActivity | WorkTask;
  role?: "activity" | "step" | "standalone-task";
  taskCount?: number;
  displayAgent?: string | null;
  displayColor?: string | null;
  agentInherited?: boolean;
}) {
  const agentName = displayAgent ?? item.agentName;
  const agentColor = displayColor ?? item.agentColor;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-text-faint">
      {agentName ? (
        <span className="inline-flex items-center gap-1">
          <AgentAvatar name={agentName} color={agentColor ?? undefined} size="sm" />
          {role === "activity" ? `Owner: ${agentName}` : agentInherited ? `${agentName} (from activity)` : agentName}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1">
          <Bot className="h-3 w-3" />
          {role === "activity" ? "No agent assigned" : "No agent"}
        </span>
      )}
      {role === "activity" && taskCount !== undefined && (
        <span>
          {taskCount} step{taskCount !== 1 ? "s" : ""}
        </span>
      )}
      <span className="capitalize">{item.priority} priority</span>
      {item.scheduledAt && <span>Scheduled {new Date(item.scheduledAt).toLocaleString()}</span>}
      {item.nextRunAt && item.scheduleType === "recurring" && (
        <span>Next {new Date(item.nextRunAt).toLocaleString()}</span>
      )}
    </div>
  );
}

function ScheduleBadge({
  scheduleType,
  recurrenceRule,
}: {
  scheduleType: WorkScheduleType;
  recurrenceRule: string | null;
}) {
  const label =
    scheduleType === "recurring" && recurrenceRule
      ? `${SCHEDULE_LABELS.recurring} · ${recurrenceRule}`
      : SCHEDULE_LABELS[scheduleType];

  return (
    <span className="rounded-full border border-border bg-panel-elevated px-2 py-0.5 text-[10px] text-text-muted">
      {label}
    </span>
  );
}

function StatusBadge({ status, styles }: { status: string; styles: Record<string, string> }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] capitalize", styles[status] ?? styles.todo)}>
      {status.replace("_", " ")}
    </span>
  );
}

function RowActions({
  status,
  onStatusChange,
  onDelete,
  onEdit,
  onAdd,
}: {
  status: WorkActivity["status"];
  onStatusChange: (status: WorkActivity["status"]) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  onEdit?: () => void;
  onAdd?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {onAdd && (
        <button
          type="button"
          onClick={onAdd.onClick}
          className="rounded-lg border border-border px-2 py-1 text-[10px] text-text-muted hover:text-text-strong"
        >
          + {onAdd.label}
        </button>
      )}
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="rounded p-1.5 hover:bg-panel-hover"
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5 text-text-muted" />
        </button>
      )}
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value as WorkActivity["status"])}
        className="rounded-lg border border-border bg-panel px-2 py-1 text-[10px] text-text-muted"
      >
        <option value="todo">To do</option>
        <option value="scheduled">Scheduled</option>
        <option value="in_progress">In progress</option>
        <option value="done">Done</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <button type="button" onClick={onDelete} className="rounded p-1.5 hover:bg-panel-hover" title="Delete">
        <Trash2 className="h-3.5 w-3.5 text-text-muted" />
      </button>
    </div>
  );
}
