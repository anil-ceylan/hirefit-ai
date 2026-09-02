import { handleCareerApi } from "../lib/vercelApi/careerApiRouter.js";
import { resolveVercelApiPath, splitVercelRouteParam } from "../lib/vercelApi/routePath.js";

export function normalizeVercelApiPath(req) {
  return resolveVercelApiPath(req, splitVercelRouteParam(req?.query?.route));
}

export default function handler(req, res) {
  const path = normalizeVercelApiPath(req);
  return handleCareerApi(req, res, path);
}
