import { SOURCE_TYPES } from "../evidence/evidenceTypes.js";

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value == null || value === "") return [];
  return [value];
}

function compact(value, max = 320) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trim()}...` : text;
}

function stableId(parts) {
  return parts
    .map((part) => String(part || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48))
    .filter(Boolean)
    .join(":") || "evidence";
}

function hasText(value) {
  return compact(value).length > 0;
}

function roleContextFrom(profile = {}, productionSnapshot = {}) {
  const snapshot = profile.career_snapshot || profile.career_gps?.snapshot || productionSnapshot || {};
  const match = snapshot.primaryRoleMatch || snapshot.topRoleMatches?.[0] || snapshot.roleMatches?.[0] || {};
  return match.roleName || match.roleFamily || snapshot.targetRole || profile.target_role || profile.targetRole || profile.target_roles?.[0] || "";
}

function topRolesFrom(snapshot = {}) {
  const roles = snapshot.topRoles || snapshot.topRoleMatches || snapshot.roleMatches || [];
  return asArray(roles).map((role) => ({
    id: role.id || role.roleId || role.roleName || role.name || role,
    label: role.label || role.roleName || role.name || role,
    fit: role.fitPercentage ?? role.roleFitScore ?? role.matchPercentage ?? role.fit ?? null,
    confidence: role.confidence ?? null,
  })).filter((role) => hasText(role.label)).slice(0, 5);
}

function addEvidence(target, warnings, item) {
  if (!item.source || !item.source_type) {
    warnings.push({ code: "DISCARDED_EVIDENCE_WITHOUT_SOURCE", field: item.title || item.type || "unknown" });
    return;
  }
  if (!hasText(item.title) && !hasText(item.description)) {
    warnings.push({ code: "DISCARDED_EMPTY_EVIDENCE", source: item.source });
    return;
  }
  target.push({
    id: item.id || stableId([item.source, item.type, item.title || item.description]),
    type: item.type || "shadow_input",
    title: compact(item.title || item.description, 120),
    description: compact(item.description || item.title),
    source: item.source,
    source_type: item.source_type,
    occurred_at: item.occurred_at || item.date || item.year || "",
    role_context: item.role_context || "",
    skills: asArray(item.skills),
    domains: asArray(item.domains),
    metrics: asArray(item.metrics),
    metadata: {
      ...(item.metadata || {}),
      sourcePath: item.sourcePath || item.source,
      explicitClaim: Boolean(item.explicitClaim),
    },
  });
}

function addClaim(target, value, sourcePath) {
  if (!hasText(value)) return;
  target.push({
    id: stableId(["claim", sourcePath, value]),
    text: compact(value, 220),
    source: sourcePath,
    source_type: SOURCE_TYPES.USER_STATEMENT,
  });
}

function processList(target, warnings, list, { source, source_type, type, roleContext, sourcePath }) {
  for (const [index, raw] of asArray(list).entries()) {
    const item = typeof raw === "string" ? { title: raw, description: raw } : raw || {};
    addEvidence(target, warnings, {
      id: item.id,
      type,
      title: item.title || item.name || item.role || item.company || item.projectName || item.label || `${type} ${index + 1}`,
      description: item.description || item.summary || item.details || item.responsibility || item.achievement || item.title || item.name,
      source,
      source_type,
      occurred_at: item.occurred_at || item.date || item.year || item.endDate || item.end_date || "",
      role_context: item.role_context || item.roleContext || roleContext,
      skills: item.skills,
      domains: item.domains || item.sectors,
      metrics: item.metrics,
      sourcePath: `${sourcePath}.${index}`,
      explicitClaim: source_type === SOURCE_TYPES.USER_STATEMENT || source_type === SOURCE_TYPES.CAREER_DNA,
    });
  }
}

export function adaptHireFitProfileToShadowInput({
  profile = {},
  productionSnapshot = null,
  generatedAt = new Date().toISOString(),
} = {}) {
  const input = profile || {};
  const snapshot = productionSnapshot || input.career_snapshot || input.career_gps?.snapshot || {};
  const roleContext = roleContextFrom(input, snapshot);
  const evidenceItems = [];
  const explicitClaims = [];
  const warnings = [];
  const basic = input.basic_profile || input.basicProfile || {};
  const careerDna = input.career_dna || input.careerDna || input.dna || {};
  const onboarding = input.onboarding_answers || input.onboardingAnswers || input.answers || {};

  processList(evidenceItems, warnings, input.projects || careerDna.projects || onboarding.projects, {
    source: "projects",
    source_type: SOURCE_TYPES.CAREER_DNA,
    type: "project_experience",
    roleContext,
    sourcePath: "projects",
  });
  processList(evidenceItems, warnings, input.work_experience || input.workExperience || input.experience || careerDna.experience, {
    source: "work_experience",
    source_type: SOURCE_TYPES.CV,
    type: "work_experience",
    roleContext,
    sourcePath: "work_experience",
  });
  processList(evidenceItems, warnings, input.internships || careerDna.internships || onboarding.internships, {
    source: "internships",
    source_type: SOURCE_TYPES.CV,
    type: "internship_experience",
    roleContext,
    sourcePath: "internships",
  });
  processList(evidenceItems, warnings, input.certifications || careerDna.certifications || basic.certifications, {
    source: "certifications",
    source_type: SOURCE_TYPES.CAREER_DNA,
    type: "credential",
    roleContext,
    sourcePath: "certifications",
  });
  processList(evidenceItems, warnings, input.education ? asArray(input.education) : [basic.university || input.university].filter(Boolean), {
    source: "education",
    source_type: SOURCE_TYPES.CAREER_DNA,
    type: "education",
    roleContext,
    sourcePath: "education",
  });

  for (const skill of asArray(input.skills || careerDna.skills || onboarding.skills)) {
    addClaim(explicitClaims, skill, "skills");
    addEvidence(evidenceItems, warnings, {
      type: "skill_claim",
      title: skill,
      description: `Self-reported skill: ${skill}`,
      source: "skills",
      source_type: SOURCE_TYPES.USER_STATEMENT,
      role_context: roleContext,
      skills: [skill],
      explicitClaim: true,
    });
  }
  for (const goal of asArray(input.career_goals || input.careerGoals || careerDna.goals || onboarding.goals)) {
    addClaim(explicitClaims, goal, "career_goals");
  }
  for (const role of asArray(input.target_roles || input.targetRoles || careerDna.targetRoles || onboarding.targetRoles)) {
    addClaim(explicitClaims, role, "target_roles");
  }

  if (basic.cvStatus === "analyzed" || basic.cvFileName || input.cv_text || input.cvText) {
    addEvidence(evidenceItems, warnings, {
      type: basic.cvStatus === "analyzed" ? "cv_analyzed_source" : "cv_uploaded_source",
      title: basic.cvFileName || "CV source",
      description: input.cv_summary || input.cvSummary || basic.cvFileName || "CV evidence source exists.",
      source: "cv",
      source_type: SOURCE_TYPES.CV,
      role_context: roleContext,
      sourcePath: "basic_profile.cv",
    });
  }

  for (const [index, raw] of asArray(input.shadow_evidence_items).entries()) {
    const item = raw && typeof raw === "object" ? raw : {};
    addEvidence(evidenceItems, warnings, {
      ...item,
      title: item.title || item.claim || `Shadow evidence ${index + 1}`,
      description: item.description || item.claim || item.title,
      source: item.source || "shadow_evidence_items",
      source_type: item.source_type || SOURCE_TYPES.USER_STATEMENT,
      role_context: item.role_context || roleContext,
      sourcePath: `shadow_evidence_items.${index}`,
      explicitClaim: true,
      metadata: {
        ...(item.metadata || {}),
        shadowOnly: true,
      },
    });
  }

  const strongest = snapshot.strongestSignal || snapshot.strongestCareerSignal;
  if (strongest) {
    addEvidence(evidenceItems, warnings, {
      type: "production_snapshot_signal",
      title: typeof strongest === "string" ? strongest : strongest.title || strongest.label,
      description: typeof strongest === "string" ? strongest : strongest.description || strongest.reason || strongest.title,
      source: "career_snapshot",
      source_type: SOURCE_TYPES.CAREER_SNAPSHOT,
      role_context: roleContext,
      sourcePath: "career_snapshot.strongestSignal",
    });
  }

  const unsupportedKeys = Object.keys(input).filter((key) =>
    /email|phone|raw|password/i.test(key)
  );
  for (const key of unsupportedKeys) warnings.push({ code: "UNSUPPORTED_OR_PRIVATE_FIELD_IGNORED", field: key });

  return {
    userId: input.user_id || input.userId || input.id || null,
    profileId: input.profile_id || input.profileId || null,
    generatedAt,
    evidenceItems,
    explicitClaims,
    existingProductionSnapshot: {
      topRoles: topRolesFrom(snapshot),
      recruiterTrust: snapshot.recruiterTrust ?? snapshot.recruiterConfidence ?? snapshot.recruiterConfidenceScore ?? null,
      careerReadiness: snapshot.careerReadiness ?? snapshot.readinessScore ?? snapshot.careerReadinessScore ?? null,
      biggestGap: snapshot.gapDetails?.title || snapshot.biggestGap?.title || snapshot.biggestGap || null,
      careerPotential: snapshot.careerPotential ?? snapshot.careerPotentialScore ?? snapshot.careerScore ?? null,
    },
    sourceCoverage: {
      onboarding: Object.keys(onboarding || {}).length > 0,
      cv: Boolean(basic.cvFileName || basic.cvStatus === "analyzed" || input.cv_text || input.cvText),
      shadowEvidence: asArray(input.shadow_evidence_items).length > 0,
      careerDna: Object.keys(careerDna || {}).length > 0,
      projects: asArray(input.projects || careerDna.projects || onboarding.projects).length > 0,
      experience: asArray(input.work_experience || input.workExperience || input.experience || careerDna.experience).length > 0,
      education: Boolean(input.education || basic.university || input.university),
      certifications: asArray(input.certifications || careerDna.certifications || basic.certifications).length > 0,
    },
    warnings,
  };
}
