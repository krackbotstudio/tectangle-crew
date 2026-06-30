import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { AgentIdentityBadge } from "../components/workspace/AgentIdentity";
import { AgentAvatar } from "../components/workspace/TagEditor";
import { cn } from "../lib/utils";

function InlineTagEditor({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {tags.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-panel-elevated/40 px-2.5 py-0.5 text-[10px] text-text-muted"
          >
            <span className="truncate max-w-[120px]">{tag}</span>
            <button
              type="button"
              onClick={() => onChange(tags.filter((_, j) => j !== i))}
              className="text-text-faint hover:text-text-strong text-[11px]"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              onChange([...tags, draft.trim()]);
              setDraft("");
            }
          }}
          className="flex-1 rounded-lg border border-border bg-panel-elevated/40 px-2 py-1 text-xs outline-none focus:border-neutral-500"
        />
        <button
          type="button"
          onClick={() => {
            if (draft.trim()) {
              onChange([...tags, draft.trim()]);
              setDraft("");
            }
          }}
          className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-panel-hover"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function CreateProjectPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [setupMode, setSetupMode] = useState<"manual" | "ai">("manual");

  // Fields for manual setup or finalized setup
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [error, setError] = useState("");

  // AI-specific states
  const [aiDescription, setAiDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState("");
  const [aiRecommendation, setAiRecommendation] = useState<{
    title: string;
    goal: string;
    description: string;
    agents: {
      agentId: string;
      role: string;
      skills: string[];
      rules: string[];
    }[];
  } | null>(null);
  const [customizedAgentSettings, setCustomizedAgentSettings] = useState<
    Record<string, { role: string; skills: string[]; rules: string[] }>
  >({});

  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.getAgents(),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      // 1. Create project
      const { projectId } = await api.createProject({
        title: title.trim(),
        goal: goal.trim() || undefined,
        description: description.trim() || undefined,
        agentIds: selectedAgents,
      });

      // 2. If setupMode is "ai", update project agents with customized settings
      if (setupMode === "ai") {
        for (const agentId of selectedAgents) {
          const custom = customizedAgentSettings[agentId];
          if (custom) {
            await api.updateProjectAgent(projectId, agentId, {
              role: custom.role,
              skills: custom.skills,
              rules: custom.rules,
            });
          }
        }
      }
      return projectId;
    },
    onSuccess: (projectId) => {
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

  async function handleAiGenerate() {
    if (!aiDescription.trim()) {
      setError("Please describe your project first.");
      return;
    }

    setError("");
    setIsGenerating(true);
    setGenerationStep("Analyzing project requirements...");

    const steps = [
      "Analyzing project requirements...",
      "Assembling optimal project group configurations...",
      "Drafting custom agent roles & specialized directives...",
      "Finalizing agent profiles & constraints...",
    ];
    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < steps.length - 1) {
        stepIdx++;
        setGenerationStep(steps[stepIdx]);
      }
    }, 2000);

    try {
      const rec = await api.getAiProjectSetup(aiDescription.trim());
      clearInterval(interval);

      // Populate main form fields
      setTitle(rec.title);
      setGoal(rec.goal || "");
      setDescription(rec.description || "");

      // Populate selected agents
      const recAgentIds = rec.agents.map((a) => a.agentId);
      setSelectedAgents(recAgentIds);

      // Populate customized settings
      const settingsMap: Record<string, { role: string; skills: string[]; rules: string[] }> = {};
      rec.agents.forEach((a) => {
        settingsMap[a.agentId] = {
          role: a.role,
          skills: a.skills,
          rules: a.rules,
        };
      });

      // Ensure other agents have default settings if the user selects them manually afterwards
      const allAgents = agentsData?.agents || [];
      allAgents.forEach((a) => {
        if (!settingsMap[a.id]) {
          settingsMap[a.id] = {
            role: "contributor",
            skills: a.skills,
            rules: a.rules,
          };
        }
      });

      setCustomizedAgentSettings(settingsMap);
      setAiRecommendation(rec);
    } catch (err) {
      clearInterval(interval);
      setError(err instanceof Error ? err.message : "AI generation failed");
    } finally {
      setIsGenerating(false);
    }
  }

  const agents = agentsData?.agents.filter((a) => a.slug !== "orchestrator" && a.isActive) ?? [];

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-xl font-semibold text-text-strong">New project group</h1>
        <p className="mt-1 text-sm text-text-muted">
          Create a group of agents from different teams. Agents can be added now or after creation.
          The same agent can join multiple groups with different settings.
        </p>

        <div className="mt-4 flex gap-1 rounded-xl border border-border bg-panel p-1">
          <button
            type="button"
            onClick={() => {
              setSetupMode("manual");
              setError("");
            }}
            className={cn(
              "flex-1 rounded-lg py-2 text-xs font-semibold transition",
              setupMode === "manual"
                ? "bg-accent text-accent-muted-fg shadow-md"
                : "text-text-muted hover:bg-panel-hover hover:text-text"
            )}
          >
            Manual Setup
          </button>
          <button
            type="button"
            onClick={() => {
              setSetupMode("ai");
              setError("");
            }}
            className={cn(
              "flex-1 rounded-lg py-2 text-xs font-semibold transition",
              setupMode === "ai"
                ? "bg-accent text-accent-muted-fg shadow-md"
                : "text-text-muted hover:bg-panel-hover hover:text-text"
            )}
          >
            🪄 AI Setup Assistant
          </button>
        </div>

        {setupMode === "manual" ? (
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
        ) : (
          <div className="mt-6 space-y-6">
            {!aiRecommendation && !isGenerating ? (
              <div className="rounded-2xl border border-border bg-panel p-6 space-y-4 shadow-md">
                <h2 className="text-sm font-semibold text-text-strong flex items-center gap-2">
                  <span>🪄</span> Tell the AI about your project
                </h2>
                <p className="text-xs text-text-muted leading-relaxed">
                  Describe what you want to build or achieve. The AI will design the project name, define clear goals,
                  and select the best agents for the job with custom specialized skills and rules.
                </p>
                <div>
                  <textarea
                    value={aiDescription}
                    onChange={(e) => setAiDescription(e.target.value)}
                    rows={5}
                    placeholder="e.g. We are building a mobile habit tracker app with a NestJS backend and React Native frontend. We need content copywriters for the landing page, developers for the codebase, and QA to structure the testing rules..."
                    className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500"
                  />
                </div>
                {error && (
                  <div className="rounded-xl border border-border bg-panel px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleAiGenerate}
                  disabled={!aiDescription.trim()}
                  className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-muted-fg hover:bg-accent-hover disabled:opacity-50"
                >
                  Generate Setup Recommendation
                </button>
              </div>
            ) : null}

            {isGenerating ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-panel p-12 text-center shadow-lg space-y-4">
                <div className="relative flex h-12 w-12 items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-accent/20" />
                  <div className="absolute inset-0 rounded-full border-4 border-t-accent animate-spin" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-strong">AI Assistant is Planning</h3>
                  <p className="mt-1 text-xs text-text-muted min-h-[16px] animate-pulse">{generationStep}</p>
                </div>
              </div>
            ) : null}

            {aiRecommendation && !isGenerating ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="rounded-2xl border border-border bg-panel p-6 space-y-5 shadow-sm">
                  <h2 className="text-sm font-semibold text-text-strong flex items-center justify-between">
                    <span>AI Setup Recommendations</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAiRecommendation(null);
                        setAiDescription("");
                      }}
                      className="text-xs text-text-muted hover:text-text-strong underline"
                    >
                      Start Over
                    </button>
                  </h2>

                  <Field
                    label="Group name"
                    value={title}
                    onChange={setTitle}
                    required
                    placeholder="e.g. Coffee shop landing page"
                  />

                  <Field
                    label="Goal"
                    value={goal}
                    onChange={setGoal}
                    placeholder="e.g. Create landing page copy and layout"
                  />

                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-muted">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-text-strong">Tailored Agents</h3>
                  <p className="text-xs text-text-muted">
                    Review the agents recommended by the AI. You can toggle inclusion and customize their specific roles, skills, and rules below.
                  </p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {agents.map((agent) => {
                      const isSelected = selectedAgents.includes(agent.id);
                      const settings = customizedAgentSettings[agent.id] || { role: "contributor", skills: [], rules: [] };

                      return (
                        <div
                          key={agent.id}
                          className={cn(
                            "flex flex-col rounded-2xl border p-4 transition space-y-3",
                            isSelected
                              ? "border-accent/40 bg-panel-elevated/40"
                              : "border-border bg-panel opacity-60 hover:opacity-80"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <AgentAvatar name={agent.name} color={agent.avatarColor} size="sm" />
                              <div>
                                <div className="text-sm font-semibold text-text-strong">{agent.name}</div>
                                <div className="text-[10px] text-text-faint uppercase tracking-wider">{agent.team}</div>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleAgent(agent.id)}
                              className="rounded text-accent focus:ring-accent h-4 w-4 bg-panel border-border"
                            />
                          </div>

                          {isSelected && (
                            <div className="space-y-3 pt-3 border-t border-border/50 text-xs">
                              <div>
                                <label className="block text-[10px] uppercase font-semibold text-text-faint mb-1">
                                  Tailored Role Title
                                </label>
                                <input
                                  value={settings.role}
                                  onChange={(e) =>
                                    setCustomizedAgentSettings((prev) => ({
                                      ...prev,
                                      [agent.id]: { ...settings, role: e.target.value },
                                    }))
                                  }
                                  className="w-full rounded-lg border border-border bg-panel-elevated px-2.5 py-1 outline-none text-xs"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] uppercase font-semibold text-text-faint mb-1">
                                  Specialized Skills
                                </label>
                                <InlineTagEditor
                                  tags={settings.skills}
                                  placeholder="Add skill..."
                                  onChange={(next) =>
                                    setCustomizedAgentSettings((prev) => ({
                                      ...prev,
                                      [agent.id]: { ...settings, skills: next },
                                    }))
                                  }
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] uppercase font-semibold text-text-faint mb-1">
                                  Style Rules
                                </label>
                                <InlineTagEditor
                                  tags={settings.rules}
                                  placeholder="Add rule..."
                                  onChange={(next) =>
                                    setCustomizedAgentSettings((prev) => ({
                                      ...prev,
                                      [agent.id]: { ...settings, rules: next },
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl border border-border bg-panel px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={!title.trim() || selectedAgents.length === 0 || createMutation.isPending}
                    className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-muted-fg hover:bg-accent-hover disabled:opacity-50"
                  >
                    {createMutation.isPending ? "Initializing..." : "Initialize Project Group"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAiRecommendation(null);
                      setAiDescription("");
                    }}
                    className="rounded-xl border border-border px-4 py-2 text-sm text-text-muted hover:bg-panel-hover hover:text-text-strong"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        )}
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
