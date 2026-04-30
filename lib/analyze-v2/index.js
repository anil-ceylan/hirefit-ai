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
  const t0 = Date.now();
  console.log("[PIPELINE] START", { sector: sec, lang: langNorm });

  console.log("[SONNET START] atsEngine");
  const atsResult = await runAtsEngine(cv, jd, sec, langNorm, careerContext);
  console.log("[SONNET DONE] atsEngine", { elapsed_ms: Date.now() - t0 });
  await new Promise((r) => setTimeout(r, 1000));
  console.log("[OPUS START] recruiterEngine");
  const recruiterResult = await runRecruiterEngine(cv, jd, sec, langNorm, careerContext);
  console.log("[OPUS DONE] recruiterEngine", { elapsed_ms: Date.now() - t0 });
  await new Promise((r) => setTimeout(r, 1000));
  console.log("[SONNET START] gapEngine");
  let gapResult = await runGapEngine(cv, jd, sec, langNorm, careerContext);
  gapResult = applyDegreeDepartmentCheck(cv, jd, gapResult, langNorm);
  console.log("[SONNET DONE] gapEngine", { elapsed_ms: Date.now() - t0 });
  await new Promise((r) => setTimeout(r, 1000));
  console.log("[OPUS START] roleFitEngine");
  const roleFitResult = await runRoleFitEngine(cv, jd, sec, langNorm, careerContext);
  console.log("[OPUS DONE] roleFitEngine", { elapsed_ms: Date.now() - t0 });

  console.log("[OPUS START] decisionEngine");
  const decision = await runDecisionEngine({
    cvText: cv,
    jobDescription: jd,
    ats: atsResult,
    recruiter: recruiterResult,
    gaps: gapResult,
    roleFit: roleFitResult,
    sector: sec,
    careerContext,
    lang: langNorm,
  });
  console.log("[OPUS DONE] decisionEngine", {
    elapsed_ms: Date.now() - t0,
    has_reasoning: Boolean(decision?.reasoning),
    has_role_suggestions: Array.isArray(decision?.role_suggestions) && decision.role_suggestions.length > 0,
  });

  const unified = buildUnifiedResponse(
    atsResult,
    recruiterResult,
    gapResult,
    roleFitResult,
    decision,
    sec,
    careerContext
  );
  console.log("[PIPELINE] DONE", { total_elapsed_ms: Date.now() - t0 });
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
