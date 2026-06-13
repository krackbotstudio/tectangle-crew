import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Users } from "lucide-react";
import { api } from "../lib/api";
import { DashboardCard, PageHeader } from "../components/workspace/DashboardUI";

export function TeamsRedirectPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: () => api.getTeams(),
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-text-muted">Loading teams…</div>
    );
  }

  const teams = data?.teams ?? [];

  if (teams.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-text-muted">
        No teams configured yet.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title="Teams"
          subtitle="Configure team rules and tool requests, or open a team to chat with its agents."
        />

        <div className="grid gap-3 sm:grid-cols-2">
          {teams.map((team) => (
            <div key={team.id} className="block">
              <DashboardCard hover className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-panel-elevated text-neutral-300">
                  <Users className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-text-strong">{team.name}</div>
                  <div className="text-xs text-text-muted">
                    {team.agentCount} agent{team.agentCount !== 1 ? "s" : ""}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Link
                      to={`/teams/${team.slug}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-text-strong"
                    >
                      Configure <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </DashboardCard>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
