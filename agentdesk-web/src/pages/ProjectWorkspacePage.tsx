import { useState } from "react";

import { Navigate, useParams, NavLink, Link, useLocation } from "react-router-dom";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { UserPlus, Pencil, Check, X, Trash2, Search, Users, PanelLeft } from "lucide-react";

import { api } from "../lib/api";
import { cn } from "../lib/utils";

import { AgentChatView } from "../components/AgentChatView";

import { AgentAvatar } from "../components/workspace/TagEditor";

import { AgentIdentityBadge } from "../components/workspace/AgentIdentity";

import { AddAgentsIllustration, EmptyAgentsIllustration } from "../components/Illustrations";

import { listItemNavClass } from "../components/workspace/DashboardUI";

import { Drawer } from "../components/workspace/Drawer";



export function ProjectWorkspacePage() {

  const { projectId, agentSlug } = useParams<{ projectId: string; agentSlug?: string }>();

  const location = useLocation();

  const justCreated = (location.state as { created?: boolean })?.created;

  const queryClient = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);

  const [agentsOpen, setAgentsOpen] = useState(false);

  const [editingTitle, setEditingTitle] = useState(false);

  const [titleDraft, setTitleDraft] = useState("");



  const { data, isLoading } = useQuery({

    queryKey: ["project", projectId],

    queryFn: () => api.getProject(projectId!),

  });



  const { data: allAgents } = useQuery({

    queryKey: ["agents"],

    queryFn: () => api.getAgents(),

  });



  const addAgentMutation = useMutation({

    mutationFn: (agentId: string) => api.addProjectAgent(projectId!, { agentId }),

    onSuccess: () => {

      queryClient.invalidateQueries({ queryKey: ["project", projectId] });

      queryClient.invalidateQueries({ queryKey: ["agents"] });

      setAddOpen(false);

    },

  });



  const removeAgentMutation = useMutation({

    mutationFn: (agentId: string) => api.removeProjectAgent(projectId!, agentId),

    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project", projectId] }),

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

  const inThisGroup = new Set(agents.map((a) => a.agentId));



  if (!agentSlug && agents.length > 0) {

    return <Navigate to={`/projects/${projectId}/agents/${agents[0].slug}`} replace />;

  }



  const selectedAgent = agents.find((a) => a.slug === agentSlug);



  return (

    <div className="flex h-full flex-col">

      <header className="border-b border-border bg-canvas px-4 py-3 sm:px-6 sm:py-4">

        <div className="flex flex-wrap items-center gap-2">

          <button
            type="button"
            onClick={() => setAgentsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-text-strong hover:bg-panel-hover md:hidden"
          >
            <PanelLeft className="h-4 w-4" />
            Agents ({agents.length})
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-2">

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

              >

                <Pencil className="h-4 w-4 text-text-muted" />

              </button>

            </>

          )}

          </div>

        </div>

        {project?.goal && <p className="mt-0.5 text-sm text-text-muted">{project.goal}</p>}

        {justCreated && (

          <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-panel px-3 py-2 text-sm text-text-strong">

            <Check className="h-4 w-4 shrink-0" />

            Project group created. Add agents below to start collaborating.

          </div>

        )}

        <p className="mt-1 text-xs text-text-muted">

          Agents keep their own config per group — the same agent can work on multiple projects.

        </p>

      </header>



      <div className="flex min-h-0 flex-1">

        <ProjectAgentsSidebar
          agents={agents}
          projectId={projectId!}
          onAdd={() => setAddOpen(true)}
          onRemove={(id) => removeAgentMutation.mutate(id)}
          className="hidden md:flex"
        />

        <Drawer open={agentsOpen} onClose={() => setAgentsOpen(false)} side="left" title="Agents in group">
          <ProjectAgentsSidebar
            agents={agents}
            projectId={projectId!}
            onAdd={() => {
              setAgentsOpen(false);
              setAddOpen(true);
            }}
            onRemove={(id) => removeAgentMutation.mutate(id)}
            onNavigate={() => setAgentsOpen(false)}
            className="flex h-full w-full"
          />
        </Drawer>



        <div className="min-w-0 flex-1">

          {selectedAgent ? (

            <AgentChatView

              slug={selectedAgent.slug}

              agentName={selectedAgent.name}

              avatarColor={selectedAgent.avatarColor}

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

      </div>



      {addOpen && (

        <AddAgentsModal

          agents={allAgents?.agents.filter((a) => a.slug !== "orchestrator") ?? []}

          inThisGroup={inThisGroup}

          onAdd={(id) => addAgentMutation.mutate(id)}

        />

      )}

    </div>

  );

}



function ProjectAgentsSidebar({
  agents,
  projectId,
  onAdd,
  onRemove,
  onNavigate,
  className,
}: {
  agents: import("../lib/api").ProjectAgent[];
  projectId: string;
  onAdd: () => void;
  onRemove: (agentId: string) => void;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex shrink-0 flex-col border-r border-border-subtle bg-panel", className ?? "w-64")}>
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase text-text-muted">
          <Users className="h-3.5 w-3.5" />
          Agents in group ({agents.length})
        </span>
        <button
          type="button"
          onClick={onAdd}
          className="rounded p-1 hover:bg-panel-hover"
          title="Add agent to group"
        >
          <UserPlus className="h-4 w-4 text-text-muted" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {agents.map((a) => (
          <div key={a.agentId} className="group mb-1 flex items-start gap-1">
            <NavLink
              to={`/projects/${projectId}/agents/${a.slug}`}
              onClick={onNavigate}
              className={({ isActive }) =>
                listItemNavClass(isActive, "flex min-w-0 flex-1 gap-2 px-2 py-2")
              }
            >
              <AgentAvatar name={a.name} color={a.avatarColor} size="sm" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{a.name}</div>
                <AgentIdentityBadge agent={a} />
                {(a.otherProjectCount ?? 0) > 0 && (
                  <div className="text-[10px] text-text-muted">
                    +{a.otherProjectCount} other group{a.otherProjectCount !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </NavLink>
            <button
              type="button"
              title="Remove from this group"
              onClick={() => onRemove(a.agentId)}
              className="rounded p-1 opacity-100 hover:bg-panel-hover md:opacity-0 md:group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5 text-text-muted" />
            </button>
          </div>
        ))}

        {agents.length === 0 && (
          <button
            type="button"
            onClick={onAdd}
            className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border py-4 text-xs text-text-muted hover:bg-panel-hover"
          >
            <UserPlus className="h-5 w-5" />
            Add agents to this group
          </button>
        )}
      </div>
    </div>
  );
}



function AddAgentsModal({

  agents,

  inThisGroup,

  onAdd,

}: {

  agents: import("../lib/api").Agent[];

  inThisGroup: Set<string>;

  onAdd: (id: string) => void;

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

    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

      <div

        className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl"

        role="dialog"

        aria-modal="true"

        aria-labelledby="add-agents-title"

      >

        <div className="border-b border-border px-5 py-4">

          <div className="flex items-start gap-4">

            <AddAgentsIllustration className="h-14 w-20 shrink-0 text-text-faint" />

            <div className="min-w-0 flex-1">

              <h2 id="add-agents-title" className="font-semibold text-text-strong">

                Add agents to project group

              </h2>

              <p className="mt-1 text-xs text-text-muted">

                Agents already in other groups can be added here too — each group has its own skills, rules, and constraints.

              </p>

            </div>

          </div>

          <div className="relative mt-3">

            <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-faint" />

            <input

              type="text"

              value={search}

              onChange={(e) => setSearch(e.target.value)}

              placeholder="Search by name, slug, or ID…"

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

                    Already in {a.projectGroupCount ?? a.projectGroups?.length} other group(s)

                  </div>

                )}

              </div>

              <UserPlus className="h-4 w-4 shrink-0 text-text-faint" />

            </button>

          ))}

          {available.length === 0 && (

            <div className="flex flex-col items-center gap-2 p-6 text-center">

              <Search className="h-8 w-8 text-neutral-300" />

              <p className="text-sm text-text-muted">No agents available to add</p>

            </div>

          )}

        </div>

      </div>

    </div>

  );

}


