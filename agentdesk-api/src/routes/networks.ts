import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { routeParam } from "../utils/routeParam.js";
import { listNetworkCommunities } from "../services/networkCatalog.js";
import { getGtmProfile, upsertGtmProfile, formatGtmBrief } from "../services/networkGtm.js";
import { generateCollateralPack, recommendCommunities } from "../services/networkAi.js";
import {
  createCampaignWithJobs,
  getCampaign,
  listCampaignJobs,
  listCampaigns,
  listMemberships,
  publishOwnedJob,
  updateJobStatus,
  upsertMembership,
} from "../services/networkCampaigns.js";
import { generateNetworkCreatives, type CreativeMode } from "../services/networkCreatives.js";
import type { CollateralPack } from "../services/networkAi.js";

const router = Router();

router.get("/communities", authRequired, async (req, res) => {
  const communities = await listNetworkCommunities({
    platform: req.query.platform as string | undefined,
    q: req.query.q as string | undefined,
  });
  res.json({ communities });
});

router.get("/profile", authRequired, async (req, res) => {
  const projectId = (req.query.projectId as string | undefined) || null;
  const profile = await getGtmProfile(req.user!.id, projectId);
  res.json({ profile });
});

router.put("/profile", authRequired, async (req, res) => {
  const profile = await upsertGtmProfile(req.user!.id, {
    projectId: req.body.projectId,
    productName: req.body.productName,
    productType: req.body.productType,
    industry: req.body.industry,
    icp: req.body.icp,
    offer: req.body.offer,
    stage: req.body.stage,
    goals: req.body.goals,
    interests: req.body.interests,
    brandVoice: req.body.brandVoice,
    geography: req.body.geography,
    notes: req.body.notes,
  });
  res.json({ profile });
});

router.post("/recommend", authRequired, async (req, res) => {
  let profile = await getGtmProfile(req.user!.id, req.body.projectId);
  if (!profile && req.body.productName) {
    profile = await upsertGtmProfile(req.user!.id, req.body);
  }
  if (!profile) {
    res.status(400).json({ error: "Save a GTM profile first (product, industry, ICP)." });
    return;
  }
  const recommendations = await recommendCommunities(profile, req.body.limit ?? 12);
  // Persist as suggested memberships
  for (const item of recommendations.slice(0, 8)) {
    await upsertMembership(req.user!.id, item.community.id, {
      status: "suggested",
      fitScore: item.score,
      fitReason: item.reasons.join("; "),
    });
  }
  res.json({
    profile,
    recommendations: recommendations.map((r) => ({
      ...r.community,
      fitScore: r.score,
      fitReasons: r.reasons,
    })),
  });
});

router.get("/memberships", authRequired, async (req, res) => {
  const memberships = await listMemberships(req.user!.id);
  res.json({ memberships });
});

router.post("/memberships", authRequired, async (req, res) => {
  const { communityId, status, fitScore, fitReason } = req.body as {
    communityId?: string;
    status?: string;
    fitScore?: number;
    fitReason?: string;
  };
  if (!communityId || !status) {
    res.status(400).json({ error: "communityId and status are required" });
    return;
  }
  const membership = await upsertMembership(req.user!.id, communityId, {
    status,
    fitScore,
    fitReason,
  });
  res.json({ membership });
});

router.post("/collateral", authRequired, async (req, res) => {
  const profile = await getGtmProfile(req.user!.id, req.body.projectId);
  if (!profile) {
    res.status(400).json({ error: "Save a GTM profile first." });
    return;
  }
  const collateral = await generateCollateralPack(profile);
  res.json({ collateral, brief: formatGtmBrief(profile) });
});

router.post("/creatives", authRequired, async (req, res) => {
  const {
    mode,
    communityIds,
    projectId,
    collateral,
  } = req.body as {
    mode?: CreativeMode;
    communityIds?: string[];
    projectId?: string;
    collateral?: CollateralPack;
  };

  if (!mode || (mode !== "shared" && mode !== "individual")) {
    res.status(400).json({ error: "mode must be 'shared' or 'individual'" });
    return;
  }
  if (!communityIds?.length) {
    res.status(400).json({ error: "communityIds are required" });
    return;
  }

  try {
    let pack = collateral;
    if (!pack) {
      const profile = await getGtmProfile(req.user!.id, projectId);
      if (!profile) {
        res.status(400).json({ error: "Save a GTM profile first." });
        return;
      }
      pack = await generateCollateralPack(profile);
    }

    const result = await generateNetworkCreatives({
      userId: req.user!.id,
      projectId,
      mode,
      communityIds,
      collateral: pack,
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get("/campaigns", authRequired, async (req, res) => {
  const campaigns = await listCampaigns(req.user!.id);
  res.json({ campaigns });
});

router.get("/campaigns/:id", authRequired, async (req, res) => {
  const campaign = await getCampaign(req.user!.id, routeParam(req.params.id));
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  const jobs = await listCampaignJobs(req.user!.id, campaign.id);
  res.json({ campaign, jobs });
});

router.post("/campaigns", authRequired, async (req, res) => {
  const {
    title,
    goal,
    projectId,
    communityIds,
    publishOwnedNow,
    collateral: collateralInput,
    creativeMode,
    sharedCreativeId,
    creatives,
  } = req.body as {
    title?: string;
    goal?: string;
    projectId?: string;
    communityIds?: string[];
    publishOwnedNow?: boolean;
    collateral?: CollateralPack;
    creativeMode?: CreativeMode | "none";
    sharedCreativeId?: string | null;
    creatives?: { communityId?: string | null; creativeId: string }[];
  };

  if (!title?.trim() || !communityIds?.length) {
    res.status(400).json({ error: "title and communityIds are required" });
    return;
  }

  const profile = await getGtmProfile(req.user!.id, projectId);
  if (!profile) {
    res.status(400).json({ error: "Save a GTM profile before launching a campaign." });
    return;
  }

  const collateral = collateralInput ?? (await generateCollateralPack(profile));
  const result = await createCampaignWithJobs({
    userId: req.user!.id,
    projectId,
    gtmProfileId: profile.id,
    title: title.trim(),
    goal: goal || profile.goals[0],
    brief: formatGtmBrief(profile),
    communityIds,
    collateral,
    publishOwnedNow: Boolean(publishOwnedNow),
    creativeMode: creativeMode ?? "none",
    sharedCreativeId,
    creatives,
  });

  res.status(201).json(result);
});

router.post("/jobs/:id/status", authRequired, async (req, res) => {
  const job = await updateJobStatus(req.user!.id, routeParam(req.params.id), {
    status: req.body.status,
    outcome: req.body.outcome,
    notes: req.body.notes,
  });
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({ job });
});

router.post("/jobs/:id/publish", authRequired, async (req, res) => {
  try {
    const result = await publishOwnedJob(req.user!.id, routeParam(req.params.id));
    if (!result) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

export default router;
