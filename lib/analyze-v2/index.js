import { runAtsEngine } from "./atsEngine.js";
import { runRecruiterEngine } from "./recruiterEngine.js";
import { runGapEngine } from "./gapEngine.js";
import { runRoleFitEngine } from "./roleFitEngine.js";
import { runDecisionEngine } from "./decisionEngine.js";
import { buildUnifiedResponse, applyTierGate } from "./tierGate.js";
import { normalizeSector } from "./sectorContext.js";

export { runAtsEngine } from "./atsEngine.js";
export { runRecruiterEngine } from "./recruiterEngine.js";
export { runGapEngine } from "./gapEngine.js";
export { runRoleFitEngine } from "./roleFitEngine.js";
export { runDecisionEngine } from "./decisionEngine.js";
export { buildUnifiedResponse, applyTierGate } from "./tierGate.js";

export async function runAnalyzeV2Pipeline({ cvText, jobDescription, sector }) {
  const cv = String(cvText || "").trim();
  const jd = String(jobDescription || "").trim();
  if (!cv || !jd) throw new Error("cvText and jobDescription are required");
  const sec = normalizeSector(sector);

  const [ats, recruiter, gaps, roleFit] = await Promise.all([
    runAtsEngine(cv, jd, sec),
    runRecruiterEngine(cv, jd, sec),
    runGapEngine(cv, jd, sec),
    runRoleFitEngine(cv, jd, sec),
  ]);

  const decision = await runDecisionEngine({
    cvText: cv,
    jobDescription: jd,
    ats,
    recruiter,
    gaps,
    roleFit,
    sector: sec,
  });

  return buildUnifiedResponse(ats, recruiter, gaps, roleFit, decision, sec);
}

export async function runAnalyzeV2ForClient({ cvText, jobDescription, isPro, sector }) {
  const full = await runAnalyzeV2Pipeline({ cvText, jobDescription, sector });
  return applyTierGate(full, !!isPro);
}
