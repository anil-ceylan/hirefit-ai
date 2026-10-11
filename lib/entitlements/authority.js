import { createHash, randomUUID } from "node:crypto";
import { getUserFromRequest } from "../auth/verifySupabaseJwt.js";
import { getServiceClient, loadCareerProfile } from "../careerMemory/persistence.js";
import { runAnalyzeV2WithCompanyIntel } from "../analyze-v2/withCompanyIntel.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const errorResult = (status, error) => ({ status, body: { success: false, error } });
export const ANALYSIS_TIMEOUT_MS = 5 * 60 * 1000;
const publicErrors = new Set(["ENTITLEMENT_REVIEW_REQUIRED", "ANALYSIS_IN_PROGRESS", "ANALYSIS_ALREADY_COMPLETED",
  "ANALYSIS_REQUEST_EXPIRED", "ANALYSIS_REQUEST_RELEASED", "IDEMPOTENCY_CONFLICT"]);

function failure(error) {
  const code = publicErrors.has(error?.message) ? error.message : "ENTITLEMENT_UNAVAILABLE";
  return errorResult(code === "ENTITLEMENT_UNAVAILABLE" || code === "ENTITLEMENT_REVIEW_REQUIRED" ? 503 : 409, code);
}

// Server-only module. A verified auth result, never req.body/req.authUser, owns identity.
// RPC uses SECURITY INVOKER and is callable only by the server service role.
export function createEntitlementAuthority({
  verify = getUserFromRequest,
  getClient = getServiceClient,
  analyze = runAnalyzeV2WithCompanyIntel,
  loadMemory = loadCareerProfile,
  newRequestId = randomUUID,
  adminEmail = () => process.env.ADMIN_EMAIL || "",
  timeoutMs = ANALYSIS_TIMEOUT_MS,
} = {}) {
  async function identity(req) {
    const auth = await verify(req);
    if (!auth?.ok && auth?.status >= 500) throw new Error("ENTITLEMENT_UNAVAILABLE");
    if (!auth?.ok || !uuid.test(auth?.user?.id || "")) return null;
    return auth.user;
  }

  async function operation(user, action, requestId = null, kind = "normal", inputHash = null, reason = null) {
    const client = getClient();
    if (!client) throw new Error("ENTITLEMENT_UNAVAILABLE");
    const configuredAdmin = String(adminEmail()).trim().toLowerCase();
    const isAdmin = Boolean(configuredAdmin && user.email_confirmed_at &&
      String(user.email || "").trim().toLowerCase() === configuredAdmin);
    const { data, error } = await client.rpc("hirefit_analysis_entitlement", {
      p_user_id: user.id,
      p_action: action,
      p_request_id: requestId,
      p_is_admin: isAdmin,
      p_kind: kind,
      p_input_hash: inputHash,
      p_reason: reason,
    });
    // Never return database error text, input or service credentials to clients/logs.
    if (!error && publicErrors.has(data?.error)) throw new Error(data.error);
    if (error || !data || typeof data.is_pro !== "boolean" || typeof data.allowed !== "boolean" ||
      !["free", "pro"].includes(data.plan) || !Number.isInteger(data.analysis_count) || data.analysis_count < 0 ||
      !Number.isInteger(data.pending_count) || data.pending_count < 0 || data.free_limit !== 2 ||
      !Number.isFinite(Date.parse(data.last_reset_at)) || (kind === "onboarding" && data.is_pro)) throw new Error("ENTITLEMENT_UNAVAILABLE");
    return data;
  }

  async function snapshot(req) {
    try {
      const user = await identity(req);
      if (!user) return errorResult(401, "AUTH_REQUIRED");
      const value = await operation(user, "snapshot");
      return { status: 200, body: { success: true, ...value } };
    } catch (error) { return failure(error); }
  }

  async function run(req, body = {}, kind = "normal") {
    let user;
    let requestId;
    let admission;
    try {
      user = await identity(req);
      if (!user) return errorResult(401, "AUTH_REQUIRED");
      const cvText = String(body?.cvText ?? body?.cv ?? "").trim();
      const jobDescription = String(body?.jobDescription ?? body?.jd ?? "").trim();
      if (!cvText || !jobDescription) return errorResult(400, "INVALID_ANALYSIS_INPUT");
      const suppliedKey = req?.headers?.["idempotency-key"];
      if (suppliedKey !== undefined && (typeof suppliedKey !== "string" || !uuid.test(suppliedKey))) {
        return errorResult(400, "INVALID_IDEMPOTENCY_KEY");
      }
      requestId = suppliedKey || newRequestId();
      const engineInput = { cvText, jobDescription, sector: body?.sector,
        careerArea: body?.careerArea, lang: body?.lang };
      // Digest only; never persist CV/prompt text. Fixed field order, UUID scoped by verified user.
      const inputHash = createHash("sha256").update(JSON.stringify(engineInput)).digest("hex");
      admission = await operation(user, "reserve", requestId, kind, inputHash);
      if (!admission.allowed) return errorResult(403, kind === "onboarding" ? "ONBOARDING_BENEFIT_UNAVAILABLE" : "ANALYSIS_LIMIT_EXHAUSTED");
      let payload;
      let timer;
      try {
        // Explicit allowlist: all client entitlement/identity flags are ignored.
        payload = await Promise.race([
          (async () => {
            let careerMemory = null;
            try { careerMemory = await loadMemory(user.id); } catch { /* optional personalization */ }
            return analyze({ ...engineInput, careerMemory, isPro: admission.is_pro });
          })(),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("ANALYSIS_TIMEOUT")), timeoutMs); }),
        ]);
        if (!payload || typeof payload !== "object" || Array.isArray(payload) || payload.success === false || payload.degraded === true ||
            !payload.Output || typeof payload.Output !== "object" || Array.isArray(payload.Output)) {
          throw new Error("ANALYSIS_FAILED");
        }
      } catch (error) {
        // Only a known engine failure releases a hold; ambiguous RPC completion must not.
        try { await operation(user, "release", requestId, kind, null,
          error.message === "ANALYSIS_TIMEOUT" ? "timeout" : "engine_failure"); }
        catch { return errorResult(503, "ENTITLEMENT_UNAVAILABLE"); }
        return errorResult(error.message === "ANALYSIS_TIMEOUT" ? 504 : 502,
          error.message === "ANALYSIS_TIMEOUT" ? "ANALYSIS_TIMEOUT" : "ANALYSIS_FAILED");
      } finally { clearTimeout(timer); }
      await operation(user, "complete", requestId, kind);
      return { status: 200, body: payload };
    } catch (error) {
      // Network/settlement uncertainty retains the hold. No blind refund or AI retry.
      return failure(error);
    }
  }
  return { snapshot, run: (req, body) => run(req, body, "normal"), runOnboarding: (req, body) => run(req, body, "onboarding") };
}

export const entitlementAuthority = createEntitlementAuthority();

export function registerEntitlementRoutes(app, authority = entitlementAuthority) {
  for (const [method, path, operation] of [["get", "/api/entitlements", "snapshot"],
    ["post", "/api/analyze-v2", "run"], ["post", "/api/onboarding-analysis", "runOnboarding"]]) {
    app[method](path, async (req, res) => {
      res.setHeader("Cache-Control", "private, no-store");
      const result = await authority[operation](req, req.body);
      return res.status(result.status).json(result.body);
    });
  }
}

// Call ONLY after existing verified admin or signature-verified payment authorization.
// Existing historical accounts require separate reconciliation; never auto-adopt their plan.
export async function setTrustedPlan(client, userId, plan, source) {
  if (!uuid.test(userId || "") || !["free", "pro"].includes(plan) || !["admin", "payment"].includes(source)) {
    return { error: new Error("ENTITLEMENT_UNAVAILABLE") };
  }
  // HMAC/email event mapping lacks reviewed product scope, identity binding and ordering.
  // It cannot be promoted to authoritative billing solely because an event is signed.
  if (source === "payment") return { error: new Error("PAYMENT_AUTHORITY_REVIEW_REQUIRED") };
  const { data, error } = await client.rpc("hirefit_set_authoritative_plan", {
    p_user_id: userId, p_plan: plan, p_source: source,
  });
  return error || data?.success !== true ? { error: new Error("ENTITLEMENT_UNAVAILABLE") } : { error: null };
}
