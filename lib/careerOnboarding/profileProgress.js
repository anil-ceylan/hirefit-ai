const HISTORY_LIMIT = 80;
const DEVELOPMENT_EVENT_FIELDS = new Set([
  "experience_signals",
  "leadership_signals",
  "projects",
  "english_level",
  "cv_status",
  "portfolio_links",
]);

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function stableHash(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value || {});
  let result = 5381;
  for (const char of text) result = ((result << 5) + result) ^ char.charCodeAt(0);
  return (result >>> 0).toString(36);
}

function compactValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).trim();
}

function stableValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String).sort().join("|");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "").trim();
}

function getPath(source = {}, path = "") {
  return path.split(".").reduce((value, key) => (value && value[key] != null ? value[key] : undefined), source);
}

function englishLevel(profile = {}) {
  const languages = asArray(profile.basic_profile?.languages);
  const english = languages.find((item) => /english|ingilizce|İngilizce/i.test(String(item?.name || item?.language || item?.id || "")));
  return english?.level || english?.proficiency || profile.career_readiness?.benchmarks?.english || "";
}

function scoreValue(profile = {}, key) {
  const snapshot = profile.career_snapshot || profile.career_gps?.snapshot || {};
  const candidates = {
    career_potential: [
      snapshot.careerPotential,
      snapshot.career_potential,
      snapshot.careerScore,
      snapshot.career_score,
    ],
    career_readiness: [
      snapshot.careerReadiness,
      snapshot.career_readiness,
      snapshot.readinessScore,
      profile.career_readiness?.score,
    ],
    recruiter_trust: [
      snapshot.recruiterTrust,
      snapshot.recruiter_trust,
      snapshot.recruiterConfidence,
      snapshot.recruiter_confidence,
    ],
    role_fit: [
      snapshot.bestRoleMatch?.match,
      snapshot.bestRoleMatch?.score,
      snapshot.roleMatch,
      snapshot.role_fit,
    ],
  }[key] || [];
  const numeric = candidates.map(Number).find((item) => Number.isFinite(item));
  return Number.isFinite(numeric) ? Math.round(numeric) : null;
}

function profileComparable(profile = {}) {
  return {
    target_roles: asArray(profile.career_goals?.targetRoles || profile.target_roles),
    target_sectors: asArray(profile.career_goals?.industries || profile.industries),
    target_countries: asArray(profile.career_goals?.targetCountries || profile.target_countries),
    company_stages: asArray(profile.career_goals?.companyStages),
    experience_levels: asArray(profile.career_goals?.experienceLevels),
    work_mode: asArray(profile.career_goals?.workMode || profile.career_goals?.preferredLocation),
    experience_signals: asArray(profile.basic_profile?.experienceSignals),
    leadership_signals: asArray(profile.basic_profile?.leadershipSignals),
    projects: profile.career_readiness?.benchmarks?.projects || profile.basic_profile?.projectCount || "",
    network: profile.career_readiness?.benchmarks?.network || "",
    english_level: englishLevel(profile),
    cv_status: profile.basic_profile?.cvStatus || (profile.basic_profile?.cvUploaded ? "uploaded" : ""),
    cv_signal_count: Number(profile.basic_profile?.cvSignalCount || 0),
    portfolio_links: [
      profile.basic_profile?.linkedin ? "linkedin" : "",
      profile.basic_profile?.github ? "github" : "",
      profile.basic_profile?.portfolio ? "portfolio" : "",
      profile.basic_profile?.website ? "website" : "",
      profile.basic_profile?.behance ? "behance" : "",
      profile.basic_profile?.dribbble ? "dribbble" : "",
    ].filter(Boolean),
    career_potential: scoreValue(profile, "career_potential"),
    career_readiness: scoreValue(profile, "career_readiness"),
    recruiter_trust: scoreValue(profile, "recruiter_trust"),
    role_fit: scoreValue(profile, "role_fit"),
  };
}

const FIELD_LABELS = {
  target_roles: "Target role",
  target_sectors: "Target sector",
  target_countries: "Target country",
  company_stages: "Company stage",
  experience_levels: "Experience level",
  work_mode: "Work preference",
  experience_signals: "Experience",
  leadership_signals: "Leadership",
  projects: "Projects",
  network: "Network",
  english_level: "English",
  cv_status: "CV",
  cv_signal_count: "CV evidence",
  portfolio_links: "Portfolio links",
  career_potential: "Career Potential",
  career_readiness: "Career Readiness",
  recruiter_trust: "Recruiter Trust",
  role_fit: "Role Fit",
};

export function buildProfileChangeEvents(previousProfile, nextProfile, { now = new Date().toISOString(), source = "profile_edit" } = {}) {
  if (!nextProfile?.onboarding_completed) return [];
  const previous = previousProfile?.onboarding_completed ? profileComparable(previousProfile) : {};
  const next = profileComparable(nextProfile);
  const events = [];

  if (!previousProfile?.onboarding_completed) {
    events.push({
      event_id: `profile_change_${stableHash({ field: "career_dna_completed", now })}`,
      field: "career_dna_completed",
      label: "Career DNA",
      old_value: "",
      new_value: "completed",
      timestamp: now,
      source,
      origin: "user_entered",
      evidence_relevant: false,
    });
    return events;
  }

  Object.entries(next).forEach(([field, newValue]) => {
    const oldValue = previous[field];
    if (stableValue(oldValue) === stableValue(newValue)) return;
    const oldDisplay = compactValue(oldValue);
    const newDisplay = compactValue(newValue);
    if (!oldDisplay && !newDisplay) return;
    events.push({
      event_id: `profile_change_${stableHash({ field, oldDisplay, newDisplay, now })}`,
      field,
      label: FIELD_LABELS[field] || field,
      old_value: oldDisplay,
      new_value: newDisplay,
      timestamp: now,
      source,
      origin: field.includes("trust") || field.includes("readiness") || field.includes("fit") || field.includes("potential")
        ? "evidence_derived"
        : "user_entered",
      evidence_relevant: DEVELOPMENT_EVENT_FIELDS.has(field),
    });
  });

  return events;
}

function eventToDevelopmentCandidate(event = {}, { userId, now }) {
  if (!event.evidence_relevant) return null;
  return {
    candidate_id: `profile_candidate_${stableHash({ userId, field: event.field, newValue: event.new_value })}`,
    user_id: userId || null,
    source: "career_profile_update",
    source_type: "user_statement",
    candidate_type: "profile_development",
    target_dimension: event.field,
    claim: `${event.label} updated`,
    preliminary_strength: "structured",
    evaluation_status: "pending_review",
    created_at: now,
    updated_at: now,
    provenance: {
      profile_change_event_id: event.event_id,
      field: event.field,
      source: event.source,
    },
    missing_fields: ["external_verification", "measurable_result"],
  };
}

export function mergeProfileProgressIntoCareerGps(existingCareerGps = {}, nextCareerGps = {}, events = [], { userId, now = new Date().toISOString() } = {}) {
  const previousHistory = asArray(existingCareerGps.profile_history);
  const existingIds = new Set(previousHistory.map((event) => event.event_id).filter(Boolean));
  const newEvents = events.filter((event) => event?.event_id && !existingIds.has(event.event_id));
  const profileHistory = [...newEvents, ...previousHistory].slice(0, HISTORY_LIMIT);

  const existingLoop = existingCareerGps.decision_loop || {};
  const nextLoop = nextCareerGps.decision_loop || existingLoop || {};
  const candidates = asArray(nextLoop.evidence_candidates || existingLoop.evidence_candidates);
  const candidateIds = new Set(candidates.map((item) => item.candidate_id).filter(Boolean));
  const developmentCandidates = newEvents
    .map((event) => eventToDevelopmentCandidate(event, { userId, now }))
    .filter((candidate) => candidate && !candidateIds.has(candidate.candidate_id));

  return {
    ...existingCareerGps,
    ...nextCareerGps,
    profile_history: profileHistory,
    profile_progress: {
      ...(existingCareerGps.profile_progress || {}),
      last_profile_update_at: newEvents[0]?.timestamp || existingCareerGps.profile_progress?.last_profile_update_at || null,
      total_changes: profileHistory.length,
      last_change_fields: newEvents.slice(0, 6).map((event) => event.field),
    },
    decision_loop: {
      ...existingLoop,
      ...nextLoop,
      evidence_candidates: [...developmentCandidates, ...candidates].slice(0, 80),
    },
  };
}

export function getRecentProfileProgress(profile = {}, { days = 30, now = new Date().toISOString() } = {}) {
  const history = asArray(getPath(profile, "career_gps.profile_history"));
  const since = new Date(now).getTime() - days * 24 * 60 * 60 * 1000;
  return history.filter((event) => {
    const ts = new Date(event.timestamp || event.created_at || 0).getTime();
    return Number.isFinite(ts) && ts >= since;
  });
}
