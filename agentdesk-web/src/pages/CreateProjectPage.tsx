import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { AgentIdentityBadge } from "../components/workspace/AgentIdentity";
import { AgentAvatar } from "../components/workspace/TagEditor";
import { cn } from "../lib/utils";

export function CreateProjectPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [error, setError] = useState("");

  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.getAgents(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createProject({ title: title.trim(), goal: goal.trim() || undefined, description: description.trim() || undefined, agentIds: selectedAgents }),
    onSuccess: ({ projectId }) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate(`/projects/${projectId}`, { state: { created: true } });
    },
    onError: (err: Error) => setError(err.message),
  });

  function toggleAgent(id: string) {
    setSelectedAgents((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("Please enter a project group name.");
      return;
    }
    createMutation.mutate();
  }

  const agents = agentsData?.agents.filter((a) => a.slug !== "orchestrator") ?? [];

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold text-text-strong">New project group</h1>
        <p className="mt-1 text-sm text-text-muted">
          Create a group of agents from different teams. Agents can be added now or after creation.
          The same agent can join multiple groups with different settings.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <Field
            label="Group name"
            value={title}
            onChange={setTitle}
            required
            placeholder="e.g. Product launch Q3"
          />
          <Field
            label="Goal (optional)"
            value={goal}
            onChange={setGoal}
            placeholder="e.g. Launch campaign for new product"
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-text-muted">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What is this group working on?"
              className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-text-strong">
              Add agents now (optional)
            </label>
            {agentsLoading ? (
              <p className="text-sm text-text-muted">Loading agents…</p>
            ) : agents.length === 0 ? (
              <p className="rounded-xl border border-border bg-panel p-4 text-sm text-text-muted">
                No agents available yet. You can still create the group and add agents later.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => toggleAgent(agent.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 text-left transition",
                      selectedAgents.includes(agent.id)
                        ? "border-accent-light bg-accent-light text-accent-fg"
                        : "border-border bg-panel hover:bg-panel-hover"
                    )}
                  >
                    <AgentAvatar name={agent.name} color={agent.avatarColor} size="sm" />
                    <div>
                      <div className="text-sm font-medium">{agent.name}</div>
                      <AgentIdentityBadge agent={agent} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-border bg-panel-elevated px-4 py-3 text-sm text-text-strong">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!title.trim() || createMutation.isPending}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-muted-fg hover:bg-accent-hover disabled:opacity-50"
            >
              {createMutation.isPending ? "Creating…" : "Create project group"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/projects")}
              className="rounded-xl border border-border px-4 py-2 text-sm text-text-muted hover:bg-panel-hover hover:text-text-strong"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text-muted">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500"
      />
    </div>
  );
}
