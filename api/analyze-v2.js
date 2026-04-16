import { runAnalyzeV2WithCompanyIntel } from "../lib/analyze-v2/withCompanyIntel.js";
import { getUserFromRequest } from "../lib/auth/verifySupabaseJwt.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await getUserFromRequest(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const cvText = String(body.cvText ?? body.cv ?? "").trim();
    const jobDescription = String(
      body.jobDescription ?? body.jd ?? ""
    ).trim();
    const isPro = Boolean(body.isPro);
    const sector = body.sector;
    const lang = body.lang;

    if (!cvText || !jobDescription) {
      return res.status(400).json({
        error: "Missing cvText or jobDescription",
      });
    }

    const payload = await runAnalyzeV2WithCompanyIntel({
      cvText,
      jobDescription,
      isPro,
      sector,
      lang,
    });
    return res.status(200).json(payload);
  } catch (e) {
    console.error("[api/analyze-v2]", e);
    return res.status(500).json({
      error: e?.message || "Analyze v2 failed",
    });
  }
}
