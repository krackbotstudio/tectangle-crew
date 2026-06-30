import { Router } from "express";
import { authRequired, adminRequired } from "../middleware/auth.js";
import {
  AUTO,
  discoverModelsForProvider,
  loadAiConfig,
  publicAiConfig,
  removeCustomProvider,
  resolveLlmTarget,
  resolveProviderApiKey,
  saveAiConfig,
  storeProviderApiKey,
  upsertCustomProviders,
  type AiConfig,
  type BuiltinProviderId,
  type ProviderRef,
} from "../services/aiSettings.js";
import { testProviderConnection } from "../services/llmClient.js";

const router = Router();

const BUILTIN_IDS: BuiltinProviderId[] = ["anthropic", "openai", "google"];

type ProviderPatch = {
  enabled?: boolean;
  apiKey?: string | null;
  defaultModel?: string;
};

async function applyBuiltinProviderPatches(
  configData: AiConfig,
  providers?: {
    anthropic?: ProviderPatch;
    openai?: ProviderPatch;
    google?: ProviderPatch;
  }
): Promise<AiConfig> {
  if (!providers) return configData;

  let config = configData;

  for (const id of BUILTIN_IDS) {
    const patch = providers[id];
    if (!patch) continue;

    const hasKeyUpdate = patch.apiKey !== undefined;
    const hasMetaUpdate =
      patch.defaultModel !== undefined ||
      (patch.enabled !== undefined && !hasKeyUpdate);

    if (hasKeyUpdate) {
      config = await storeProviderApiKey(
        id,
        patch.apiKey?.trim() ? patch.apiKey.trim() : patch.apiKey,
        {
          enabled: patch.enabled,
          defaultModel: patch.defaultModel,
        }
      );
    } else if (hasMetaUpdate) {
      config = await saveAiConfig({
        providers: {
          [id]: {
            ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
            ...(patch.defaultModel !== undefined ? { defaultModel: patch.defaultModel } : {}),
          },
        },
      });
    }
  }

  return config;
}

router.get("/ai", authRequired, adminRequired, async (_req, res) => {
  const configData = await loadAiConfig();
  res.json(publicAiConfig(configData));
});

router.patch("/ai", authRequired, adminRequired, async (req, res) => {
  const body = req.body as {
    defaultProvider?: string;
    defaultModel?: string;
    providers?: {
      anthropic?: ProviderPatch;
      openai?: ProviderPatch;
      google?: ProviderPatch;
    };
    customProviders?: Array<{
      id?: string;
      name?: string;
      baseUrl?: string;
      enabled?: boolean;
      apiKey?: string | null;
      clearApiKey?: boolean;
      defaultModel?: string;
    }>;
    removeCustomProviderIds?: string[];
  };

  let configData = await loadAiConfig();
  configData = await applyBuiltinProviderPatches(configData, body.providers);

  if (body.customProviders?.length) {
    configData = await upsertCustomProviders(body.customProviders);
  }

  if (body.removeCustomProviderIds?.length) {
    for (const id of body.removeCustomProviderIds) {
      configData = await removeCustomProvider(id);
    }
  }

  configData = await saveAiConfig({
    defaultProvider: body.defaultProvider as ProviderRef | undefined,
    defaultModel: body.defaultModel,
  });

  res.json(publicAiConfig(configData));
});

router.post("/ai/test", authRequired, adminRequired, async (req, res) => {
  const { provider, model, apiKey } = req.body as {
    provider?: string;
    model?: string;
    apiKey?: string;
  };

  if (!provider) {
    res.status(400).json({ error: "Provider is required" });
    return;
  }

  const configData = await loadAiConfig();
  const resolvedKey = resolveProviderApiKey(configData, provider, apiKey);
  if (!resolvedKey) {
    res.status(400).json({ error: "No API key configured. Save your API key first." });
    return;
  }

  const target = resolveLlmTarget(configData, {
    llm_provider: provider,
    llm_model: model && model !== AUTO ? model : null,
  });

  try {
    const preferred = model && model !== AUTO ? model : undefined;
    const result = await testProviderConnection(
      {
        ...target,
        apiKey: resolvedKey,
        model: preferred ?? target.model,
      },
      { preferredModel: preferred }
    );
    res.json({
      ok: true,
      reply: result.reply,
      provider,
      model: result.modelUsed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection test failed";
    res.status(502).json({ ok: false, error: message });
  }
});

router.post("/ai/discover-models", authRequired, adminRequired, async (req, res) => {
  const { provider, apiKey } = req.body as { provider?: string; apiKey?: string };
  if (!provider) {
    res.status(400).json({ error: "Provider is required" });
    return;
  }

  try {
    const configData = await loadAiConfig();
    const models = await discoverModelsForProvider(configData, provider, apiKey);
    const refreshed = await loadAiConfig();
    res.json({ models, settings: publicAiConfig(refreshed) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Model discovery failed";
    res.status(502).json({ error: message });
  }
});

export default router;
