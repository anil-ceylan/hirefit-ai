import { isReadinessComplete } from "./readinessBenchmarks.js";
import { normalizeLookingFor } from "./industries.js";
import { validateLanguagesArray } from "./languageProfile.js";
import { MAX_TARGET_ROLES } from "./careerSignalSchema.js";

/**
 * @param {object} params
 * @returns {{ ok: boolean, missing: string[] }}
 */
export function validateOnboardingForComplete({
  basic,
  goals,
  selectedIndustries,
  dnaAnswers,
  readinessAnswers,
  cv,
  lang = "TR",
}) {
  const tr = String(lang).toUpperCase() === "TR";
  const missing = [];

  const nameOk = basic?.fullName?.trim() || basic?.firstName?.trim();
  if (!nameOk) missing.push(tr ? "Ad soyad" : "Full name");
  if (!basic?.age) missing.push(tr ? "Yaş" : "Age");
  if (!basic?.university?.trim()) missing.push(tr ? "Üniversite" : "University");
  if (!(basic?.degree || basic?.department)?.trim()) missing.push(tr ? "Bölüm" : "Department");
  if (!basic?.educationStatus) missing.push(tr ? "Eğitim durumu" : "Education status");
  if (basic?.educationStatus === "currently_studying" && !basic?.classYear) {
    missing.push(tr ? "Sınıf" : "Class year");
  }
  if (
    ["currently_studying", "masters_student", "phd_student"].includes(basic?.educationStatus) &&
    !basic?.expectedGraduationYear
  ) {
    missing.push(tr ? "Beklenen mezuniyet yılı" : "Expected graduation year");
  }
  if (basic?.educationStatus === "graduate" && !basic?.graduationYear) {
    missing.push(tr ? "Mezuniyet yılı" : "Graduation year");
  }
  if (!basic?.residenceCountryCode && !basic?.countryCode && !basic?.residenceCountry) {
    missing.push(tr ? "İkamet ülkesi" : "Country of residence");
  }
  if (!(basic?.residenceCity || basic?.city)?.trim()) {
    missing.push(tr ? "İkamet şehri" : "City of residence");
  }
  if (!basic?.universityCountryCode) missing.push(tr ? "Üniversite ülkesi" : "University country");
  const universityCities = Array.isArray(basic?.universityCities)
    ? basic.universityCities.filter((city) => String(city || "").trim())
    : basic?.universityCity?.trim()
      ? [basic.universityCity.trim()]
      : [];
  if (!universityCities.length) missing.push(tr ? "Eğitim şehri" : "Education city");
  if (!basic?.livingSituation) missing.push(tr ? "Yaşam düzeni" : "Living situation");

  const langCheck = validateLanguagesArray(basic?.languages, lang);
  if (!langCheck.ok) missing.push(tr ? "Dil bilgileri" : "Language details");

  if (!selectedIndustries?.length) missing.push(tr ? "Sektör" : "Sector");
  if (selectedIndustries?.length > MAX_TARGET_ROLES) {
    missing.push(tr ? "En fazla 3 sektör" : "Maximum 3 sectors");
  }
  const lookingForList = normalizeLookingFor(goals?.lookingFor);
  if (!lookingForList.length) {
    missing.push(tr ? "Ne arıyorsun?" : "What you're looking for");
  }
  if (lookingForList.length > MAX_TARGET_ROLES) {
    missing.push(tr ? "En fazla 3 tercih" : "Maximum 3 preferences");
  }
  if (!goals?.targetRoles?.length) missing.push(tr ? "Hedef rol" : "Target role");
  if ((goals?.targetRoles || []).length > MAX_TARGET_ROLES) {
    missing.push(tr ? "En fazla 3 hedef rol" : "Maximum 3 target roles");
  }
  if (!goals?.primaryRole) missing.push(tr ? "Birincil hedef rol" : "Primary target role");
  if (!(goals?.experienceLevels?.length || goals?.experienceLevel || goals?.seniority)) {
    missing.push(tr ? "Deneyim seviyesi" : "Experience level");
  }

  const dnaCount = Object.keys(dnaAnswers || {}).filter((key) => {
    const value = Number(dnaAnswers[key]);
    return Number.isFinite(value) && value >= 1 && value <= 5;
  }).length;
  if (dnaCount < 10) missing.push(tr ? "DNA testi (10 soru)" : "DNA assessment (10 questions)");

  if (!isReadinessComplete(readinessAnswers)) {
    missing.push(tr ? "Kariyer hazırlığı benchmarkları" : "Career readiness benchmarks");
  }

  if (!cv?.cvStatus) missing.push(tr ? "CV durumu" : "CV status");
  if (cv?.cvStatus !== "none" && !(cv?.cvLastUpdatedRange || cv?.cvLastUpdated)) {
    missing.push(tr ? "CV güncelliği" : "CV recency");
  }

  return { ok: missing.length === 0, missing };
}
