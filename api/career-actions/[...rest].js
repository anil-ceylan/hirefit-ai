import { handleCareerApi } from "../../lib/vercelApi/careerApiRouter.js";
import { resolveVercelApiPath, splitVercelRouteParam } from "../../lib/vercelApi/routePath.js";

export default function handler(req, res) {
  const rest = splitVercelRouteParam(req?.query?.rest);
  const path = resolveVercelApiPath(req, ["career-actions", ...rest]);
  // The narrow Vercel rewrite targets this single-segment function. Its query
  // value is already decoded; encode once for the shared outcome dispatcher.
  if (req?.query?.outcomeActionId != null &&
      (path === "/api/career-actions/outcome" || req?.url?.includes("["))) {
    return handleCareerApi(req, res, `/api/career-actions/${encodeURIComponent(String(req.query.outcomeActionId))}/outcome`);
  }
  return handleCareerApi(req, res, path);
}
