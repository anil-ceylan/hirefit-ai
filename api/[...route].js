import { handleCareerApi } from "../lib/vercelApi/careerApiRouter.js";
import { resolveVercelApiPath, splitVercelRouteParam } from "../lib/vercelApi/routePath.js";

export function normalizeVercelApiPath(req) {
  // Generic Vercel functions match one segment here, not a Next.js catch-all.
  // Only the narrow Companion rewrites use this transport alias. Query values
  // are already decoded by Vercel; encode the ID once for the shared dispatcher.
  const pathname = new URL(req?.url || "/", "https://www.hirefit.co").pathname;
  const segments = splitVercelRouteParam(req?.query?.route);
  if (pathname === "/api/career-companion" ||
      (pathname.includes("[") && segments.length === 1 && segments[0] === "career-companion")) {
    const endpoint = req?.query?.companionEndpoint;
    if (endpoint === "cases") return "/api/career-companion/cases";
    const id = req?.query?.companionCaseId;
    if (["detail", "guidance", "outcome"].includes(endpoint) && typeof id === "string" && id) {
      return `/api/career-companion/cases/${encodeURIComponent(id)}${endpoint === "detail" ? "" : `/${endpoint}`}`;
    }
  }
  return resolveVercelApiPath(req, splitVercelRouteParam(req?.query?.route));
}

export default function handler(req, res) {
  const path = normalizeVercelApiPath(req);
  return handleCareerApi(req, res, path);
}
