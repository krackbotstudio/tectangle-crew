import { useState } from "react";
import { useParams, NavLink, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutGrid,
  Sliders,
  Workflow,
  BookOpen,
  Settings,
  ListTodo,
  Copy,
  Trash2,
  Pencil,
  Check,
  X,
  Power,
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { AutomationsPage } from "./AutomationsPage";
import { KnowledgePage } from "./KnowledgePage";
import { SettingsPage } from "./SettingsPage";
import { TasksPage } from "./TasksPage";
import { AgentBoardTab } from "../components/agentboard/AgentBoardTab";
import { listItemNavClass } from "../components/workspace/DashboardUI";
import { AgentAvatar } from "../components/workspace/TagEditor";
import { AgentIdentity, AgentIdentityBadge } from "../components/workspace/AgentIdentity";
import { TagEditor } from "../components/workspace/TagEditor";
import { cn } from "../lib/utils";

const tabs = [
  { id: "board", label: "Agent board", shortLabel: "Board", icon: LayoutGrid },
  { id: "configure", label: "Configure", shortLabel: "Config", icon: Sliders },
  { id: "automations", label: "Automations", shortLabel: "n8n", icon: Workflow },
  { id: "knowledge", label: "Knowledge", shortLabel: "Docs", icon: BookOpen },
  { id: "settings", label: "Settings", shortLabel: "Settings", icon: Settings },
  { id: "tasks", label: "Tasks", shortLabel: "Tasks", icon: ListTodo },
];

export function AgentManagePage() {
  const { agentSlug, tab } = useParams<{ agentSlug: string; tab?: string }>();
  const activeTab = tab ?? "board";
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["agent", agentSlug],
    queryFn: () => api.getAgent(agentSlug!),
    enabled: !!agentSlug,
  });

  const toggleMutation = useMutation({
    mutationFn: (isActive: boolean) => api.updateAgent(agentSlug!, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent", agentSlug] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (err: Error) => {
      alert(err.message);
    },
  });

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-text-muted">Loading…</div>;
  }

  const agent = data?.agent;
  if (!agent) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 text-center text-text-muted">
        <p>Agent not found.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-border bg-canvas">
        <div className="flex items-start gap-3 px-4 py-3 sm:px-6">
          <AgentAvatar name={agent.name} color={agent.avatarColor} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-base font-semibold text-text-strong sm:text-lg">
                {agent.name}
              </h1>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!isAdmin || toggleMutation.isPending}
                  onClick={() => toggleMutation.mutate(!agent.isActive)}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    agent.isActive ? "bg-emerald-500" : "bg-neutral-700",
                    (!isAdmin || toggleMutation.isPending) && "opacity-50 cursor-not-allowed"
                  )}
                  title={isAdmin ? (agent.isActive ? "Deactivate agent" : "Activate agent") : "Only admins can change agent activation"}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      agent.isActive ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                    agent.isActive
                      ? "bg-emerald-900/40 text-emerald-400"
                      : "border border-border text-text-muted"
                  )}
                >
                  {agent.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
            <div className="mt-1.5">
              <AgentIdentity agent={agent} compact />
            </div>
            {agent.description && (
              <p className="mt-2 text-sm text-text-muted">{agent.description}</p>
            )}
          </div>
        </div>

        <nav
          className="grid grid-cols-6 gap-1 border-t border-border-subtle px-2 py-2 sm:flex sm:gap-1 sm:overflow-x-auto sm:px-6 scrollbar-hide"
          aria-label="Agent management"
        >
          {tabs.map(({ id, label, shortLabel, icon: Icon }) => (
            <NavLink
              key={id}
              to={
                id === "board"
                  ? `/agents/${agentSlug}`
                  : id === "configure"
                    ? `/agents/${agentSlug}/configure`
                    : `/agents/${agentSlug}/${id}`
              }
              end={id === "board"}
              title={label}
              className={({ isActive }) =>
                listItemNavClass(
                  isActive ||
                    (id === "board" && !tab) ||
                    (id === "configure" && tab === "configure"),
                  "flex flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] sm:min-w-0 sm:flex-1 sm:flex-row sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm"
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">
                <span className="sm:hidden">{shortLabel}</span>
                <span className="hidden sm:inline">{label}</span>
              </span>
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="min-h-0 flex-1">
        {(activeTab === "board" || !tab) && <AgentBoardTab agent={agent} />}
        {activeTab === "configure" && <AgentConfigureTab agentSlug={agent.slug} />}
        {activeTab === "automations" && <AutomationsPage embedded agentSlug={agent.slug} />}
        {activeTab === "knowledge" && <KnowledgePage embedded agentSlug={agent.slug} />}
        {activeTab === "settings" && <SettingsPage embedded agentSlug={agent.slug} />}
        {activeTab === "tasks" && <TasksPage embedded agentSlug={agent.slug} />}
      </div>
    </div>
  );
}

function AgentConfigureTab({ agentSlug }: { agentSlug: string }) {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const { data } = useQuery({
    queryKey: ["agent", agentSlug],
    queryFn: () => api.getAgent(agentSlug),
  });

  const agent = data?.agent;
  if (!agent) return null;

  const saveMutation = useMutation({
    mutationFn: (payload: { skills?: string[]; rules?: string[]; constraints?: string[]; name?: string; isActive?: boolean }) =>
      api.updateAgent(agentSlug, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent", agentSlug] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["team"] });
      setEditingName(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteAgent(agentSlug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      window.location.href = "/agents";
    },
    onError: (e: Error) => alert(e.message),
  });

  const cloneMutation = useMutation({
    mutationFn: () =>
      api.cloneAgent(agent.slug, {
        name: `${agent.name} (Copy)`,
        teamGroupId: agent.teamGroupId ?? undefined,
        skills: agent.skills,
        rules: agent.rules,
        constraints: agent.constraints,
      }),
    onSuccess: ({ agent: cloned }) => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      window.location.href = `/agents/${cloned.slug}`;
    },
  });

  function startRename() {
    if (!agent) return;
    setNameDraft(agent.name);
    setEditingName(true);
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="rounded-2xl border border-border bg-panel p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-faint">
            Identity
          </h2>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="flex-1 rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text-strong outline-none focus:border-neutral-500"
                autoFocus
              />
              <button
                type="button"
                onClick={() => saveMutation.mutate({ name: nameDraft.trim() })}
                className="rounded-lg p-2 hover:bg-panel-hover"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setEditingName(false)}
                className="rounded-lg p-2 hover:bg-panel-hover"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-medium text-text-strong">{agent.name}</span>
              {!agent.isTemplate && (
                <button type="button" onClick={startRename} className="rounded p-1 hover:bg-panel-hover">
                  <Pencil className="h-3.5 w-3.5 text-text-muted" />
                </button>
              )}
            </div>
          )}
          <div className="mt-2">
            <AgentIdentityBadge agent={agent} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => cloneMutation.mutate()}
              disabled={cloneMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs hover:bg-panel-hover"
            >
              <Copy className="h-3.5 w-3.5" /> Clone agent
            </button>
            <button
              type="button"
              disabled={!isAdmin || saveMutation.isPending}
              onClick={() => saveMutation.mutate({ isActive: !agent.isActive })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs hover:bg-panel-hover transition-colors",
                agent.isActive 
                  ? "border-emerald-900/50 text-emerald-400 hover:bg-emerald-950/20" 
                  : "border-border text-text-muted"
              )}
              title={isAdmin ? undefined : "Only admins can change agent activation"}
            >
              <Power className="h-3.5 w-3.5" /> {agent.isActive ? "Deactivate" : "Activate"}
            </button>
            {!agent.isTemplate && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete "${agent.name}" permanently?`)) deleteMutation.mutate();
                }}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-panel-hover"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )}
          </div>
        </section>

        <section className="space-y-5 rounded-2xl border border-border bg-panel p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-faint">
            Behavior
          </h2>
          <TagEditor
            label="Skills"
            items={agent.skills}
            color="light"
            onChange={(items) =>
              saveMutation.mutate({ skills: items, rules: agent.rules, constraints: agent.constraints })
            }
            placeholder="Add skill…"
          />
          <TagEditor
            label="Rules"
            items={agent.rules}
            color="mid"
            onChange={(items) =>
              saveMutation.mutate({ skills: agent.skills, rules: items, constraints: agent.constraints })
            }
            placeholder="Add rule…"
          />
          <TagEditor
            label="Constraints"
            items={agent.constraints}
            color="dark"
            onChange={(items) =>
              saveMutation.mutate({ skills: agent.skills, rules: agent.rules, constraints: items })
            }
            placeholder="Add constraint…"
          />
        </section>

        {(agent.projectGroups?.length ?? 0) > 0 && (
          <section className="rounded-2xl border border-border bg-panel p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-faint">
              Project groups
            </h2>
            <ul className="space-y-1 text-sm text-text-muted">
              {agent.projectGroups!.map((p) => (
                <li key={p.id}>
                  <Link to={`/projects/${p.id}`} className="hover:text-text-strong">
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
