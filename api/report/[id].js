import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { id } = req.query;

  const { data } = await supabase
    .from("analyses")
    .select("role, alignment_score, missing_skills, seniority, created_at")
    .eq("id", id)
    .single();

  const appUrl = `https://hirefit-ai.vercel.app/report/${id}`;
  const score = data?.alignment_score || 0;
  const role = data?.role || "CV Analysis";
  const verdict = score >= 80 ? "Strong Match" : score >= 60 ? "Moderate Match" : "Needs Work";
  const missing = (data?.missing_skills || []).slice(0, 3).join(", ") || "None";

  const title = `${role} — ${score}/100 ${verdict} | HireFit`;
  const description = `ATS Score: ${score}/100 · ${verdict} · Missing skills: ${missing}. Analyzed with HireFit AI.`;
  const image = `https://hirefit-ai.vercel.app/og-default.png`;

  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:url" content="${appUrl}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta http-equiv="refresh" content="0;url=${appUrl}" />
</head>
<body>
  <script>window.location.href = "${appUrl}";</script>
  <p>Redirecting... <a href="${appUrl}">Click here</a></p>
</body>
</html>`);
}