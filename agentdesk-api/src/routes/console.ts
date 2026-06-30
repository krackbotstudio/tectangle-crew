import { Router } from "express";
import { authRequired, adminRequired } from "../middleware/auth.js";
import { publicToolCatalog } from "../services/toolCatalog.js";
import { verifyIntegration } from "../services/integrations/index.js";
import {
  createMcpConnector,
  deleteMcpConnector,
  deleteWorkspaceIntegration,
  listMcpConnectors,
  listWorkspaceIntegrations,
  markIntegrationTested,
  updateMcpConnector,
  upsertWorkspaceIntegration,
} from "../services/workspaceIntegrations.js";

const router = Router();

router.get("/", authRequired, async (_req, res) => {
  const catalog = publicToolCatalog();
  const integrations = await listWorkspaceIntegrations();
  const mcpConnectors = await listMcpConnectors();
  const integrationMap = new Map(integrations.map((i) => [i.toolSlug, i]));

  const library = catalog.tools.map((tool) => ({
    ...tool,
    integration: integrationMap.get(tool.slug) ?? null,
  }));

  res.json({
    catalog: { categories: catalog.categories, stacks: catalog.stacks },
    library,
    integrations,
    mcpConnectors,
    stats: {
      catalogCount: catalog.tools.length,
      configuredCount: integrations.filter((i) => i.status !== "not_configured").length,
      connectedCount: integrations.filter((i) => i.status === "connected").length,
      mcpCount: mcpConnectors.length,
    },
  });
});

router.put("/integrations/:toolSlug", authRequired, adminRequired, async (req, res) => {
  const toolSlug = String(req.params.toolSlug);
  try {
    const integration = await upsertWorkspaceIntegration(toolSlug, {
      connectionType: req.body.connectionType,
      status: req.body.status,
      accountLabel: req.body.accountLabel,
      config: req.body.config,
      credentials: req.body.credentials,
      notes: req.body.notes,
      configuredBy: req.user!.id,
    });
    res.json({ integration });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.delete("/integrations/:toolSlug", authRequired, adminRequired, async (req, res) => {
  const deleted = await deleteWorkspaceIntegration(String(req.params.toolSlug));
  res.json({ deleted });
});

router.post("/integrations/:toolSlug/test", authRequired, adminRequired, async (req, res) => {
  const toolSlug = String(req.params.toolSlug);
  try {
    const result = await verifyIntegration(toolSlug);
    await markIntegrationTested(toolSlug, result.ok, result.ok ? undefined : result.message);
    if (!result.ok) {
      res.status(400).json({ ok: false, error: result.message });
      return;
    }
    if (result.accountLabel) {
      await upsertWorkspaceIntegration(toolSlug, {
        accountLabel: result.accountLabel,
        status: "connected",
      });
    }
    res.json({ ok: true, message: result.message });
  } catch (error) {
    await markIntegrationTested(toolSlug, false, (error as Error).message);
    res.status(400).json({ ok: false, error: (error as Error).message });
  }
});

router.post("/mcp-connectors", authRequired, adminRequired, async (req, res) => {
  try {
    const connector = await createMcpConnector({
      name: req.body.name,
      description: req.body.description,
      transport: req.body.transport,
      serverUrl: req.body.serverUrl,
      command: req.body.command,
      args: req.body.args,
      envKeys: req.body.envKeys,
      credentials: req.body.credentials,
      status: req.body.status,
      notes: req.body.notes,
      configuredBy: req.user!.id,
    });
    res.json({ connector });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.patch("/mcp-connectors/:id", authRequired, adminRequired, async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const connector = await updateMcpConnector(id, {
    name: req.body.name,
    description: req.body.description,
    transport: req.body.transport,
    serverUrl: req.body.serverUrl,
    command: req.body.command,
    args: req.body.args,
    envKeys: req.body.envKeys,
    credentials: req.body.credentials,
    status: req.body.status,
    notes: req.body.notes,
    configuredBy: req.user!.id,
  });
  if (!connector) {
    res.status(404).json({ error: "MCP connector not found" });
    return;
  }
  res.json({ connector });
});

router.delete("/mcp-connectors/:id", authRequired, adminRequired, async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const deleted = await deleteMcpConnector(id);
  res.json({ deleted });
});

export default router;
