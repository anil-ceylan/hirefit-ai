import { runAtsEngine } from "./atsEngine.js";
import { runRecruiterEngine } from "./recruiterEngine.js";
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

  const atsResult = await timeEngine("runAtsEngine", () =>
    runAtsEngine(cv, jd, sec, langNorm, careerContext)
  );
  const recruiterResult = await timeEngine("runRecruiterEngine", () =>
    runRecruiterEngine(cv, jd, sec, langNorm, careerContext)
  );
  let gapResult = await timeEngine("runGapEngine", () =>
    runGapEngine(cv, jd, sec, langNorm, careerContext)
  );
  gapResult = applyDegreeDepartmentCheck(cv, jd, gapResult, langNorm);
  const roleFitResult = await timeEngine("runRoleFitEngine", () =>
    runRoleFitEngine(cv, jd, sec, langNorm, careerContext)
  );

  const decision = await timeEngine("runDecisionEngine", () =>
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
  );

  const unified = buildUnifiedResponse(
    atsResult,
    recruiterResult,
    gapResult,
    roleFitResult,
    decision,
    sec,
    careerContext
  );
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
  const gated = applyTierGate(full, !!isPro, langNorm);
  return localizePayloadStrings(gated, langNorm);
}
