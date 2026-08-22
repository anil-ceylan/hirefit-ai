import { handleCareerApi } from "../lib/vercelApi/careerApiRouter.js";

export default function handler(req, res) {
  const path = new URL(req.url || "/", `https://${req.headers?.host || "www.hirefit.co"}`).pathname;
  return handleCareerApi(req, res, path);
}
