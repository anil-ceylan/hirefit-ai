import { requireAuthExpress, getUserFromRequest } from "../auth/verifySupabaseJwt.js";
import { buildCareerGrowthView, recordSnapshotPayload } from "./index.js";
import { insertCareerProgress, listCareerProgress } from "./persistence.js";

export function registerCareerProgressRoutes(app) {
  app.get("/api/career-progress", async (req, res) => {
    try {
      const auth = await getUserFromRequest(req);
      if (!auth.ok) {
        return res.status(200).json({
          success: true,
          items: [],
          snapshots: [],
          growth: null,
          authenticated: false,
        });
      }
      const limit = Math.min(48, Math.max(1, Number(req.query?.limit) || 24));
      const snapshots = await listCareerProgress(auth.user.id, limit);
      const growth = buildCareerGrowthView({
        snapshots,
        current: snapshots[0] || null,
        lang: req.query?.lang === "en" ? "EN" : "TR",
      });
      return res.status(200).json({
        success: true,
        items: snapshots,
        snapshots,
        growth,
        authenticated: true,
      });
    } catch (e) {
      console.error("[career-progress:get]", e?.message || e);
      return res.status(200).json({
        success: true,
        items: [],
        snapshots: [],
        growth: null,
        authenticated: true,
      });
    }
  });

  app.post("/api/career-progress/record", requireAuthExpress, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const { engineV2, score, cvText, role, lang, analysis_id } = req.body || {};
      const existing = await listCareerProgress(userId, 1);
      const previous = existing[0] || null;
      const payload = recordSnapshotPayload({
        engineV2,
        score,
        cvText,
        role,
        lang,
        previous,
        analysis_id,
      });
      const saved = await insertCareerProgress(userId, payload);
      const snapshots = await listCareerProgress(userId, 24);
      const growth = buildCareerGrowthView({
        snapshots,
        current: saved,
        lang,
      });
      return res.status(200).json({ snapshot: saved, snapshots, growth });
    } catch (e) {
      console.error("[career-progress:record]", e?.message || e);
      return res.status(200).json({
        success: true,
        snapshot: null,
        snapshots: [],
        growth: null,
        storageUnavailable: true,
      });
    }
  });
}
