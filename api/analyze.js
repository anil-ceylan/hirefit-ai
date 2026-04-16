import { runMultiAnalyze } from "../lib/analyze/index.js";
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

    if (!cvText || !jobDescription) {
      return res.status(400).json({
        error: "Missing cvText or jobDescription",
      });
    }

    const { lang } = body;
    const result = await runMultiAnalyze({ cvText, jobDescription, lang });
    return res.status(200).json(result);
  } catch (e) {
    console.error("[api/analyze]", e);
    return res.status(500).json({
      error: "An error occurred. Please try again.",
    });
  }
}
