import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ExternalLink,
  FolderKanban,
  Plus,
  Shield,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";
import {
  api,
  type Agent,
  type TeamAssignedProject,
  type TeamGroup,
  type TeamToolRequest,
  type TeamToolRequestStatus,
} from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";
import { PageHeader } from "../workspace/DashboardUI";
import { TagEditor } from "../workspace/TagEditor";
import {
  REQUEST_STATUS_META,
  TOOL_CATALOG,
  TOOL_CATEGORIES,
} from "./teamConfigureTypes";

interface TeamConfigurePageProps {
  teamSlug: string;
  team: TeamGroup;
  agents: Agent[];
  projects: TeamAssignedProject[];
  toolRequests: TeamToolRequest[];
}

export function TeamConfigurePage({
  teamSlug,
  team,
  agents,
  projects,
  toolRequests,
}: TeamConfigurePageProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? "");
  const [toolName, setToolName] = useState("");
  const [customTool, setCustomTool] = useState("");
  const [category, setCategory] = useState("other");
  const [reason, setReason] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState(team.description ?? "");

  useEffect(() => {
    setDescription(team.description ?? "");
  }, [team.description]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["team", teamSlug] });

  const saveMutation = useMutation({
    mutationFn: (payload: { rules?: string[]; constraints?: string[]; description?: string | null }) =>
      api.updateTeam(teamSlug, payload),
    onSuccess: invalidate,
  });

  const createRequestMutation = useMutation({
    mutationFn: () =>
      api.createTeamToolRequest(teamSlug, {
        projectId: selectedProjectId || undefined,
        toolName: (customTool.trim() || toolName).trim(),
        category,
        reason: reason.trim() || undefined,
        url: url.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setToolName("");
      setCustomTool("");
      setReason("");
      setUrl("");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TeamToolRequestStatus }) =>
      api.updateTeamToolRequest(teamSlug, id, { status }),
    onSuccess: invalidate,
  });

  const deleteRequestMutation = useMutation({
    mutationFn: (id: string) => api.deleteTeamToolRequest(teamSlug, id),
    onSuccess: invalidate,
  });

  const rules = team.rules ?? [];
  const constraints = team.constraints ?? [];
  const activeAgents = agents.filter((a) => a.isActive);
  const firstAgent = activeAgents[0] ?? agents[0];

  function handleToolPick(name: string, cat: string) {
    setToolName(name);
    setCustomTool("");
    setCategory(cat);
  }

  function submitRequest() {
    const name = customTool.trim() || toolName.trim();
    if (!name) return;
    if (projects.length > 0 && !selectedProjectId) return;
    createRequestMutation.mutate();
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title={team.name}
          subtitle="Set team rules and constraints, review assigned projects, and request tools needed to deliver work."
          action={
            firstAgent ? (
              <Link
                to={`/teams/${teamSlug}/agents/${firstAgent.slug}`}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-panel px-4 py-2 text-sm font-medium text-text-strong transition hover:bg-panel-hover"
              >
                Open agents <ArrowRight className="h-4 w-4" />
              </Link>
            ) : undefined
          }
        />

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Policy column */}
          <section className="flex flex-col rounded-2xl border border-border bg-panel">
            <div className="border-b border-border-subtle px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-text-strong">
                <Shield className="h-4 w-4 text-text-muted" />
                Team policy
              </div>
              <p className="mt-1 text-xs text-text-muted">
                Rules and constraints apply to every agent in this team.
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-5 p-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-faint">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => {
                    if (description !== (team.description ?? "")) {
                      saveMutation.mutate({ description, rules, constraints });
                    }
                  }}
                  rows={3}
                  placeholder="What this team owns and how it operates…"
                  className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none placeholder:text-text-faint focus:border-neutral-500"
                />
              </div>
              <TagEditor
                label="Rules"
                items={rules}
                color="mid"
                placeholder="Add team rule…"
                onChange={(items) => saveMutation.mutate({ rules: items, constraints })}
              />
              <TagEditor
                label="Constraints"
                items={constraints}
                color="dark"
                placeholder="Add constraint…"
                onChange={(items) => saveMutation.mutate({ rules, constraints: items })}
              />
              <div className="mt-auto rounded-xl border border-dashed border-border-subtle bg-panel-elevated/50 p-3">
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <Users className="h-3.5 w-3.5" />
                  {agents.length} agent{agents.length !== 1 ? "s" : ""} · {activeAgents.length} active
                </div>
              </div>
            </div>
          </section>

          {/* Projects column */}
          <section className="flex flex-col rounded-2xl border border-border bg-panel">
            <div className="border-b border-border-subtle px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-text-strong">
                <FolderKanban className="h-4 w-4 text-text-muted" />
                Assigned projects
              </div>
              <p className="mt-1 text-xs text-text-muted">
                Project groups where this team&apos;s agents participate.
              </p>
            </div>
            <div className="flex-1 space-y-2 p-4">
              {projects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border-subtle px-4 py-8 text-center text-sm text-text-muted">
                  No project groups yet. Assign team agents to a project group from{" "}
                  <Link to="/projects" className="text-text-strong underline underline-offset-2">
                    Groups
                  </Link>
                  .
                </div>
              ) : (
                projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    selected={selectedProjectId === project.id}
                    onSelect={() => setSelectedProjectId(project.id)}
                  />
                ))
              )}
            </div>
          </section>

          {/* Tool requests column */}
          <section className="flex flex-col rounded-2xl border border-border bg-panel">
            <div className="border-b border-border-subtle px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-text-strong">
                <Wrench className="h-4 w-4 text-text-muted" />
                Tools & applications
              </div>
              <p className="mt-1 text-xs text-text-muted">
                Request apps and integrations needed for assigned projects.
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-4 p-4">
              <div className="rounded-xl border border-border bg-panel-elevated p-3 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-text-faint">
                  New request
                </div>
                {projects.length > 0 && (
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text outline-none focus:border-neutral-500"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {TOOL_CATALOG.slice(0, 8).map((tool) => (
                    <button
                      key={tool.name}
                      type="button"
                      onClick={() => handleToolPick(tool.name, tool.category)}
                      className={cn(
                        "rounded-lg border px-2 py-1 text-[11px] transition",
                        toolName === tool.name && !customTool
                          ? "border-accent-light bg-accent-light text-accent-fg"
                          : "border-border text-text-muted hover:bg-panel-hover"
                      )}
                    >
                      {tool.name}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={customTool || toolName}
                  onChange={(e) => {
                    setCustomTool(e.target.value);
                    setToolName("");
                  }}
                  placeholder="Tool or application name…"
                  className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text outline-none placeholder:text-text-faint focus:border-neutral-500"
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text outline-none focus:border-neutral-500"
                >
                  {TOOL_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="Why does the team need this for the project?"
                  className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text outline-none placeholder:text-text-faint focus:border-neutral-500"
                />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Link (optional)"
                  className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text outline-none placeholder:text-text-faint focus:border-neutral-500"
                />
                <button
                  type="button"
                  onClick={submitRequest}
                  disabled={
                    createRequestMutation.isPending ||
                    !(customTool.trim() || toolName.trim()) ||
                    (projects.length > 0 && !selectedProjectId)
                  }
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Submit request
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-text-faint">
                  Requests ({toolRequests.length})
                </div>
                {toolRequests.length === 0 ? (
                  <p className="text-sm text-text-muted">No tool requests yet.</p>
                ) : (
                  toolRequests.map((req) => (
                    <ToolRequestCard
                      key={req.id}
                      request={req}
                      isAdmin={isAdmin}
                      onStatusChange={(status) =>
                        updateStatusMutation.mutate({ id: req.id, status })
                      }
                      onDelete={() => {
                        if (confirm(`Remove request for "${req.toolName}"?`)) {
                          deleteRequestMutation.mutate(req.id);
                        }
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  selected,
  onSelect,
}: {
  project: TeamAssignedProject;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-xl border p-3 text-left transition",
        selected
          ? "border-accent-light bg-accent-light/10"
          : "border-border bg-panel-elevated hover:border-neutral-600"
      )}
    >
      <div className="font-medium text-text-strong">{project.title}</div>
      {project.description && (
        <p className="mt-1 line-clamp-2 text-xs text-text-muted">{project.description}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text-faint">
        <span className="rounded-md border border-border px-1.5 py-0.5 capitalize">{project.status}</span>
        <span>
          {project.teamAgentCount} team agent{project.teamAgentCount !== 1 ? "s" : ""}
        </span>
        {project.workProjectId && (
          <Link
            to="/work"
            onClick={(e) => e.stopPropagation()}
            className="text-text-muted underline-offset-2 hover:text-text-strong hover:underline"
          >
            Work hub
          </Link>
        )}
        <Link
          to={`/projects/${project.id}`}
          onClick={(e) => e.stopPropagation()}
          className="ml-auto text-text-muted underline-offset-2 hover:text-text-strong hover:underline"
        >
          Open group
        </Link>
      </div>
    </button>
  );
}

function ToolRequestCard({
  request,
  isAdmin,
  onStatusChange,
  onDelete,
}: {
  request: TeamToolRequest;
  isAdmin: boolean;
  onStatusChange: (status: TeamToolRequestStatus) => void;
  onDelete: () => void;
}) {
  const statusMeta = REQUEST_STATUS_META[request.status] ?? REQUEST_STATUS_META.requested;

  return (
    <div className="rounded-xl border border-border bg-panel-elevated p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-text-strong">{request.toolName}</div>
          {request.projectTitle && (
            <div className="text-xs text-text-muted">For {request.projectTitle}</div>
          )}
        </div>
        <span className={cn("shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium", statusMeta.className)}>
          {statusMeta.label}
        </span>
      </div>
      {request.reason && (
        <p className="mt-2 text-xs text-text-muted">{request.reason}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text-faint">
        <span className="capitalize">{request.category.replace("_", " ")}</span>
        {request.requesterName && <span>· {request.requesterName}</span>}
        {request.url && (
          <a
            href={request.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 text-text-muted hover:text-text-strong"
          >
            Link <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {isAdmin && (
          <select
            value={request.status}
            onChange={(e) => onStatusChange(e.target.value as TeamToolRequestStatus)}
            className="rounded-lg border border-border bg-panel px-2 py-1 text-xs text-text outline-none"
          >
            {Object.entries(REQUEST_STATUS_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto rounded-lg p-1.5 text-text-faint hover:bg-panel-hover hover:text-text-muted"
          title="Remove request"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
