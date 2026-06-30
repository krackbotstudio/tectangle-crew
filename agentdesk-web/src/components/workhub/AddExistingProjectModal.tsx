import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FolderKanban, Loader2, Search, X } from "lucide-react";
import { api, type Project } from "../../lib/api";

export function AddExistingProjectModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.getProjects(),
  });

  const addMutation = useMutation({
    mutationFn: (projectGroupId: string) => api.addWorkProjectFromGroup(projectGroupId),
    onSuccess: () => {
      onAdded();
      onClose();
    },
  });

  const available = (data?.projects ?? []).filter((p) => !p.workProjectId);
  const filtered = available.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.goal ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-existing-project-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="add-existing-project-title" className="font-semibold text-text-strong">
                Add existing project group
              </h2>
              <p className="mt-1 text-xs text-text-muted">
                Project groups from Groups that are not yet on the Work canvas.
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded p-1 hover:bg-panel-hover" title="Close">
              <X className="h-4 w-4 text-text-muted" />
            </button>
          </div>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-faint" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search project groups…"
              className="w-full rounded-xl border border-border bg-panel-elevated py-2 pl-9 pr-3 text-sm text-text outline-none focus:border-neutral-500"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading project groups…
            </div>
          )}

          {!isLoading &&
            filtered.map((project) => (
              <ProjectGroupRow
                key={project.id}
                project={project}
                disabled={addMutation.isPending}
                onSelect={() => addMutation.mutate(project.id)}
              />
            ))}

          {!isLoading && available.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <FolderKanban className="h-10 w-10 text-text-faint" />
              <p className="text-sm text-text-muted">All project groups are already on the canvas.</p>
              <p className="text-xs text-text-faint">Create a new group under Groups, or use Create → Project.</p>
            </div>
          )}

          {!isLoading && available.length > 0 && filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-text-muted">No matches for your search.</div>
          )}

          {addMutation.isError && (
            <div className="mx-2 mb-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {addMutation.error instanceof Error ? addMutation.error.message : "Failed to add project"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectGroupRow({
  project,
  disabled,
  onSelect,
}: {
  project: Project;
  disabled: boolean;
  onSelect: () => void;
}) {
  const subtitle = project.description?.trim() || project.goal?.trim();

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className="mb-1 flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-panel-hover disabled:opacity-50"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-panel-elevated text-text-muted">
        <FolderKanban className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-text-strong">{project.title}</span>
        {subtitle && (
          <span className="mt-0.5 line-clamp-2 block text-xs text-text-muted">{subtitle}</span>
        )}
        {(project.agentCount ?? 0) > 0 && (
          <span className="mt-1 inline-block text-[10px] text-text-faint">
            {project.agentCount} agent{project.agentCount !== 1 ? "s" : ""} in group
          </span>
        )}
      </span>
    </button>
  );
}
