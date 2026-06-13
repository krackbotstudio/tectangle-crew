import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bot } from "lucide-react";
import { api } from "../lib/api";

export function AgentsRedirectPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.getAgents(),
  });

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-text-muted">Loading…</div>;
  }

  const agents = data?.agents ?? [];
  const first = agents.find((a) => a.isActive) ?? agents[0];

  if (first) {
    return <Navigate to={`/agents/${first.slug}`} replace />;
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-text-muted">
      <Bot className="h-12 w-12 text-text-faint" />
      <p>No agents configured yet.</p>
      <p className="text-sm">Clone an agent from a team to get started.</p>
    </div>
  );
}
