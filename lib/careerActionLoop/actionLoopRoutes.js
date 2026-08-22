import { requireAuthExpress } from "../auth/verifySupabaseJwt.js";
import {
  completeCareerAction,
  getCareerActionOutcome,
  getCurrentCareerAction,
  startCareerAction,
  upsertCareerActionOutcome,
  upsertRecommendedCareerAction,
} from "./persistence.js";

function safeActionResponse(res, payload = {}) {
  return res.status(200).json({ success: true, ...payload });
}

export function registerCareerActionLoopRoutes(app) {
  app.get("/api/career-actions/current", requireAuthExpress, async (req, res) => {
    try {
      const result = await getCurrentCareerAction(req.authUser.id, {
        actionId: req.query?.action_id || "",
        weekKey: req.query?.week_key || "",
      });
      return safeActionResponse(res, result);
    } catch (error) {
      console.error("[career-action-loop:current]", error?.message || error);
      return safeActionResponse(res, { action: null, storageUnavailable: true });
    }
  });

  app.post("/api/career-actions/recommended", requireAuthExpress, async (req, res) => {
    try {
      const result = await upsertRecommendedCareerAction(req.authUser.id, req.body?.action || req.body || {});
      return safeActionResponse(res, result);
    } catch (error) {
      console.error("[career-action-loop:recommended]", error?.message || error);
      return safeActionResponse(res, { action: null, storageUnavailable: true });
    }
  });

  app.post("/api/career-actions/start", requireAuthExpress, async (req, res) => {
    try {
      const actionId = String(req.body?.action_id || req.body?.actionId || "").trim();
      if (!actionId) return safeActionResponse(res, { action: null, invalidRequest: true });
      const result = await startCareerAction(req.authUser.id, actionId);
      return safeActionResponse(res, result);
    } catch (error) {
      console.error("[career-action-loop:start]", error?.message || error);
      return safeActionResponse(res, { action: null, storageUnavailable: true });
    }
  });

  app.post("/api/career-actions/complete", requireAuthExpress, async (req, res) => {
    try {
      const actionId = String(req.body?.action_id || req.body?.actionId || "").trim();
      if (!actionId) return safeActionResponse(res, { action: null, invalidRequest: true });
      const result = await completeCareerAction(req.authUser.id, actionId);
      return safeActionResponse(res, result);
    } catch (error) {
      console.error("[career-action-loop:complete]", error?.message || error);
      return safeActionResponse(res, { action: null, storageUnavailable: true });
    }
  });

  app.get("/api/career-actions/:actionId/outcome", requireAuthExpress, async (req, res) => {
    try {
      const actionId = String(req.params?.actionId || "").trim();
      if (!actionId) return safeActionResponse(res, { outcome: null, invalidRequest: true });
      const result = await getCareerActionOutcome(req.authUser.id, actionId);
      return safeActionResponse(res, result);
    } catch (error) {
      console.error("[career-action-loop:outcome:get]", error?.message || error);
      return safeActionResponse(res, { outcome: null, storageUnavailable: true });
    }
  });

  app.post("/api/career-actions/:actionId/outcome", requireAuthExpress, async (req, res) => {
    try {
      const actionId = String(req.params?.actionId || "").trim();
      if (!actionId) return safeActionResponse(res, { outcome: null, invalidRequest: true });
      const result = await upsertCareerActionOutcome(req.authUser.id, actionId, req.body?.outcome || req.body || {});
      return safeActionResponse(res, result);
    } catch (error) {
      console.error("[career-action-loop:outcome:save]", error?.message || error);
      return safeActionResponse(res, { outcome: null, storageUnavailable: true });
    }
  });
}
