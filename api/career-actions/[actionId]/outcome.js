import { handleCareerApi } from "../../_shared/careerApiRouter.js";

export default function handler(req, res) {
  const actionId = req.query?.actionId || "";
  return handleCareerApi(req, res, `/api/career-actions/${encodeURIComponent(actionId)}/outcome`);
}
