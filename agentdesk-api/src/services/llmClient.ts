import type { AiConfig, ProviderKind, ResolvedLlmTarget } from "./aiSettings.js";
import {
  AUTO,
  fetchGoogleModels,
  isProviderConfigured,
  listConfiguredProviders,
  resolveLlmTarget,
} from "./aiSettings.js";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateChatReplyInput {
  kind: ProviderKind;
  model: string;
  apiKey: string;
  systemPrompt: string;
  history: ChatMessage[];
  userMessage: string;
  temperature?: number;
  baseUrl?: string;
  maxOutputTokens?: number;
}

export interface DirectChatInput {
  aiConfig: AiConfig;
  agent: {
    llm_provider: string | null;
    llm_model: string | null;
    llm_temperature?: number;
  };
  systemPrompt: string;
  history: ChatMessage[];
  userMessage: string;
}

export interface DirectChatResult {
  reply: string;
  providerRef: string;
  providerLabel: string;
  model: string;
}

function isRetryableLlmError(error: Error): boolean {
  const msg = error.message.toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("404") ||
    msg.includes("not_found") ||
    msg.includes("503") ||
    msg.includes("resource_exhausted")
  );
}

/** Turn raw provider JSON errors into short user-facing text. */
export function formatUserFacingLlmError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (raw.includes("429") || raw.toLowerCase().includes("quota")) {
    return (
      "Google AI quota exceeded on your API key. Wait a few minutes, use Gemini 2.0 Flash Lite, " +
      "or check usage at https://ai.dev/rate-limit and billing at https://ai.google.dev/"
    );
  }

  if (raw.includes("API key not valid") || raw.includes("API_KEY_INVALID")) {
    return "The Google AI API key is invalid. Paste a fresh key from https://aistudio.google.com/apikey and save.";
  }

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        error?: { message?: string; code?: number };
      };
      if (parsed.error?.message) {
        return `AI provider error: ${parsed.error.message.slice(0, 200)}`;
      }
    }
  } catch {
    // keep raw fallback
  }

  return raw.length > 280 ? `${raw.slice(0, 280)}…` : raw;
}

function googleModelCandidates(preferredModel: string, available: string[] = []): string[] {
  const preferred = preferredModel.replace(/^models\//, "");
  return [
    ...(preferred && preferred !== AUTO ? [preferred] : []),
    ...available.filter((m) => m.includes("flash-lite")),
    ...available.filter((m) => m.includes("2.0-flash") && !m.includes("lite")),
    ...available,
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);
}

async function generateGoogleChatWithFallback(
  input: Omit<GenerateChatReplyInput, "kind" | "model"> & { preferredModel: string }
): Promise<{ text: string; modelUsed: string }> {
  let available: string[] = [];
  try {
    available = await fetchGoogleModels(input.apiKey);
  } catch {
    available = [];
  }

  const candidates = googleModelCandidates(input.preferredModel, available);
  let lastError: Error | null = null;

  for (const model of candidates) {
    try {
      const text = await callGoogle({ ...input, kind: "google", model });
      return { text, modelUsed: model };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (!isRetryableLlmError(lastError)) break;
    }
  }

  throw lastError ?? new Error("Google AI request failed on all models.");
}

function buildProviderTryOrder(
  aiConfig: AiConfig,
  agent: { llm_provider: string | null; llm_model: string | null }
): string[] {
  const configured = listConfiguredProviders(aiConfig);
  const explicit =
    agent.llm_provider && agent.llm_provider !== AUTO ? agent.llm_provider : null;
  const workspaceDefault =
    aiConfig.defaultProvider && aiConfig.defaultProvider !== AUTO
      ? aiConfig.defaultProvider
      : null;

  const order: string[] = [];
  if (explicit) order.push(explicit);
  if (workspaceDefault && !order.includes(workspaceDefault)) order.push(workspaceDefault);
  for (const ref of configured) {
    if (!order.includes(ref)) order.push(ref);
  }
  return order;
}

export async function generateDirectAgentReply(input: DirectChatInput): Promise<DirectChatResult> {
  const providersToTry = buildProviderTryOrder(input.aiConfig, input.agent);
  let lastError: Error | null = null;

  for (const providerRef of providersToTry) {
    if (!isProviderConfigured(input.aiConfig, providerRef)) continue;

    const target = resolveLlmTarget(input.aiConfig, {
      llm_provider: providerRef,
      llm_model: input.agent.llm_model,
    });
    if (!target.apiKey) continue;

    const chatBase = {
      apiKey: target.apiKey,
      baseUrl: target.baseUrl,
      systemPrompt: input.systemPrompt,
      history: input.history,
      userMessage: input.userMessage,
      temperature: input.agent.llm_temperature ?? 0.7,
      maxOutputTokens: 2048,
    };

    try {
      if (target.kind === "google") {
        const result = await generateGoogleChatWithFallback({
          ...chatBase,
          preferredModel: target.model,
        });
        return {
          reply: result.text,
          providerRef,
          providerLabel: target.providerLabel,
          model: result.modelUsed,
        };
      }

      const reply = await generateChatReply({
        kind: target.kind,
        model: target.model,
        ...chatBase,
      });
      return {
        reply,
        providerRef,
        providerLabel: target.providerLabel,
        model: target.model,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (isRetryableLlmError(lastError)) continue;
      throw lastError;
    }
  }

  if (lastError) {
    throw new Error(formatUserFacingLlmError(lastError));
  }
  throw new Error("No working AI provider is configured. Add an API key under Workspace settings → AI models.");
}

export async function generateChatReply(input: GenerateChatReplyInput): Promise<string> {
  if (input.kind === "anthropic") {
    return callAnthropic(input);
  }
  if (input.kind === "google") {
    return callGoogle(input);
  }
  return callOpenAiCompatible(input);
}

async function callAnthropic(input: GenerateChatReplyInput): Promise<string> {
  const messages = [
    ...input.history.filter((m) => m.role === "user" || m.role === "assistant"),
    { role: "user" as const, content: input.userMessage },
  ];

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": input.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: input.maxOutputTokens ?? 4096,
      system: input.systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errBody.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = data.content?.find((c) => c.type === "text")?.text?.trim();
  if (!text) throw new Error("Anthropic returned an empty response");
  return text;
}

async function callGoogle(input: GenerateChatReplyInput): Promise<string> {
  const contents = [
    ...input.history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: m.content }],
      })),
    { role: "user" as const, parts: [{ text: input.userMessage }] },
  ];

  const model = input.model.replace(/^models\//, "");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.systemPrompt }] },
      contents,
      generationConfig: {
        temperature: input.temperature ?? 0.7,
        maxOutputTokens: input.maxOutputTokens ?? 4096,
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Google AI error (${response.status}): ${errBody.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!text) throw new Error("Google AI returned an empty response");
  return text;
}

async function callOpenAiCompatible(input: GenerateChatReplyInput): Promise<string> {
  const messages = [
    { role: "system" as const, content: input.systemPrompt },
    ...input.history.filter((m) => m.role === "user" || m.role === "assistant"),
    { role: "user" as const, content: input.userMessage },
  ];

  const root = (input.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const response = await fetch(`${root}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      messages,
      temperature: input.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`LLM API error (${response.status}): ${errBody.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("LLM returned an empty response");
  return text;
}

export async function testProviderConnection(
  target: ResolvedLlmTarget,
  options?: { preferredModel?: string }
): Promise<{ reply: string; modelUsed: string }> {
  if (target.kind === "google") {
    return testGoogleConnection(target.apiKey, options?.preferredModel ?? target.model);
  }

  const reply = await generateChatReply({
    kind: target.kind,
    model: target.model,
    apiKey: target.apiKey,
    baseUrl: target.baseUrl,
    systemPrompt: "You are a connectivity test assistant. Reply with exactly: OK",
    history: [],
    userMessage: "Say OK",
    temperature: 0,
    maxOutputTokens: 16,
  });
  return { reply, modelUsed: target.model };
}

async function testGoogleConnection(
  apiKey: string,
  preferredModel?: string
): Promise<{ reply: string; modelUsed: string }> {
  const result = await generateGoogleChatWithFallback({
    apiKey,
    preferredModel: preferredModel ?? "gemini-2.0-flash-lite",
    systemPrompt: "Reply with exactly: OK",
    history: [],
    userMessage: "OK",
    temperature: 0,
    maxOutputTokens: 8,
  });
  return { reply: result.text, modelUsed: result.modelUsed };
}
