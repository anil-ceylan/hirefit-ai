function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function splitVercelRouteParam(routeParam) {
  const values = Array.isArray(routeParam) ? routeParam : [routeParam];
  return values
    .filter((value) => value !== undefined && value !== null)
    .flatMap((value) => String(value).split("/"))
    .map((value) => safeDecode(value.trim().replace(/^\/+|\/+$/g, "")))
    .filter(Boolean);
}

export function buildApiPath(segments) {
  const cleanSegments = splitVercelRouteParam(segments);
  const withoutApiPrefix = cleanSegments[0] === "api" ? cleanSegments.slice(1) : cleanSegments;
  return `/api${withoutApiPrefix.length > 0 ? `/${withoutApiPrefix.join("/")}` : ""}`;
}

export function resolveVercelApiPath(req, fallbackSegments) {
  const urlPath = new URL(req?.url || "/", `https://${req?.headers?.host || "www.hirefit.co"}`).pathname;
  const fallbackPath = buildApiPath(fallbackSegments);

  if (urlPath.includes("[")) {
    return fallbackPath;
  }

  if (urlPath === "/api" || urlPath.startsWith("/api/")) {
    return urlPath;
  }

  if (splitVercelRouteParam(fallbackSegments).length > 0) {
    return fallbackPath;
  }

  return buildApiPath(urlPath);
}
