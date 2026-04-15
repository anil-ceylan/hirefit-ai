import { runAtsAnalysis } from "./ats.js";
import { runRecruiterAnalysis } from "./recruiter.js";
import { runFixAnalysis } from "./fix.js";
import { combineAnalysisOutputs } from "./decisionEngine.js";

export { runAtsAnalysis } from "./ats.js";
export { runRecruiterAnalysis } from "./recruiter.js";
export { runFixAnalysis } from "./fix.js";
export { combineAnalysisOutputs } from "./decisionEngine.js";

export async function runMultiAnalyze({ cvText, jobDescription, lang }) {
  const cv = String(cvText || "").trim();
  const jd = String(jobDescription || "").trim();
  if (!cv || !jd) {
    throw new Error("cvText and jobDescription are required");
  }

  const [ats, recruiter, fix] = await Promise.all([
    runAtsAnalysis(cv, jd, lang),
    runRecruiterAnalysis(cv, jd, lang),
    runFixAnalysis(cv, jd, lang),
  ]);

  return combineAnalysisOutputs(ats, recruiter, fix);
}
