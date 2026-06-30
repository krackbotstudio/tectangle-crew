import {
  getWorkspaceIntegrationSecrets,
  type IntegrationCredentials,
} from "../workspaceIntegrations.js";
import type { IntegrationContext } from "./types.js";

export async function loadIntegrationContext(
  toolSlug: string
): Promise<IntegrationContext | null> {
  const secrets = await getWorkspaceIntegrationSecrets(toolSlug);
  if (!secrets) return null;

  return {
    toolSlug,
    credentials: secrets.credentials,
    config: secrets.config,
  };
}

export function requireApiKey(credentials: IntegrationCredentials, label = "API key"): string {
  const key = credentials.apiKey?.trim() || credentials.accessToken?.trim();
  if (!key) throw new Error(`${label} is required. Add it in App Store and verify the connection.`);
  return key;
}
