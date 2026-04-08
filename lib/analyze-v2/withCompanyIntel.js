/* eslint-env node */
import { runAnalyzeV2ForClient } from "./index.js";
import { normalizeSector } from "./sectorContext.js";
import { normalizeAnalyzeLang } from "./lang.js";
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
  lang,
}) {
  const c = String(cvText || "").trim();
  const j = String(jobDescription || "").trim();
  const langNorm = normalizeAnalyzeLang(lang);
  const langUi = langNorm === "tr" ? "tr" : "en";

  let effectiveSector = normalizeSector(sector);
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
  };
}
