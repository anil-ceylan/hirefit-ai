import { runAtsEngine } from "./atsEngine.js";
import { runRecruiterEngine } from "./recruiterEngine.js";
import { runGapEngine } from "./gapEngine.js";
import { runRoleFitEngine } from "./roleFitEngine.js";
import { runDecisionEngine } from "./decisionEngine.js";
import { buildUnifiedResponse, applyTierGate } from "./tierGate.js";
import { normalizeSector } from "./sectorContext.js";
import { normalizeAnalyzeLang } from "./lang.js";

export { runAtsEngine } from "./atsEngine.js";
export { runRecruiterEngine } from "./recruiterEngine.js";
export { runGapEngine } from "./gapEngine.js";
export { runRoleFitEngine } from "./roleFitEngine.js";
export { runDecisionEngine } from "./decisionEngine.js";
export { buildUnifiedResponse, applyTierGate } from "./tierGate.js";

export async function runAnalyzeV2Pipeline({ cvText, jobDescription, sector, lang }) {
  const cv = String(cvText || "").trim();
  const jd = String(jobDescription || "").trim();
  if (!cv || !jd) throw new Error("cvText and jobDescription are required");
  const sec = normalizeSector(sector);
  const langNorm = normalizeAnalyzeLang(lang);

  const atsResult = await runAtsEngine(cv, jd, sec, langNorm);
  await new Promise((r) => setTimeout(r, 1000));
  const recruiterResult = await runRecruiterEngine(cv, jd, sec, langNorm);
  await new Promise((r) => setTimeout(r, 1000));
  const gapResult = await runGapEngine(cv, jd, sec, langNorm);
  await new Promise((r) => setTimeout(r, 1000));
  const roleFitResult = await runRoleFitEngine(cv, jd, sec, langNorm);

  const decision = await runDecisionEngine({
    cvText: cv,
    jobDescription: jd,
    ats: atsResult,
    recruiter: recruiterResult,
    gaps: gapResult,
    roleFit: roleFitResult,
    sector: sec,
    lang: langNorm,
  });

  return buildUnifiedResponse(atsResult, recruiterResult, gapResult, roleFitResult, decision, sec);
}

export async function runAnalyzeV2ForClient({ cvText, jobDescription, isPro, sector, lang }) {
  const full = await runAnalyzeV2Pipeline({ cvText, jobDescription, sector, lang });
  return applyTierGate(full, !!isPro);
}
