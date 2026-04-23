/* eslint-env node */
import { runAnalyzeV2ForClient } from "./index.js";
import { normalizeSector } from "./sectorContext.js";
import { normalizeAnalyzeLang } from "./lang.js";
import { detectCareerArea, normalizeCareerArea } from "./careerAreaDetector.js";
import { extractCompanyIntelFromJd } from "../../backend/engines/companyIntelEngine.js";
import { buildCompanyIntelligenceLayer, liteCompanyIntel } from "../../backend/services/webSearch.js";

/**
 * Runs v2 pipeline with optional sector override; enriches with company/sector intelligence layer.
 */
export async function runAnalyzeV2WithCompanyIntel({
  cvText,
  jobDescription,
  isPro,
  sector,
  careerArea,
  lang,
}) {
  try {
    const c = String(cvText || "").trim();
    const j = String(jobDescription || "").trim();
    const langNorm = normalizeAnalyzeLang(lang);
    const langUi = langNorm === "tr" ? "tr" : "en";

    let effectiveSector = normalizeSector(sector);
    const detectedCareer = await detectCareerArea({
      cvText: c,
      jobDescription: j,
      lang: langUi,
    });
    const hasUserCareerArea = Boolean(String(careerArea || "").trim());
    const userCareerArea = hasUserCareerArea ? normalizeCareerArea(careerArea) : "";
    const lowConfidence = detectedCareer.confidence === "low";
    const fallbackCareerArea = "İş / Operasyon";
    const resolvedCareerArea = hasUserCareerArea
      ? userCareerArea
      : lowConfidence
        ? fallbackCareerArea
        : normalizeCareerArea(detectedCareer.area);
    const careerContext = {
      area: resolvedCareerArea,
      confidence: lowConfidence ? "low" : detectedCareer.confidence,
      reason: detectedCareer.reason,
      fallbackApplied: !hasUserCareerArea && lowConfidence,
      source: hasUserCareerArea ? "user_override" : "detector",
      detectedArea: normalizeCareerArea(detectedCareer.area),
    };
    let companyLayer = null;

    try {
      const extracted = await extractCompanyIntelFromJd(j, langUi);
      companyLayer = await buildCompanyIntelligenceLayer({
        extracted,
        cvText: c,
        jobDescription: j,
        lang: langUi,
      });
      const auto = normalizeSector(extracted.mapped_sector);
      if (!sector || sector === "Auto-detect") {
        effectiveSector = auto;
      }
    } catch (e) {
      console.warn("[runAnalyzeV2WithCompanyIntel] intel skipped:", e?.message || e);
    }

    const payload = await runAnalyzeV2ForClient({
      cvText: c,
      jobDescription: j,
      isPro: Boolean(isPro),
      sector: effectiveSector,
      lang,
      careerContext,
    });

    const intelOut = companyLayer
      ? isPro
        ? companyLayer
        : liteCompanyIntel(companyLayer)
      : null;

    return {
      ...payload,
      CompanyIntel: intelOut,
      detected_sector: companyLayer?.extracted?.mapped_sector || effectiveSector,
      detected_career_area: careerContext.detectedArea,
      selected_career_area: careerContext.area,
      career_area_confidence: careerContext.confidence,
      career_area_reason: careerContext.reason,
      career_area_fallback_applied: careerContext.fallbackApplied,
      career_area_source: careerContext.source,
    };
  } catch (e) {
    console.error("withCompanyIntel error:", e?.message, e?.stack);
    throw e;
  }
}
