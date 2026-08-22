import {
  flattenAllRoles,
  getIndustryLabel,
  getRoleLabel,
  normalizeRoleList,
  getPrioritizedRoles,
  primaryLookingFor,
  includesLookingFor,
} from "./industries.js";
import { resolveCareerArchetype, traitLabels } from "./careerDna.js";

function tr(lang) {
  return String(lang || "").toUpperCase() === "TR";
}

function topTraits(scores, n = 2) {
  return Object.entries(scores || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

function weakTraits(scores, n = 2) {
  return Object.entries(scores || {})
    .sort((a, b) => a[1] - b[1])
    .slice(0, n)
    .map(([k]) => k);
}

export function generateProfileSummary({ basic = {}, goals = {}, dna = {}, lang = "TR" }) {
  const isTr = tr(lang);
  const labels = traitLabels(lang);
  const scores = dna.traitScores || dna.scores || {};
  const archetypeResolved = resolveCareerArchetype(scores);
  const typeLabel =
    dna.typeLabel || (isTr ? archetypeResolved.labelTr : archetypeResolved.labelEn) || archetypeResolved.id;

  const allRoles = new Set(flattenAllRoles());
  const targetRoles = getPrioritizedRoles(goals).filter((r) => allRoles.has(r));
  const dnaPaths = normalizeRoleList(dna.recommendedPaths || archetypeResolved.paths || []);
  const bestFit = [...new Set([...targetRoles.slice(0, 2), ...dnaPaths])].slice(0, 5);
  const primaryRoleValue = goals.primaryRole || targetRoles[0] || "";
  const primaryRoleLabel = primaryRoleValue ? getRoleLabel(primaryRoleValue, lang) : "";

  const strongDims = topTraits(scores, 2);
  const weakDims = weakTraits(scores, 2);
  const strong_signals = dna.strengths?.length ? dna.strengths : strongDims.map((d) => labels[d] || d).filter(Boolean);
  const weak_signals = dna.weaknesses?.length
    ? dna.weaknesses
    : weakDims.map((d) => (isTr ? `${labels[d] || d} gelişim alanı` : `${labels[d] || d} growth area`));

  const lookingFor = primaryLookingFor(goals);
  const city = basic.city || "";
  const country =
    basic.countryNameTR ||
    basic.countryNameEN ||
    basic.countryCode ||
    basic.residenceCountry ||
    basic.country ||
    goals.targetCountries?.[0] ||
    "";
  const industryId = goals.industries?.[0] || goals.primaryIndustry || "";
  const industry = getIndustryLabel(industryId, lang);

  let career_identity = typeLabel;
  if (primaryRoleLabel) {
    career_identity = `${typeLabel} · ${primaryRoleLabel}`;
  } else if (industry) {
    career_identity = isTr ? `${typeLabel} · ${industry}` : `${typeLabel} · ${industry}`;
  }

  const roleForCopy = primaryRoleLabel || (isTr ? "hedef rol" : "target role");
  const nextMove = isTr
    ? includesLookingFor(goals, "internship") || lookingFor === "internship"
      ? `${country || city || "Hedef"} pazarında ${roleForCopy || industry || "hedef rol"} için staj başvurularına odaklan.`
      : `${roleForCopy || "Hedef rol"} için kanıt hattını netleştir; ${weak_signals[0] || "zayıf alan"} için mini proje ekle.`
    : includesLookingFor(goals, "internship") || lookingFor === "internship"
      ? `Focus internships on ${roleForCopy || industry || "target role"} in ${country || city || "your market"}.`
      : `Sharpen proof for ${roleForCopy || "target role"}; add one project for ${weak_signals[0] || "growth area"}.`;

  const growthLines = isTr
    ? [
        "Hafta 1: Hedef endüstri + rol için profil ve 3 ilan",
        "Hafta 2: Eksik yetkinlik için case study",
        "Hafta 3: 2 başvuru + networking",
        "Hafta  4: CV / readiness skorunu güncelle",
      ]
    : [
        "Week 1: Profile for target industry + role, shortlist 3 jobs",
        "Week 2: Case study for biggest skill gap",
        "Week 3: Two applications + networking",
        "Week 4: Refresh CV / readiness score",
      ];

  return {
    career_identity,
    career_level: mapEducationToLevel(basic.educationLevel),
    primary_role: primaryRoleValue,
    secondary_role: goals.secondaryRole || "",
    tertiary_role: goals.tertiaryRole || "",
    career_archetype: dna.typeId || archetypeResolved.id,
    best_fit_roles: bestFit,
    target_roles: targetRoles.length ? targetRoles : bestFit,
    industries: industryId ? [industryId] : goals.industries || [],
    industryLabel: industry,
    strong_signals,
    weak_signals,
    strengths: strong_signals,
    weaknesses: weak_signals,
    recommended_next_move: nextMove,
    growth_plan_30d: growthLines.join("\n"),
    dna: {
      typeId: dna.typeId || archetypeResolved.id,
      typeLabel,
      scores,
      traitScores: scores,
      strengths: dna.strengths,
      weaknesses: dna.weaknesses,
      recommendedPaths: dna.recommendedPaths || dnaPaths,
    },
  };
}

function mapEducationToLevel(educationLevel) {
  const s = String(educationLevel || "").toLowerCase();
  if (s === "university_student") return "Student";
  if (s === "new_graduate") return "Junior";
  if (s === "working_professional") return "Mid";
  if (s === "career_switcher") return "Switch";
  return "Mid";
}
