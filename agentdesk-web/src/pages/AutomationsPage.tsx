import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Workflow,
  Plus,
  Play,
  Pause,
  Trash2,
  ExternalLink,
  Zap,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Send,
} from "lucide-react";
import { AgentTabs } from "../components/AgentSidebar";
import { api, type N8nWorkflowItem } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { DashboardCard } from "../components/workspace/DashboardUI";
import { cn } from "../lib/utils";
import { LOGO_WORDMARK } from "../lib/brand";

export function AutomationsPage({
  embedded,
  agentSlug: slugProp,
}: {
  embedded?: boolean;
  agentSlug?: string;
} = {}) {
  const { agentId, agentSlug: routeSlug } = useParams<{ agentId?: string; agentSlug?: string }>();
  const slug = slugProp ?? routeSlug ?? agentId!;
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [testMessage, setTestMessage] = useState(`Hello — webhook test from ${LOGO_WORDMARK}.`);
  const [actionError, setActionError] = useState("");

  const { data: agentData } = useQuery({
    queryKey: ["agent", slug],
    queryFn: () => api.getAgent(slug),
  });

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ["n8n-status", slug],
    queryFn: () => api.getN8nAgentStatus(slug),
    refetchInterval: 15000,
  });

  const { data: templatesData } = useQuery({
    queryKey: ["n8n-templates"],
    queryFn: () => api.getN8nTemplates(),
  });

  const { data: workflowsData, isLoading: workflowsLoading } = useQuery({
    queryKey: ["n8n-workflows", slug],
    queryFn: () => api.getN8nWorkflows(slug),
    enabled: statusData?.n8n.reachable === true,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["n8n-status", slug] });
    queryClient.invalidateQueries({ queryKey: ["n8n-workflows", slug] });
    queryClient.invalidateQueries({ queryKey: ["agent", slug] });
  };

  const createMutation = useMutation({
    mutationFn: (template: "chat" | "schedule") =>
      api.createN8nWorkflow(slug, { template, activate: true }),
    onSuccess: () => {
      setActionError("");
      invalidate();
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const activateMutation = useMutation({
    mutationFn: (workflowId: string) => api.activateN8nWorkflow(slug, workflowId),
    onSuccess: invalidate,
    onError: (e: Error) => setActionError(e.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (workflowId: string) => api.deactivateN8nWorkflow(slug, workflowId),
    onSuccess: invalidate,
    onError: (e: Error) => setActionError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (workflowId: string) => api.deleteN8nWorkflow(slug, workflowId),
    onSuccess: invalidate,
    onError: (e: Error) => setActionError(e.message),
  });

  const testMutation = useMutation({
    mutationFn: () => api.testN8nWebhook(slug, testMessage),
    onError: (e: Error) => setActionError(e.message),
  });

  const agent = agentData?.agent;
  const n8n = statusData?.n8n;
  const workflows = workflowsData?.workflows ?? [];

  return (
    <div className={embedded ? "h-full overflow-y-auto p-4 sm:p-6" : "mx-auto max-w-3xl p-4 sm:p-6 lg:p-8"}>
      {!embedded && (
        <>
          <div className="mb-6 flex items-center gap-3">
            <Workflow className="h-8 w-8 text-text-muted" />
            <div>
              <h1 className="text-xl font-semibold text-text-strong">
                {agent?.name ?? slug} — Automations
              </h1>
              <p className="text-sm text-text-muted">Create and control n8n workflows from {LOGO_WORDMARK}</p>
            </div>
          </div>
          <AgentTabs />
        </>
      )}

      {embedded && (
        <div className="mb-4 flex items-center gap-2">
          <Workflow className="h-5 w-5 text-text-muted" />
          <h2 className="font-semibold text-text-strong">Automations</h2>
        </div>
      )}

      {/* Connection status */}
      <DashboardCard className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-text-strong">
              <Zap className="h-4 w-4" />
              n8n connection
            </div>
            {statusLoading ? (
              <p className="mt-1 text-sm text-text-muted">Checking…</p>
            ) : (
              <div className="mt-2 space-y-1 text-sm text-text-muted">
                <StatusLine
                  ok={statusData?.apiConfigured}
                  label={
                    statusData?.apiConfigured
                      ? "API key configured"
                      : "N8N_API_KEY missing on server — add in .env"
                  }
                />
                <StatusLine
                  ok={n8n?.reachable}
                  label={
                    n8n?.reachable
                      ? `Connected to ${statusData?.n8nBaseUrl}`
                      : n8n?.error ?? "n8n not reachable"
                  }
                />
                {statusData?.agent.webhookUrl && (
                  <p className="font-mono text-xs text-text-faint">{statusData.agent.webhookUrl}</p>
                )}
              </div>
            )}
          </div>
          {statusData?.agent.isActive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-panel-elevated px-2 py-1 text-xs text-text-strong">
              <CheckCircle2 className="h-3 w-3" /> Agent active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs text-text-muted">
              Inactive
            </span>
          )}
        </div>
      </DashboardCard>

      {actionError && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-border bg-panel-elevated px-4 py-3 text-sm text-text-strong">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {actionError}
        </div>
      )}

      {/* Create from template */}
      {isAdmin && (
        <section className="mb-8">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-faint">
            Create workflow
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {(templatesData?.templates ?? []).map((t) => (
              <DashboardCard key={t.id} className="flex flex-col">
                <div className="font-medium text-text-strong">{t.label}</div>
                <p className="mt-1 flex-1 text-xs text-text-muted">{t.description}</p>
                <button
                  type="button"
                  disabled={!n8n?.reachable || createMutation.isPending}
                  onClick={() => createMutation.mutate(t.id)}
                  className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-medium text-accent-muted-fg hover:bg-accent-hover disabled:opacity-50"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Create & activate
                </button>
              </DashboardCard>
            ))}
          </div>
          {!statusData?.apiConfigured && (
            <p className="mt-2 text-xs text-text-faint">
              Generate an API key in n8n → Settings → API, then set N8N_API_KEY in your .env and restart the API.
            </p>
          )}
        </section>
      )}

      {/* Workflows list */}
      <section className="mb-8">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-faint">
          Workflows for this agent
        </h3>
        {workflowsLoading ? (
          <p className="text-sm text-text-muted">Loading workflows…</p>
        ) : workflows.length === 0 ? (
          <DashboardCard>
            <p className="text-sm text-text-muted">
              No workflows yet. {isAdmin ? "Create a chat workflow above to connect this agent to n8n." : "Ask an admin to set up automations."}
            </p>
          </DashboardCard>
        ) : (
          <ul className="space-y-2">
            {workflows.map((wf) => (
              <WorkflowRow
                key={wf.id}
                workflow={wf}
                isAdmin={isAdmin}
                onActivate={() => activateMutation.mutate(wf.id)}
                onDeactivate={() => deactivateMutation.mutate(wf.id)}
                onDelete={() => {
                  if (confirm(`Delete workflow "${wf.name}" from n8n?`)) deleteMutation.mutate(wf.id);
                }}
                busy={
                  activateMutation.isPending ||
                  deactivateMutation.isPending ||
                  deleteMutation.isPending
                }
              />
            ))}
          </ul>
        )}
      </section>

      {/* Test webhook */}
      {isAdmin && statusData?.agent.webhookUrl && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-faint">
            Test chat webhook
          </h3>
          <DashboardCard>
            <textarea
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500"
            />
            <button
              type="button"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm text-accent-muted-fg hover:bg-accent-hover disabled:opacity-50"
            >
              {testMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send test
            </button>
            {testMutation.data && (
              <pre className="mt-3 max-h-40 overflow-auto rounded-xl border border-border bg-canvas p-3 text-xs text-text-muted">
                {JSON.stringify(testMutation.data, null, 2)}
              </pre>
            )}
          </DashboardCard>
        </section>
      )}
    </div>
  );
}

function StatusLine({ ok, label }: { ok?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-neutral-400" />
      ) : (
        <AlertCircle className="h-3.5 w-3.5 text-neutral-500" />
      )}
      <span>{label}</span>
    </div>
  );
}

function WorkflowRow({
  workflow,
  isAdmin,
  onActivate,
  onDeactivate,
  onDelete,
  busy,
}: {
  workflow: N8nWorkflowItem;
  isAdmin: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-panel px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-text-strong">{workflow.name}</span>
          {workflow.isLinkedChat && (
            <span className="rounded bg-panel-elevated px-1.5 py-0.5 text-[10px] uppercase text-text-faint">
              Chat
            </span>
          )}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] uppercase",
              workflow.active ? "bg-accent-light text-accent-fg" : "border border-border text-text-muted"
            )}
          >
            {workflow.active ? "Active" : "Inactive"}
          </span>
        </div>
        <p className="mt-0.5 font-mono text-[10px] text-text-faint">ID: {workflow.id}</p>
      </div>
      <div className="flex items-center gap-1">
        <a
          href={workflow.editorUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg p-2 text-text-muted hover:bg-panel-hover hover:text-text-strong"
          title="Open in n8n"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
        {isAdmin && (
          <>
            {workflow.active ? (
              <button
                type="button"
                disabled={busy}
                onClick={onDeactivate}
                className="rounded-lg p-2 text-text-muted hover:bg-panel-hover"
                title="Deactivate"
              >
                <Pause className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={onActivate}
                className="rounded-lg p-2 text-text-muted hover:bg-panel-hover"
                title="Activate"
              >
                <Play className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              className="rounded-lg p-2 text-text-muted hover:bg-panel-hover"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </li>
  );
}
