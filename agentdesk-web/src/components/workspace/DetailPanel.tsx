import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Copy, Save, Trash2, Pencil, Check, X } from "lucide-react";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";
import { TagEditor, AgentAvatar } from "./TagEditor";
import { AgentIdentity } from "./AgentIdentity";

export function DetailPanel({ mode = "inline" }: { mode?: "inline" | "overlay" }) {
  const { agentSlug, projectId, teamSlug } = useParams<{
    agentSlug?: string;
    projectId?: string;
    teamSlug?: string;
  }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const isProjectView =
    !!projectId &&
    projectId !== "new" &&
    location.pathname.startsWith("/projects/") &&
    !!agentSlug;

  const { data: agentData } = useQuery({
    queryKey: ["agent", agentSlug],
    queryFn: () => api.getAgent(agentSlug!),
    enabled: !!agentSlug,
  });

  const { data: projectData } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.getProject(projectId!),
    enabled: !!isProjectView,
  });

  const agent = agentData?.agent;
  const projectAgent = projectData?.agents.find((a) => a.slug === agentSlug);

  const saveMutation = useMutation({
    mutationFn: async (data: {
      skills?: string[];
      rules?: string[];
      constraints?: string[];
      name?: string;
    }) => {
      if (isProjectView && projectId && projectAgent) {
        await api.updateProjectAgent(projectId, projectAgent.agentId, data);
        return;
      }
      await api.updateAgent(agentSlug!, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent", agentSlug] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["team"] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setEditingName(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteAgent(agentSlug!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["team"] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      navigate(teamSlug ? `/teams/${teamSlug}` : "/teams");
    },
    onError: (e: Error) => alert(e.message),
  });

  const cloneMutation = useMutation({
    mutationFn: () =>
      api.cloneAgent(agent!.slug, {
        name: `${agent!.name} (Copy)`,
        teamGroupId: agent!.teamGroupId ?? undefined,
        skills: agent!.skills,
        rules: agent!.rules,
        constraints: agent!.constraints,
      }),
    onSuccess: ({ agent: cloned }) => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["team"] });
      navigate(`/teams/${agent!.teamGroup?.slug ?? teamSlug ?? "content"}/agents/${cloned.slug}`);
    },
  });

  const removeFromGroupMutation = useMutation({
    mutationFn: () => api.removeProjectAgent(projectId!, projectAgent!.agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["agent", agentSlug] });
      navigate(`/projects/${projectId}`);
    },
  });

  const panelClass =
    mode === "inline"
      ? "flex w-[320px] shrink-0 flex-col border-l border-border-subtle bg-panel"
      : "flex h-full w-full flex-col bg-panel";

  if (!agentSlug) return null;

  const skills =
    isProjectView && projectAgent ? projectAgent.skills : agent?.skills ?? [];
  const rules = isProjectView && projectAgent ? projectAgent.rules : agent?.rules ?? [];
  const constraints =
    isProjectView && projectAgent ? projectAgent.constraints : agent?.constraints ?? [];

  if (!agent && !projectAgent) {
    return (
      <aside className={cn(panelClass, "p-6 text-sm text-text-muted")}>
        Select an agent to view profile
      </aside>
    );
  }

  const displayName = agent?.name ?? projectAgent?.name ?? "";
  const color = agent?.avatarColor ?? projectAgent?.avatarColor;
  const canDelete = agent && !agent.isTemplate;
  const identityAgent = agent ?? {
    name: projectAgent!.name,
    slug: projectAgent!.slug,
    shortId: projectAgent!.shortId,
    isTemplate: false,
    isProjectAgent: true,
    isClone: projectAgent!.isClone,
    parentAgentName: projectAgent!.parentAgentName,
    team: projectAgent!.team,
    teamGroup: projectAgent!.teamGroup,
    skills: projectAgent!.skills,
    rules: projectAgent!.rules,
    constraints: projectAgent!.constraints,
    avatarColor: color,
    connectedApps: [],
    isActive: true,
    projectGroups: [],
  };

  function startRename() {
    setNameDraft(displayName);
    setEditingName(true);
  }

  function saveRename() {
    if (!nameDraft.trim() || isProjectView) return;
    saveMutation.mutate({ name: nameDraft.trim() });
  }

  return (
    <aside className={panelClass}>
      <div className="border-b border-border p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <AgentAvatar name={displayName} color={color} size="lg" />
          <div className="min-w-0 flex-1">
            {editingName && !isProjectView ? (
              <div className="flex items-center gap-1">
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="w-full rounded-xl border border-border bg-panel-elevated px-2 py-1 text-sm font-semibold text-text-strong outline-none focus:border-neutral-500"
                  autoFocus
                />
                <button type="button" onClick={saveRename} className="rounded p-1 hover:bg-panel-hover">
                  <Check className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setEditingName(false)} className="rounded p-1 hover:bg-panel-hover">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <h2 className="truncate text-lg font-semibold text-text-strong">{displayName}</h2>
                {!isProjectView && (
                  <button type="button" onClick={startRename} title="Rename agent" className="rounded p-1 hover:bg-panel-hover">
                    <Pencil className="h-3.5 w-3.5 text-text-muted" />
                  </button>
                )}
              </div>
            )}
            <div className="mt-1">
              <AgentIdentity
                agent={
                  isProjectView
                    ? {
                        ...(agent ?? identityAgent),
                        isTemplate: false,
                        isProjectAgent: true,
                        isClone: projectAgent?.isClone ?? agent?.isClone,
                        parentAgentName: projectAgent?.parentAgentName ?? agent?.parentAgentName,
                      }
                    : (agent ?? identityAgent)
                }
                showProjects={!isProjectView}
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {!isProjectView && (
            <button
              type="button"
              onClick={() => cloneMutation.mutate()}
              disabled={cloneMutation.isPending}
              className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-panel-hover"
            >
              <Copy className="h-3.5 w-3.5" /> Clone
            </button>
          )}
          {isProjectView && projectAgent && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Remove ${displayName} from this project group?`)) {
                  removeFromGroupMutation.mutate();
                }
              }}
              className="flex items-center gap-1 rounded-xl border border-border px-2.5 py-1.5 text-xs text-text-muted hover:bg-panel-hover hover:text-text-strong"
            >
              <X className="h-3.5 w-3.5" /> Remove from group
            </button>
          )}
          {!isProjectView && canDelete && (
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    `Delete "${displayName}" permanently? This cannot be undone.`
                  )
                ) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-1 rounded-xl border border-border px-2.5 py-1.5 text-xs text-text-muted hover:bg-panel-hover hover:text-text-strong"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {isProjectView && (
          <div className="rounded-xl border border-border bg-panel-elevated px-3 py-2 text-xs text-text-muted">
            Project agent for <strong className="text-text-strong">{projectData?.project.title}</strong>.
            {projectAgent?.parentAgentName && (
              <>
                {" "}
                Based on the <strong className="text-text-strong">{projectAgent.parentAgentName}</strong> template —
                skills, rules, and constraints here apply only to this group.
              </>
            )}
          </div>
        )}

        {agent?.description && !isProjectView && (
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-text-faint">About</div>
            <p className="text-sm leading-relaxed text-text-muted">{agent.description}</p>
          </div>
        )}

        <TagEditor
          label="Skills"
          items={skills}
          color="light"
          onChange={(items) => saveMutation.mutate({ skills: items, rules, constraints })}
          placeholder="Add skill…"
        />
        <TagEditor
          label="Rules"
          items={rules}
          color="mid"
          onChange={(items) => saveMutation.mutate({ skills, rules: items, constraints })}
          placeholder="Add rule…"
        />
        <TagEditor
          label="Constraints"
          items={constraints}
          color="dark"
          onChange={(items) => saveMutation.mutate({ skills, rules, constraints: items })}
          placeholder="Add constraint…"
        />

        {saveMutation.isSuccess && (
          <div className="flex items-center gap-1 text-xs text-text-muted">
            <Save className="h-3 w-3" /> Saved
          </div>
        )}
      </div>
    </aside>
  );
}
