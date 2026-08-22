/**
 * Rule-based Career OS intelligence from onboarding profile.
 * Powers GPS, university/city intel, and pre-CV readiness scoring.
 */

import {
  getIndustryContext,
  getIndustryLabel,
  getRoleLabel,
  normalizeRoleList,
  includesLookingFor,
} from "../careerOnboarding/industries.js";
import {
  READINESS_PILLAR_KEYS,
  normalizeReadinessAnswers,
  getReadinessPillarLabel,
  getReadinessOptionLabel,
} from "../careerOnboarding/readinessBenchmarks.js";
import { normalizeTraitScoresTo100 } from "./evidenceDimensions.js";
import { buildCvEvidenceLayer } from "./cvEvidenceLayer.js";

function tr(lang) {
  return String(lang || "").toUpperCase() === "TR";
}

function clamp(n, min = 0, max = 100) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.round(x)));
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const UNI_HINTS = [
  { match: /bogazici|boun|b\.u\./, tr: { strengths: ["Güçlü analitik kültür", "İngilizce ortam"], clubs: ["BÜİK", "Product Club", "Case Study Society"] }, en: { strengths: ["Strong analytic culture", "English-medium environment"], clubs: ["BÜİK", "Product Club", "Case Study Society"] } },
  { match: /odtu|metu|middle east technical/, tr: { strengths: ["Mühendislik disiplini", "Teknik derinlik"], clubs: ["METU Product", "IEEE", "Startup Club METU"] }, en: { strengths: ["Engineering discipline", "Technical depth"], clubs: ["METU Product", "IEEE", "Startup Club METU"] } },
  { match: /itu|istanbul technical/, tr: { strengths: ["Tasarım + mühendislik", "Endüstri bağlantıları"], clubs: ["ITU Entrepreneurship", "Design Society"] }, en: { strengths: ["Design + engineering blend", "Industry ties"], clubs: ["ITU Entrepreneurship", "Design Society"] } },
  { match: /koc|sabanci|bilgi|ozyegin/, tr: { strengths: ["İş dünyası ağı", "Uluslararası staj"], clubs: ["Consulting Club", "Marketing Society", "Impact Hub"] }, en: { strengths: ["Business network", "International internships"], clubs: ["Consulting Club", "Marketing Society", "Impact Hub"] } },
];

const CITY_HINTS = [
  { match: /istanbul/, tr: { ecosystem: "Güçlü startup ve scale-up yoğunluğu", events: ["Webrazzi", "Startup Istanbul meetups", "Üniversite kariyer fuarları"] }, en: { ecosystem: "Dense startup and scale-up scene", events: ["Webrazzi", "Startup Istanbul meetups", "Campus career fairs"] } },
  { match: /ankara/, tr: { ecosystem: "Kamu + teknoloji karışımı", events: ["ODTÜ kariyer günleri", "Policy & tech meetups"] }, en: { ecosystem: "Public sector + tech mix", events: ["METU career days", "Policy & tech meetups"] } },
  { match: /izmir/, tr: { ecosystem: "Üretim + SaaS büyümesi", events: ["Ege üniversite etkinlikleri", "Sahil networking"] }, en: { ecosystem: "Manufacturing + SaaS growth", events: ["Ege university events", "Coastal networking"] } },
  { match: /london|berlin|amsterdam|dublin/, tr: { ecosystem: "Global tech hub", events: ["Meetup.com tech", "University alumni chapters"] }, en: { ecosystem: "Global tech hub", events: ["Meetup.com tech", "University alumni chapters"] } },
];

function matchHint(hints, text) {
  const n = norm(text);
  for (const h of hints) {
    if (h.match.test(n)) return h;
  }
  return null;
}

function englishScoreFromLanguages(languages = []) {
  let best = 0;
  const map = { A1: 28, A2: 35, B1: 50, B2: 68, C1: 82, C2: 92, native: 98, none: 0 };
  for (const row of languages) {
    const langName = norm(row.name || row.language);
    const isEnglish =
      row.type === "english" || /english|ingilizce/.test(langName);
    if (!isEnglish) continue;
    const lvl = String(row.level || "").trim().toLowerCase();
    const code =
      lvl === "ana dil" || lvl === "native"
        ? "native"
        : lvl === "bilmiyorum"
          ? "none"
          : row.level;
    const levelScore = map[code] ?? 0;
    best = Math.max(best, levelScore);
  }
  return best || 45;
}

export function buildUniversityIntelligence(basic, lang) {
  const isTr = tr(lang);
  const university = basic.university || basic.school || "";
  const degree = basic.department || basic.degree || "";
  const hint = matchHint(UNI_HINTS, university);
  const pack = hint ? (isTr ? hint.tr : hint.en) : null;

  const strengths = pack?.strengths || [
    isTr ? "Disiplinler arası proje kültürü" : "Interdisciplinary project culture",
    isTr ? "Kariyer merkezi ve alumni ağı" : "Career center and alumni network",
  ];
  const clubs = pack?.clubs || [
    isTr ? "Ürün / girişimcilik kulübü" : "Product / entrepreneurship club",
    isTr ? "Case study & consulting society" : "Case study & consulting society",
    isTr ? "Veri / analitik topluluğu" : "Data / analytics community",
  ];
  const activities = [
    isTr ? `${degree || "Bölüm"} için 1 portfolio case study` : `One portfolio case study for ${degree || "your major"}`,
    isTr ? "Hackathon veya ürün yarışmasına katılım" : "Join a hackathon or product competition",
    isTr ? "LinkedIn'de haftalık 1 içgörü paylaşımı" : "Share one career insight weekly on LinkedIn",
  ];
  const advantages = [
    isTr ? "Kampüs ağı ile ilk staj referansı" : "Campus network for first internship referral",
    isTr ? "Grup projelerini CV kanıtına çevirme" : "Turn group projects into CV proof",
  ];
  const risks = [
    isTr ? "Sadece not ortalamasına odaklanmak" : "Focusing only on GPA",
    isTr ? "İngilizce CV hazırlamadan mezun kalmak" : "Graduating without an English CV",
  ];

  return {
    university,
    degree,
    strengths,
    recommendedClubs: clubs,
    recommendedActivities: activities,
    careerAdvantages: advantages,
    careerRisks: risks,
  };
}

export function buildCityIntelligence(basic, goals, lang) {
  const isTr = tr(lang);
  const targetCityRow = (goals?.targetCities || []).find((t) => t?.city);
  const city = basic.city || targetCityRow?.city || "";
  const country =
    basic.countryNameTR ||
    basic.countryNameEN ||
    basic.countryCode ||
    basic.country ||
    basic.residenceCountry ||
    goals?.targetCountries?.[0] ||
    targetCityRow?.countryCode ||
    targetCityRow?.country ||
    "";
  const key = `${city} ${country}`;
  const hint = matchHint(CITY_HINTS, key) || matchHint(CITY_HINTS, city);
  const pack = hint ? (isTr ? hint.tr : hint.en) : null;

  return {
    city,
    country,
    networkingOpportunities: [
      isTr ? `${city || "Şehir"} üniversite–şirket buluşmaları` : `${city || "City"} university–company mixers`,
      isTr ? "Alumni LinkedIn grupları" : "Alumni LinkedIn groups",
      isTr ? "Sektör Slack / Discord toplulukları" : "Industry Slack / Discord communities",
    ],
    careerEvents: pack?.events || [
      isTr ? "Kariyer fuarları ve staj günleri" : "Career fairs and internship days",
      isTr ? "Startup demo günleri" : "Startup demo days",
    ],
    startupEcosystem: pack?.ecosystem || (isTr ? "Yerel startup ve KOBİ işe alım döngüsü" : "Local startup and SME hiring cycles"),
    professionalCommunities: [
      isTr ? "Product Türkiye / Growth toplulukları" : "Product / Growth communities",
      isTr ? "Meetup & Eventbrite tech etkinlikleri" : "Meetup & Eventbrite tech events",
      (Array.isArray(goals.workMode) && goals.workMode.includes("remote")) ||
        (Array.isArray(goals.preferredLocation) && goals.preferredLocation.includes("remote"))
        ? isTr
          ? "Remote-first global topluluklar"
          : "Remote-first global communities"
        : isTr
          ? "Yüz yüze networking kulüpleri"
          : "In-person networking clubs",
    ],
  };
}

export function buildCareerGps({ basic, goals, dna, summary, lang }) {
  const isTr = tr(lang);
  const industryId = goals.industries?.[0] || goals.primaryIndustry || "";
  const industryLabel = getIndustryLabel(industryId, lang);
  const normalizedTargets = normalizeRoleList(goals.targetRoles || summary?.target_roles || []);
  const targetRoleValue =
    goals.primaryRole ||
    normalizedTargets[0] ||
    normalizeRoleList(summary?.best_fit_roles || [])[0] ||
    "";
  const industryCtx = getIndustryContext(industryId, { goals, targetRoles: normalizedTargets, lang });
  const targetRole = targetRoleValue
    ? getRoleLabel(targetRoleValue, lang)
    : isTr
      ? "Hedef rol"
      : "Target role";
  const seniority =
    goals.experienceLevel ||
    goals.seniority ||
    (Array.isArray(goals.experienceLevels) && goals.experienceLevels[0]) ||
    "entry";
  const isInternship = includesLookingFor(goals, "internship");
  const dnaLabel = dna?.typeLabel || dna?.typeId || "";

  const currentPosition = isTr
    ? `${dnaLabel ? `${dnaLabel} profili · ` : ""}${industryLabel ? `${industryLabel} · ` : ""}${seniority} · ${basic.university || "Üniversite"} ${basic.classYear || basic.graduationYear || ""}`.trim()
    : `${dnaLabel ? `${dnaLabel} profile · ` : ""}${industryLabel ? `${industryLabel} · ` : ""}${seniority} · ${basic.university || "University"} ${basic.classYear || basic.graduationYear || ""}`.trim();

  const marketLabel =
    basic.countryNameTR ||
    basic.countryNameEN ||
    goals.targetCountries?.[0] ||
    basic.countryCode ||
    basic.country ||
    (isTr ? "hedef pazar" : "target market");

  const targetPosition = isTr
    ? `${isInternship ? "Staj: " : ""}${targetRole} · ${industryLabel || marketLabel}`
    : `${isInternship ? "Internship: " : ""}${targetRole} · ${industryLabel || marketLabel}`;

  const months =
    isInternship
      ? 3
      : seniority === "intern" || seniority === "entry" || seniority === "junior" || seniority === "entry-level" || seniority === "new_graduate"
        ? 6
        : 9;

  const sectorAction = isTr
    ? `${industryLabel || "Sektör"} için ATS anahtar kelimelerini CV'ne ekle`
    : `Add ${industryLabel || "sector"} ATS keywords to your CV`;
  const keywordSample = (industryCtx.atsKeywords || []).slice(0, 3).join(", ");

  const roadmap = isTr
    ? [
        { phase: "1", title: "Temel", actions: [sectorAction, `Hedef rol için 5 ${industryLabel || "sektör"} ilanı araştır`, keywordSample ? `Anahtar kelimeler: ${keywordSample}` : null].filter(Boolean) },
        { phase: "2", title: "Kanıt", actions: ["1 mini proje veya case study", industryCtx.cvImprovementTips?.[0] || "LinkedIn profilini hedef role göre yaz"] },
        { phase: "3", title: "Başvuru", actions: [`${industryCtx.suggestedJobs?.[0] || targetRole} için 3 kaliteli başvuru`, "Networking: 2 görüşme"] },
        { phase: "4", title: "Mülakat", actions: ["Rol bazlı mülakat soruları", industryCtx.cvImprovementTips?.[1] || "Geri bildirimle CV revizyonu"] },
      ]
    : [
        { phase: "1", title: "Foundation", actions: [sectorAction, `Research 5 ${industryLabel || "sector"} job postings`, keywordSample ? `Keywords: ${keywordSample}` : null].filter(Boolean) },
        { phase: "2", title: "Proof", actions: ["One mini project or case study", industryCtx.cvImprovementTips?.[0] || "Rewrite LinkedIn for target role"] },
        { phase: "3", title: "Apply", actions: [`Three quality applications for ${industryCtx.suggestedJobs?.[0] || targetRole}`, "Networking: 2 conversations"] },
        { phase: "4", title: "Interview", actions: ["Role-specific interview prep", industryCtx.cvImprovementTips?.[1] || "CV revision from feedback"] },
      ];

  return {
    currentPosition,
    targetPosition,
    timelineMonths: months,
    estimatedTimelineLabel: isTr ? `~${months} ay` : `~${months} mo`,
    roadmap,
    longTermVision: isTr
      ? `${industryLabel || "Hedef sektör"} · ${targetRole} yolunda ölçülebilir kanıt biriktirerek ${months} ay içinde başvuruya hazır ol.`
      : `Build measurable proof toward ${targetRole} in ${industryLabel || "your sector"} and be application-ready in ~${months} months.`,
    industryId: industryCtx.industryId,
    industryLabel: industryCtx.industryLabel,
    suggestedJobs: industryCtx.suggestedJobs,
    atsKeywords: industryCtx.atsKeywords,
    marketIntelligence: industryCtx.marketIntelligence,
    cvImprovementTips: industryCtx.cvImprovementTips,
    roleScores: industryCtx.roleScores,
  };
}

export function buildCareerReadiness({ basic, goals, dna, readinessAnswers, hasCv = false, lang }) {
  const isTr = tr(lang);
  const langCode = isTr ? "TR" : "EN";
  const { benchmarks, scores: benchmarkScores } = normalizeReadinessAnswers(readinessAnswers || {});

  const traitNorm = normalizeTraitScoresTo100(dna?.traitScores || dna?.scores || {});
  const inferred = {
    english: englishScoreFromLanguages(basic.languages),
    network: goals.companyTypes?.length ? 55 : 38,
    experience: experienceScoreFromGoals(goals, basic.educationLevel),
    projects: clamp(traitNorm.execution * 0.45 + traitNorm.creativity * 0.35 + 25),
    leadership: clamp(traitNorm.leadership * 0.55 + traitNorm.communication * 0.25 + 20),
  };

  const scored = READINESS_PILLAR_KEYS.map((key) => {
    const benchId = benchmarks[key];
    const tierScore = benchmarkScores[key];
    const score =
      benchId && tierScore != null ? clamp(tierScore * 20) : inferred[key];
    const tip = readinessTip(key, score, isTr);
    return {
      key,
      label: getReadinessPillarLabel(key, langCode),
      score,
      tip,
      benchmarkId: benchId || "",
      benchmarkLabel: benchId ? getReadinessOptionLabel(key, benchId, langCode) : "",
    };
  });

  const score = clamp(scored.reduce((s, p) => s + p.score, 0) / scored.length);
  const summary = isTr
    ? hasCv
      ? `CV'n var; readiness skoru profilini tamamlar (${score}/100).`
      : `CV olmadan kariyer hazırlığın: ${score}/100 — önce ${scored.sort((a, b) => a.score - b.score)[0]?.label} alanını güçlendir.`
    : hasCv
      ? `You have a CV; readiness score complements your profile (${score}/100).`
      : `Career readiness without a CV: ${score}/100 — strengthen ${scored.sort((a, b) => a.score - b.score)[0]?.label} first.`;

  return {
    score,
    pillars: scored,
    benchmarks,
    readinessAnswers: benchmarks,
    hasCv: Boolean(hasCv),
    summary,
    measuredAt: new Date().toISOString(),
  };
}

function experienceScoreFromGoals(goals = {}, educationLevel) {
  const levels = goals.experienceLevels;
  if (Array.isArray(levels) && levels.length) {
    return Math.max(...levels.map((id) => mapExperienceScore(id, educationLevel)));
  }
  return mapExperienceScore(goals.experienceLevel || goals.seniority, educationLevel);
}

function mapExperienceScore(seniority, educationLevel) {
  const s = norm(seniority);
  if (s === "manager") return 78;
  if (s === "senior" || s === "mid" || s === "manager") return 72;
  if (s === "entry" || s === "junior" || s === "entry-level" || s === "new_graduate") return 52;
  if (s === "new_graduate" || s === "new-graduate") return 48;
  if (s === "intern") return 38;
  if (norm(educationLevel).includes("university")) return 42;
  return 45;
}

function readinessTip(key, score, isTr) {
  if (score >= 75) return isTr ? "Güçlü — kanıtı CV'ye taşı." : "Strong — move proof onto your CV.";
  const tips = {
    english: isTr ? "B2+ hedefle; İngilizce CV satırı ekle." : "Aim for B2+; add an English CV line.",
    network: isTr ? "Haftada 2 LinkedIn mesajı veya 1 etkinlik." : "Two LinkedIn messages or one event per week.",
    experience: isTr ? "Staj / freelance ile ilk iş deneyimini al." : "Land first work signal via internship or freelance.",
    projects: isTr ? "Tek sayfalık case study yayınla." : "Publish a one-page case study.",
    leadership: isTr ? "Kulüp veya proje liderliği üstlen." : "Take a club or project lead role.",
  };
  return tips[key] || "";
}

export function buildCareerIntelligence(profileInput, { hasCv = false, readinessAnswers, lang = "TR" } = {}) {
  const basic = profileInput.basic_profile || profileInput.basic || {};
  const goals = profileInput.career_goals || profileInput.goals || {};
  const dna = profileInput.career_dna || profileInput.dna || {};
  const summary = profileInput;

  const result = {
    career_gps: buildCareerGps({ basic, goals, dna, summary, lang }),
    university_intelligence: buildUniversityIntelligence(basic, lang),
    city_intelligence: buildCityIntelligence(basic, goals, lang),
    career_readiness: buildCareerReadiness({ basic, goals, dna, readinessAnswers, hasCv, lang }),
  };
  const { coreIntelligence } = buildCvEvidenceLayer({
    profile: profileInput,
    readinessAnswers,
    lang,
  });
  Object.defineProperty(result, "coreIntelligence", {
    value: coreIntelligence,
    enumerable: false,
  });
  return result;
}
