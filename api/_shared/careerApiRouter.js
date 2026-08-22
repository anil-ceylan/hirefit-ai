import { createClient } from "@supabase/supabase-js";
import { getUserFromRequest } from "../../lib/auth/verifySupabaseJwt.js";
import {
  extractCareerProfileSnapshot,
  mergeCareerProfiles,
  compareCareerMemory,
} from "../../lib/careerMemory/index.js";
import { loadCareerProfile, saveCareerProfile } from "../../lib/careerMemory/persistence.js";
import { buildCareerGrowthView, recordSnapshotPayload } from "../../lib/careerProgress/index.js";
import { insertCareerProgress, listCareerProgress } from "../../lib/careerProgress/persistence.js";
import {
  loadFullCareerProfile,
  upsertOnboardingDraft,
  completeOnboarding,
  saveFirstAnalysis,
} from "../../lib/careerOnboarding/persistence.js";
import { getCareerDnaQuestions } from "../../lib/careerOnboarding/careerDna.js";
import {
  completeCareerAction,
  getCareerActionOutcome,
  getCurrentCareerAction,
  startCareerAction,
  upsertCareerActionOutcome,
  upsertRecommendedCareerAction,
} from "../../lib/careerActionLoop/persistence.js";
import { buildCareerIntelligence } from "../../lib/careerIntelligence/buildIntelligence.js";
import { recommendJobs } from "../../lib/jobDiscovery/index.js";
import { callClaudeHaiku } from "../../lib/analyze-v2/openaiClient.js";
import {
  enforcePromptLanguageRules,
  normalizeAnalyzeLang,
  requiredResponseLanguageDirective,
} from "../../lib/analyze-v2/lang.js";

const ALLOWED_ORIGINS = new Set([
  "https://www.hirefit.co",
  "https://hirefit.co",
  "https://hirefit-ai.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
]);

function isAllowedCorsOrigin(origin) {
  return Boolean(origin && ALLOWED_ORIGINS.has(origin));
}

function applyCors(req, res) {
  const origin = req?.headers?.origin;
  if (isAllowedCorsOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,x-user-id,x-requested-with");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function methodNotAllowed(res) {
  return sendJson(res, 405, { error: "Method not allowed" });
}

function notFound(res) {
  return sendJson(res, 404, { error: "Route not found" });
}

async function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  const contentType = String(req.headers?.["content-type"] || "").toLowerCase();
  if (!contentType.includes("application/json")) return {};
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

async function withBody(req) {
  req.body = await readBody(req);
  return req.body;
}

async function requireUser(req, res) {
  const auth = await getUserFromRequest(req);
  if (!auth.ok) {
    sendJson(res, auth.status, { error: auth.error });
    return null;
  }
  req.authUser = auth.user;
  return auth.user;
}

function queryFromReq(req) {
  const url = new URL(req.url || "/", `https://${req.headers?.host || "www.hirefit.co"}`);
  return Object.fromEntries(url.searchParams.entries());
}

function responseLanguageLabel(langNorm) {
  return langNorm === "tr" ? "Turkish" : "English";
}

function constrainedMessages(messages, lang) {
  return enforcePromptLanguageRules(messages, lang);
}

function extractJSON(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

function isAdminEmail(email) {
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  return Boolean(adminEmail) && normalizeEmail(email) === adminEmail;
}

async function findAuthUserByEmail(targetEmail) {
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase environment variables are missing");
  }
  const adminClient = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  let page = 1;
  const perPage = 1000;
  while (page <= 20) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const user = users.find((item) => normalizeEmail(item.email) === targetEmail);
    if (user) return user;
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}

async function handleCareerProfile(req, res) {
  const auth = await getUserFromRequest(req);
  if (!auth.ok) {
    return sendJson(res, 200, { success: true, exists: false, profile: null, authenticated: false });
  }
  try {
    const profile = await loadCareerProfile(auth.user.id);
    if (!profile) {
      return sendJson(res, 200, {
        success: true,
        exists: false,
        profile: null,
        authenticated: true,
        onboarding_completed: false,
      });
    }
    return sendJson(res, 200, {
      success: true,
      exists: true,
      profile,
      authenticated: true,
      onboarding_completed: Boolean(profile?.onboarding_completed),
    });
  } catch (error) {
    console.error("[career-profile:get]", error?.message || error);
    return sendJson(res, 200, {
      success: true,
      exists: null,
      profile: null,
      authenticated: true,
      onboarding_completed: false,
      profileFetchFailed: true,
    });
  }
}

async function handleCareerMemorySync(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  try {
    const body = await withBody(req);
    const { cvText = "", engineV2 = null, score = null, roleSuggestions = [], lang = "TR" } = body || {};
    const previous = await loadCareerProfile(user.id);
    const snapshot = extractCareerProfileSnapshot({
      cvText,
      engineV2,
      identityEngine: null,
      atsIntelligence: engineV2?.ATS ? { displayMissingCritical: engineV2.ATS.missing_keywords } : null,
      roleSuggestions,
      score,
      lang,
    });
    const merged = mergeCareerProfiles(previous, snapshot);
    const profile = await saveCareerProfile(user.id, merged);
    const comparison = compareCareerMemory(previous, snapshot, lang);
    return sendJson(res, 200, { profile, comparison, snapshot });
  } catch (error) {
    console.error("[career-memory:sync]", error?.message || error);
    return sendJson(res, 200, { success: true, profile: null, comparison: null, storageUnavailable: true });
  }
}

async function handleCareerProgressGet(req, res) {
  const auth = await getUserFromRequest(req);
  if (!auth.ok) {
    return sendJson(res, 200, {
      success: true,
      items: [],
      snapshots: [],
      growth: null,
      authenticated: false,
    });
  }
  const query = queryFromReq(req);
  try {
    const limit = Math.min(48, Math.max(1, Number(query.limit) || 24));
    const snapshots = await listCareerProgress(auth.user.id, limit);
    const growth = buildCareerGrowthView({
      snapshots,
      current: snapshots[0] || null,
      lang: query.lang === "en" ? "EN" : "TR",
    });
    return sendJson(res, 200, { success: true, items: snapshots, snapshots, growth, authenticated: true });
  } catch (error) {
    console.error("[career-progress:get]", error?.message || error);
    return sendJson(res, 200, {
      success: true,
      items: [],
      snapshots: [],
      growth: null,
      authenticated: true,
    });
  }
}

async function handleCareerProgressRecord(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  try {
    const body = await withBody(req);
    const { engineV2, score, cvText, role, lang, analysis_id } = body || {};
    const existing = await listCareerProgress(user.id, 1);
    const previous = existing[0] || null;
    const payload = recordSnapshotPayload({ engineV2, score, cvText, role, lang, previous, analysis_id });
    const saved = await insertCareerProgress(user.id, payload);
    const snapshots = await listCareerProgress(user.id, 24);
    const growth = buildCareerGrowthView({ snapshots, current: saved, lang });
    return sendJson(res, 200, { snapshot: saved, snapshots, growth });
  } catch (error) {
    console.error("[career-progress:record]", error?.message || error);
    return sendJson(res, 200, {
      success: true,
      snapshot: null,
      snapshots: [],
      growth: null,
      storageUnavailable: true,
    });
  }
}

async function handleOnboardingGet(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  const query = queryFromReq(req);
  const lang = query.lang === "en" ? "EN" : "TR";
  try {
    const profile = await loadFullCareerProfile(user.id);
    return sendJson(res, 200, {
      success: true,
      profile: profile || null,
      exists: Boolean(profile),
      questions: getCareerDnaQuestions(lang),
      onboarding_completed: Boolean(profile?.onboarding_completed),
    });
  } catch (error) {
    console.error("[career-onboarding:get]", error?.message || error);
    return sendJson(res, 200, {
      success: true,
      profile: null,
      exists: null,
      questions: getCareerDnaQuestions(lang),
      onboarding_completed: false,
      profileFetchFailed: true,
    });
  }
}

async function handleOnboardingDraft(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  try {
    const body = await withBody(req);
    const { step, draft, lang } = body || {};
    const result = await upsertOnboardingDraft(user.id, { step, draft, lang });
    if (result.storageUnavailable) {
      return sendJson(res, 200, { success: true, profile: null, draftAccepted: true, storageUnavailable: true });
    }
    return sendJson(res, 200, { success: true, profile: result.profile });
  } catch (error) {
    console.error("[career-onboarding:draft]", error?.message || error);
    return sendJson(res, 200, {
      success: true,
      profile: null,
      draftAccepted: true,
      storageUnavailable: true,
      warning: error?.message || "Draft saved locally only",
    });
  }
}

async function handleOnboardingComplete(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  try {
    const body = await withBody(req);
    const result = await completeOnboarding(user.id, body || {});
    if (result.storageUnavailable) {
      return sendJson(res, 200, { success: true, mode: "local", profile: null, storageUnavailable: true });
    }
    return sendJson(res, 200, { success: true, mode: result.mode || "created", profile: result.profile });
  } catch (error) {
    console.error("[career-onboarding:complete]", error?.message || error);
    return sendJson(res, 200, { success: true, mode: "local", profile: null, storageUnavailable: true });
  }
}

async function handleFirstAnalysis(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  try {
    const body = await withBody(req);
    const { snapshot, firstAnalysis, basicProfile, analysisSources } = body || {};
    const result = await saveFirstAnalysis(user.id, { snapshot, firstAnalysis, basicProfile, analysisSources });
    if (result.storageUnavailable) {
      return sendJson(res, 200, { success: true, profile: null, storageUnavailable: true });
    }
    return sendJson(res, 200, { success: true, profile: result.profile });
  } catch (error) {
    console.error("[career-onboarding:first-analysis]", error?.message || error);
    return sendJson(res, 200, { success: true, profile: null, storageUnavailable: true });
  }
}

async function handleCvUpload(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  return sendJson(res, 200, {
    success: false,
    error: "CV upload unavailable",
    optional: true,
  });
}

async function handleActionCurrent(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  const query = queryFromReq(req);
  try {
    const result = await getCurrentCareerAction(user.id, {
      actionId: query.action_id || "",
      weekKey: query.week_key || "",
    });
    return sendJson(res, 200, { success: true, ...result });
  } catch (error) {
    console.error("[career-action-loop:current]", error?.message || error);
    return sendJson(res, 200, { success: true, action: null, storageUnavailable: true });
  }
}

async function handleActionRecommended(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  try {
    const body = await withBody(req);
    const result = await upsertRecommendedCareerAction(user.id, body?.action || body || {});
    return sendJson(res, 200, { success: true, ...result });
  } catch (error) {
    console.error("[career-action-loop:recommended]", error?.message || error);
    return sendJson(res, 200, { success: true, action: null, storageUnavailable: true });
  }
}

async function handleActionStart(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  try {
    const body = await withBody(req);
    const actionId = String(body?.action_id || body?.actionId || "").trim();
    if (!actionId) return sendJson(res, 200, { success: true, action: null, invalidRequest: true });
    const result = await startCareerAction(user.id, actionId);
    return sendJson(res, 200, { success: true, ...result });
  } catch (error) {
    console.error("[career-action-loop:start]", error?.message || error);
    return sendJson(res, 200, { success: true, action: null, storageUnavailable: true });
  }
}

async function handleActionComplete(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  try {
    const body = await withBody(req);
    const actionId = String(body?.action_id || body?.actionId || "").trim();
    if (!actionId) return sendJson(res, 200, { success: true, action: null, invalidRequest: true });
    const result = await completeCareerAction(user.id, actionId);
    return sendJson(res, 200, { success: true, ...result });
  } catch (error) {
    console.error("[career-action-loop:complete]", error?.message || error);
    return sendJson(res, 200, { success: true, action: null, storageUnavailable: true });
  }
}

async function handleActionOutcome(req, res, actionId) {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (!actionId) return sendJson(res, 200, { success: true, outcome: null, invalidRequest: true });
  try {
    if (req.method === "GET") {
      const result = await getCareerActionOutcome(user.id, actionId);
      return sendJson(res, 200, { success: true, ...result });
    }
    const body = await withBody(req);
    const result = await upsertCareerActionOutcome(user.id, actionId, body?.outcome || body || {});
    return sendJson(res, 200, { success: true, ...result });
  } catch (error) {
    console.error("[career-action-loop:outcome]", error?.message || error);
    return sendJson(res, 200, { success: true, outcome: null, storageUnavailable: true });
  }
}

async function handleCareerIntelligence(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  const query = queryFromReq(req);
  try {
    const profile = await loadFullCareerProfile(user.id);
    if (!profile) return sendJson(res, 200, { intelligence: null });
    const lang = query.lang === "en" ? "EN" : "TR";
    const intelligence = buildCareerIntelligence(profile, {
      hasCv: Boolean(profile.career_readiness?.hasCv),
      readinessAnswers: null,
      lang,
    });
    return sendJson(res, 200, { intelligence, profile });
  } catch (error) {
    console.error("[career-intelligence:get]", error?.message || error);
    return sendJson(res, 200, { intelligence: null, storageUnavailable: true });
  }
}

async function handleJobRecommendations(req, res) {
  try {
    const body = await withBody(req);
    const { cvText = "", lang = "TR", limit = 5, skippedIds = [], careerProfile = null } = body || {};
    let profile = careerProfile;
    const auth = await getUserFromRequest(req);
    if (auth.ok && !profile) {
      try {
        profile = await loadCareerProfile(auth.user.id);
      } catch {
        profile = null;
      }
    }
    const result = recommendJobs({ cvText, careerProfile: profile, lang, limit, skippedIds });
    return sendJson(res, 200, result);
  } catch (error) {
    console.error("[job-discovery]", error?.message || error);
    return sendJson(res, 200, { jobs: [], recommendations: [], storageUnavailable: true });
  }
}

async function handleSignupStatus(req, res) {
  try {
    const body = await withBody(req);
    const targetEmail = normalizeEmail(body?.email);
    if (!targetEmail || !targetEmail.includes("@")) {
      return sendJson(res, 400, { error: "email is required" });
    }
    const user = await findAuthUserByEmail(targetEmail);
    return sendJson(res, 200, {
      exists: Boolean(user),
      confirmed: Boolean(user?.email_confirmed_at || user?.confirmed_at),
    });
  } catch (error) {
    console.error("[signup-status]", error?.message || error);
    return sendJson(res, 200, { exists: false, confirmed: false, unavailable: true });
  }
}

async function handleAdminProAccess(req, res) {
  try {
    const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
    if (!adminEmail) return sendJson(res, 500, { error: "ADMIN_EMAIL is not configured" });

    const user = await requireUser(req, res);
    if (!user) return null;
    if (!isAdminEmail(user.email)) return sendJson(res, 403, { error: "Only admin can update user access" });

    const body = await withBody(req);
    const targetEmail = normalizeEmail(body?.targetEmail);
    const grantPro = Boolean(body?.grantPro);
    if (!targetEmail) return sendJson(res, 400, { error: "targetEmail is required" });
    if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return sendJson(res, 500, { error: "Supabase environment variables are missing" });
    }

    const adminClient = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: usersPage, error: usersError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) return sendJson(res, 500, { error: "Failed to load users" });
    const targetUser = usersPage?.users?.find((item) => normalizeEmail(item.email) === targetEmail);
    if (!targetUser) return sendJson(res, 404, { error: "Target user not found" });

    const plan = grantPro ? "pro" : "free";
    const { error: upsertError } = await adminClient
      .from("user_plans")
      .upsert({ user_id: targetUser.id, plan }, { onConflict: "user_id" });
    if (upsertError) return sendJson(res, 500, { error: "An error occurred. Please try again." });

    return sendJson(res, 200, { ok: true, targetEmail, plan, adminGranted: grantPro });
  } catch {
    return sendJson(res, 500, { error: "An error occurred. Please try again." });
  }
}

async function handleOptimize(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  const { cvText, jobDescription, lang } = await withBody(req);
  if (!cvText || !jobDescription) return sendJson(res, 400, { error: "Missing CV or JD" });
  try {
    const langNorm = normalizeAnalyzeLang(lang);
    const languageDirective = requiredResponseLanguageDirective(langNorm);
    const optimizedCv =
      (await callClaudeHaiku({
        langNorm,
        max_tokens: 800,
        messages: constrainedMessages(
          [
            { role: "system", content: languageDirective },
            {
              role: "user",
              content: `You are a senior recruiter-turned-CV writer doing a "Fix My CV" pass for one specific job.

TASK — rewrite the ENTIRE CV for this job description:
1) Every bullet: strong action verb + outcome + metric.
2) Remove generic filler and replace it with concrete achievements tied to the JD keywords.
3) Mirror critical language from the job description naturally without lying.
4) Keep structure readable and preserve truthful employment/education facts.
5) Return ONLY the rewritten CV body text.

${langNorm === "tr" ? "Write the CV in Turkish." : "Write the CV in English."}
Respond entirely in ${responseLanguageLabel(langNorm)}.

CV:
${cvText}

Job Description:
${jobDescription}`,
            },
          ],
          langNorm
        ),
      })) || "";
    return sendJson(res, 200, { optimizedCv });
  } catch (error) {
    console.error("[optimize]", error?.message || error);
    return sendJson(res, 500, {
      error: "optimization_failed",
      message: "CV optimization did not complete. Check your connection and try again.",
    });
  }
}

async function handleRoadmap(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  const { missingSkills, roleType, seniority, lang } = await withBody(req);
  if (!missingSkills?.length) return sendJson(res, 400, { error: "No missing skills provided" });
  try {
    const langNorm = normalizeAnalyzeLang(lang);
    const languageDirective = requiredResponseLanguageDirective(langNorm);
    const roadmap =
      (await callClaudeHaiku({
        langNorm,
        max_tokens: 800,
        messages: constrainedMessages(
          [
            { role: "system", content: languageDirective },
            {
              role: "user",
              content: `Create a concise 30-day learning roadmap for someone targeting a ${seniority || "Junior"} ${roleType || "role"} who is missing these skills: ${missingSkills.join(", ")}.

For each skill provide: week number, specific resource, and estimated hours. Be practical and specific. Return as plain text, no JSON.
Respond entirely in ${responseLanguageLabel(langNorm)}.`,
            },
          ],
          langNorm
        ),
      })) || "";
    return sendJson(res, 200, { roadmap });
  } catch (error) {
    console.error("[roadmap]", error?.message || error);
    return sendJson(res, 500, { error: "Roadmap generation failed" });
  }
}

async function handleApplyFix(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  const body = await withBody(req);
  const weakBullet = String(body?.weak_bullet || body?.problem || "").trim();
  const careerAreaValue = String(body?.career_area || body?.careerArea || body?.sector || "İş / Operasyon").trim();
  const jobDescriptionValue = String(body?.job_description || body?.jobDescription || "").trim();
  if (!weakBullet) return sendJson(res, 400, { error: "Missing weak bullet data" });
  try {
    const langNorm = normalizeAnalyzeLang(body?.lang);
    const languageDirective = requiredResponseLanguageDirective(langNorm);
    const content = await callClaudeHaiku({
      langNorm,
      max_tokens: 420,
      messages: constrainedMessages(
        [
          { role: "system", content: languageDirective },
          {
            role: "user",
            content: `Adayın CV'sindeki zayıf noktayı güçlü, ölçülebilir ve profesyonel bir şekilde yeniden yaz.

Zayıf ifade:
${weakBullet}

Alan:
${careerAreaValue}

İş ilanı:
${jobDescriptionValue || "N/A"}

Ek bağlam:
${body?.cvText ? String(body.cvText).slice(0, 2000) : ""}

Return ONLY valid JSON:
{
  "old": "${weakBullet.replace(/"/g, '\\"')}",
  "new": "<single strong measurable sentence>"
}`,
          },
        ],
        langNorm
      ),
    });
    const parsed = extractJSON(content);
    if (!parsed || !parsed.new) return sendJson(res, 200, { error: "Could not parse response" });
    const oldText = String(parsed.old || weakBullet).trim() || weakBullet;
    const newText = String(parsed.new || "").trim();
    return sendJson(res, 200, {
      old: oldText,
      new: newText,
      original_section: oldText,
      rewritten_section: newText,
      explanation:
        langNorm === "tr"
          ? "Zayıf ifade ölçülebilir ve güçlü bir cümleye dönüştürüldü."
          : "The weak bullet was rewritten into a stronger measurable line.",
    });
  } catch (error) {
    console.error("[apply-fix]", error?.message || error);
    return sendJson(res, 500, { error: "Apply fix failed" });
  }
}

function handleHealth(_req, res) {
  return sendJson(res, 200, {
    ok: true,
    service: "hirefit-api",
    platform: "vercel-serverless",
    supabaseAuthConfigured: Boolean(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY),
    supabaseServiceConfigured: Boolean(process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}

export async function handleCareerApi(req, res, routePath) {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const method = String(req.method || "GET").toUpperCase();
  const path = routePath || new URL(req.url || "/", `https://${req.headers?.host || "www.hirefit.co"}`).pathname;

  try {
    if (path === "/api/health" && method === "GET") return handleHealth(req, res);

    if (path === "/api/career-profile" && method === "GET") return handleCareerProfile(req, res);
    if (path === "/api/career-memory/sync" && method === "POST") return handleCareerMemorySync(req, res);

    if (path === "/api/career-progress" && method === "GET") return handleCareerProgressGet(req, res);
    if (path === "/api/career-progress/record" && method === "POST") return handleCareerProgressRecord(req, res);

    if (path === "/api/career-onboarding" && method === "GET") return handleOnboardingGet(req, res);
    if (path === "/api/career-onboarding/draft" && method === "PATCH") return handleOnboardingDraft(req, res);
    if (path === "/api/career-onboarding/complete" && method === "POST") return handleOnboardingComplete(req, res);
    if (path === "/api/career-onboarding/first-analysis" && method === "PATCH") return handleFirstAnalysis(req, res);
    if (
      (path === "/api/career-onboarding/upload-cv" || path === "/api/career-onboarding/cv") &&
      method === "POST"
    ) {
      return handleCvUpload(req, res);
    }

    if (path === "/api/career-actions/current" && method === "GET") return handleActionCurrent(req, res);
    if (path === "/api/career-actions/recommended" && method === "POST") return handleActionRecommended(req, res);
    if (path === "/api/career-actions/start" && method === "POST") return handleActionStart(req, res);
    if (path === "/api/career-actions/complete" && method === "POST") return handleActionComplete(req, res);
    const outcomeMatch = path.match(/^\/api\/career-actions\/([^/]+)\/outcome$/);
    if (outcomeMatch && (method === "GET" || method === "POST")) {
      return handleActionOutcome(req, res, decodeURIComponent(outcomeMatch[1]));
    }

    if (path === "/api/career-intelligence" && method === "GET") return handleCareerIntelligence(req, res);
    if (path === "/api/job-discovery/recommendations" && method === "POST") return handleJobRecommendations(req, res);
    if (path === "/api/auth/signup-status" && method === "POST") return handleSignupStatus(req, res);
    if (path === "/api/admin/pro-access" && method === "POST") return handleAdminProAccess(req, res);

    if ((path === "/api/optimize" || path === "/optimize") && method === "POST") return handleOptimize(req, res);
    if ((path === "/api/roadmap" || path === "/roadmap") && method === "POST") return handleRoadmap(req, res);
    if ((path === "/api/apply-fix" || path === "/apply-fix") && method === "POST") return handleApplyFix(req, res);

    const routeExists =
      [
        "/api/career-profile",
        "/api/career-memory/sync",
        "/api/career-progress",
        "/api/career-progress/record",
        "/api/career-onboarding",
        "/api/career-onboarding/draft",
        "/api/career-onboarding/complete",
        "/api/career-onboarding/first-analysis",
        "/api/career-onboarding/upload-cv",
        "/api/career-onboarding/cv",
        "/api/career-actions/current",
        "/api/career-actions/recommended",
        "/api/career-actions/start",
        "/api/career-actions/complete",
        "/api/career-intelligence",
        "/api/job-discovery/recommendations",
        "/api/auth/signup-status",
        "/api/admin/pro-access",
        "/api/optimize",
        "/api/roadmap",
        "/api/apply-fix",
      ].includes(path) || Boolean(outcomeMatch);
    return routeExists ? methodNotAllowed(res) : notFound(res);
  } catch (error) {
    console.error("[career-api-router]", error?.message || error);
    return sendJson(res, 200, { success: false, storageUnavailable: true, error: "Temporary service issue" });
  }
}
