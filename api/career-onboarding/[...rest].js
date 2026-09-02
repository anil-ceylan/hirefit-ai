import { handleCareerApi } from "../../lib/vercelApi/careerApiRouter.js";
import { resolveVercelApiPath, splitVercelRouteParam } from "../../lib/vercelApi/routePath.js";

export default function handler(req, res) {
  const rest = splitVercelRouteParam(req?.query?.rest);
  return handleCareerApi(req, res, resolveVercelApiPath(req, ["career-onboarding", ...rest]));
}
