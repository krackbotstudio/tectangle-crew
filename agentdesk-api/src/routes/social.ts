import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { routeParam } from "../utils/routeParam.js";
import {
  createSocialAccount,
  deleteSocialAccount,
  listSocialAccounts,
  updateSocialAccount,
} from "../services/socialAccounts.js";
import {
  createSocialPost,
  listSocialPosts,
  publishSocialPostById,
  scheduleSocialPostById,
} from "../services/socialPosts.js";
import { SOCIAL_PLATFORMS } from "../services/imageGeneration.js";
import { PLATFORM_INTEGRATION } from "../services/socialPublisher.js";
import { getWorkspaceIntegrationBySlug } from "../services/workspaceIntegrations.js";

const router = Router();

router.get("/platforms", authRequired, async (_req, res) => {
  const platforms = await Promise.all(
    SOCIAL_PLATFORMS.map(async (p) => {
      const integrationSlugs = PLATFORM_INTEGRATION[p.id] ?? [p.id];
      let connected = false;
      for (const slug of integrationSlugs) {
        const integration = await getWorkspaceIntegrationBySlug(slug);
        if (integration?.status === "connected") {
          connected = true;
          break;
        }
      }
      return {
        id: p.id,
        label: p.label,
        integrationSlugs,
        workspaceConnected: connected,
      };
    })
  );
  res.json({ platforms });
});

router.get("/accounts", authRequired, async (req, res) => {
  const accounts = await listSocialAccounts(req.user!.id);
  res.json({ accounts });
});

router.post("/accounts", authRequired, async (req, res) => {
  const { platform, handle, displayName, profileUrl, integrationSlug, config } = req.body as {
    platform?: string;
    handle?: string;
    displayName?: string;
    profileUrl?: string;
    integrationSlug?: string;
    config?: Record<string, unknown>;
  };

  if (!platform || !handle?.trim()) {
    res.status(400).json({ error: "platform and handle are required" });
    return;
  }

  try {
    const account = await createSocialAccount(req.user!.id, {
      platform,
      handle,
      displayName,
      profileUrl,
      integrationSlug,
      config,
    });
    res.status(201).json({ account });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") {
      res.status(409).json({ error: "This handle is already connected for that platform" });
      return;
    }
    throw error;
  }
});

router.patch("/accounts/:id", authRequired, async (req, res) => {
  const account = await updateSocialAccount(req.user!.id, routeParam(req.params.id), req.body);
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  res.json({ account });
});

router.delete("/accounts/:id", authRequired, async (req, res) => {
  await deleteSocialAccount(req.user!.id, routeParam(req.params.id));
  res.json({ deleted: true });
});

router.get("/posts", authRequired, async (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const posts = await listSocialPosts(req.user!.id, projectId);
  res.json({ posts });
});

router.post("/posts", authRequired, async (req, res) => {
  const {
    platform,
    content,
    projectId,
    agentId,
    creativeId,
    handle,
    socialAccountId,
    scheduledAt,
    publishNow,
  } = req.body as {
    platform?: string;
    content?: string;
    projectId?: string;
    agentId?: string;
    creativeId?: string;
    handle?: string;
    socialAccountId?: string;
    scheduledAt?: string;
    publishNow?: boolean;
  };

  if (!platform || !content?.trim()) {
    res.status(400).json({ error: "platform and content are required" });
    return;
  }

  const result = await createSocialPost(req.user!.id, {
    platform,
    content: content.trim(),
    projectId,
    agentId,
    creativeId,
    handle,
    socialAccountId,
    scheduledAt,
    publishNow,
  });

  res.status(201).json(result);
});

router.post("/posts/:id/publish", authRequired, async (req, res) => {
  const result = await publishSocialPostById(req.user!.id, routeParam(req.params.id));
  if (!result) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.json(result);
});

router.post("/posts/:id/schedule", authRequired, async (req, res) => {
  const { scheduledAt } = req.body as { scheduledAt?: string };
  if (!scheduledAt) {
    res.status(400).json({ error: "scheduledAt is required" });
    return;
  }
  const result = await scheduleSocialPostById(req.user!.id, routeParam(req.params.id), scheduledAt);
  if (!result) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.json(result);
});

export default router;
