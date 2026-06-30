import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";
import type { Agent } from "../../lib/api";

interface AgentIdentityProps {
  agent: Pick<
    Agent,
    | "name"
    | "slug"
    | "shortId"
    | "isTemplate"
    | "isClone"
    | "isProjectAgent"
    | "parentAgentName"
    | "team"
    | "teamGroup"
    | "projectGroups"
    | "projectGroupCount"
  >;
  compact?: boolean;
  showProjects?: boolean;
}

export function AgentIdentityBadge({
  agent,
}: {
  agent: {
    isTemplate?: boolean;
    isClone?: boolean;
    isProjectAgent?: boolean;
    parentAgentName?: string | null;
    templateVisibility?: "public" | "private";
    createdById?: string | null;
    creatorName?: string | null;
    isOwner?: boolean;
    shortId?: string;
  };
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {agent.isProjectAgent && (
        <span className="rounded border border-accent/40 bg-accent-light px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent-fg">
          Project agent
        </span>
      )}
      {agent.isProjectAgent && agent.parentAgentName && (
        <span className="rounded border border-neutral-600 bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-200">
          From {agent.parentAgentName}
        </span>
      )}
      {!agent.isProjectAgent && agent.isTemplate && (
        <span className="rounded border border-neutral-600 bg-neutral-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-neutral-300">
          Template
        </span>
      )}
      {agent.isTemplate && agent.templateVisibility === "private" && (
        <span className="rounded border border-amber-700/50 bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
          Private
        </span>
      )}
      {agent.isTemplate && agent.templateVisibility === "public" && agent.createdById && (
        <span className="rounded border border-emerald-700/50 bg-emerald-900/30 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200">
          Public
        </span>
      )}
      {!agent.isProjectAgent && agent.isTemplate && !agent.createdById && (
        <span className="rounded border border-neutral-600 bg-neutral-800/80 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
          Built-in
        </span>
      )}
      {!agent.isProjectAgent && agent.isClone && (
        <span className="rounded border border-neutral-600 bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-200">
          Team clone{agent.parentAgentName ? ` · ${agent.parentAgentName}` : ""}
        </span>
      )}
      {!agent.isProjectAgent && !agent.isTemplate && !agent.isClone && (
        <span className="rounded bg-accent-light px-1.5 py-0.5 text-[10px] font-medium text-accent-fg">
          Custom
        </span>
      )}
      {agent.shortId && (
        <span className="rounded bg-neutral-700 px-1.5 py-0.5 font-mono text-[10px] text-neutral-300">
          #{agent.shortId}
        </span>
      )}
    </div>
  );
}

export function AgentIdentity({ agent, compact = false, showProjects = true }: AgentIdentityProps) {
  const projectCount =
    agent.projectGroupCount ?? agent.projectGroups?.length ?? 0;

  return (
    <div className={cn(compact ? "space-y-0.5" : "space-y-1")}>
      <AgentIdentityBadge agent={agent} />
      {!compact && (
        <div className="font-mono text-[11px] text-text-faint">{agent.slug}</div>
      )}
      {!compact && (
        <div className="text-xs text-text-muted">
          {agent.teamGroup?.name ?? agent.team}
          {projectCount > 0 && showProjects && (
            <span> · in {projectCount} project group{projectCount !== 1 ? "s" : ""}</span>
          )}
        </div>
      )}
      {showProjects && agent.projectGroups && agent.projectGroups.length > 0 && !compact && (
        <div className="flex flex-wrap gap-1 pt-1">
          {agent.projectGroups.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="rounded-full border border-border bg-panel-elevated px-2 py-0.5 text-[10px] text-text-muted hover:border-neutral-500 hover:text-text-strong"
            >
              {p.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
