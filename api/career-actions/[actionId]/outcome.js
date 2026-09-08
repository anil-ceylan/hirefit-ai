import { handleCareerApi } from "../../../lib/vercelApi/careerApiRouter.js";

export default function handler(req, res) {
  const path = new URL(req?.url || "/", `https://${req?.headers?.host || "www.hirefit.co"}`).pathname;
  // Prefer the original encoded URL. Vercel's query parameter is already decoded
  // when only the filesystem template is available; encode it for the dispatcher.
  const route = path.startsWith("/api/career-actions/") && !path.includes("[")
    ? path
    : `/api/career-actions/${encodeURIComponent(String(req?.query?.actionId || ""))}/outcome`;
  return handleCareerApi(req, res, route);
}
