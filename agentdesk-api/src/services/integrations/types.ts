import type { IntegrationCredentials } from "../workspaceIntegrations.js";

export interface IntegrationContext {
  toolSlug: string;
  credentials: IntegrationCredentials;
  config: Record<string, unknown>;
}

export interface VerifyResult {
  ok: boolean;
  message: string;
  accountLabel?: string;
}

export interface ToolActionInput {
  action: "fetch" | "write" | "create";
  config: Record<string, string>;
  content?: string;
}

export interface ToolActionResult {
  ok: boolean;
  message: string;
  data?: string;
}

export interface IntegrationAdapter {
  toolSlug: string;
  verify(ctx: IntegrationContext): Promise<VerifyResult>;
  execute(ctx: IntegrationContext, input: ToolActionInput): Promise<ToolActionResult>;
}
