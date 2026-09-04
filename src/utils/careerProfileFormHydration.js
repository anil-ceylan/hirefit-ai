import {
  EXPERIENCE_SIGNAL_OPTIONS,
  LEADERSHIP_SIGNAL_OPTIONS,
  normalizePortfolioLinks,
  normalizeSignalSelection,
  normalizeUniversityCitiesForProfile,
} from "../../lib/careerOnboarding/constants.js";
import {
  getDefaultLanguagesProfile,
  normalizeLanguagesArray,
} from "../../lib/careerOnboarding/languageProfile.js";
import { resolveCountryCode } from "../data/locationData.js";

function firstPresent(...values) {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function firstObject(...values) {
  return values.find((value) => value && typeof value === "object" && !Array.isArray(value)) || {};
}

function firstArray(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.some((item) => String(item || "").trim())) return value;
  }
  return [];
}

function normalizeLocationObject(location = {}) {
  if (!location || typeof location !== "object" || Array.isArray(location)) return {};
  return location;
}

export function getProfileBasicHydrationPayload(profile = {}) {
  const basic = profile?.basic_profile || {};
  const gpsInputs = profile?.career_gps?.inputs || {};
  const gpsEducation = firstObject(
    gpsInputs.educationLocation,
    gpsInputs.localCareerIntelligence?.education,
    gpsInputs.careerGps,
  );
  const basicEducation = firstObject(
    basic.educationLocation,
    basic.education_location,
    basic.localCareerIntelligence?.education,
  );
  const gpsResidence = firstObject(
    gpsInputs.residenceLocation,
    gpsInputs.location,
    gpsInputs.homeLocation,
  );
  const basicResidence = firstObject(
    basic.residenceLocation,
    basic.residence_location,
    basic.location,
    basic.homeLocation,
  );

  return {
    ...basic,
    educationLocation: Object.keys(basicEducation).length ? basicEducation : gpsEducation,
    education_location: Object.keys(basicEducation).length ? basicEducation : gpsEducation,
    residenceLocation: Object.keys(basicResidence).length ? basicResidence : gpsResidence,
    residence_location: Object.keys(basicResidence).length ? basicResidence : gpsResidence,
  };
}

export function getResidenceCountryCode(basic = {}) {
  const residenceLocation = normalizeLocationObject(basic.residenceLocation || basic.residence_location);
  return resolveCountryCode(
    basic.residenceCountryCode ||
      basic.countryCode ||
      basic.residenceCountry ||
      basic.country ||
      residenceLocation.countryCode ||
      residenceLocation.country ||
      residenceLocation.code
  );
}

function inferEducationStatus(basic = {}) {
  if (basic.educationStatus) return basic.educationStatus;
  const degreeText = String(basic.degree || basic.department || "").toLowerCase();
  if (/phd|doctor|doktora/.test(degreeText)) return "phd_student";
  if (/master|yüksek lisans|yuksek lisans/.test(degreeText)) return "masters_student";
  if (basic.educationLevel === "new_graduate" || basic.classYear === "graduate") return "graduate";
  if (basic.educationLevel === "university_student") return "currently_studying";
  if (basic.educationLevel === "working_professional") return "graduate";
  return "";
}

export function educationLevelFromStatus(status, fallback = "") {
  if (status === "graduate") return "new_graduate";
  if (["currently_studying", "masters_student", "phd_student"].includes(status)) {
    return "university_student";
  }
  return fallback;
}

export function getUniversityCities(basic = {}) {
  const educationLocation = normalizeLocationObject(basic.educationLocation || basic.education_location);
  const normalized = normalizeUniversityCitiesForProfile({
    ...basic,
    universityCities: firstArray(
      basic.universityCities,
      basic.educationCities,
      educationLocation.cities,
      educationLocation.educationCities,
      educationLocation.universityCities
    ),
    universityCity: firstPresent(
      basic.universityCity,
      basic.educationCity,
      educationLocation.city,
      educationLocation.universityCity
    ),
    educationCity: firstPresent(
      basic.educationCity,
      basic.universityCity,
      educationLocation.city,
      educationLocation.educationCity
    ),
  });
  return normalized.universityCities;
}

export function normalizeBasicLocation(bp = {}, lang = "TR", previous = {}) {
  const residenceLocation = normalizeLocationObject(bp.residenceLocation || bp.residence_location);
  const educationLocation = normalizeLocationObject(bp.educationLocation || bp.education_location);
  const residenceCode = getResidenceCountryCode(bp);
  const universityCode = resolveCountryCode(
    bp.universityCountryCode ||
      bp.universityCountry ||
      educationLocation.countryCode ||
      educationLocation.country ||
      educationLocation.code
  );
  const educationStatus = inferEducationStatus(bp);
  const cityFields = normalizeUniversityCitiesForProfile({
    ...bp,
    universityCities: getUniversityCities(bp),
  });
  const normalizedExperienceSignals = normalizeSignalSelection(
    bp.experienceSignals,
    EXPERIENCE_SIGNAL_OPTIONS,
    bp.experienceSignal || ""
  );
  const normalizedLeadershipSignals = normalizeSignalSelection(
    bp.leadershipSignals,
    LEADERSHIP_SIGNAL_OPTIONS,
    bp.leadershipSignal || ""
  );
  const leadershipExperienceStatus =
    bp.leadershipExperienceStatus ||
    (normalizedLeadershipSignals.includes("none") ? "no" : normalizedLeadershipSignals.length ? "yes" : "");
  const residenceCity = firstPresent(
    bp.residenceCity,
    bp.city,
    bp.homeCity,
    residenceLocation.city,
    residenceLocation.homeCity
  );
  const languages = normalizeLanguagesArray(
    bp.languages?.length ? bp.languages : previous.languages,
    lang
  );

  return {
    ...bp,
    ...normalizePortfolioLinks(bp),
    fullName: firstPresent(bp.fullName, bp.name, bp.displayName, [bp.firstName, bp.lastName].filter(Boolean).join(" ")),
    age: firstPresent(bp.age, bp.ageRange),
    languages: languages?.length ? languages : getDefaultLanguagesProfile(lang),
    experienceSignals: normalizedExperienceSignals,
    leadershipSignals: normalizedLeadershipSignals,
    cvUploaded: Boolean(bp.cvUploaded || bp.cvFileName),
    cvSignalCount: Number(bp.cvSignalCount || 0),
    analysisSources: Array.isArray(bp.analysisSources) ? [...new Set(bp.analysisSources)] : [],
    educationStatus,
    educationLevel: educationLevelFromStatus(educationStatus, bp.educationLevel || ""),
    expectedGraduationYear:
      bp.expectedGraduationYear ||
      (educationStatus !== "graduate" ? bp.graduationYear || "" : ""),
    residenceCountryCode: residenceCode,
    residenceCountry: residenceCode,
    countryCode: residenceCode,
    country: residenceCode,
    residenceCity,
    city: residenceCity,
    homeCity: firstPresent(bp.homeCity, residenceCity),
    universityCountryCode: universityCode,
    universityCountry: universityCode,
    ...cityFields,
    universityManual: Boolean(bp.universityManual || bp.universitySource === "manual" || bp.university_source === "manual"),
    livingSituation: bp.livingSituation || "",
    mbtiType: bp.mbtiType || "",
    leadershipExperienceStatus,
  };
}

export function normalizeProfileBasicForForm(currentBasic = {}, profile = {}, lang = "TR") {
  return normalizeBasicLocation(
    {
      ...currentBasic,
      ...getProfileBasicHydrationPayload(profile),
    },
    lang,
    currentBasic
  );
}
