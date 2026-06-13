import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { AGENT_ICONS, STATUS_STYLES, formatRelativeTime } from "../lib/utils";

export function DashboardPage() {
  const { data: agentsData } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.getAgents(),
  });

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ["tasks", "recent"],
    queryFn: () => api.getRecentTasks(),
    refetchInterval: 15000,
  });

  const agents = agentsData?.agents ?? [];
  const tasks = tasksData?.tasks ?? [];
  const activeAgents = agents.filter((a) => a.isActive).length;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">Dashboard</h1>
      <p className="mb-8 text-slate-500">
        Overview of your team agents and recent automation runs.
      </p>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total agents" value={agents.length} />
        <StatCard label="Active agents" value={activeAgents} />
        <StatCard label="Recent tasks" value={tasks.length} />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-800">Recent tasks</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading tasks…</div>
        ) : tasks.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No tasks yet. Start a chat with the Content Agent or run an n8n workflow.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center gap-4 px-5 py-4">
                <span className="text-xl">{AGENT_ICONS[task.agentSlug] ?? "🤖"}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-800">{task.title}</div>
                  <div className="text-xs text-slate-500">
                    {task.agentName} · {formatRelativeTime(task.createdAt)}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[task.status]}`}
                >
                  {task.status.replace("_", " ")}
                </span>
                <Link
                  to={`/agents/${task.agentSlug}/tasks`}
                  className="text-sm text-brand-600 hover:underline"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
