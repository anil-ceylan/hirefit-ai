/** Career DNA onboarding — CV status & freshness */

export const CV_STATUS = {
  NONE: "none",
  OUTDATED: "outdated",
  CURRENT: "current",
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

/** @deprecated use cvExists from normalizeCvProfile */
export function cvExistsFromLegacy(hasCv, cvStatus) {
  if (cvStatus) return needsCvUpload(cvStatus);
  return Boolean(hasCv);
}
