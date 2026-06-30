import { useState } from "react";

import { Navigate, useParams, Link, useLocation } from "react-router-dom";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { UserPlus, Pencil, Check, X, Search } from "lucide-react";

import { api } from "../lib/api";

import { ProjectToolsPanel } from "../components/projects/ProjectToolsPanel";

import { AgentChatView } from "../components/AgentChatView";

import { AgentAvatar } from "../components/workspace/TagEditor";

import { AgentIdentityBadge } from "../components/workspace/AgentIdentity";

import { AddAgentsIllustration, EmptyAgentsIllustration } from "../components/Illustrations";
export function ProjectWorkspacePage() {

  const { projectId, agentSlug } = useParams<{ projectId: string; agentSlug?: string }>();

  const location = useLocation();

  const justCreated = (location.state as { created?: boolean })?.created;

  const queryClient = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);

  const [editingTitle, setEditingTitle] = useState(false);

  const [titleDraft, setTitleDraft] = useState("");



  const { data, isLoading } = useQuery({

    queryKey: ["project", projectId],

    queryFn: () => api.getProject(projectId!),

  });



  const { data: allAgents } = useQuery({
    queryKey: ["agents", "templates"],
    queryFn: () => api.getAgentTemplates(),
    enabled: addOpen,
  });



  const addAgentMutation = useMutation({

    mutationFn: (agentId: string) => api.addProjectAgent(projectId!, { agentId }),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setAddOpen(false);
    },

  });



  const renameMutation = useMutation({

    mutationFn: (title: string) => api.updateProject(projectId!, { title }),

    onSuccess: () => {

      queryClient.invalidateQueries({ queryKey: ["project", projectId] });

      queryClient.invalidateQueries({ queryKey: ["projects"] });

      queryClient.invalidateQueries({ queryKey: ["work-hub"] });

      setEditingTitle(false);

    },

  });



  if (isLoading) {

    return <div className="flex h-full items-center justify-center text-text-muted">Loading…</div>;

  }



  const project = data?.project;

  const agents = data?.agents ?? [];

  const inThisGroup = new Set(
    agents.flatMap((a) => [a.agentId, a.templateAgentId].filter(Boolean) as string[])
  );



  if (!agentSlug && agents.length > 0) {

    return <Navigate to={`/projects/${projectId}/agents/${agents[0].slug}`} replace />;

  }



  const selectedAgent = agents.find((a) => a.slug === agentSlug);



  return (

    <div className="flex h-full flex-col">

      <header className="border-b border-border bg-canvas px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {editingTitle ? (
                <>
                  <input
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    className="rounded-xl border border-border bg-panel-elevated px-2 py-1 text-lg font-semibold text-text-strong outline-none focus:border-neutral-500"
                    autoFocus
                  />
                  <button type="button" onClick={() => renameMutation.mutate(titleDraft)} className="rounded p-1 hover:bg-panel-hover">
                    <Check className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setEditingTitle(false)} className="rounded p-1 hover:bg-panel-hover">
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <h1 className="text-lg font-semibold text-text-strong">{project?.title}</h1>
                  {project?.workProjectId && (
                    <Link
                      to="/work"
                      className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-text-muted hover:border-neutral-500 hover:text-text-strong"
                    >
                      Open in Work hub
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setTitleDraft(project?.title ?? "");
                      setEditingTitle(true);
                    }}
                    className="rounded p-1 hover:bg-panel-hover"
                    title="Rename project group"
                  >
                    <Pencil className="h-4 w-4 text-text-muted" />
                  </button>
                </>
              )}
            </div>

            {project?.goal && <p className="mt-0.5 text-sm text-text-muted">{project.goal}</p>}

            {justCreated && (
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-panel px-3 py-2 text-sm text-text-strong">
                <Check className="h-4 w-4 shrink-0" />
                Project group created. Add agents to start collaborating.
              </div>
            )}

            <p className="mt-1 text-xs text-text-muted">
              Agents keep their own config per group — the same agent can work on multiple projects.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-panel px-3 py-2 text-sm font-medium text-text-strong hover:bg-panel-hover"
            title="Add agent to group"
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Add agent</span>
          </button>
        </div>
      </header>



      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">

          {selectedAgent ? (

            <AgentChatView
              slug={selectedAgent.slug}
              agentName={selectedAgent.name}
              avatarColor={selectedAgent.avatarColor}
              projectId={projectId}
              groupAgents={agents.map((a) => ({
                slug: a.slug,
                name: a.name,
                avatarColor: a.avatarColor,
              }))}
            />

          ) : (

            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-text-muted">

              <EmptyAgentsIllustration className="h-24 w-32 text-text-faint" />

              <p className="max-w-sm text-center text-sm">

                You haven&apos;t added any team to this project group

              </p>

              <button

                type="button"

                onClick={() => setAddOpen(true)}

                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm text-accent-muted-fg hover:bg-accent-hover"

              >

                <UserPlus className="h-4 w-4" />

                Add agents

              </button>

            </div>

          )}

        </div>

        <ProjectToolsPanel projectId={projectId!} className="hidden w-[300px] lg:flex" />

      </div>



      {addOpen && (
        <AddAgentsModal
          agents={allAgents?.agents.filter((a) => a.slug !== "orchestrator" && a.isActive) ?? []}
          inThisGroup={inThisGroup}
          onAdd={(id) => addAgentMutation.mutate(id)}
          onClose={() => setAddOpen(false)}
        />
      )}

    </div>

  );

}



function AddAgentsModal({
  agents,
  inThisGroup,
  onAdd,
  onClose,
}: {
  agents: import("../lib/api").Agent[];
  inThisGroup: Set<string>;
  onAdd: (id: string) => void;
  onClose: () => void;
}) {

  const [search, setSearch] = useState("");

  const available = agents.filter(

    (a) =>

      !inThisGroup.has(a.id) &&

      (a.name.toLowerCase().includes(search.toLowerCase()) ||

        a.slug.includes(search.toLowerCase()) ||

        (a.shortId ?? "").includes(search))

  );



  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-agents-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-start gap-4">
            <AddAgentsIllustration className="h-14 w-20 shrink-0 text-text-faint" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h2 id="add-agents-title" className="font-semibold text-text-strong">
                  Add from template library
                </h2>
                <button type="button" onClick={onClose} className="rounded p-1 hover:bg-panel-hover" title="Close">
                  <X className="h-4 w-4 text-text-muted" />
                </button>
              </div>

              <p className="mt-1 text-xs text-text-muted">
                Pick a template — Tangent creates a dedicated project agent for this group. The template stays unchanged in the library.
              </p>

            </div>

          </div>

          <div className="relative mt-3">

            <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-faint" />

            <input

              type="text"

              value={search}

              onChange={(e) => setSearch(e.target.value)}

              placeholder="Search templates…"

              className="w-full rounded-xl border border-border bg-panel-elevated py-2 pl-9 pr-3 text-sm text-text-strong outline-none focus:border-neutral-500"

              autoFocus

            />

          </div>

        </div>

        <div className="max-h-96 overflow-y-auto p-2">

          {available.map((a) => (

            <button

              key={a.id}

              type="button"

              onClick={() => onAdd(a.id)}

              className="mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-panel-hover"

            >

              <AgentAvatar name={a.name} color={a.avatarColor} size="sm" />

              <div className="min-w-0 flex-1">

                <div className="text-sm font-medium">{a.name}</div>

                <AgentIdentityBadge agent={a} />

                {(a.projectGroupCount ?? a.projectGroups?.length ?? 0) > 0 && (
                  <div className="text-[10px] text-text-muted">
                    Used in {a.projectGroupCount ?? a.projectGroups?.length} project group(s)
                  </div>
                )}

              </div>

              <UserPlus className="h-4 w-4 shrink-0 text-text-faint" />

            </button>

          ))}

          {available.length === 0 && (

            <div className="flex flex-col items-center gap-2 p-6 text-center">

              <Search className="h-8 w-8 text-neutral-300" />

              <p className="text-sm text-text-muted">No templates match your search</p>

            </div>

          )}

        </div>

      </div>

    </div>

  );

}


