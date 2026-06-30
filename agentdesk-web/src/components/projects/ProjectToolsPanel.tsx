import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, Plus, Trash2, Wrench, ExternalLink } from "lucide-react";
import {
  api,
  type ProjectTool,
  type ProjectToolStatus,
} from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";

const STATUS_META: Record<
  ProjectToolStatus,
  { label: string; className: string }
> = {
  planned: { label: "Planned", className: "border-border text-text-faint" },
  requested: { label: "Requested", className: "border-amber-500/30 text-amber-200 bg-amber-500/10" },
  approved: { label: "Approved", className: "border-emerald-500/30 text-emerald-200 bg-emerald-500/10" },
  connected: { label: "Connected", className: "border-sky-500/30 text-sky-200 bg-sky-500/10" },
  disabled: { label: "Disabled", className: "border-red-500/30 text-red-200 bg-red-500/10" },
};

export function ProjectToolsPanel({
  projectId,
  className,
}: {
  projectId: string;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [addSlug, setAddSlug] = useState("");

  const { data: catalogData } = useQuery({
    queryKey: ["tool-catalog"],
    queryFn: () => api.getToolCatalog(),
  });

  const { data: toolsData, isLoading } = useQuery({
    queryKey: ["project-tools", projectId],
    queryFn: () => api.getProjectTools(projectId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["project-tools", projectId] });
  };

  const stackMutation = useMutation({
    mutationFn: (stackId: string) => api.applyProjectToolStack(projectId, stackId),
    onSuccess: invalidate,
  });

  const addMutation = useMutation({
    mutationFn: (toolSlug: string) => api.addProjectTool(projectId, { toolSlug }),
    onSuccess: () => {
      invalidate();
      setAddSlug("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProjectToolStatus }) =>
      api.updateProjectTool(projectId, id, { status }),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.removeProjectTool(projectId, id),
    onSuccess: invalidate,
  });

  const tools = toolsData?.tools ?? [];
  const stacks = catalogData?.stacks ?? [];
  const catalog = catalogData?.tools ?? [];
  const assignedSlugs = new Set(tools.map((t) => t.toolSlug));

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-l border-border-subtle bg-sidebar",
        className
      )}
    >
      <div className="border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-strong">
          <Wrench className="h-4 w-4 text-text-muted" />
          Project tools
        </div>
        <p className="mt-1 text-xs text-text-muted">
          Apps every agent in this group can use. Configure credentials in{" "}
          <Link to="/app-store" className="underline hover:text-text-strong">
            App Store
          </Link>
          .
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <section className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-text-faint">
            Quick stacks
          </div>
          {stacks.map((stack) => (
            <button
              key={stack.id}
              type="button"
              onClick={() => stackMutation.mutate(stack.id)}
              disabled={stackMutation.isPending}
              className="w-full rounded-xl border border-border bg-panel-elevated p-3 text-left transition hover:border-neutral-500 hover:bg-panel-hover"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-text-strong">
                <Layers className="h-3.5 w-3.5 text-text-muted" />
                {stack.name}
              </div>
              <p className="mt-1 text-xs text-text-muted">{stack.description}</p>
            </button>
          ))}
        </section>

        <section className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-text-faint">
            Add tool
          </div>
          <div className="flex gap-2">
            <select
              value={addSlug}
              onChange={(e) => setAddSlug(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-border bg-panel px-2 py-2 text-sm text-text outline-none focus:border-neutral-500"
            >
              <option value="">Select…</option>
              {catalog
                .filter((t) => !assignedSlugs.has(t.slug))
                .map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={!addSlug || addMutation.isPending}
              onClick={() => addSlug && addMutation.mutate(addSlug)}
              className="rounded-lg border border-border px-2 py-2 text-text-muted hover:bg-panel-hover disabled:opacity-50"
              title="Add tool"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </section>

        <section className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-text-faint">
            Assigned ({tools.length})
          </div>
          {isLoading && <p className="text-sm text-text-muted">Loading…</p>}
          {!isLoading && tools.length === 0 && (
            <p className="text-sm text-text-muted">
              No tools yet. Add the social media stack for content tracking, creatives, and publishing.
            </p>
          )}
          {tools.map((tool) => (
            <ToolRow
              key={tool.id}
              tool={tool}
              isAdmin={isAdmin}
              onStatusChange={(status) => updateMutation.mutate({ id: tool.id, status })}
              onRemove={() => {
                if (confirm(`Remove ${tool.toolName} from this project?`)) {
                  removeMutation.mutate(tool.id);
                }
              }}
            />
          ))}
        </section>
      </div>
    </aside>
  );
}

function ToolRow({
  tool,
  isAdmin,
  onStatusChange,
  onRemove,
}: {
  tool: ProjectTool;
  isAdmin: boolean;
  onStatusChange: (status: ProjectToolStatus) => void;
  onRemove: () => void;
}) {
  const meta = STATUS_META[tool.status] ?? STATUS_META.planned;

  return (
    <div className="rounded-xl border border-border bg-panel-elevated p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-text-strong">{tool.toolName}</div>
          {tool.description && (
            <p className="mt-1 text-xs text-text-muted">{tool.description}</p>
          )}
        </div>
        <span className={cn("shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium", meta.className)}>
          {meta.label}
        </span>
      </div>
      {tool.workspaceStatus && tool.workspaceStatus !== "connected" && tool.workspaceStatus !== "not_configured" && (
        <Link
          to={`/app-store?tool=${tool.toolSlug}`}
          className="mt-2 inline-flex items-center gap-1 text-[10px] text-amber-200 hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Finish setup in App Store
        </Link>
      )}
      {tool.workspaceStatus === "not_configured" && (
        <Link
          to={`/app-store?tool=${tool.toolSlug}`}
          className="mt-2 inline-flex items-center gap-1 text-[10px] text-text-faint hover:text-text-muted hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Connect in App Store
        </Link>
      )}
      {tool.accountLabel && (
        <p className="mt-1 text-[10px] text-text-faint">{tool.accountLabel}</p>
      )}
      {tool.capabilities.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tool.capabilities.slice(0, 4).map((cap) => (
            <span
              key={cap}
              className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-text-faint"
            >
              {cap.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {isAdmin && (
          <select
            value={tool.status}
            onChange={(e) => onStatusChange(e.target.value as ProjectToolStatus)}
            className="rounded-lg border border-border bg-panel px-2 py-1 text-xs text-text outline-none"
          >
            {Object.entries(STATUS_META).map(([value, m]) => (
              <option key={value} value={value}>
                {m.label}
              </option>
            ))}
          </select>
        )}
        {tool.connectVia && (
          <span className="text-[10px] text-text-faint">via {tool.connectVia}</span>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto rounded-lg p-1 text-text-faint hover:bg-panel-hover"
          title="Remove"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
