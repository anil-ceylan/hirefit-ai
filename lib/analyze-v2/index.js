import { runAtsEngine } from "./atsEngine.js";
import { runRecruiterEngine, buildFallbackRecruiterOutput } from "./recruiterEngine.js";
import { runGapEngine } from "./gapEngine.js";
import { applyDegreeDepartmentCheck } from "./degreeDepartmentCheck.js";
import { runRoleFitEngine } from "./roleFitEngine.js";
import { runDecisionEngine } from "./decisionEngine.js";
import { buildUnifiedResponse, applyTierGate } from "./tierGate.js";
import { normalizeSector } from "./sectorContext.js";
import { normalizeAnalyzeLang } from "./lang.js";
import { localizePayloadStrings } from "./localizePayload.js";

export { runAtsEngine } from "./atsEngine.js";
export { runRecruiterEngine } from "./recruiterEngine.js";
export { runGapEngine } from "./gapEngine.js";
export { runRoleFitEngine } from "./roleFitEngine.js";
export { runDecisionEngine, parseActionPlan, enrichActionPlan, pickDoThisNextStep } from "./decisionEngine.js";
export { buildUnifiedResponse, applyTierGate } from "./tierGate.js";

/**
 * @param {string} engineName
 * @param {() => Promise<unknown>} fn
 */
async function timeEngine(engineName, fn) {
  /* eslint-disable no-console -- [TIMING] Railway pipeline observability */
  console.log(`[TIMING] ${engineName} started`);
  const t0 = Date.now();
  try {
    const out = await fn();
    console.log(`[TIMING] ${engineName} completed in ${Date.now() - t0}ms`);
    return out;
  } catch (err) {
    console.log(`[TIMING] ${engineName} failed after ${Date.now() - t0}ms`);
    throw err;
  } finally {
    /* eslint-enable no-console */
  }
}

/**
 * @param {string} stepName
 * @param {() => Promise<unknown>} fn
 */
async function stepEngine(stepName, fn) {
  // eslint-disable-next-line no-console -- production step tracing
  console.log(`[STEP] ${stepName}:start`);
  try {
    const out = await fn();
    // eslint-disable-next-line no-console -- production step tracing
    console.log(`[STEP] ${stepName}:done`);
    return out;
  } catch (err) {
    // eslint-disable-next-line no-console -- production step tracing
    console.log(`[STEP] ${stepName}:error`, err?.message || err);
    throw err;
  }
}

export async function runAnalyzeV2Pipeline({
  cvText,
  jobDescription,
  sector,
  lang,
  careerContext = null,
}) {
  const cv = String(cvText || "").trim();
  const jd = String(jobDescription || "").trim();
  if (!cv || !jd) throw new Error("cvText and jobDescription are required");
  const sec = normalizeSector(sector);
  const langNorm = normalizeAnalyzeLang(lang);

  const recruiterPromise = stepEngine("recruiter", () =>
    timeEngine("runRecruiterEngine", () => runRecruiterEngine(cv, jd, sec, langNorm, careerContext))
  ).catch((err) => {
    // eslint-disable-next-line no-console -- keep pipeline alive if recruiter engine fails
    console.log("[runAnalyzeV2Pipeline] recruiter fallback:", err?.message || err);
    return buildFallbackRecruiterOutput(langNorm);
  });
  const [atsResult, recruiterResult, gapRaw] = await Promise.all([
    stepEngine("ats", () => timeEngine("runAtsEngine", () => runAtsEngine(cv, jd, sec, langNorm, careerContext))),
    recruiterPromise,
    stepEngine("gap", () => timeEngine("runGapEngine", () => runGapEngine(cv, jd, sec, langNorm, careerContext))),
  ]);
  // eslint-disable-next-line no-console -- production step tracing
  console.log("[STEP] degreeDepartmentCheck:start");
  let gapResult = applyDegreeDepartmentCheck(cv, jd, gapRaw, langNorm);
  // eslint-disable-next-line no-console -- production step tracing
  console.log("[STEP] degreeDepartmentCheck:done");
  const roleFitResult = await stepEngine("roleFit", () =>
    timeEngine("runRoleFitEngine", () => runRoleFitEngine(cv, jd, sec, langNorm, careerContext))
  );

  const decision = await stepEngine("decision", () =>
    timeEngine("runDecisionEngine", () =>
      runDecisionEngine({
        cvText: cv,
        jobDescription: jd,
        ats: atsResult,
        recruiter: recruiterResult,
        gaps: gapResult,
        roleFit: roleFitResult,
        sector: sec,
        careerContext,
        lang: langNorm,
      })
    )
  );

  // eslint-disable-next-line no-console -- production step tracing
  console.log("[STEP] responseAssembly:start");
  const unified = buildUnifiedResponse(
    atsResult,
    recruiterResult,
    gapResult,
    roleFitResult,
    decision,
    sec,
    careerContext
  );
  // eslint-disable-next-line no-console -- production step tracing
  console.log("[STEP] responseAssembly:done");
  return unified;
}

export async function runAnalyzeV2ForClient({
  cvText,
  jobDescription,
  isPro,
  sector,
  lang,
  careerContext = null,
}) {
  const langNorm = normalizeAnalyzeLang(lang);
  const full = await runAnalyzeV2Pipeline({
    cvText,
    jobDescription,
    sector,
    lang: langNorm,
    careerContext,
  });
  // eslint-disable-next-line no-console -- production step tracing
  console.log("[STEP] tierGate:start");
  const gated = applyTierGate(full, !!isPro, langNorm);
  // eslint-disable-next-line no-console -- production step tracing
  console.log("[STEP] tierGate:done");
  // eslint-disable-next-line no-console -- production step tracing
  console.log("[STEP] localizePayload:start");
  const localized = localizePayloadStrings(gated, langNorm);
  // eslint-disable-next-line no-console -- production step tracing
  console.log("[STEP] localizePayload:done");
  return localized;
}
