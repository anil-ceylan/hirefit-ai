import { handleCareerApi } from "./_shared/careerApiRouter.js";

export default function handler(req, res) {
  return handleCareerApi(req, res, "/api/apply-fix");
}
