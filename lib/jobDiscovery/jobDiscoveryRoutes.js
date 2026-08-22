import { getUserFromRequest } from "../auth/verifySupabaseJwt.js";
import { loadCareerProfile } from "../careerMemory/persistence.js";
import { recommendJobs } from "./index.js";

export function registerJobDiscoveryRoutes(app) {
  app.post("/api/job-discovery/recommendations", async (req, res) => {
    try {
      const { cvText = "", lang = "TR", limit = 5, skippedIds = [], careerProfile = null } = req.body || {};
      let profile = careerProfile;
      const auth = await getUserFromRequest(req);
      if (auth.ok && !profile) {
        try {
          profile = await loadCareerProfile(auth.user.id);
        } catch {
          profile = null;
        }
      }
      const result = recommendJobs({
        cvText,
        careerProfile: profile,
        lang,
        limit,
        skippedIds,
      });
      return res.status(200).json(result);
    } catch (e) {
      console.error("[job-discovery]", e?.message || e);
      return res.status(500).json({ error: "Failed to load job recommendations" });
    }
  });
}
