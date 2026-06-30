import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, CheckCircle2, Bot, Workflow } from "lucide-react";
import { AgentTabs } from "../components/AgentSidebar";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { AGENT_ICONS } from "../lib/utils";
import { cn } from "../lib/utils";
import { AUTO } from "../components/settings/aiModelUtils";
import { ModelPicker, ProviderPicker } from "../components/settings/ModelPicker";

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

  const { data: aiSettings } = useQuery({
    queryKey: ["ai-settings"],
    queryFn: () => api.getAiSettings(),
    enabled: isAdmin,
  });

  const agent = data?.agent;

  const [form, setForm] = useState({
    chatMode: "direct" as "direct" | "n8n",
    llmProvider: AUTO as string,
    llmModel: AUTO as string,
    llmTemperature: 0.7,
    chatWebhookPath: "",
    workflowId: "",
    webhookUrl: "",
    systemPrompt: "",
    isActive: false,
  });

  useEffect(() => {
    if (agent) {
      setForm({
        chatMode: agent.chatMode ?? "direct",
        llmProvider: agent.llmProvider || AUTO,
        llmModel: agent.llmModel || AUTO,
        llmTemperature: agent.llmTemperature ?? 0.7,
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
        chatMode: form.chatMode,
        llmProvider: form.llmProvider === AUTO ? AUTO : form.llmProvider || null,
        llmModel: form.llmModel === AUTO ? AUTO : form.llmModel || null,
        llmTemperature: form.llmTemperature,
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

  const effectiveProvider =
    form.llmProvider === AUTO
      ? aiSettings?.defaultProvider ?? AUTO
      : form.llmProvider || aiSettings?.defaultProvider || AUTO;

  return (
    <div className={embedded ? "h-full overflow-y-auto p-4 sm:p-6" : "mx-auto max-w-3xl p-4 sm:p-6 lg:p-8"}>
      {!embedded && (
        <>
          <div className="mb-2 flex items-center gap-3">
            <span className="text-2xl">{AGENT_ICONS[slug] ?? "🤖"}</span>
            <div>
              <h1 className="text-xl font-semibold text-text-strong">
                {agent?.name ?? slug} — Settings
              </h1>
              <p className="text-sm text-text-muted">AI model, prompt, and activation</p>
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
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-sm font-medium text-text-strong">Agent active</span>
          </label>

          <section className="space-y-4 rounded-xl border border-border bg-panel-elevated p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-strong">
              <Bot className="h-4 w-4" />
              Chat engine
            </div>
            <p className="text-xs text-text-muted">
              Built-in AI works immediately after you add provider keys in Workspace settings → AI models.
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              <ModeButton
                active={form.chatMode === "direct"}
                icon={Bot}
                title="Built-in AI"
                description="Chat via any configured LLM provider"
                onClick={() => setForm((f) => ({ ...f, chatMode: "direct" }))}
              />
              <ModeButton
                active={form.chatMode === "n8n"}
                icon={Workflow}
                title="n8n workflow"
                description="Route chat through a custom n8n webhook"
                onClick={() => setForm((f) => ({ ...f, chatMode: "n8n" }))}
              />
            </div>

            {form.chatMode === "direct" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <ProviderPicker
                  label="Provider"
                  hint="Auto picks the best configured provider for each message"
                  value={form.llmProvider}
                  onChange={(llmProvider) =>
                    setForm((f) => ({ ...f, llmProvider, llmModel: AUTO }))
                  }
                  settings={aiSettings}
                />
                <ModelPicker
                  label="Model"
                  hint="Auto uses the provider's default model"
                  providerRef={effectiveProvider}
                  value={form.llmModel}
                  onChange={(llmModel) => setForm((f) => ({ ...f, llmModel }))}
                  settings={aiSettings}
                />
                <Field label="Temperature" hint="0 = focused, 1 = creative">
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={form.llmTemperature}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, llmTemperature: parseFloat(e.target.value) || 0.7 }))
                    }
                    className={inputClass}
                  />
                </Field>
              </div>
            )}
          </section>

          {form.chatMode === "n8n" && (
            <section className="space-y-4 rounded-xl border border-dashed border-border p-4">
              <div className="text-sm font-semibold text-text-strong">n8n webhook</div>
              <Field
                label="Chat webhook path"
                hint="e.g. content-agent-chat → http://localhost:5678/webhook/content-agent-chat"
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
            </section>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-text-muted">
              System prompt
            </label>
            <p className="mb-2 text-xs text-text-faint">
              Combined with skills, rules, and constraints from the Configure tab at chat time.
            </p>
            <textarea
              value={form.systemPrompt}
              onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
              rows={8}
              className="w-full rounded-lg border border-border bg-panel-elevated px-3 py-2 font-mono text-sm text-text outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-text-muted">Connected apps</div>
            <div className="flex flex-wrap gap-2">
              {(agent?.connectedApps ?? []).map((app) => (
                <span
                  key={app}
                  className="rounded-full border border-border bg-panel-elevated px-3 py-1 text-xs text-text-muted"
                >
                  {app}
                </span>
              ))}
            </div>
          </div>
        </fieldset>

        {!isAdmin && (
          <p className="text-sm text-text-muted">
            Only admins can edit settings. Contact an admin to activate agents or update AI configuration.
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

function ModeButton({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: typeof Bot;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-3 text-left transition",
        active
          ? "border-accent-light bg-accent-light/10"
          : "border-border hover:border-neutral-600 hover:bg-panel-hover"
      )}
    >
      <div className="flex items-center gap-2 font-medium text-text-strong">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <p className="mt-1 text-xs text-text-muted">{description}</p>
    </button>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  children,
}: {
  label: string;
  hint?: string;
  value?: string;
  onChange?: (v: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text-muted">{label}</label>
      {hint && <p className="mb-1 text-xs text-text-faint">{hint}</p>}
      {children ?? (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className={inputClass}
        />
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500";
