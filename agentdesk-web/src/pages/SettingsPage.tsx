import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, CheckCircle2 } from "lucide-react";
import { AgentTabs } from "../components/AgentSidebar";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { AGENT_ICONS } from "../lib/utils";

export function SettingsPage({ embedded, agentSlug: slugProp }: { embedded?: boolean; agentSlug?: string } = {}) {
  const { agentId, agentSlug: routeSlug } = useParams<{ agentId?: string; agentSlug?: string }>();
  const slug = slugProp ?? routeSlug ?? agentId!;
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data } = useQuery({
    queryKey: ["agent", slug],
    queryFn: () => api.getAgent(slug),
  });

  const agent = data?.agent;

  const [form, setForm] = useState({
    chatWebhookPath: "",
    workflowId: "",
    webhookUrl: "",
    systemPrompt: "",
    isActive: false,
  });

  useEffect(() => {
    if (agent) {
      setForm({
        chatWebhookPath: agent.chatWebhookPath ?? "",
        workflowId: agent.workflowId ?? "",
        webhookUrl: agent.webhookUrl ?? "",
        systemPrompt: agent.systemPrompt ?? "",
        isActive: agent.isActive,
      });
    }
  }, [agent]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.updateAgent(slug, {
        chatWebhookPath: form.chatWebhookPath || null,
        workflowId: form.workflowId || null,
        webhookUrl: form.webhookUrl || null,
        systemPrompt: form.systemPrompt,
        isActive: form.isActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent", slug] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    saveMutation.mutate();
  }

  return (
    <div className={embedded ? "h-full overflow-y-auto p-4 sm:p-6" : "mx-auto max-w-3xl p-4 sm:p-6 lg:p-8"}>
      {!embedded && (
        <>
          <div className="mb-2 flex items-center gap-3">
            <span className="text-2xl">{AGENT_ICONS[slug] ?? "🤖"}</span>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                {agent?.name ?? slug} — Settings
              </h1>
              <p className="text-sm text-slate-500">Webhook, prompt, and activation</p>
            </div>
          </div>
          <AgentTabs />
        </>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-xl border border-border bg-panel p-6"
      >
        <fieldset disabled={!isAdmin} className="space-y-6 disabled:opacity-70">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="text-sm font-medium text-slate-700">Agent active</span>
          </label>

          <Field
            label="Chat webhook path"
            hint="n8n path segment, e.g. content-agent-chat → http://localhost:5678/webhook/content-agent-chat"
            value={form.chatWebhookPath}
            onChange={(v) => setForm((f) => ({ ...f, chatWebhookPath: v }))}
          />

          <Field
            label="Full webhook URL (optional override)"
            value={form.webhookUrl}
            onChange={(v) => setForm((f) => ({ ...f, webhookUrl: v }))}
          />

          <Field
            label="n8n workflow ID"
            hint="Used for View in n8n deep links on Tasks tab"
            value={form.workflowId}
            onChange={(v) => setForm((f) => ({ ...f, workflowId: v }))}
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              System prompt
            </label>
            <textarea
              value={form.systemPrompt}
              onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
              rows={8}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-slate-700">Connected apps</div>
            <div className="flex flex-wrap gap-2">
              {(agent?.connectedApps ?? []).map((app) => (
                <span
                  key={app}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                >
                  {app}
                </span>
              ))}
            </div>
          </div>
        </fieldset>

        {!isAdmin && (
          <p className="text-sm text-neutral-600">
            Only admins can edit settings. Contact an admin to activate agents or update webhooks.
          </p>
        )}

        {isAdmin && (
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-muted-fg hover:bg-accent-hover disabled:opacity-60"
          >
            {saved ? (
              <>
                <CheckCircle2 className="h-4 w-4" /> Saved
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> Save settings
              </>
            )}
          </button>
        )}
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {hint && <p className="mb-1 text-xs text-slate-400">{hint}</p>}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
    </div>
  );
}
