import { handleCareerApi } from "../lib/vercelApi/careerApiRouter.js";

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function splitRouteParam(routeParam) {
  const values = Array.isArray(routeParam) ? routeParam : [routeParam];
  return values
    .filter((value) => value !== undefined && value !== null)
    .flatMap((value) => String(value).split("/"))
    .map((value) => safeDecode(value.trim().replace(/^\/+|\/+$/g, "")))
    .filter(Boolean);
}

export function normalizeVercelApiPath(req) {
  const routeSegments = splitRouteParam(req?.query?.route);
  if (routeSegments.length > 0) {
    const segments = routeSegments[0] === "api" ? routeSegments.slice(1) : routeSegments;
    return `/api/${segments.join("/")}`;
  }

  const urlPath = new URL(req?.url || "/", `https://${req?.headers?.host || "www.hirefit.co"}`).pathname;
  if (urlPath === "/api" || urlPath.startsWith("/api/")) return urlPath;
  return `/api${urlPath.startsWith("/") ? urlPath : `/${urlPath}`}`;
}

export default function handler(req, res) {
  const path = normalizeVercelApiPath(req);
  return handleCareerApi(req, res, path);
}
