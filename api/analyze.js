import { runMultiAnalyze } from "../lib/analyze/index.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
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
      error: e?.message || "Analysis failed",
    });
  }
}
