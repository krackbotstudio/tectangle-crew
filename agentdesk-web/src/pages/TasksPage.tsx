import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, RefreshCw } from "lucide-react";
import { AgentTabs } from "../components/AgentSidebar";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { AGENT_ICONS, STATUS_STYLES, formatRelativeTime } from "../lib/utils";

export function TasksPage({ embedded, agentSlug: slugProp }: { embedded?: boolean; agentSlug?: string } = {}) {
  const { agentId, agentSlug: routeSlug } = useParams<{ agentId?: string; agentSlug?: string }>();
  const slug = slugProp ?? routeSlug ?? agentId!;
  const { isAdmin } = useAuth();

  const { data: agentData } = useQuery({
    queryKey: ["agent", slug],
    queryFn: () => api.getAgent(slug),
  });

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["tasks", slug],
    queryFn: () => api.getTasks(slug),
    refetchInterval: 10000,
  });

  const tasks = data?.tasks ?? [];

  return (
    <div className={embedded ? "h-full overflow-y-auto p-6" : "mx-auto max-w-5xl"}>
      {!embedded && (
        <>
          <div className="mb-2 flex items-center gap-3">
            <span className="text-2xl">{AGENT_ICONS[slug] ?? "🤖"}</span>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                {agentData?.agent.name ?? slug} — Tasks
              </h1>
              <p className="text-sm text-slate-500">Live feed of runs and chat sessions</p>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="ml-auto inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
          <AgentTabs />
        </>
      )}
      {embedded && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Tasks</h2>
          <button type="button" onClick={() => refetch()} className="text-sm text-neutral-700 underline-offset-2 hover:underline">
            Refresh
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-panel">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading tasks…</div>
        ) : tasks.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No tasks yet for this agent.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Title</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Step</th>
                <th className="px-5 py-3 font-medium">When</th>
                {isAdmin && <th className="px-5 py-3 font-medium">Debug</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-4">
                    <div className="font-medium text-slate-800">{task.title}</div>
                    {task.errorDetail && (
                      <div className="mt-1 text-xs text-neutral-600">{task.errorDetail}</div>
                    )}
                    {task.outputRef && (
                      <a
                        href={task.outputRef}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs text-neutral-800 underline-offset-2 hover:underline"
                      >
                        View output
                      </a>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[task.status]}`}
                    >
                      {task.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{task.currentStep || "—"}</td>
                  <td className="px-5 py-4 text-slate-500">
                    {formatRelativeTime(task.updatedAt)}
                  </td>
                  {isAdmin && (
                    <td className="px-5 py-4">
                      {task.n8nExecutionUrl ? (
                        <a
                          href={task.n8nExecutionUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-neutral-800 underline-offset-2 hover:underline"
                        >
                          n8n <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
