import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { publicToolCatalog } from "../services/toolCatalog.js";

const router = Router();

router.get("/catalog", authRequired, (_req, res) => {
  res.json(publicToolCatalog());
});

export default router;
