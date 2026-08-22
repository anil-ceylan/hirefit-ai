import { requireAuthExpress } from "../auth/verifySupabaseJwt.js";
import { loadFullCareerProfile } from "../careerOnboarding/persistence.js";
import { buildCareerIntelligence } from "./buildIntelligence.js";

export function registerCareerIntelligenceRoutes(app) {
  app.get("/api/career-intelligence", requireAuthExpress, async (req, res) => {
    try {
      const profile = await loadFullCareerProfile(req.authUser.id);
      if (!profile) return res.status(200).json({ intelligence: null });
      const lang = req.query?.lang === "en" ? "EN" : "TR";
      const intelligence = buildCareerIntelligence(profile, {
        hasCv: Boolean(profile.career_readiness?.hasCv),
        readinessAnswers: null,
        lang,
      });
      return res.status(200).json({ intelligence, profile });
    } catch (e) {
      console.error("[career-intelligence:get]", e?.message || e);
      return res.status(500).json({ error: "Failed to load career intelligence" });
    }
  });
}
