import { assertAdapter } from "./adapter.js";
import { validateSource } from "./registry.js";
import { readJson } from "./http.js";
import { normalizeGreenhouse } from "./normalize.js";

export function parseSnapshot(data, source, fetchedAt) {
  if (!data || !Array.isArray(data.jobs)) return { items: [], complete: false, fetchedAt, warnings: ["INVALID_SNAPSHOT"] };
  const total = data.meta?.total;
  const complete = Number.isSafeInteger(total) && total === data.jobs.length && data.jobs.length <= source.maxImportSize && !data.next && !data.links?.next;
  // Documented Greenhouse list is a single complete response. Never chase unknown
  // pagination URLs; a changed/paginated contract requires an adapter review.
  return { items: data.jobs.slice(0, source.maxImportSize), complete, fetchedAt,
    warnings: complete ? [] : ["INCOMPLETE_OR_OVERSIZED_SNAPSHOT"], upstreamCount: data.jobs.length };
}

export const greenhouseAdapter = assertAdapter({
  async fetchSnapshot(input, { transport = readJson, clock = () => new Date() } = {}) {
    const source = validateSource(input, { live: true });
    try {
      const data = await transport(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(source.board)}/jobs?content=true`, source);
      return parseSnapshot(data, source, clock().toISOString());
    } catch (error) {
      const safe = /^(?:UPSTREAM_HTTP_\d{3}|UPSTREAM_RETRY_DEFERRED|REQUEST_TIMEOUT|DNS_TIMEOUT|NETWORK_ERROR|RESPONSE_READ_FAILED|INVALID_JSON|INVALID_CONTENT_TYPE|RESPONSE_TOO_LARGE|REDIRECT_LIMIT|UNSAFE_URL_HOST|INVALID_URL|UNSAFE_DNS_DESTINATION)$/;
      return { items: [], complete: false, fetchedAt: clock().toISOString(), warnings: [safe.test(error.message) ? error.message : "FETCH_FAILED"] };
    }
  },
  normalize: normalizeGreenhouse,
});
