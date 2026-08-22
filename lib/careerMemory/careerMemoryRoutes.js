import { requireAuthExpress, getUserFromRequest } from "../auth/verifySupabaseJwt.js";
import {
  extractCareerProfileSnapshot,
  mergeCareerProfiles,
  compareCareerMemory,
} from "./index.js";
import { loadCareerProfile, saveCareerProfile } from "./persistence.js";

export function registerCareerMemoryRoutes(app) {
  app.get("/api/career-profile", async (req, res) => {
    try {
      const auth = await getUserFromRequest(req);
      if (!auth.ok) {
        return res.status(200).json({ success: true, exists: false, profile: null, authenticated: false });
      }
      const profile = await loadCareerProfile(auth.user.id);
      if (!profile) {
        return res.status(200).json({
          exists: false,
          profile: null,
          authenticated: true,
          onboarding_completed: false,
        });
      }
      return res.status(200).json({
        exists: true,
        profile,
        authenticated: true,
        onboarding_completed: Boolean(profile?.onboarding_completed),
      });
    } catch (e) {
      console.error("[career-profile:get]", e?.message || e);
      return res.status(200).json({
        success: true,
        exists: null,
        profile: null,
        authenticated: true,
        onboarding_completed: false,
        profileFetchFailed: true,
      });
    }
  });

  app.post("/api/career-memory/sync", requireAuthExpress, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const {
        cvText = "",
        engineV2 = null,
        score = null,
        roleSuggestions = [],
        lang = "TR",
      } = req.body || {};

      const previous = await loadCareerProfile(userId);
      const snapshot = extractCareerProfileSnapshot({
        cvText,
        engineV2,
        identityEngine: null,
        atsIntelligence: engineV2?.ATS ? { displayMissingCritical: engineV2.ATS.missing_keywords } : null,
        roleSuggestions,
        score,
        lang,
      });
      const merged = mergeCareerProfiles(previous, snapshot);
      const saved = await saveCareerProfile(userId, merged);
      const comparison = compareCareerMemory(previous, snapshot, lang);

      return res.status(200).json({
        profile: saved,
        comparison,
        snapshot,
      });
    } catch (e) {
      console.error("[career-memory:sync]", e?.message || e);
      return res.status(200).json({ success: true, profile: null, comparison: null, storageUnavailable: true });
    }
  });
}
