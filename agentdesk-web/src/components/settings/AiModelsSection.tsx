import { useEffect, useRef, useState, type RefObject } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CheckCircle2, KeyRound, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { api, type AiSettingsResponse, type BuiltinAiProviderId } from "../../lib/api";
import { DashboardCard } from "../workspace/DashboardUI";
import { cn } from "../../lib/utils";
import { AUTO } from "./aiModelUtils";
import { ModelPicker, ProviderPicker } from "./ModelPicker";

const inputClass =
  "w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500";

const BUILTIN_PROVIDERS: BuiltinAiProviderId[] = ["anthropic", "openai", "google"];

const PROVIDER_HELP: Partial<Record<BuiltinAiProviderId, string>> = {
  google: "Get a key from Google AI Studio (aistudio.google.com/apikey)",
};

type CustomForm = {
  id?: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  apiKey: string;
  defaultModel: string;
};

type AiFormState = {
  defaultProvider: string;
  defaultModel: string;
  anthropic: { enabled: boolean; apiKey: string; defaultModel: string };
  openai: { enabled: boolean; apiKey: string; defaultModel: string };
  google: { enabled: boolean; apiKey: string; defaultModel: string };
  customProviders: CustomForm[];
};

type ApiKeyRefs = {
  anthropic: RefObject<HTMLInputElement | null>;
  openai: RefObject<HTMLInputElement | null>;
  google: RefObject<HTMLInputElement | null>;
};

function readApiKey(ref: RefObject<HTMLInputElement | null>, formValue: string): string {
  return (ref.current?.value ?? formValue).trim();
}

function buildSavePayload(form: AiFormState, keyRefs?: ApiKeyRefs) {
  const anthropicKey = keyRefs
    ? readApiKey(keyRefs.anthropic, form.anthropic.apiKey)
    : form.anthropic.apiKey.trim();
  const openaiKey = keyRefs
    ? readApiKey(keyRefs.openai, form.openai.apiKey)
    : form.openai.apiKey.trim();
  const googleKey = keyRefs
    ? readApiKey(keyRefs.google, form.google.apiKey)
    : form.google.apiKey.trim();

  return {
    defaultProvider: form.defaultProvider,
    defaultModel: form.defaultModel,
    providers: {
      anthropic: {
        enabled: form.anthropic.enabled,
        defaultModel: form.anthropic.defaultModel,
        ...(anthropicKey ? { apiKey: anthropicKey } : {}),
      },
      openai: {
        enabled: form.openai.enabled,
        defaultModel: form.openai.defaultModel,
        ...(openaiKey ? { apiKey: openaiKey } : {}),
      },
      google: {
        enabled: form.google.enabled,
        defaultModel: form.google.defaultModel,
        ...(googleKey ? { apiKey: googleKey } : {}),
      },
    },
    customProviders: form.customProviders.map((p) => ({
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl,
      enabled: p.enabled,
      defaultModel: p.defaultModel,
      ...(p.apiKey.trim() ? { apiKey: p.apiKey.trim() } : {}),
    })),
  };
}

function formFromSettings(data: AiSettingsResponse): AiFormState {
  return {
    defaultProvider: data.defaultProvider,
    defaultModel: data.defaultModel,
    anthropic: {
      enabled: data.providers.anthropic.enabled,
      apiKey: "",
      defaultModel: data.providers.anthropic.defaultModel,
    },
    openai: {
      enabled: data.providers.openai.enabled,
      apiKey: "",
      defaultModel: data.providers.openai.defaultModel,
    },
    google: {
      enabled: data.providers.google.enabled,
      apiKey: "",
      defaultModel: data.providers.google.defaultModel,
    },
    customProviders: data.customProviders.map((p) => ({
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl,
      enabled: p.enabled,
      apiKey: "",
      defaultModel: p.defaultModel,
    })),
  };
}

function syncFormFromSettings(saved: AiSettingsResponse, form: AiFormState): AiFormState {
  const savedCustomById = new Map(saved.customProviders.map((p) => [p.id, p]));
  return {
    defaultProvider: saved.defaultProvider,
    defaultModel: saved.defaultModel,
    anthropic: {
      enabled: saved.providers.anthropic.enabled,
      apiKey: "",
      defaultModel: saved.providers.anthropic.defaultModel,
    },
    openai: {
      enabled: saved.providers.openai.enabled,
      apiKey: "",
      defaultModel: saved.providers.openai.defaultModel,
    },
    google: {
      enabled: saved.providers.google.enabled,
      apiKey: "",
      defaultModel: saved.providers.google.defaultModel,
    },
    customProviders: form.customProviders.map((p) => {
      const match = p.id ? savedCustomById.get(p.id) : undefined;
      return {
        id: match?.id ?? p.id,
        name: match?.name ?? p.name,
        baseUrl: match?.baseUrl ?? p.baseUrl,
        enabled: match?.enabled ?? p.enabled,
        apiKey: "",
        defaultModel: match?.defaultModel ?? p.defaultModel,
      };
    }),
  };
}

function formHasPendingChanges(
  form: AiFormState,
  data: AiSettingsResponse,
  keyRefs?: ApiKeyRefs
): boolean {
  if (form.defaultProvider !== data.defaultProvider) return true;
  if (form.defaultModel !== data.defaultModel) return true;
  if (form.anthropic.enabled !== data.providers.anthropic.enabled) return true;
  if (form.anthropic.defaultModel !== data.providers.anthropic.defaultModel) return true;
  if (form.openai.enabled !== data.providers.openai.enabled) return true;
  if (form.openai.defaultModel !== data.providers.openai.defaultModel) return true;
  if (form.google.enabled !== data.providers.google.enabled) return true;
  if (form.google.defaultModel !== data.providers.google.defaultModel) return true;
  if (readApiKey(keyRefs?.anthropic ?? { current: null }, form.anthropic.apiKey)) return true;
  if (readApiKey(keyRefs?.openai ?? { current: null }, form.openai.apiKey)) return true;
  if (readApiKey(keyRefs?.google ?? { current: null }, form.google.apiKey)) return true;
  if (form.customProviders.some((p) => p.apiKey.trim())) return true;
  return false;
}

function hasUnsavedApiKeys(form: AiFormState, keyRefs?: ApiKeyRefs): boolean {
  return (
    !!readApiKey(keyRefs?.anthropic ?? { current: null }, form.anthropic.apiKey) ||
    !!readApiKey(keyRefs?.openai ?? { current: null }, form.openai.apiKey) ||
    !!readApiKey(keyRefs?.google ?? { current: null }, form.google.apiKey) ||
    form.customProviders.some((p) => !!p.apiKey.trim())
  );
}

function providerStatusMeta(
  configured: boolean,
  hasPendingKey: boolean
): { label: string; className: string } {
  if (configured && hasPendingKey) {
    return { label: "Key update pending", className: "border-amber-500/30 bg-amber-500/10 text-amber-200" };
  }
  if (configured) {
    return { label: "Connected", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" };
  }
  if (hasPendingKey) {
    return { label: "Unsaved key", className: "border-amber-500/30 bg-amber-500/10 text-amber-200" };
  }
  return { label: "Not configured", className: "border-border text-text-faint" };
}

export function AiModelsSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["ai-settings"],
    queryFn: () => api.getAiSettings(),
  });

  const [form, setForm] = useState<AiFormState | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [editingKeys, setEditingKeys] = useState<Set<string>>(new Set());

  const anthropicKeyRef = useRef<HTMLInputElement>(null);
  const openaiKeyRef = useRef<HTMLInputElement>(null);
  const googleKeyRef = useRef<HTMLInputElement>(null);
  const keyRefs: ApiKeyRefs = {
    anthropic: anthropicKeyRef,
    openai: openaiKeyRef,
    google: googleKeyRef,
  };

  useEffect(() => {
    if (data && !form) {
      setForm(formFromSettings(data));
    }
  }, [data, form]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!form) throw new Error("Form not ready");
      const payload = buildSavePayload(form, keyRefs);
      const googleKey = payload.providers?.google?.apiKey;
      if (form.google.enabled && !data?.providers.google.configured && !googleKey) {
        throw new Error("Enter your Google AI API key before saving.");
      }
      return api.updateAiSettings(payload);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(["ai-settings"], saved);
      queryClient.invalidateQueries({ queryKey: ["ai-settings"] });
      setForm((f) => (f ? syncFormFromSettings(saved, f) : f));
      if (anthropicKeyRef.current) anthropicKeyRef.current.value = "";
      if (openaiKeyRef.current) openaiKeyRef.current.value = "";
      if (googleKeyRef.current) googleKeyRef.current.value = "";
      setEditingKeys(new Set());
      const connected = saved.configuredProviders;
      setSaveStatus({
        ok: true,
        message:
          connected.length > 0
            ? `Saved. API keys are stored securely. Connected: ${connected.join(", ")}.`
            : "Settings saved. Add an API key to connect a provider.",
      });
      setTestResult(null);
    },
    onError: (e: Error) => setSaveStatus({ ok: false, message: e.message }),
  });

  async function saveIfNeeded(): Promise<AiSettingsResponse | null> {
    if (!form || !data) return null;
    if (!formHasPendingChanges(form, data, keyRefs)) return data;
    const saved = await api.updateAiSettings(buildSavePayload(form, keyRefs));
    queryClient.setQueryData(["ai-settings"], saved);
    setForm((f) => (f ? syncFormFromSettings(saved, f) : f));
    if (anthropicKeyRef.current) anthropicKeyRef.current.value = "";
    if (openaiKeyRef.current) openaiKeyRef.current.value = "";
    if (googleKeyRef.current) googleKeyRef.current.value = "";
    setEditingKeys(new Set());
    return saved;
  }

  const hasUnsavedKeys = form ? hasUnsavedApiKeys(form, keyRefs) : false;
  const hasPendingChanges = form && data ? formHasPendingChanges(form, data, keyRefs) : false;

  const testMutation = useMutation({
    mutationFn: async (provider: string) => {
      if (!form) throw new Error("Form not ready");
      await saveIfNeeded();

      const model =
        provider === "anthropic"
          ? form.anthropic.defaultModel
          : provider === "openai"
            ? form.openai.defaultModel
            : provider === "google"
              ? form.google.defaultModel
              : form.customProviders.find((p) => `custom:${p.id}` === provider)?.defaultModel;
      return api.testAiConnection({ provider, model });
    },
    onSuccess: (result) => {
      setTestResult({
        ok: result.ok,
        message: result.ok
          ? `Connected (${result.provider} · ${result.model}): ${result.reply}`
          : result.error ?? "Test failed",
      });
    },
    onError: (e: Error) => setTestResult({ ok: false, message: e.message }),
  });

  const discoverMutation = useMutation({
    mutationFn: async ({ provider }: { provider: string }) => {
      await saveIfNeeded();
      return api.discoverAiModels({ provider });
    },
    onSuccess: (result) => {
      queryClient.setQueryData(["ai-settings"], result.settings);
      setForm((f) => (f ? syncFormFromSettings(result.settings, f) : f));
      setTestResult({ ok: true, message: `Found ${result.models.length} models.` });
    },
    onError: (e: Error) => setTestResult({ ok: false, message: e.message }),
  });

  if (isLoading || !form || !data) {
    return <p className="text-sm text-text-muted">Loading AI settings…</p>;
  }

  function addCustomFromTemplate(index: number) {
    const template = data!.providerTemplates[index];
    setForm((f) =>
      f
        ? {
            ...f,
            customProviders: [
              ...f.customProviders,
              {
                name: template.name,
                baseUrl: template.baseUrl,
                enabled: true,
                apiKey: "",
                defaultModel: template.defaultModel,
              },
            ],
          }
        : f
    );
  }

  function getBuiltinForm(provider: BuiltinAiProviderId) {
    return form![provider];
  }

  function patchBuiltin(
    provider: BuiltinAiProviderId,
    patch: Partial<{ enabled: boolean; apiKey: string; defaultModel: string }>
  ) {
    setForm((f) => (f ? { ...f, [provider]: { ...f[provider], ...patch } } : f));
  }

  function toggleKeyEdit(id: string) {
    setEditingKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 font-semibold text-text-strong">
          <Sparkles className="h-5 w-5" />
          AI models
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Connect LLM providers in one place. API keys are encrypted and stored on the server — after saving, you will
          see a masked hint (not the full key). Use <strong className="text-text-strong">Auto</strong> to pick the best
          configured provider at runtime.
        </p>
      </div>

      <DashboardCard className="space-y-4">
        <h3 className="text-sm font-medium text-text-strong">Workspace defaults</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <ProviderPicker
            label="Default provider"
            value={form.defaultProvider}
            onChange={(defaultProvider) => setForm((f) => (f ? { ...f, defaultProvider } : f))}
            settings={data}
          />
          <ModelPicker
            label="Default model"
            providerRef={form.defaultProvider}
            value={form.defaultModel}
            onChange={(defaultModel) => setForm((f) => (f ? { ...f, defaultModel } : f))}
            settings={data}
            hint="Auto uses each provider's default model"
          />
        </div>
        {data.configuredProviders.length > 0 ? (
          <p className="text-xs text-text-faint">
            Auto will use: {data.configuredProviders.join(" → ")}
          </p>
        ) : (
          <p className="text-xs text-amber-200/80">No providers configured yet — add an API key in the table below and click Save.</p>
        )}
        {hasUnsavedKeys && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            You entered a new API key. Click <strong>Save AI settings</strong> or <strong>Test</strong> (saves
            automatically) so agents can use it.
          </p>
        )}
        {hasPendingChanges && !hasUnsavedKeys && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            You have unsaved changes. Click <strong>Save AI settings</strong> to apply them.
          </p>
        )}
      </DashboardCard>

      <DashboardCard className="overflow-hidden p-0">
        <div className="border-b border-border-subtle px-4 py-3">
          <h3 className="text-sm font-medium text-text-strong">Built-in providers</h3>
          <p className="text-xs text-text-muted">Anthropic, OpenAI, and Google Gemini</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-xs text-text-faint">
                <th className="px-4 py-2.5 font-medium">Provider</th>
                <th className="px-4 py-2.5 font-medium">On</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">API key</th>
                <th className="px-4 py-2.5 font-medium">Default model</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {BUILTIN_PROVIDERS.map((provider) => {
                const meta = data.catalog[provider];
                const status = data.providers[provider];
                const rowForm = getBuiltinForm(provider);
                const apiKeyRef =
                  provider === "anthropic"
                    ? anthropicKeyRef
                    : provider === "openai"
                      ? openaiKeyRef
                      : googleKeyRef;
                const domKey = apiKeyRef.current?.value?.trim() ?? "";
                const hasPendingKey = !!rowForm.apiKey.trim() || !!domKey;
                const statusMeta = providerStatusMeta(status.configured, hasPendingKey);
                const editing = editingKeys.has(provider) || !status.configured;
                const canTest = status.configured || hasPendingKey;
                const helpLink = PROVIDER_HELP[provider];

                return (
                  <tr key={provider} className="align-top hover:bg-panel-hover/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-strong">{meta.label}</div>
                      {helpLink && (
                        <a
                          href="https://aistudio.google.com/apikey"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 block text-[10px] text-text-faint hover:text-text-muted"
                        >
                          {helpLink}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={rowForm.enabled}
                        onChange={(e) => patchBuiltin(provider, { enabled: e.target.checked })}
                        className="h-4 w-4 rounded border-border"
                        aria-label={`Enable ${meta.label}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          statusMeta.className
                        )}
                      >
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="min-w-[200px] px-4 py-3">
                      <ApiKeyCell
                        configured={status.configured}
                        apiKeyHint={status.apiKeyHint}
                        editing={editing}
                        onToggleEdit={() => toggleKeyEdit(provider)}
                        input={
                          <input
                            ref={apiKeyRef}
                            type="password"
                            autoComplete="off"
                            value={rowForm.apiKey}
                            onChange={(e) => patchBuiltin(provider, { apiKey: e.target.value })}
                            placeholder={status.configured ? "Paste new key to replace…" : "Paste API key…"}
                            className={cn(inputClass, "text-xs")}
                          />
                        }
                      />
                    </td>
                    <td className="min-w-[180px] px-4 py-3">
                      <ModelPicker
                        compact
                        label={`${meta.label} model`}
                        providerRef={provider}
                        value={rowForm.defaultModel || AUTO}
                        onChange={(defaultModel) => patchBuiltin(provider, { defaultModel })}
                        settings={data}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <ActionBtn
                          onClick={() => testMutation.mutate(provider)}
                          disabled={testMutation.isPending || !canTest}
                        >
                          {testMutation.isPending && testMutation.variables === provider ? "…" : "Test"}
                        </ActionBtn>
                        {(provider === "openai" || provider === "google") && (
                          <ActionBtn
                            onClick={() => discoverMutation.mutate({ provider })}
                            disabled={discoverMutation.isPending || !canTest}
                          >
                            {discoverMutation.isPending ? "…" : "Discover"}
                          </ActionBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DashboardCard>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-medium text-text-strong">Custom providers</h3>
            <p className="text-sm text-text-muted">OpenAI-compatible endpoints (Groq, Ollama, OpenRouter, etc.)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.providerTemplates.slice(0, 4).map((template, i) => (
              <button
                key={template.name}
                type="button"
                onClick={() => addCustomFromTemplate(i)}
                className="rounded-xl border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-panel-hover"
              >
                + {template.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => addCustomFromTemplate(data.providerTemplates.length - 1)}
              className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-panel-hover"
            >
              <Plus className="h-3.5 w-3.5" /> Custom
            </button>
          </div>
        </div>

        {form.customProviders.length === 0 ? (
          <DashboardCard className="text-sm text-text-muted">
            No custom providers yet. Quick-add Groq, Together, Mistral, or Ollama above.
          </DashboardCard>
        ) : (
          <DashboardCard className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-xs text-text-faint">
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">On</th>
                    <th className="px-4 py-2.5 font-medium">Base URL</th>
                    <th className="px-4 py-2.5 font-medium">API key</th>
                    <th className="px-4 py-2.5 font-medium">Model</th>
                    <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {form.customProviders.map((custom, index) => {
                    const saved = data.customProviders.find((p) => p.id === custom.id);
                    const rowId = custom.id ?? `new-${index}`;
                    const editing = editingKeys.has(rowId) || !saved?.configured;
                    const hasPendingKey = !!custom.apiKey.trim();

                    return (
                      <tr key={rowId} className="align-top hover:bg-panel-hover/40">
                        <td className="px-4 py-3">
                          <input
                            value={custom.name}
                            onChange={(e) =>
                              setForm((f) =>
                                f
                                  ? {
                                      ...f,
                                      customProviders: f.customProviders.map((c, i) =>
                                        i === index ? { ...c, name: e.target.value } : c
                                      ),
                                    }
                                  : f
                              )
                            }
                            className={cn(inputClass, "min-w-[120px] text-xs font-medium")}
                            placeholder="Provider name"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={custom.enabled}
                            onChange={(e) =>
                              setForm((f) =>
                                f
                                  ? {
                                      ...f,
                                      customProviders: f.customProviders.map((c, i) =>
                                        i === index ? { ...c, enabled: e.target.checked } : c
                                      ),
                                    }
                                  : f
                              )
                            }
                            className="h-4 w-4 rounded border-border"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={custom.baseUrl}
                            onChange={(e) =>
                              setForm((f) =>
                                f
                                  ? {
                                      ...f,
                                      customProviders: f.customProviders.map((c, i) =>
                                        i === index ? { ...c, baseUrl: e.target.value } : c
                                      ),
                                    }
                                  : f
                              )
                            }
                            className={cn(inputClass, "min-w-[180px] font-mono text-[11px]")}
                          />
                        </td>
                        <td className="min-w-[180px] px-4 py-3">
                          <ApiKeyCell
                            configured={!!saved?.configured}
                            apiKeyHint={saved?.apiKeyHint ?? null}
                            editing={editing}
                            onToggleEdit={() => toggleKeyEdit(rowId)}
                            input={
                              <input
                                type="password"
                                autoComplete="off"
                                value={custom.apiKey}
                                onChange={(e) =>
                                  setForm((f) =>
                                    f
                                      ? {
                                          ...f,
                                          customProviders: f.customProviders.map((c, i) =>
                                            i === index ? { ...c, apiKey: e.target.value } : c
                                          ),
                                        }
                                      : f
                                  )
                                }
                                placeholder={saved?.configured ? "Paste new key…" : "Paste API key…"}
                                className={cn(inputClass, "text-xs")}
                              />
                            }
                          />
                        </td>
                        <td className="min-w-[160px] px-4 py-3">
                          {saved && saved.discoveredModels.length > 0 ? (
                            <ModelPicker
                              compact
                              label={`${custom.name} model`}
                              providerRef={saved.ref}
                              value={custom.defaultModel || AUTO}
                              onChange={(defaultModel) =>
                                setForm((f) =>
                                  f
                                    ? {
                                        ...f,
                                        customProviders: f.customProviders.map((c, i) =>
                                          i === index ? { ...c, defaultModel } : c
                                        ),
                                      }
                                    : f
                                )
                              }
                              settings={{ ...data, customProviders: [saved] }}
                            />
                          ) : (
                            <input
                              value={custom.defaultModel}
                              onChange={(e) =>
                                setForm((f) =>
                                  f
                                    ? {
                                        ...f,
                                        customProviders: f.customProviders.map((c, i) =>
                                          i === index ? { ...c, defaultModel: e.target.value } : c
                                        ),
                                      }
                                    : f
                                )
                              }
                              placeholder="model-id"
                              className={cn(inputClass, "font-mono text-[11px]")}
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <ActionBtn
                              onClick={() =>
                                testMutation.mutate(custom.id ? `custom:${custom.id}` : "openai")
                              }
                              disabled={
                                testMutation.isPending ||
                                (!saved?.configured && !hasPendingKey)
                              }
                            >
                              Test
                            </ActionBtn>
                            <ActionBtn
                              onClick={() =>
                                discoverMutation.mutate({
                                  provider: custom.id ? `custom:${custom.id}` : "",
                                })
                              }
                              disabled={
                                discoverMutation.isPending ||
                                (!saved?.configured && !hasPendingKey)
                              }
                            >
                              Discover
                            </ActionBtn>
                            <button
                              type="button"
                              onClick={() =>
                                setForm((f) =>
                                  f
                                    ? {
                                        ...f,
                                        customProviders: f.customProviders.filter((_, i) => i !== index),
                                      }
                                    : f
                                )
                              }
                              className="rounded-lg p-1.5 text-text-faint hover:bg-panel-hover hover:text-red-300"
                              title="Remove"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </DashboardCard>
        )}
      </section>

      {saveStatus && (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            saveStatus.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              : "border-red-500/30 bg-red-500/10 text-red-100"
          )}
        >
          {saveStatus.message}
        </div>
      )}

      {testResult && (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            testResult.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              : "border-red-500/30 bg-red-500/10 text-red-100"
          )}
        >
          {testResult.message}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setSaveStatus(null);
          saveMutation.mutate();
        }}
        disabled={saveMutation.isPending}
        className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm text-accent-muted-fg hover:bg-accent-hover disabled:opacity-50"
      >
        {saveMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Saving…
          </>
        ) : saveMutation.isSuccess ? (
          <>
            <CheckCircle2 className="h-4 w-4" /> Saved
          </>
        ) : (
          "Save AI settings"
        )}
      </button>

      <DashboardCard>
        <div className="flex items-start gap-3 text-sm text-text-muted">
          <Bot className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium text-text-strong">Per-agent overrides</p>
            <p className="mt-1">
              Agents default to <strong className="text-text-strong">Auto</strong> unless you pick a specific
              provider and model under Agents → Settings.
            </p>
          </div>
        </div>
      </DashboardCard>
    </section>
  );
}

function ApiKeyCell({
  configured,
  apiKeyHint,
  editing,
  onToggleEdit,
  input,
}: {
  configured: boolean;
  apiKeyHint: string | null;
  editing: boolean;
  onToggleEdit: () => void;
  input: React.ReactNode;
}) {
  if (!editing && configured && apiKeyHint) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1.5">
          <KeyRound className="h-3.5 w-3.5 shrink-0 text-emerald-300/80" />
          <span className="font-mono text-xs text-text-muted">{apiKeyHint}</span>
        </div>
        <p className="text-[10px] text-text-faint">Key stored securely on server</p>
        <button
          type="button"
          onClick={onToggleEdit}
          className="text-[11px] text-text-muted underline hover:text-text-strong"
        >
          Update key
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {configured && apiKeyHint && (
        <p className="text-[10px] text-text-faint">
          Current: <span className="font-mono">{apiKeyHint}</span>
        </p>
      )}
      {input}
      {configured && (
        <button
          type="button"
          onClick={onToggleEdit}
          className="text-[11px] text-text-faint hover:text-text-muted"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-border px-2.5 py-1 text-xs text-text-muted hover:bg-panel-hover disabled:opacity-50"
    >
      {children}
    </button>
  );
}
