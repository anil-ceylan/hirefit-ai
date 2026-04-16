import { createClient } from "@supabase/supabase-js";
import { getUserFromRequest } from "../../lib/auth/verifySupabaseJwt.js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default async function handler(req, res) {
  const auth = await getUserFromRequest(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const { id } = req.query;

  const { data } = await supabase
    .from("analyses")
    .select("role, alignment_score, missing_skills, seniority, created_at")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .single();

  const rawAppUrl = `https://hirefit-ai.vercel.app/report/${id}`;
  const appUrl = escapeHtml(rawAppUrl);
  const score = data?.alignment_score || 0;
  const role = escapeHtml(data?.role || "CV Analysis");
  const verdict = escapeHtml(
    score >= 80 ? "Strong Match" : score >= 60 ? "Moderate Match" : "Needs Work"
  );
  const missing = escapeHtml(
    (data?.missing_skills || []).slice(0, 3).join(", ") || "None"
  );

  const title = escapeHtml(`${role} — ${score}/100 ${verdict} | HireFit`);
  const description = escapeHtml(
    `ATS Score: ${score}/100 - ${verdict} - Missing: ${missing}. Analyzed with HireFit AI.`
  );
  const image = escapeHtml("https://hirefit-ai.vercel.app/og-default.png");
  const appUrlJs = JSON.stringify(rawAppUrl);

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
  <script>window.location.href = ${appUrlJs};</script>
  <p>Redirecting... <a href="${appUrl}">Click here</a></p>
</body>
</html>`);
}