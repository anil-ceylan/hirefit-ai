import { JOB_SUBTYPES, USER_STATES } from "./constants.js";

export function radarError(code, status = 400) {
  return Object.assign(new Error(code), { code, status });
}

export function validateStateInput(id, body) {
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
      !body || Array.isArray(body) || typeof body !== "object" ||
      Object.keys(body).some(key => key !== "state") || !USER_STATES.includes(body.state)) {
    throw radarError("INVALID_STATE_INPUT");
  }
  return { id: id.toLowerCase(), state: body.state };
}

export function validateListQuery(query = {}) {
  const allowed = new Set(["limit", "lang", "state", "view"]);
  if (Object.keys(query).some(key => !allowed.has(key)) ||
      Object.values(query).some(value => typeof value !== "string") ||
      (query.limit !== undefined && !/^(?:[1-9]|[1-4][0-9]|50)$/.test(query.limit)) ||
      (query.lang !== undefined && !["TR", "EN"].includes(query.lang)) ||
      (query.state !== undefined && !USER_STATES.includes(query.state)) ||
      (query.view !== undefined && query.view !== "nearby") ||
      (query.view !== undefined && query.state !== undefined)) throw radarError("INVALID_QUERY");
  return { limit: Number(query.limit || 20), lang: query.lang || "TR", state: query.state || null, ...(query.view ? { view: query.view } : {}) };
}

export function safeOpportunityUrl(value) {
  try {
    const url = new URL(value);
    return typeof value === "string" && value.length <= 2048 &&
      ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

// Defense in depth: also applied after DB reads. Fixtures are never eligible,
// even if a development row is accidentally marked published/verified.
export function isVisibleJob(row, now = new Date()) {
  const at = now.getTime();
  const futureOrAbsent = value => value == null || Date.parse(value) > at;
  return row?.type === "job" && JOB_SUBTYPES.includes(row.subtype) &&
    ["employer", "job_board", "curated"].includes(row.source_type) &&
    row.published === true && row.active === true && row.verification_status === "verified" &&
    Number.isFinite(Date.parse(row.last_verified_at)) && Date.parse(row.last_verified_at) <= at &&
    Date.parse(row.expires_at) > at && futureOrAbsent(row.deadline_at) && futureOrAbsent(row.ends_at) &&
    safeOpportunityUrl(row.url);
}
