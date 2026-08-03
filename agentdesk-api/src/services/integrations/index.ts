import type { IntegrationAdapter, ToolActionInput, ToolActionResult, VerifyResult } from "./types.js";
import { loadIntegrationContext } from "./credentials.js";
import { notionAdapter } from "./notion.js";
import { googleSheetsAdapter } from "./googleSheets.js";
import { googleDocsAdapter } from "./googleDocs.js";
import { slackAdapter } from "./slack.js";
import { bufferAdapter } from "./buffer.js";
import {
  facebookAdapter,
  instagramAdapter,
  linkedinAdapter,
  metaBusinessAdapter,
  tiktokAdapter,
  xTwitterAdapter,
} from "./socialAdapters.js";
import { getCatalogTool } from "../toolCatalog.js";

const ADAPTERS: IntegrationAdapter[] = [
  notionAdapter,
  googleSheetsAdapter,
  googleDocsAdapter,
  slackAdapter,
  bufferAdapter,
  metaBusinessAdapter,
  facebookAdapter,
  instagramAdapter,
  linkedinAdapter,
  xTwitterAdapter,
  tiktokAdapter,
];

const adapterBySlug = new Map(ADAPTERS.map((a) => [a.toolSlug, a]));

export function getIntegrationAdapter(toolSlug: string): IntegrationAdapter | undefined {
  return adapterBySlug.get(toolSlug);
}

export function hasLiveIntegration(toolSlug: string): boolean {
  return adapterBySlug.has(toolSlug);
}

export async function verifyIntegration(toolSlug: string): Promise<VerifyResult> {
  const adapter = getIntegrationAdapter(toolSlug);
  if (!adapter) {
    const catalog = getCatalogTool(toolSlug);
    if (!catalog) {
      return { ok: false, message: "Unknown integration." };
    }
    return {
      ok: false,
      message: `${catalog.name} does not have a live API adapter yet. OAuth support is coming in a later release.`,
    };
  }

  const ctx = await loadIntegrationContext(toolSlug);
  if (!ctx) {
    return { ok: false, message: "Integration not configured. Save credentials first." };
  }

  const hasCreds = Object.values(ctx.credentials).some((v) => !!v?.trim());
  if (!hasCreds) {
    return { ok: false, message: "No credentials saved. Add your API key or token and save." };
  }

  try {
    return await adapter.verify(ctx);
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

export async function executeIntegrationTool(
  toolSlug: string,
  input: ToolActionInput,
  configOverride?: Record<string, string>
): Promise<ToolActionResult> {
  const adapter = getIntegrationAdapter(toolSlug);
  if (!adapter) {
    return {
      ok: false,
      message: `${toolSlug} is not connected to a live API yet. Configure it in App Store when an adapter is available.`,
    };
  }

  const ctx = await loadIntegrationContext(toolSlug);
  if (!ctx) {
    return {
      ok: false,
      message: `${toolSlug} is not configured at workspace level. An admin must add credentials in App Store.`,
    };
  }

  const mergedConfig = { ...Object.fromEntries(Object.entries(ctx.config).map(([k, v]) => [k, String(v)])), ...input.config };
  try {
    return await adapter.execute(ctx, { ...input, config: mergedConfig });
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

export { ADAPTERS };
