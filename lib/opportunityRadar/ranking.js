import { normalizeRoleValue } from "../careerOnboarding/roleCatalog.js";
import { INDUSTRIES, normalizeLookingFor } from "../careerOnboarding/industries.js";
import { normalizeExperienceLevels } from "../careerOnboarding/onboardingOptions.js";
import { resolveCountryCode } from "../../src/data/locationData.js";
import { RANKING_VERSION, LOCATION_RANKING_VERSION, WEIGHTS } from "./constants.js";
import { evaluateLocationMatch } from "./location/evaluation.js";

const normalize = value => String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i");
const list = value => (Array.isArray(value) ? value : typeof value === "string" ? [value] : []).filter(item => typeof item === "string" && item.trim());
const clean = value => [...new Set(list(value).map(normalize))].filter(value => !["unknown", "unsure", "other"].includes(value));
const roles = value => clean(list(value).map(normalizeRoleValue));
const sectorAliases = new Map(INDUSTRIES.flatMap(row => [row.id, row.labelEn, row.labelTr].map(label => [normalize(label), row.id])));
const sectors = value => clean(list(value).map(item => sectorAliases.get(normalize(item)) || item));
const preferred = (...values) => values.find(value => list(value).length) || [];
const labels = {
  target_role: ["Hedef rol", "Target role"], target_sector: ["Hedef sektör", "Target sector"],
  skills: ["Belgelenmiş beceriler", "Recorded skills"], location: ["Hedef konum", "Target location"],
  work_mode: ["Çalışma biçimi", "Work mode"], experience_level: ["Deneyim seviyesi", "Experience level"],
  career_direction: ["İş/staj tercihi", "Job/internship preference"],
};

// Read-only projection; never writes back or invents preferences from residence,
// scores, age, university, or career identity. Explicit goals precede CV inference.
export function profileContext(profile = {}) {
  const goals = profile.career_goals || {};
  return {
    target_role: roles(preferred(goals.targetRoles, goals.roleIds, [goals.primaryRole, goals.secondaryRole, goals.tertiaryRole], profile.target_roles)),
    target_sector: sectors(preferred(goals.industries, goals.sectorIds, profile.industries)),
    skills: clean(profile.skills),
    countries: [...new Set(list(goals.targetCountries).map(resolveCountryCode).filter(Boolean))],
    cities: (Array.isArray(goals.targetCities) ? goals.targetCities : [])
      .filter(item => item && typeof item === "object" && typeof item.city === "string")
      .map(item => ({ country: resolveCountryCode(item.countryCode || item.country), city: normalize(item.city) }))
      .filter(item => item.country && item.city),
    work_mode: clean(preferred(goals.workMode, goals.workModels, goals.workPreferences)).filter(item => ["onsite", "hybrid", "remote", "flexible"].includes(item)),
    experience_level: normalizeExperienceLevels(list(preferred(goals.experienceLevels, goals.experienceLevel, goals.seniority, profile.career_level)).map(normalize)),
    career_direction: normalizeLookingFor(goals.lookingFor).filter(item => item !== "unsure"),
  };
}

function compare(dimension, wanted, offered, allRequired = false) {
  if (!wanted.length || !offered.length) return { dimension, score: null, reason: !wanted.length ? "profile_unknown" : "opportunity_unknown", values: [] };
  const matched = offered.filter(item => wanted.includes(item));
  return { dimension, score: allRequired ? matched.length / offered.length : Number(matched.length > 0),
    reason: matched.length ? "aligned" : dimension === "skills" ? "not_evidenced" : "not_aligned", values: matched,
    uncertain_values: allRequired ? offered.filter(item => !wanted.includes(item)) : [] };
}

function locationSignal(context, opportunity) {
  const unknown = reason => ({ dimension: "location", score: null, reason, values: [] });
  if (!context.countries.length && !context.cities.length) return unknown("profile_unknown");
  const country = resolveCountryCode(opportunity.country);
  if (!country) return unknown("opportunity_unknown");
  const cities = context.cities.filter(item => item.country === country);
  if (cities.length && !opportunity.city) return unknown("opportunity_unknown");
  // Remote does not imply worldwide work authorization or geographic eligibility.
  const aligned = cities.length ? cities.some(item => item.city === normalize(opportunity.city)) : context.countries.includes(country);
  return { dimension: "location", score: Number(aligned), reason: aligned ? "aligned" : "not_aligned", values: aligned ? [country, opportunity.city].filter(Boolean) : [] };
}

export function evaluateOpportunity(opportunity, context, { preference = null, locationSet = null } = {}) {
  const location = preference?.enabled ? evaluateLocationMatch(preference, locationSet, opportunity.work_mode) : null;
  const offeredWork = clean(opportunity.work_mode);
  const signals = [
    compare("target_role", context.target_role, roles(opportunity.role_tags)),
    compare("target_sector", context.target_sector, sectors(opportunity.sector_tags)),
    compare("skills", context.skills, clean(opportunity.skill_tags), true),
    location ? location.signal : locationSignal(context, opportunity),
    compare("work_mode", context.work_mode.includes("flexible") && offeredWork.length ? offeredWork : context.work_mode, offeredWork),
    compare("experience_level", context.experience_level, normalizeExperienceLevels(list(opportunity.requirements?.experience_levels).map(normalize))),
    compare("career_direction", context.career_direction, [opportunity.subtype]),
  ].map(signal => ({ ...signal, weight: WEIGHTS[signal.dimension] }));
  const known = signals.filter(signal => signal.score !== null);
  const coverage = known.reduce((sum, signal) => sum + signal.weight, 0);
  return { id: opportunity.id, signals, alignment_coverage: coverage,
    ...(location ? { location_match: location.metadata, nearby: location.nearby } : {}),
    match_score: coverage ? Math.round(known.reduce((sum, signal) => sum + signal.weight * signal.score, 0) / coverage * 100) : null };
}

export function rankOpportunity(opportunity, profile, state = null, { lang = "TR", now = new Date(), preference = null, locationSet = null } = {}) {
  const { signals, alignment_coverage: coverage, match_score, location_match } = evaluateOpportunity(opportunity, profileContext(profile), { preference, locationSet });
  const matched = signals.filter(signal => signal.score > 0);
  const uncertain = signals.filter(signal => signal.score === null || signal.score < 1).map(signal => ({ ...signal,
    reason: signal.uncertain_values?.length ? "not_evidenced" : signal.reason }));
  const tr = lang === "TR";
  let whyNow = null;
  if (Date.parse(opportunity.deadline_at) > now.getTime()) {
    whyNow = { code: "application_deadline", date: opportunity.deadline_at,
      text: `${tr ? "İlanda belirtilen son başvuru tarihi" : "Application deadline stated in the listing"}: ${opportunity.deadline_at.slice(0, 10)}` };
  } else if (Date.parse(opportunity.starts_at) > now.getTime()) {
    whyNow = { code: "start_date", date: opportunity.starts_at,
      text: `${tr ? "İlanda belirtilen başlangıç tarihi" : "Start date stated in the listing"}: ${opportunity.starts_at.slice(0, 10)}` };
  }
  return { ...opportunity, match_score,
    score_kind: "profile_alignment", alignment_coverage: coverage, ranking_version: preference?.enabled ? LOCATION_RANKING_VERSION : RANKING_VERSION,
    ...(location_match ? { location_match } : {}),
    matched_signals: matched, missing_or_uncertain_signals: uncertain,
    why_this_matches_you: matched.map(signal => signal.dimension === "location" && location_match ?
      (location_match.kind === "same_city" ?
        (tr ? "İncelenmiş şehir kimliği arama konumunla aynı; mesafe doğrulanmadı." : "Reviewed city identity matches your search location; distance is unconfirmed.") :
        (tr ? "İncelenmiş konum yaklaşık kuş uçuşu arama yarıçapında; ulaşım süresi değildir." : "Reviewed location is within the approximate straight-line search radius, not a commute estimate.")) :
      `${labels[signal.dimension][tr ? 0 : 1]}${tr ? " ile örtüşen bilgi var." : " has supporting alignment."}`),
    why_now: whyNow,
    recommended_next_action: { code: "review_source_requirements", url: opportunity.url,
      text: tr ? "Kaynağı aç; başvuru ve uygunluk koşullarını doğrula." : "Open the source and verify application and eligibility requirements." },
    current_user_state: state,
  };
}

export function sortRankedOpportunities(items) {
  return items.sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1) || b.alignment_coverage - a.alignment_coverage || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
