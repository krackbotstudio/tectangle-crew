import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Layers,
  ArrowRight,
  Plus,
  Globe,
  Lock,
  Trash2,
  X,
  Loader2,
} from "lucide-react";
import { api, type Agent } from "../lib/api";
import { cn } from "../lib/utils";
import { AgentAvatar } from "../components/workspace/TagEditor";
import { AgentIdentityBadge } from "../components/workspace/AgentIdentity";

const TEAM_ORDER = ["content", "design", "marketing", "development", "sales", "hr", "custom"];

type FilterTab = "all" | "mine";

function parseLines(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function CreateTemplateModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [teamGroupId, setTeamGroupId] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [rulesText, setRulesText] = useState("");
  const [constraintsText, setConstraintsText] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [error, setError] = useState<string | null>(null);

  const { data: teamsData } = useQuery({
    queryKey: ["teams"],
    queryFn: () => api.getTeams(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createAgentTemplate({
        name: name.trim(),
        description: description.trim() || undefined,
        teamGroupId: teamGroupId || undefined,
        skills: parseLines(skillsText),
        rules: parseLines(rulesText),
        constraints: parseLines(constraintsText),
        templateVisibility: visibility,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", "templates"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setError(null);
    createMutation.mutate();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-panel shadow-2xl"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold text-text-strong">Create agent template</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-panel-hover">
            <X className="h-4 w-4 text-text-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {error}
            </div>
          )}

          <label className="block space-y-1">
            <span className="text-xs font-medium text-text-muted">Name *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. LinkedIn content strategist"
              className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500"
              autoFocus
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-text-muted">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What this agent is for…"
              className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-text-muted">Team category</span>
            <select
              value={teamGroupId}
              onChange={(e) => setTeamGroupId(e.target.value)}
              className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500"
            >
              <option value="">General / custom</option>
              {(teamsData?.teams ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-text-muted">Skills (one per line)</span>
            <textarea
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              rows={3}
              placeholder="Social copy&#10;Brand voice&#10;SEO"
              className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-text-muted">Rules (one per line)</span>
            <textarea
              value={rulesText}
              onChange={(e) => setRulesText(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500"
            />
          </label>

          <div className="space-y-2">
            <span className="text-xs font-medium text-text-muted">Visibility</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVisibility("private")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
                  visibility === "private"
                    ? "border-accent bg-accent-light text-accent-fg"
                    : "border-border bg-panel-elevated text-text-muted hover:border-neutral-500"
                )}
              >
                <Lock className="h-4 w-4" /> Private
              </button>
              <button
                type="button"
                onClick={() => setVisibility("public")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
                  visibility === "public"
                    ? "border-accent bg-accent-light text-accent-fg"
                    : "border-border bg-panel-elevated text-text-muted hover:border-neutral-500"
                )}
              >
                <Globe className="h-4 w-4" /> Public
              </button>
            </div>
            <p className="text-[11px] text-text-faint">
              Private templates are only visible to you. Public templates appear in everyone&apos;s library.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-sm text-text-muted hover:bg-panel-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-muted-fg hover:bg-accent-hover disabled:opacity-50"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create template
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  onUpdated,
}: {
  template: Agent;
  onUpdated: () => void;
}) {
  const visibilityMutation = useMutation({
    mutationFn: (next: "public" | "private") =>
      api.updateAgent(template.slug, { templateVisibility: next }),
    onSuccess: onUpdated,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteAgent(template.slug),
    onSuccess: onUpdated,
  });

  return (
    <div className="rounded-2xl border border-border bg-panel p-4 transition hover:border-neutral-500">
      <div className="flex items-start gap-3">
        <AgentAvatar name={template.name} color={template.avatarColor} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-text-strong">{template.name}</h3>
          <div className="mt-1">
            <AgentIdentityBadge agent={template} />
          </div>
          {template.creatorName && template.createdById && (
            <p className="mt-1 text-[11px] text-text-faint">By {template.creatorName}</p>
          )}
          {template.description && (
            <p className="mt-2 line-clamp-2 text-sm text-text-muted">{template.description}</p>
          )}
          {template.skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {template.skills.slice(0, 4).map((skill) => (
                <span
                  key={skill}
                  className="rounded-full bg-panel-elevated px-2 py-0.5 text-[10px] text-text-muted"
                >
                  {skill}
                </span>
              ))}
              {template.skills.length > 4 && (
                <span className="text-[10px] text-text-faint">+{template.skills.length - 4} more</span>
              )}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {template.teamGroup ? (
              <Link
                to={`/teams/${template.teamGroup.slug}/agents/${template.slug}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-accent-fg hover:underline"
              >
                View
                <ArrowRight className="h-3 w-3" />
              </Link>
            ) : (
              <Link
                to={`/agents/${template.slug}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-accent-fg hover:underline"
              >
                View
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
            {template.isOwner && (
              <>
                <button
                  type="button"
                  disabled={visibilityMutation.isPending}
                  onClick={() =>
                    visibilityMutation.mutate(
                      template.templateVisibility === "private" ? "public" : "private"
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-text-muted hover:bg-panel-hover"
                >
                  {template.templateVisibility === "private" ? (
                    <>
                      <Globe className="h-3 w-3" /> Make public
                    </>
                  ) : (
                    <>
                      <Lock className="h-3 w-3" /> Make private
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (confirm(`Delete template "${template.name}"?`)) {
                      deleteMutation.mutate();
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-text-muted hover:bg-panel-hover hover:text-red-300"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TemplateLibraryPage() {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["agents", "templates", filter],
    queryFn: () => api.getAgentTemplates(filter === "mine"),
  });

  const templates = data?.agents ?? [];

  const byTeam = templates.reduce<Record<string, Agent[]>>((acc, t) => {
    const key = t.teamGroup?.slug ?? t.team ?? "other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  const teamKeys = Object.keys(byTeam).sort((a, b) => {
    const ai = TEAM_ORDER.indexOf(a);
    const bi = TEAM_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["agents", "templates"] });
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-border bg-panel p-3">
              <Layers className="h-7 w-7 text-text-muted" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-text-strong">Agent template library</h1>
              <p className="mt-1 max-w-2xl text-sm text-text-muted">
                Create reusable agent blueprints and share them publicly or keep them private. Adding
                a template to a project group creates a dedicated working instance.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-muted-fg hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" />
            Create template
          </button>
        </div>

        <div className="mb-6 flex gap-2">
          {(["all", "mine"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                filter === tab
                  ? "border-accent bg-accent-light text-accent-fg"
                  : "border-border bg-panel-elevated text-text-muted hover:border-neutral-500"
              )}
            >
              {tab === "all" ? "All visible" : "My templates"}
            </button>
          ))}
        </div>

        {isLoading && <p className="text-sm text-text-muted">Loading templates…</p>}

        {!isLoading && templates.length === 0 && (
          <div className="rounded-2xl border border-border bg-panel p-8 text-center">
            <p className="text-sm text-text-muted">
              {filter === "mine"
                ? "You haven't created any templates yet."
                : "No templates available yet."}
            </p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-muted-fg hover:bg-accent-hover"
            >
              <Plus className="h-4 w-4" /> Create your first template
            </button>
          </div>
        )}

        <div className="space-y-8 pb-8">
          {teamKeys.map((teamKey) => {
            const group = byTeam[teamKey];
            const teamLabel = group[0]?.teamGroup?.name ?? group[0]?.team ?? teamKey;

            return (
              <section key={teamKey}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-faint">
                  {teamLabel}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.map((template) => (
                    <TemplateCard key={template.id} template={template} onUpdated={refresh} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {createOpen && <CreateTemplateModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}
