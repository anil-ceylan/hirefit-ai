/**
 * Read-only source adapter contract. No database dependency is permitted here.
 * fetchSnapshot(source, { transport?, clock? }) -> Promise<{
 *   items: unknown[], complete: boolean, fetchedAt: string, warnings: string[]
 * }>. Complete means all upstream records were retrieved, not just HTTP 200.
 * normalize(item, source) -> { candidate: object|null, evidence: object[], issues: string[], reviewFacts?: object }.
 * reviewFacts is retained even for rejected items, including bounded identity,
 * locations and source-attributed requirement/date excerpts for review only;
 * it is not part of the catalog candidate or the public Opportunity Radar API.
 * Candidates are NOT approved for publication. The planner owns eligibility.
 */
export function assertAdapter(adapter) {
  if (typeof adapter?.fetchSnapshot !== "function" || typeof adapter?.normalize !== "function") throw new Error("INVALID_ADAPTER");
  return adapter;
}
