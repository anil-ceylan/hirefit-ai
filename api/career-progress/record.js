import { handleCareerApi } from "../../lib/vercelApi/careerApiRouter.js";
import { resolveVercelApiPath } from "../../lib/vercelApi/routePath.js";

export default function handler(req, res) {
  return handleCareerApi(req, res, resolveVercelApiPath(req, ["career-progress", "record"]));
}
