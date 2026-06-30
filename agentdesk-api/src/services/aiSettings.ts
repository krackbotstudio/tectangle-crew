import crypto from "crypto";
import { query } from "../db.js";
import { config } from "../config.js";
import { decryptSecret, encryptSecret, maskSecret } from "./secretCrypto.js";

export const AUTO = "auto" as const;

export type BuiltinProviderId = "anthropic" | "openai" | "google";
export type ProviderRef = typeof AUTO | BuiltinProviderId | `custom:${string}`;

export type ProviderKind = "anthropic" | "openai" | "google" | "openai_compatible";

export interface BuiltinProviderConfig {
  enabled: boolean;
  apiKey: string | null;
  defaultModel: string;
}

export interface CustomProviderConfig {
  id: string;
  name: string;
  kind: "openai_compatible";
  baseUrl: string;
  enabled: boolean;
  apiKey: string | null;
  defaultModel: string;
  /** Optional cached model ids from last discovery */
  discoveredModels?: string[];
}

export interface AiConfig {
  defaultProvider: ProviderRef;
  defaultModel: string;
  providers: Record<BuiltinProviderId, BuiltinProviderConfig>;
  customProviders: CustomProviderConfig[];
}

export type AiConfigUpdate = {
  defaultProvider?: ProviderRef;
  defaultModel?: string;
  providers?: Partial<Record<BuiltinProviderId, Partial<BuiltinProviderConfig>>>;
  customProviders?: CustomProviderConfig[];
};

export interface ResolvedLlmTarget {
  providerRef: string;
  providerLabel: string;
  kind: ProviderKind;
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export const PROVIDER_TEMPLATES = [
  {
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
  },
  {
    name: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  },
  {
    name: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-large-latest",
  },
  {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
  },
  {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o",
  },
  {
    name: "Ollama (local)",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.2",
  },
  {
    name: "Custom OpenAI-compatible",
    baseUrl: "https://api.example.com/v1",
    defaultModel: "",
  },
] as const;

export const AI_MODEL_CATALOG: Record<
  BuiltinProviderId,
  { label: string; models: { id: string; label: string }[] }
> = {
  anthropic: {
    label: "Anthropic",
    models: [
      { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
      { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
      { id: "claude-3-opus-20240229", label: "Claude 3 Opus" },
      { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
    ],
  },
  openai: {
    label: "OpenAI",
    models: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o mini" },
      { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
      { id: "o1", label: "o1" },
      { id: "o1-mini", label: "o1 mini" },
      { id: "o3-mini", label: "o3 mini" },
    ],
  },
  google: {
    label: "Google AI",
    models: [
      { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite (recommended)" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    ],
  },
};

const AUTO_PROVIDER_PRIORITY: BuiltinProviderId[] = ["anthropic", "openai", "google"];

/** Deprecated Gemini IDs → current equivalents */
const GOOGLE_MODEL_ALIASES: Record<string, string> = {
  "gemini-1.5-flash-8b": "gemini-2.0-flash-lite",
  "models/gemini-1.5-flash-8b": "gemini-2.0-flash-lite",
};

function normalizeGoogleModel(model: string): string {
  const bare = model.replace(/^models\//, "");
  return GOOGLE_MODEL_ALIASES[model] ?? GOOGLE_MODEL_ALIASES[bare] ?? bare;
}

const DEFAULT_CONFIG: AiConfig = {
  defaultProvider: AUTO,
  defaultModel: AUTO,
  providers: {
    anthropic: { enabled: true, apiKey: null, defaultModel: "claude-sonnet-4-20250514" },
    openai: { enabled: true, apiKey: null, defaultModel: "gpt-4o" },
    google: { enabled: true, apiKey: null, defaultModel: "gemini-2.0-flash-lite" },
  },
  customProviders: [],
};

function normalizeProviderRef(value: unknown): ProviderRef {
  if (value === AUTO) return AUTO;
  if (value === "anthropic" || value === "openai" || value === "google") return value;
  if (typeof value === "string" && value.startsWith("custom:")) return value as `custom:${string}`;
  return AUTO;
}

function normalizeCustomProvider(raw: Partial<CustomProviderConfig>): CustomProviderConfig {
  return {
    id: raw.id || crypto.randomUUID(),
    name: raw.name?.trim() || "Custom provider",
    kind: "openai_compatible",
    baseUrl: raw.baseUrl?.trim() || "https://api.openai.com/v1",
    enabled: raw.enabled ?? true,
    apiKey: raw.apiKey ?? null,
    defaultModel: raw.defaultModel?.trim() || "gpt-4o",
    discoveredModels: Array.isArray(raw.discoveredModels) ? raw.discoveredModels : [],
  };
}

function normalizeConfig(raw: unknown): AiConfig {
  const data = (raw ?? {}) as Partial<AiConfig> & {
    providers?: Partial<AiConfig["providers"]>;
    customProviders?: Partial<CustomProviderConfig>[];
  };

  return {
    defaultProvider: normalizeProviderRef(data.defaultProvider ?? AUTO),
    defaultModel: typeof data.defaultModel === "string" ? data.defaultModel : AUTO,
    providers: {
      anthropic: {
        enabled: data.providers?.anthropic?.enabled ?? true,
        apiKey: data.providers?.anthropic?.apiKey ?? null,
        defaultModel:
          data.providers?.anthropic?.defaultModel ?? DEFAULT_CONFIG.providers.anthropic.defaultModel,
      },
      openai: {
        enabled: data.providers?.openai?.enabled ?? true,
        apiKey: data.providers?.openai?.apiKey ?? null,
        defaultModel: data.providers?.openai?.defaultModel ?? DEFAULT_CONFIG.providers.openai.defaultModel,
      },
      google: {
        enabled: data.providers?.google?.enabled ?? true,
        apiKey: data.providers?.google?.apiKey ?? null,
        defaultModel: data.providers?.google?.defaultModel ?? DEFAULT_CONFIG.providers.google.defaultModel,
      },
    },
    customProviders: (data.customProviders ?? []).map(normalizeCustomProvider),
  };
}

export async function loadAiConfig(): Promise<AiConfig> {
  const result = await query<{ value: unknown }>(
    "SELECT value FROM app_settings WHERE key = 'ai_config'"
  );
  if (!result.rows[0]) return structuredClone(DEFAULT_CONFIG);
  return normalizeConfig(result.rows[0].value);
}

export async function saveAiConfig(configUpdate: AiConfigUpdate): Promise<AiConfig> {
  const current = await loadAiConfig();
  const next: AiConfig = {
    defaultProvider: configUpdate.defaultProvider ?? current.defaultProvider,
    defaultModel: configUpdate.defaultModel ?? current.defaultModel,
    providers: {
      anthropic: { ...current.providers.anthropic, ...configUpdate.providers?.anthropic },
      openai: { ...current.providers.openai, ...configUpdate.providers?.openai },
      google: { ...current.providers.google, ...configUpdate.providers?.google },
    },
    customProviders: configUpdate.customProviders ?? current.customProviders,
  };

  await query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ('ai_config', $1::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(next)]
  );

  return next;
}

function decryptStoredKey(stored: string | null): string | null {
  if (!stored) return null;
  try {
    return decryptSecret(stored);
  } catch {
    return null;
  }
}

function getEnvApiKey(provider: BuiltinProviderId): string | null {
  if (provider === "anthropic") return config.anthropicApiKey || null;
  if (provider === "openai") return config.openaiApiKey || null;
  if (provider === "google") return config.googleAiApiKey || null;
  return null;
}

export function getCustomProvider(configData: AiConfig, ref: string): CustomProviderConfig | null {
  if (!ref.startsWith("custom:")) return null;
  const id = ref.slice("custom:".length);
  return configData.customProviders.find((p) => p.id === id) ?? null;
}

export function isBuiltinProvider(ref: string): ref is BuiltinProviderId {
  return ref === "anthropic" || ref === "openai" || ref === "google";
}

export function isProviderConfigured(configData: AiConfig, ref: string): boolean {
  if (ref === AUTO) return listConfiguredProviders(configData).length > 0;
  if (isBuiltinProvider(ref)) {
    if (!configData.providers[ref].enabled) return false;
    return !!(getEnvApiKey(ref) || decryptStoredKey(configData.providers[ref].apiKey));
  }
  const custom = getCustomProvider(configData, ref);
  if (!custom?.enabled) return false;
  return !!decryptStoredKey(custom.apiKey);
}

export function listConfiguredProviders(configData: AiConfig): string[] {
  const refs: string[] = [];
  for (const id of AUTO_PROVIDER_PRIORITY) {
    if (isProviderConfigured(configData, id)) refs.push(id);
  }
  for (const custom of configData.customProviders) {
    if (isProviderConfigured(configData, `custom:${custom.id}`)) {
      refs.push(`custom:${custom.id}`);
    }
  }
  return refs;
}

export function pickAutoProvider(configData: AiConfig): string {
  const configured = listConfiguredProviders(configData);
  if (configured.length === 0) {
    return AUTO_PROVIDER_PRIORITY.find((p) => configData.providers[p].enabled) ?? "anthropic";
  }
  return configured[0];
}

export function resolveProviderApiKey(
  configData: AiConfig,
  ref: string,
  overrideKey?: string | null
): string | null {
  if (overrideKey?.trim()) return overrideKey.trim();
  if (isBuiltinProvider(ref)) {
    return getEnvApiKey(ref) || decryptStoredKey(configData.providers[ref].apiKey);
  }
  const custom = getCustomProvider(configData, ref);
  return custom ? decryptStoredKey(custom.apiKey) : null;
}

export function getProviderDefaultModel(configData: AiConfig, ref: string): string {
  if (isBuiltinProvider(ref)) {
    const configured = configData.providers[ref].defaultModel;
    if (configured && configured !== AUTO) {
      return ref === "google" ? normalizeGoogleModel(configured) : configured;
    }
    if (ref === "google") return "gemini-2.0-flash-lite";
    return AI_MODEL_CATALOG[ref].models[0]?.id ?? "gpt-4o";
  }
  const custom = getCustomProvider(configData, ref);
  const customDefault = custom?.defaultModel;
  if (customDefault && customDefault !== AUTO) return customDefault;
  return custom?.defaultModel || "gpt-4o";
}

export function resolveAgentModel(
  configData: AiConfig,
  agent: { llm_provider: string | null; llm_model: string | null }
): { providerRef: string; model: string } {
  let providerRef = agent.llm_provider || configData.defaultProvider || AUTO;
  let model = agent.llm_model || configData.defaultModel || AUTO;

  if (!providerRef || providerRef === AUTO) {
    providerRef = pickAutoProvider(configData);
  }

  if (!model || model === AUTO) {
    model = getProviderDefaultModel(configData, providerRef);
  } else if (providerRef === "google") {
    model = normalizeGoogleModel(model);
  }

  return { providerRef, model };
}

export function resolveLlmTarget(
  configData: AiConfig,
  agent: { llm_provider: string | null; llm_model: string | null }
): Omit<ResolvedLlmTarget, "apiKey"> & { apiKey: string | null } {
  const { providerRef, model } = resolveAgentModel(configData, agent);
  const apiKey = resolveProviderApiKey(configData, providerRef);

  if (isBuiltinProvider(providerRef)) {
    return {
      providerRef,
      providerLabel: AI_MODEL_CATALOG[providerRef].label,
      kind: providerRef,
      model,
      apiKey,
    };
  }

  const custom = getCustomProvider(configData, providerRef);
  return {
    providerRef,
    providerLabel: custom?.name ?? "Custom provider",
    kind: "openai_compatible",
    model,
    apiKey,
    baseUrl: custom?.baseUrl,
  };
}

export function listModelSuggestions(
  configData: AiConfig,
  providerRef: string
): { id: string; label: string }[] {
  if (providerRef === AUTO) {
    return [{ id: AUTO, label: "Auto (best available)" }];
  }
  if (isBuiltinProvider(providerRef)) {
    return [
      { id: AUTO, label: "Auto (provider default)" },
      ...AI_MODEL_CATALOG[providerRef].models,
    ];
  }
  const custom = getCustomProvider(configData, providerRef);
  const discovered = (custom?.discoveredModels ?? []).map((id) => ({ id, label: id }));
  return [{ id: AUTO, label: "Auto (provider default)" }, ...discovered];
}

export function publicAiConfig(configData: AiConfig) {
  return {
    defaultProvider: configData.defaultProvider,
    defaultModel: configData.defaultModel,
    autoAvailable: listConfiguredProviders(configData).length > 0,
    configuredProviders: listConfiguredProviders(configData),
    providers: {
      anthropic: {
        enabled: configData.providers.anthropic.enabled,
        configured: isProviderConfigured(configData, "anthropic"),
        apiKeyHint: maskSecret(
          getEnvApiKey("anthropic") || decryptStoredKey(configData.providers.anthropic.apiKey)
        ),
        defaultModel: configData.providers.anthropic.defaultModel,
      },
      openai: {
        enabled: configData.providers.openai.enabled,
        configured: isProviderConfigured(configData, "openai"),
        apiKeyHint: maskSecret(
          getEnvApiKey("openai") || decryptStoredKey(configData.providers.openai.apiKey)
        ),
        defaultModel: configData.providers.openai.defaultModel,
      },
      google: {
        enabled: configData.providers.google.enabled,
        configured: isProviderConfigured(configData, "google"),
        apiKeyHint: maskSecret(
          getEnvApiKey("google") || decryptStoredKey(configData.providers.google.apiKey)
        ),
        defaultModel: configData.providers.google.defaultModel,
      },
    },
    customProviders: configData.customProviders.map((p) => ({
      id: p.id,
      ref: `custom:${p.id}` as const,
      name: p.name,
      kind: p.kind,
      baseUrl: p.baseUrl,
      enabled: p.enabled,
      configured: isProviderConfigured(configData, `custom:${p.id}`),
      apiKeyHint: maskSecret(decryptStoredKey(p.apiKey)),
      defaultModel: p.defaultModel,
      discoveredModels: p.discoveredModels ?? [],
    })),
    catalog: AI_MODEL_CATALOG,
    providerTemplates: PROVIDER_TEMPLATES,
  };
}

export async function storeProviderApiKey(
  provider: BuiltinProviderId,
  apiKey: string | null | undefined,
  options?: { enabled?: boolean; defaultModel?: string }
): Promise<AiConfig> {
  const current = await loadAiConfig();
  let nextKey = current.providers[provider].apiKey;
  if (apiKey === null || apiKey === "") {
    nextKey = null;
  } else if (apiKey?.trim()) {
    nextKey = encryptSecret(apiKey.trim());
  }

  return saveAiConfig({
    providers: {
      [provider]: {
        ...current.providers[provider],
        enabled: options?.enabled ?? current.providers[provider].enabled,
        defaultModel: options?.defaultModel ?? current.providers[provider].defaultModel,
        apiKey: nextKey,
      },
    },
  });
}

export async function upsertCustomProviders(
  updates: Array<
    Partial<CustomProviderConfig> & {
      id?: string;
      apiKey?: string | null;
      clearApiKey?: boolean;
    }
  >
): Promise<AiConfig> {
  const current = await loadAiConfig();
  const map = new Map(current.customProviders.map((p) => [p.id, p]));

  for (const update of updates) {
    const existing = update.id ? map.get(update.id) : undefined;
    const base = normalizeCustomProvider({ ...existing, ...update, id: update.id ?? existing?.id });
    let apiKey = existing?.apiKey ?? null;
    if (update.clearApiKey || update.apiKey === "") {
      apiKey = null;
    } else if (update.apiKey?.trim()) {
      apiKey = encryptSecret(update.apiKey.trim());
    }
    map.set(base.id, { ...base, apiKey });
  }

  return saveAiConfig({ customProviders: Array.from(map.values()) });
}

export async function removeCustomProvider(id: string): Promise<AiConfig> {
  const current = await loadAiConfig();
  return saveAiConfig({
    customProviders: current.customProviders.filter((p) => p.id !== id),
  });
}

export async function discoverModelsForProvider(
  configData: AiConfig,
  providerRef: string,
  overrideKey?: string
): Promise<string[]> {
  const apiKey = resolveProviderApiKey(configData, providerRef, overrideKey);
  if (!apiKey) throw new Error("No API key configured");

  if (isBuiltinProvider(providerRef)) {
    if (providerRef === "openai") {
      return fetchOpenAiCompatibleModels("https://api.openai.com/v1", apiKey);
    }
    if (providerRef === "google") {
      return fetchGoogleModels(apiKey);
    }
    return AI_MODEL_CATALOG.anthropic.models.map((m) => m.id);
  }

  const custom = getCustomProvider(configData, providerRef);
  if (!custom) throw new Error("Custom provider not found");
  const models = await fetchOpenAiCompatibleModels(custom.baseUrl, apiKey);

  const next = configData.customProviders.map((p) =>
    p.id === custom.id ? { ...p, discoveredModels: models } : p
  );
  await saveAiConfig({ customProviders: next });
  return models;
}

export async function fetchGoogleModels(apiKey: string): Promise<string[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Could not list Google models (${response.status}): ${body.slice(0, 200)}`);
  }
  const data = (await response.json()) as {
    models?: { name: string; supportedGenerationMethods?: string[] }[];
  };
  return (data.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""))
    .filter(Boolean)
    .sort();
}

export async function fetchOpenAiCompatibleModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const root = baseUrl.replace(/\/$/, "");
  const response = await fetch(`${root}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Could not list models (${response.status}): ${body.slice(0, 200)}`);
  }
  const data = (await response.json()) as { data?: { id: string }[] };
  return (data.data ?? []).map((m) => m.id).filter(Boolean).sort();
}
