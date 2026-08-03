import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { config } from "../config.js";
import {
  buildOauthAuthorizeUrl,
  handleOauthCallback,
  listSocialOauthProviders,
  type SocialOauthPlatform,
} from "../services/socialOauth.js";

const router = Router();

router.get("/providers", authRequired, (_req, res) => {
  res.json({ providers: listSocialOauthProviders() });
});

router.get("/:platform/start", authRequired, (req, res) => {
  const platform = String(req.params.platform) as SocialOauthPlatform;
  try {
    const url = buildOauthAuthorizeUrl(req.user!.id, platform);
    res.json({ url });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

/** Browser redirect entry — starts OAuth after auth cookie/token is not available; use start JSON from SPA. */
router.get("/:platform/callback", async (req, res) => {
  const platform = String(req.params.platform);
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const error = req.query.error as string | undefined;

  if (error || !code || !state) {
    res.redirect(
      `${config.frontendUrl}/social?oauth=error&message=${encodeURIComponent(error || "OAuth cancelled")}`
    );
    return;
  }

  try {
    const { redirectUrl } = await handleOauthCallback(platform, code, state);
    res.redirect(redirectUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth failed";
    res.redirect(`${config.frontendUrl}/social?oauth=error&message=${encodeURIComponent(message)}`);
  }
});

export default router;
