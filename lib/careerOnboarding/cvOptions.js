/** Career DNA onboarding — CV status & freshness */

export const CV_STATUS = {
  NONE: "none",
  OUTDATED: "outdated",
  CURRENT: "current",
};

export const CV_PROCESSING_STATE = {
  NOT_UPLOADED: "not_uploaded",
  UPLOADED_LOCAL: "uploaded_local",
  SAVED_TO_PROFILE: "saved_to_profile",
  ANALYSIS_PENDING: "analysis_pending",
  ANALYSIS_FAILED: "analysis_failed",
  ANALYZED: "analyzed",
};

export const CV_STATUS_OPTIONS = [
  { id: CV_STATUS.NONE, labelTr: "Henüz CV'm yok", labelEn: "I don't have a CV yet" },
  { id: CV_STATUS.OUTDATED, labelTr: "CV'm var ama güncel değil", labelEn: "I have a CV but it's not up to date" },
  { id: CV_STATUS.CURRENT, labelTr: "Güncel CV'm var", labelEn: "I have an up-to-date CV" },
];

export const CV_FRESHNESS_OPTIONS = [
  { id: "this_month", labelTr: "Bu ay güncelledim", labelEn: "Updated this month" },
  { id: "last_3_months", labelTr: "Son 3 ay içinde", labelEn: "Within the last 3 months" },
  { id: "last_6_months", labelTr: "Son 6 ay içinde", labelEn: "Within the last 6 months" },
  { id: "over_1_year", labelTr: "1 yıldan uzun süredir güncellemedim", labelEn: "Not updated for over a year" },
];

const VALID_STATUS = new Set(CV_STATUS_OPTIONS.map((o) => o.id));
const VALID_FRESHNESS = new Set(CV_FRESHNESS_OPTIONS.map((o) => o.id));

export function needsCvUpload(cvStatus) {
  return cvStatus === CV_STATUS.OUTDATED || cvStatus === CV_STATUS.CURRENT;
}

export function emptyCvProfile() {
  return {
    cvStatus: CV_STATUS.NONE,
    cvExists: false,
    cvLastUpdated: null,
    cvLastUpdatedRange: null,
    cvFileUrl: null,
    cvFileName: null,
    cvUploaded: false,
    cvSignalCount: 0,
  };
}

export function normalizeCvProfile(input = {}) {
  const cvStatus = VALID_STATUS.has(input.cvStatus) ? input.cvStatus : CV_STATUS.NONE;
  const cvExists = needsCvUpload(cvStatus);
  const freshnessRaw = input.cvLastUpdatedRange || input.cvLastUpdated || "";
  const cvLastUpdatedRange =
    cvExists && VALID_FRESHNESS.has(freshnessRaw) ? freshnessRaw : "";
  const cvFileUrl = cvExists && input.cvFileUrl ? String(input.cvFileUrl).trim() : null;
  const cvFileName = cvExists && input.cvFileName ? String(input.cvFileName).trim() : null;
  const cvUploaded = Boolean(input.cvUploaded || cvFileName);
  const cvSignalCount = Math.max(0, Number(input.cvSignalCount || 0));

  return {
    cvStatus,
    cvExists,
    cvLastUpdated: cvLastUpdatedRange,
    cvLastUpdatedRange,
    cvFileUrl,
    cvFileName,
    cvUploaded,
    cvSignalCount,
  };
}

export function resolveCvProcessingState(profile = {}) {
  const basic = profile?.basic_profile || profile?.basic || {};
  const cv = profile?.cv || {};
  const firstAnalysis = profile?.first_analysis || profile?.career_gps?.first_analysis || {};
  const signalCount = Math.max(
    Number(firstAnalysis.cvSignalCount || 0),
    Number(basic.cvSignalCount || 0),
    Number(cv.cvSignalCount || 0)
  );
  if (signalCount > 0 || firstAnalysis.cvMatch) return CV_PROCESSING_STATE.ANALYZED;
  if (basic.cvAnalysisFailed || cv.cvAnalysisFailed || firstAnalysis.error) return CV_PROCESSING_STATE.ANALYSIS_FAILED;
  const uploaded = Boolean(basic.cvUploaded || cv.cvUploaded || basic.cvFileName || cv.cvFileName);
  if (!uploaded) return CV_PROCESSING_STATE.NOT_UPLOADED;
  if (basic.cvFileUrl || cv.cvFileUrl) return CV_PROCESSING_STATE.ANALYSIS_PENDING;
  return CV_PROCESSING_STATE.UPLOADED_LOCAL;
}

export function getCvProcessingLabel(state, lang = "TR") {
  const tr = lang === "TR";
  const labels = {
    [CV_PROCESSING_STATE.NOT_UPLOADED]: tr ? "CV yüklenmedi" : "CV not uploaded",
    [CV_PROCESSING_STATE.UPLOADED_LOCAL]: tr
      ? "CV yerel olarak yüklendi. Daha güvenilir analiz için CV’mi Analiz Et butonuyla işle."
      : "CV uploaded locally. Use Analyze My CV for a more reliable read.",
    [CV_PROCESSING_STATE.SAVED_TO_PROFILE]: tr ? "CV profile kaydedildi" : "CV saved to profile",
    [CV_PROCESSING_STATE.ANALYSIS_PENDING]: tr ? "CV — Yüklendi, analiz bekliyor" : "CV — Uploaded, analysis pending",
    [CV_PROCESSING_STATE.ANALYSIS_FAILED]: tr ? "CV analizi tamamlanamadı" : "CV analysis failed",
    [CV_PROCESSING_STATE.ANALYZED]: tr ? "CV — Analiz edildi" : "CV — Analyzed",
  };
  return labels[state] || labels[CV_PROCESSING_STATE.NOT_UPLOADED];
}

/** @deprecated use cvExists from normalizeCvProfile */
export function cvExistsFromLegacy(hasCv, cvStatus) {
  if (cvStatus) return needsCvUpload(cvStatus);
  return Boolean(hasCv);
}
