import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Info, Sparkles, Shield } from "lucide-react";
import {
  INDUSTRIES,
  getRolesForIndustries,
  getTopRolesForIndustries,
  getRemainingRolesForIndustries,
  normalizeCareerGoals,
  normalizeLookingFor,
  getCareerDnaQuestions,
  getMbtiQuestions,
  resolveMbtiType,
  getRoleLabel,
  getIndustryLabel,
  normalizeExperienceLevels,
  primaryExperienceLevel,
  COMPANY_SIZE_OPTIONS,
  COMPANY_STAGE_OPTIONS,
  COMPANY_INDUSTRY_OPTIONS,
  EDUCATION_STATUS_OPTIONS,
  EDUCATION_LANGUAGES,
  CLASS_YEARS,
  LOOKING_FOR_OPTIONS,
  EXPERIENCE_LEVELS,
  LIVING_SITUATION_OPTIONS,
  WORK_MODE_OPTIONS,
  INTERNATIONAL_INTENT_OPTIONS,
  INTERNATIONAL_COUNTRY_GROUPS,
  READINESS_PILLAR_KEYS,
  READINESS_BENCHMARKS,
  emptyReadinessAnswers,
  getReadinessPillarLabel,
  MAX_TARGET_ROLES,
  EXPERIENCE_SIGNAL_OPTIONS,
  LEADERSHIP_SIGNAL_OPTIONS,
  normalizeSignalSelection,
  toggleSignalSelection,
  strongestSignalBenchmark,
  normalizePortfolioLinks,
  buildAnalysisSources,
  normalizeUniversityCitiesForProfile,
  getRoleDisplay,
} from "../lib/careerOnboarding/constants.js";
import {
  getDefaultLanguagesProfile,
  normalizeLanguagesArray,
  validateLanguagesArray,
} from "../lib/careerOnboarding/languageProfile.js";
import HFSelect from "./components/HFSelect.jsx";
import {
  completeCareerOnboarding,
  fetchCareerOnboarding,
  saveOnboardingDraft,
  buildLocalOnboardingProfile,
} from "./utils/careerOnboardingClient.js";
import { getApiBase } from "./utils/apiBase.js";
import { saveLocalCareerProfile } from "./utils/careerMemoryClient.js";
import { emptyCvProfile } from "../lib/careerOnboarding/cvOptions.js";
import { validateOnboardingForComplete } from "../lib/careerOnboarding/validateOnboarding.js";
import HFCvSection from "./components/onboarding/HFCvSection.jsx";
import HFLanguageSection from "./components/onboarding/HFLanguageSection.jsx";
import { parseLocalStorageJson } from "./utils/safeJson.js";
import LocationCountryCityFields from "./components/LocationCountryCityFields.jsx";
import UniversitySelect from "./components/UniversitySelect.jsx";
import FirstCareerAnalysisFlow from "./components/onboarding/FirstCareerAnalysisFlow.jsx";
import HFMultiSignalSelect from "./components/onboarding/HFMultiSignalSelect.jsx";
import CareerSignalLinks from "./components/onboarding/CareerSignalLinks.jsx";
import CareerIdentityBuilder from "./components/onboarding/CareerIdentityBuilder.jsx";
import { buildCareerPreview } from "../lib/careerOnboarding/careerSnapshot.js";
import {
  getCountryLabel,
  resolveCountryCode,
} from "./data/locationData.js";
import { getCareerDiscoveryLoadingCopy } from "./utils/activationFlow.js";
import { trackActivationEvent } from "./utils/activationEvents.js";
import "./components/career-os/career-os.css";

const DRAFT_SCHEMA_VERSION = 10;
const DRAFT_KEY = "hirefit-onboarding-draft-v10";
const LEGACY_DRAFT_KEYS = ["hirefit-onboarding-draft-v9", "hirefit-onboarding-draft-v8"];
const INITIAL_ROLE_VISIBLE = 10;
const GENERATION_STEP_MS = 0;

function waitForGenerationStep(ms = GENERATION_STEP_MS) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function loadOnboardingDraft() {
  const primary = parseLocalStorageJson(localStorage.getItem(DRAFT_KEY), null, { label: "onboarding-draft-v9" });
  if (primary) return primary;
  for (const key of LEGACY_DRAFT_KEYS) {
    const legacy = parseLocalStorageJson(localStorage.getItem(key), null, { label: key });
    if (legacy) return legacy;
  }
  return null;
}

function buildGenerationSteps({ analysisSources, cvSignalCount, lang }) {
  const tr = lang === "TR";
  const hasCvEvidence = (analysisSources || []).includes("cv") && Number(cvSignalCount || 0) > 0;
  return [
    { id: "preferences", label: tr ? "Tercihlerin haz\u0131rlan\u0131yor" : "Preparing preferences" },
    { id: "experience", label: tr ? "Deneyimlerin de\u011ferlendiriliyor" : "Reviewing experience" },
    {
      id: "evidence",
      label: tr ? "Kariyer kan\u0131tlar\u0131n inceleniyor" : "Reviewing career evidence",
      detail: hasCvEvidence ? (tr ? `${cvSignalCount} CV sinyali bulundu` : `${cvSignalCount} CV signals found`) : "",
    },
    { id: "role_matches", label: tr ? "Rol y\u00f6nlerin kar\u015f\u0131la\u015ft\u0131r\u0131l\u0131yor" : "Comparing role directions" },
    { id: "career_snapshot", label: tr ? "Kariyer \u00f6zetin haz\u0131rlan\u0131yor" : "Preparing your career snapshot" },
  ];
}

function getResidenceCountryCode(basic) {
  return resolveCountryCode(
    basic?.residenceCountryCode || basic?.countryCode || basic?.residenceCountry || basic?.country
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

function educationLevelFromStatus(status, fallback = "") {
  if (status === "graduate") return "new_graduate";
  if (["currently_studying", "masters_student", "phd_student"].includes(status)) {
    return "university_student";
  }
  return fallback;
}

function getUniversityCities(basic = {}) {
  const normalized = normalizeUniversityCitiesForProfile(basic);
  return normalized.universityCities;
}

function normalizeBasicLocation(bp = {}) {
  const residenceCode = resolveCountryCode(
    bp.residenceCountryCode || bp.countryCode || bp.residenceCountry || bp.country
  );
  const universityCode = resolveCountryCode(bp.universityCountryCode || bp.universityCountry);
  const educationStatus = inferEducationStatus(bp);
  const cityFields = normalizeUniversityCitiesForProfile(bp);
  return {
    ...bp,
    ...normalizePortfolioLinks(bp),
    experienceSignals: normalizeSignalSelection(
      bp.experienceSignals,
      EXPERIENCE_SIGNAL_OPTIONS,
      bp.experienceSignal || ""
    ),
    leadershipSignals: normalizeSignalSelection(
      bp.leadershipSignals,
      LEADERSHIP_SIGNAL_OPTIONS,
      bp.leadershipSignal || ""
    ),
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
    city: bp.residenceCity || bp.city || "",
    homeCity: bp.homeCity || bp.residenceCity || bp.city || "",
    universityCountryCode: universityCode,
    universityCountry: universityCode,
    ...cityFields,
    universityManual: Boolean(bp.universityManual || bp.universitySource === "manual" || bp.university_source === "manual"),
    livingSituation: bp.livingSituation || "",
    mbtiType: bp.mbtiType || "",
    leadershipExperienceStatus: bp.leadershipExperienceStatus || (bp.leadershipSignals?.length ? "yes" : ""),
  };
}

function normalizeGoalsLocation(g = {}) {
  const base = normalizeCareerGoals(g);
  const experienceLevels = normalizeExperienceLevels(
    base.experienceLevels ?? base.experienceLevel ?? base.seniority
  );
  const primaryExp = primaryExperienceLevel(experienceLevels);
  return {
    ...base,
    experienceLevels,
    experienceLevel: primaryExp,
    seniority: primaryExp,
    targetCountries: (g.targetCountries || []).map((c) => String(c || "").trim()).filter(Boolean),
    internationalInterest: g.internationalInterest || (g.lookingFor?.includes?.("abroad") ? "yes" : ""),
    internationalIndustries: (g.internationalIndustries || []).filter(Boolean).slice(0, MAX_TARGET_ROLES),
    targetCities: (g.targetCities || [])
      .map((t) => ({
        countryCode: resolveCountryCode(t?.countryCode || t?.country),
        city: t?.city || "",
      }))
      .filter((t) => t.countryCode),
  };
}

function isDnaComplete(dnaAnswers, lang) {
  return getCareerDnaQuestions(lang).every((q) => {
    const v = Number(dnaAnswers[q.id]);
    return Number.isFinite(v) && v >= 1 && v <= 5;
  });
}

const inputClass = "hf-input hf-ds-input";

function Chip({ active, label, onClick, size = "md", disabled = false, title = "" }) {
  const sizeClass = size === "xl" ? " hf-onboard-chip--xl" : size === "lg" ? " hf-onboard-chip--lg" : "";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`hf-onboard-chip${sizeClass}${active ? " hf-onboard-chip--active" : ""}`}
    >
      {label}
    </button>
  );
}

function RoleChip({ role, active, disabled, onClick, lang }) {
  const tr = lang === "TR";
  const display = getRoleDisplay(role, lang);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`hf-onboard-role-chip${active ? " hf-onboard-role-chip--active" : ""}`}
      title={display.explanation}
    >
      <span>{display.primary}</span>
      {tr && display.secondary && display.secondary !== display.primary ? <small>{display.secondary}</small> : null}
      <em>{display.explanation}</em>
    </button>
  );
}

function toggleMulti(list, value) {
  const set = new Set(list || []);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return [...set];
}

function rankSlotLabel(index, lang, kind = "role") {
  const tr = lang === "TR";
  if (kind === "companyIndustry") {
    if (index === 0) return tr ? "Birincil sektör" : "Primary industry";
    if (index === 1) return tr ? "İkincil sektör" : "Secondary industry";
    return tr ? "Keşif sektörü" : "Exploration industry";
  }
  if (kind === "industry") {
    if (index === 0) return tr ? "Birincil sektör" : "Primary sector";
    if (index === 1) return tr ? "İkincil sektör" : "Secondary sector";
    return tr ? "Keşif sektörü" : "Exploration sector";
  }
  if (kind === "looking") {
    if (index === 0) return tr ? "Birincil tercih" : "Primary preference";
    if (index === 1) return tr ? "İkincil tercih" : "Secondary preference";
    return tr ? "Ek tercih" : "Additional preference";
  }
  if (index === 0) return tr ? "En güçlü rol yönün" : "Top role direction";
  if (index === 1) return tr ? "Yedek rol yönün" : "Backup role direction";
  return tr ? "Keşif rol yönün" : "Exploration role direction";
}

function RecommendedBadge({ lang }) {
  const tr = lang === "TR";
  const tip = tr
    ? "Daha doğru kariyer tahmini için önerilir."
    : "Recommended for a more accurate career prediction.";
  return (
    <span className="hf-recommended-badge" title={tip} aria-label={tip}>
      {tr ? "ÖNERİLİR" : "RECOMMENDED"}
      <Info size={12} aria-hidden />
    </span>
  );
}

function RankedPriorityList({ items, getItemLabel, onMove, lang, kind }) {
  if (!items?.length) return null;
  return (
    <div className="hf-onboard-priority-block">
      <div className="hf-onboard-role-ranking">
        {items.map((item, index) => (
          <div key={item} className="hf-onboard-role-rank-row">
            <span className="hf-onboard-role-rank-index">{index + 1}</span>
            <div className="hf-onboard-role-rank-copy">
              <strong>{getItemLabel(item)}</strong>
              <small>{rankSlotLabel(index, lang, kind)}</small>
            </div>
            <div className="hf-onboard-role-rank-actions">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => onMove(item, -1)}
                aria-label={`${getItemLabel(item)} ${lang === "TR" ? "yukarı taşı" : "move up"}`}
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                disabled={index === items.length - 1}
                onClick={() => onMove(item, 1)}
                aria-label={`${getItemLabel(item)} ${lang === "TR" ? "aşağı taşı" : "move down"}`}
              >
                <ArrowDown size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OnboardingSubnav({ tabs, active, onChange, ariaLabel }) {
  return (
    <div className="hf-onboard-subnav" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          aria-controls={`hf-onboard-panel-${tab.id}`}
          className={`hf-onboard-subnav__tab${active === tab.id ? " is-active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          <span>{tab.label}</span>
          {tab.hint ? <small>{tab.hint}</small> : null}
        </button>
      ))}
    </div>
  );
}

function toSelectOptions(items, lang, { placeholder } = {}) {
  const trLang = lang === "TR";
  const mapped = (items || []).map((o) => ({
    value: o.id ?? o.value,
    label: o.label ?? (trLang ? o.labelTr : o.labelEn),
  }));
  if (placeholder) return [{ value: "", label: placeholder }, ...mapped];
  return mapped;
}

function CareerDnaHero() {
  return (
    <section className="hf-career-dna-hero">
      <div>
        <span className="hf-career-dna-hero__eyebrow">Kariyer Profili</span>
        <h2>3 dakikada kariyer yönünü netleştir.</h2>
        <p>Sonunda kimliğini, rol yönünü, en önemli eksiğini ve ilk hamleni tek ekranda görürsün.</p>
      </div>
      <div className="hf-career-dna-hero__panel">
        <span>Analiz sonunda</span>
        <ul>
          <li>Kariyer Kimliği</li>
          <li>Kariyer Hazırlığı</li>
          <li>En Uygun Rol Yönleri</li>
          <li>Geliştirmen Gereken Alan</li>
          <li>Sonraki En İyi Hamle</li>
        </ul>
        <strong>Tahmini süre: 3 dakika</strong>
      </div>
    </section>
  );
}

function liveDirectionLabel(roleName, tr) {
  const raw = String(roleName || "").trim();
  if (!raw) return tr ? "Hedef yönünü seç" : "Choose a career direction";
  const lower = raw.toLowerCase();

  if (tr) {
    if (/ürün|product/.test(lower)) return "Ürün Yönetimi yönü";
    if (/strategy|strateji|operations|operasyon/.test(lower)) return "Strateji & Operasyon yönü";
    if (/business analyst|iş anal|analyst/.test(lower)) return "İş Analizi yönü";
    if (/data|veri|analytics/.test(lower)) return "Veri Analizi yönü";
    if (/growth|marketing|pazarlama/.test(lower)) return "Growth / Pazarlama yönü";
    return raw;
  }

  if (/product/.test(lower)) return "Product Management direction";
  if (/strategy|operations/.test(lower)) return "Strategy & Operations direction";
  if (/business analyst|analyst/.test(lower)) return "Business Analysis direction";
  if (/data|analytics/.test(lower)) return "Data Analytics direction";
  if (/growth|marketing/.test(lower)) return "Growth / Marketing direction";
  return raw;
}

function previewSignalLevelLabel(row, tr) {
  if (!tr) return row.levelLabel;
  if (row.level === "low" || row.levelLabel === "Düşük") {
    const label = String(row.label || "").toLowerCase();
    if (/ownership|sahip|founder|kurucu|builder|kimlik/.test(label)) {
      return "Beyan güçlü, kanıt sınırlı";
    }
    return "Kanıt sınırlı";
  }
  return row.levelLabel;
}

function CareerPreviewPanel({ preview, lang }) {
  const tr = lang === "TR";
  const topMatch = preview.topMatch;
  const trust = preview.trustLayer;
  const confidenceLabel = {
    High: tr ? "Yüksek" : "High",
    Medium: tr ? "Orta" : "Medium",
    Low: tr ? "Düşük" : "Low",
  }[preview.confidence] || (tr ? "Oluşuyor" : "Forming");

  if (!trust) {
    return (
      <aside className="hf-career-preview">
        <div className="hf-career-preview__head">
          <span>{tr ? "Canlı Kariyer Tahmini" : "Live Career Prediction"}</span>
          <strong>{preview.identity}</strong>
        </div>
      </aside>
    );
  }

  const { whyThisPrediction, signalBreakdown, whatIncreasedMatch, gapTrust, confidenceTrust } = trust;

  return (
    <aside className="hf-career-preview">
      <div className="hf-career-preview__head">
        <span>{tr ? "Canlı Kariyer Tahmini" : "Live Career Prediction"}</span>
        <strong>{preview.identity}</strong>
      </div>
      {preview.identityExplanation ? (
        <p className="hf-career-preview__identity-explanation">{preview.identityExplanation}</p>
      ) : null}

      <section className="hf-preview-trust">
        <h4>{whyThisPrediction.title}</h4>
        <p className="hf-preview-trust__intro">{whyThisPrediction.intro}</p>
        {whyThisPrediction.bullets?.length ? (
          <ul className="hf-preview-trust__bullets">
            {whyThisPrediction.bullets.map((item) => (
              <li key={item}>✓ {item}</li>
            ))}
          </ul>
        ) : null}
        {whyThisPrediction.closing ? (
          <p className="hf-preview-trust__closing">{whyThisPrediction.closing}</p>
        ) : null}
      </section>

      <section className="hf-preview-trust hf-preview-trust--match">
        <label>{tr ? "Olası rol yönü" : "Likely role direction"}</label>
        <strong>{topMatch ? liveDirectionLabel(topMatch.roleName, tr) : (tr ? "Hedef yönünü seç" : "Choose a career direction")}</strong>
        {topMatch ? (
          <span className="hf-preview-trust__band">
            {tr ? "Yön uyumu" : "Direction fit"}: {topMatch.fitBand?.label}
          </span>
        ) : null}
      </section>

      {topMatch ? (
        <section className="hf-preview-trust">
          <h4>{whatIncreasedMatch.title}</h4>
          <p className="hf-preview-trust__intro">{whatIncreasedMatch.intro}</p>
          {whatIncreasedMatch.bullets?.length ? (
            <ul className="hf-preview-trust__bullets">
              {whatIncreasedMatch.bullets.map((item) => (
                <li key={item}>✓ {item}</li>
              ))}
            </ul>
          ) : null}
          {whatIncreasedMatch.closing ? (
            <p className="hf-preview-trust__closing">{whatIncreasedMatch.closing}</p>
          ) : null}
        </section>
      ) : null}

      {signalBreakdown?.rows?.length ? (
        <section className="hf-preview-trust hf-preview-trust--signals">
          <h4>{signalBreakdown.title}</h4>
          <div className="hf-preview-signals">
            {signalBreakdown.rows.map((row) => (
              <div className="hf-preview-signals__row" key={row.key}>
                <span className="hf-preview-signals__label">{row.label}</span>
                <span className="hf-preview-signals__dots" aria-hidden="true">
                  {".".repeat(Math.max(4, 18 - row.label.length))}
                </span>
                <span className={`hf-preview-signals__level hf-preview-signals__level--${row.level.toLowerCase()}`}>
                  {previewSignalLevelLabel(row, tr)}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {gapTrust?.gapTitle ? (
        <section className="hf-preview-trust hf-preview-trust--gap">
          <h4>{gapTrust.title}</h4>
          <strong className="hf-preview-trust__gap-title">{gapTrust.gapTitle}</strong>
          {gapTrust.whyItMatters ? (
            <>
              <p className="hf-preview-trust__subhead">{tr ? "Neden önemli:" : "Why it matters:"}</p>
              <p className="hf-preview-trust__copy">{gapTrust.whyItMatters}</p>
            </>
          ) : null}
          {gapTrust.missingProof?.length ? (
            <>
              <p className="hf-preview-trust__subhead">{tr ? "Eksik kanıt:" : "Missing proof:"}</p>
              <ul className="hf-preview-trust__bullets hf-preview-trust__bullets--plain">
                {gapTrust.missingProof.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </>
          ) : null}
          {gapTrust.fastestProof ? (
            <>
              <p className="hf-preview-trust__subhead">{tr ? "En hızlı kanıt:" : "Fastest proof:"}</p>
              <p className="hf-preview-trust__fastest">{gapTrust.fastestProof}</p>
            </>
          ) : null}
        </section>
      ) : null}

      <section className="hf-preview-trust hf-preview-trust--confidence">
        <div className="hf-preview-trust__confidence-head">
          <span>{tr ? "Tahmin Güveni" : "Prediction Confidence"}</span>
          <strong>{confidenceLabel}</strong>
        </div>
        {confidenceTrust?.title ? <p className="hf-preview-trust__subhead">{confidenceTrust.title}</p> : null}
        {confidenceTrust?.reasons?.length ? (
          <ul className="hf-preview-trust__bullets hf-preview-trust__bullets--plain">
            {confidenceTrust.reasons.map((reason) => (
              <li key={reason}>• {reason}</li>
            ))}
          </ul>
        ) : null}
        {confidenceTrust?.footer ? (
          <p className="hf-preview-trust__copy">{confidenceTrust.footer}</p>
        ) : null}
      </section>
    </aside>
  );
}

export default function CareerOnboardingPage() {
  const { lang, navigate, getApiAuthHeaders, setCareerProfile, user, isUserEmailVerified, authStatus } = useOutletContext();
  const [searchParams] = useSearchParams();
  const editMode = searchParams.get("edit") === "1";
  const snapshotMode = searchParams.get("snapshot") === "1";
  const welcomeMode = searchParams.get("welcome") === "1";
  const tr = lang === "TR";
  const apiBase = getApiBase();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [offlineMode, setOfflineMode] = useState(false);
  const [profileExists, setProfileExists] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [summary, setSummary] = useState(null);

  const [basic, setBasic] = useState({
    firstName: "",
    lastName: "",
    fullName: "",
    age: "",
    ageRange: "",
    country: "",
    countryCode: "",
    city: "",
    university: "",
    degree: "",
    department: "",
    educationLevel: "",
    educationStatus: "",
    educationLanguage: "",
    classYear: "",
    graduationYear: "",
    expectedGraduationYear: "",
    gpa: "",
    residenceCountry: "",
    residenceCountryCode: "",
    residenceCity: "",
    universityCountryCode: "",
    universityCountry: "",
    universityCity: "",
    universityCities: [],
    educationCities: [],
    universityManual: false,
    universitySource: "",
    livingSituation: "",
    mbtiType: "",
    languages: getDefaultLanguagesProfile("TR"),
    experienceSignals: [],
    leadershipExperienceStatus: "",
    leadershipSignals: [],
    linkedin: "",
    github: "",
    portfolio: "",
    website: "",
    behance: "",
    dribbble: "",
    cvUploaded: false,
    cvSignalCount: 0,
    analysisSources: [],
  });
  const [goals, setGoals] = useState({
    lookingFor: [],
    primaryIndustry: "",
    industries: [],
    targetRoles: [],
    primaryRole: "",
    secondaryRole: "",
    tertiaryRole: "",
    targetCountries: [],
    targetCities: [],
    experienceLevels: [],
    experienceLevel: "",
    seniority: "",
    workMode: [],
    internationalInterest: "",
    internationalIndustries: [],
    companyTypes: [],
    companyStages: [],
    companyIndustries: [],
    companySizes: [],
  });
  const [showAllRoles, setShowAllRoles] = useState(false);
  const [goalsPanel, setGoalsPanel] = useState("target");
  const [readinessPanel, setReadinessPanel] = useState("evidence");
  const [roleLimitNotice, setRoleLimitNotice] = useState("");
  const [industryLimitNotice, setIndustryLimitNotice] = useState("");
  const [lookingForLimitNotice, setLookingForLimitNotice] = useState("");
  const [companyIndustryLimitNotice, setCompanyIndustryLimitNotice] = useState("");
  const primaryIndustry = goals.primaryIndustry || goals.industries?.[0] || "";

  const toggleIndustry = (industryId) => {
    setGoals((g) => {
      const isSelected = (g.industries || []).includes(industryId);
      if (!isSelected && (g.industries || []).length >= MAX_TARGET_ROLES) {
        setIndustryLimitNotice(
          lang === "TR"
            ? "Daha doğru öneriler için en fazla 3 sektör seçebilirsin."
            : "For more accurate recommendations you can select up to 3 sectors."
        );
        return g;
      }
      const pool = isSelected
        ? (g.industries || []).filter((id) => id !== industryId)
        : [...(g.industries || []), industryId].slice(0, MAX_TARGET_ROLES);
      setIndustryLimitNotice("");
      return normalizeGoalsLocation({
        ...g,
        industries: pool,
        primaryIndustry: pool[0] || "",
        targetRoles: g.targetRoles,
      });
    });
    setShowAllRoles(false);
  };

  const moveRankedIndustry = (industryId, direction) => {
    setGoals((g) => {
      const ranked = [...(g.industries || [])];
      const currentIndex = ranked.indexOf(industryId);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= ranked.length) return g;
      [ranked[currentIndex], ranked[nextIndex]] = [ranked[nextIndex], ranked[currentIndex]];
      return normalizeGoalsLocation({
        ...g,
        industries: ranked,
        primaryIndustry: ranked[0] || "",
      });
    });
  };

  const toggleCompanyIndustry = (industryId) => {
    setGoals((g) => {
      const isSelected = (g.companyIndustries || []).includes(industryId);
      if (!isSelected && (g.companyIndustries || []).length >= MAX_TARGET_ROLES) {
        setCompanyIndustryLimitNotice(
          lang === "TR"
            ? "Daha doğru öneriler için en fazla 3 şirket sektörü seçebilirsin."
            : "For more accurate recommendations you can select up to 3 company industries."
        );
        return g;
      }
      const pool = isSelected
        ? (g.companyIndustries || []).filter((id) => id !== industryId)
        : [...(g.companyIndustries || []), industryId].slice(0, MAX_TARGET_ROLES);
      setCompanyIndustryLimitNotice("");
      return normalizeGoalsLocation({
        ...g,
        companyIndustries: pool,
      });
    });
  };

  const moveRankedCompanyIndustry = (industryId, direction) => {
    setGoals((g) => {
      const ranked = [...(g.companyIndustries || [])];
      const currentIndex = ranked.indexOf(industryId);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= ranked.length) return g;
      [ranked[currentIndex], ranked[nextIndex]] = [ranked[nextIndex], ranked[currentIndex]];
      return normalizeGoalsLocation({
        ...g,
        companyIndustries: ranked,
      });
    });
  };

  const toggleLookingFor = (optionId) => {
    setGoals((g) => {
      const current = normalizeLookingFor(g.lookingFor);
      const isSelected = current.includes(optionId);
      if (!isSelected && current.length >= MAX_TARGET_ROLES) {
        setLookingForLimitNotice(
          lang === "TR"
            ? "Daha doğru öneriler için en fazla 3 tercih seçebilirsin."
            : "For more accurate recommendations you can select up to 3 preferences."
        );
        return g;
      }
      const pool = isSelected
        ? current.filter((id) => id !== optionId)
        : [...current, optionId].slice(0, MAX_TARGET_ROLES);
      setLookingForLimitNotice("");
      return normalizeGoalsLocation({ ...g, lookingFor: pool });
    });
  };

  const moveRankedLookingFor = (optionId, direction) => {
    setGoals((g) => {
      const ranked = [...normalizeLookingFor(g.lookingFor)];
      const currentIndex = ranked.indexOf(optionId);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= ranked.length) return g;
      [ranked[currentIndex], ranked[nextIndex]] = [ranked[nextIndex], ranked[currentIndex]];
      return normalizeGoalsLocation({ ...g, lookingFor: ranked });
    });
  };

  const toggleInternationalCountry = (country) => {
    setGoals((g) =>
      normalizeGoalsLocation({
        ...g,
        targetCountries: toggleMulti(g.targetCountries || [], country),
      })
    );
  };

  const moveRankedInternationalCountry = (country, direction) => {
    setGoals((g) => {
      const ranked = [...(g.targetCountries || [])];
      const currentIndex = ranked.indexOf(country);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= ranked.length) return g;
      [ranked[currentIndex], ranked[nextIndex]] = [ranked[nextIndex], ranked[currentIndex]];
      return normalizeGoalsLocation({ ...g, targetCountries: ranked });
    });
  };

  const toggleInternationalIndustry = (industryId) => {
    setGoals((g) =>
      normalizeGoalsLocation({
        ...g,
        internationalIndustries: toggleMulti(g.internationalIndustries || [], industryId).slice(0, MAX_TARGET_ROLES),
      })
    );
  };

  const toggleTargetRole = (roleValue) => {
    setGoals((g) => {
      const isSelected = g.targetRoles.includes(roleValue);
      if (!isSelected && g.targetRoles.length >= MAX_TARGET_ROLES) {
        setRoleLimitNotice(
          lang === "TR"
            ? "Daha doğru öneriler için en fazla 3 hedef rol seçebilirsin."
            : "For more accurate recommendations you can select up to 3 target roles."
        );
        return g;
      }
      const pool = isSelected
        ? g.targetRoles.filter((r) => r !== roleValue)
        : [...g.targetRoles, roleValue].slice(0, MAX_TARGET_ROLES);
      setRoleLimitNotice("");
      let { primaryRole, secondaryRole, tertiaryRole } = g;
      if (!pool.includes(primaryRole)) primaryRole = "";
      if (!pool.includes(secondaryRole)) secondaryRole = "";
      if (!pool.includes(tertiaryRole)) tertiaryRole = "";
      return normalizeGoalsLocation({ ...g, targetRoles: pool, primaryRole, secondaryRole, tertiaryRole });
    });
  };

  const updateReadinessSignals = (key, optionId) => {
    const options = key === "experience" ? EXPERIENCE_SIGNAL_OPTIONS : LEADERSHIP_SIGNAL_OPTIONS;
    const field = key === "experience" ? "experienceSignals" : "leadershipSignals";
    const nextSignals = toggleSignalSelection(basic[field], optionId, options);
    const benchmark = strongestSignalBenchmark(nextSignals, options, "");
    setBasic({ ...basic, [field]: nextSignals });
    setReadinessAnswers({ ...readinessAnswers, [key]: benchmark });
  };

  const moveRankedRole = (roleValue, direction) => {
    setGoals((g) => {
      const ranked = [...(g.targetRoles || [])];
      const currentIndex = ranked.indexOf(roleValue);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= ranked.length) return g;
      [ranked[currentIndex], ranked[nextIndex]] = [ranked[nextIndex], ranked[currentIndex]];
      return normalizeGoalsLocation({
        ...g,
        targetRoles: ranked,
        primaryRole: ranked[0] || "",
        secondaryRole: ranked[1] || "",
        tertiaryRole: ranked[2] || "",
      });
    });
  };
  const [dnaAnswers, setDnaAnswers] = useState({});
  const [readinessAnswers, setReadinessAnswers] = useState(emptyReadinessAnswers);
  const [cv, setCv] = useState(emptyCvProfile);
  const [pendingCvFile, setPendingCvFile] = useState(null);
  const [showMbti, setShowMbti] = useState(false);
  const [mbtiAnswers, setMbtiAnswers] = useState({});
  const [generationState, setGenerationState] = useState(null);
  const [draftHydrated, setDraftHydrated] = useState(false);

  const selectedIndustries = useMemo(
    () => (goals.industries?.length > 0 ? goals.industries : primaryIndustry ? [primaryIndustry] : []),
    [goals.industries, primaryIndustry]
  );

  const allRoleOptions = useMemo(
    () => getRolesForIndustries(selectedIndustries || []),
    [selectedIndustries]
  );
  const topRoleOptions = useMemo(
    () => getTopRolesForIndustries(selectedIndustries || [], INITIAL_ROLE_VISIBLE),
    [selectedIndustries]
  );
  const extraRoleOptions = useMemo(
    () => getRemainingRolesForIndustries(selectedIndustries || [], INITIAL_ROLE_VISIBLE),
    [selectedIndustries]
  );
  const visibleRoleOptions = useMemo(() => {
    const source = showAllRoles ? allRoleOptions : [...topRoleOptions, ...(goals.targetRoles || [])];
    return [...new Set(source.filter(Boolean))];
  }, [showAllRoles, allRoleOptions, topRoleOptions, goals.targetRoles]);
  const hasCreativeDirection = useMemo(() => {
    const directionText = [
      ...(goals.targetRoles || []),
      ...(selectedIndustries || []),
    ].join(" ");
    return /design|ui_ux|ui|ux|motion|creative|brand|graphic|media/i.test(directionText);
  }, [goals.targetRoles, selectedIndustries]);

  const goalsTabs = useMemo(
    () => [
      { id: "target", label: tr ? "Hedefin" : "Goal", hint: tr ? "Ne arıyorsun?" : "Intent" },
      { id: "roles", label: tr ? "Roller" : "Roles", hint: tr ? `${goals.targetRoles.length}/${MAX_TARGET_ROLES}` : `${goals.targetRoles.length}/${MAX_TARGET_ROLES}` },
      { id: "environment", label: tr ? "Sektör ve Çalışma Biçimi" : "Sector & Work Style", hint: tr ? `${selectedIndustries.length}/${MAX_TARGET_ROLES}` : `${selectedIndustries.length}/${MAX_TARGET_ROLES}` },
    ],
    [tr, goals.targetRoles.length, selectedIndustries.length]
  );

  const readinessTabs = useMemo(
    () => [
      { id: "evidence", label: tr ? "CV ve Kariyer Kanıtları" : "CV & Career Evidence", hint: tr ? "Kaynaklar" : "Sources" },
      { id: "experience", label: tr ? "Deneyim ve Liderlik" : "Experience & Leadership", hint: tr ? "Sinyaller" : "Signals" },
      { id: "final", label: tr ? "Son Kontrol" : "Final Check", hint: tr ? "Şirket boyutu" : "Company size" },
    ],
    [tr]
  );

  useEffect(() => {
    if (!selectedIndustries.length) return;
    const available = new Set(getRolesForIndustries(selectedIndustries));
    setGoals((g) => {
      const targetRoles = (g.targetRoles || []).filter((role) => available.has(role));
      let { primaryRole, secondaryRole, tertiaryRole } = g;
      if (primaryRole && !available.has(primaryRole)) primaryRole = "";
      if (secondaryRole && !available.has(secondaryRole)) secondaryRole = "";
      if (tertiaryRole && !available.has(tertiaryRole)) tertiaryRole = "";
      return normalizeGoalsLocation({
        ...g,
        targetRoles,
        primaryRole,
        secondaryRole,
        tertiaryRole,
      });
    });
    setShowAllRoles(false);
  }, [selectedIndustries]);
  const careerPreview = useMemo(() => {
    return buildCareerPreview({ basic, goals, dnaAnswers, readinessAnswers, cv, lang });
  }, [basic, goals, dnaAnswers, readinessAnswers, cv, lang]);

  const dnaQuestions = useMemo(
    () => (questions.length > 0 ? questions : getCareerDnaQuestions(lang)),
    [questions, lang]
  );
  const mbtiQuestions = useMemo(() => getMbtiQuestions(lang), [lang]);

  const educationLanguageOptions = useMemo(
    () => toSelectOptions(EDUCATION_LANGUAGES, lang, { placeholder: tr ? "Eğitim dili" : "Education language" }),
    [lang, tr]
  );
  const classYearOptions = useMemo(
    () => toSelectOptions(
      CLASS_YEARS.filter((option) => option.id !== "graduate"),
      lang,
      { placeholder: tr ? "Sınıf" : "Class year" }
    ),
    [lang, tr]
  );
  const labels = useMemo(
    () => ({
      title: tr ? "Kariyer Profili" : "Career Profile",
      subtitle: tr
        ? "3 dakika içinde rol yönünü, en büyük kanıt açığını ve sonraki en iyi hamleni netleştir."
        : "Clarify your role direction, biggest proof gap, and next best move in 3 minutes.",
      step1: tr ? "Profil" : "Profile",
      step2: tr ? "Hedefin ve rol yönlerin" : "Career goals",
      step3: tr ? "DNA testi" : "DNA assessment",
      step4: tr ? "Kariyer hazırlığı" : "Career readiness",
      next: tr ? "İleri" : "Next",
      back: tr ? "Geri" : "Back",
      finish: profileExists
        ? tr
          ? "Kariyer Profilini Güncelle"
          : "Update Career Profile"
        : tr
          ? "Kariyer Profilini Oluştur"
          : "Create Career Profile",
      skip: tr ? "Atla" : "Skip",
      privacy: tr
        ? "Verilerin yalnızca kariyer önerileri ve OS modülleri için kullanılır; üçüncü taraflarla paylaşılmaz."
        : "Your data powers career recommendations and OS modules only — never sold to third parties.",
    }),
    [tr, profileExists]
  );

  const hydrate = useCallback((draft, profile) => {
    const d = draft || profile?.onboarding_draft || {};
    if (d.basic) {
      setBasic((b) => {
        const merged = normalizeBasicLocation({ ...b, ...d.basic });
        merged.languages = normalizeLanguagesArray(
          merged.languages?.length ? merged.languages : b.languages,
          lang
        );
        return merged;
      });
    }
    if (d.goals) setGoals((g) => normalizeGoalsLocation({ ...g, ...d.goals }));
    if (d.mbtiAnswers) setMbtiAnswers(d.mbtiAnswers);
    if (d.showMbti != null) setShowMbti(Boolean(d.showMbti));
    if (d.dnaAnswers) setDnaAnswers(d.dnaAnswers);
    if (d.readinessAnswers) setReadinessAnswers((r) => ({ ...emptyReadinessAnswers(), ...r, ...d.readinessAnswers }));
    if (profile?.career_readiness?.benchmarks) {
      setReadinessAnswers((r) => ({ ...emptyReadinessAnswers(), ...r, ...profile.career_readiness.benchmarks }));
    }
    const legacyReadiness = {
      ...(profile?.career_readiness?.benchmarks || {}),
      ...(d.readinessAnswers || {}),
    };
    const signalSource = {
      ...(profile?.basic_profile || {}),
      ...(d.basic || {}),
    };
    setBasic((current) => ({
      ...current,
      experienceSignals: normalizeSignalSelection(
        signalSource.experienceSignals,
        EXPERIENCE_SIGNAL_OPTIONS,
        legacyReadiness.experience
      ),
      leadershipSignals: normalizeSignalSelection(
        signalSource.leadershipSignals,
        LEADERSHIP_SIGNAL_OPTIONS,
        legacyReadiness.leadership
      ),
    }));
    if (d.cv) setCv((c) => ({ ...emptyCvProfile(), ...c, ...d.cv }));
    else if (d.hasCv != null) setCv((c) => ({ ...c, cvStatus: d.hasCv ? "current" : "none", cvExists: Boolean(d.hasCv) }));
    if (profile?.basic_profile) {
      setCv((c) => ({ ...emptyCvProfile(), ...c, ...profile.basic_profile }));
    }
    if (profile?.basic_profile && Object.keys(profile.basic_profile).length) {
      setBasic((b) => {
        const merged = normalizeBasicLocation({ ...b, ...profile.basic_profile });
        merged.languages = normalizeLanguagesArray(
          merged.languages?.length ? merged.languages : b.languages,
          lang
        );
        if (!merged.languages?.length) {
          merged.languages = getDefaultLanguagesProfile(lang);
        }
        return merged;
      });
    }
    if (profile?.career_goals && Object.keys(profile.career_goals).length) {
      setGoals((g) =>
        normalizeGoalsLocation({
          ...g,
          ...profile.career_goals,
          primaryIndustry:
            profile.career_goals.primaryIndustry ||
            profile.primary_industry ||
            profile.career_goals.industries?.[0] ||
            "",
        })
      );
    }
    if (profile?.primary_industry) {
      setGoals((g) =>
        normalizeGoalsLocation({
          ...g,
          primaryIndustry: profile.primary_industry,
          industries: profile.career_goals?.industries?.length
            ? profile.career_goals.industries
            : [profile.primary_industry],
        })
      );
    }
    if (profile?.career_dna?.answers) setDnaAnswers(profile.career_dna.answers);
    if (d.lastStep) setStep(Number(d.lastStep) || 1);
    if (d.ui?.showAllRoles != null) setShowAllRoles(Boolean(d.ui.showAllRoles));
    if (d.ui?.goalsPanel) setGoalsPanel(d.ui.goalsPanel);
    if (d.ui?.readinessPanel) setReadinessPanel(d.ui.readinessPanel);
    if (profile?.onboarding_completed) setProfileExists(true);
  }, [lang]);

  useEffect(() => {
    if (authStatus === "initializing") return;
    if (!user) {
      navigate(`/login?next=${encodeURIComponent("/career-dna")}`);
      return;
    }
    if (!isUserEmailVerified) {
      navigate(`/verify-email?email=${encodeURIComponent(user.email || "")}`);
      return;
    }
    const local = loadOnboardingDraft();
    (async () => {
      try {
        const data = await fetchCareerOnboarding(apiBase, getApiAuthHeaders, lang);
        setQuestions(data.questions || []);
        setOfflineMode(Boolean(data.offline));
        setProfileExists(Boolean(data.profile?.onboarding_completed));
        hydrate(local, data.profile);
        if (data.profile?.onboarding_completed && snapshotMode) {
          setSummary(data.profile);
          setStep(5);
        } else if (data.profile?.onboarding_completed && !editMode) {
          navigate("/dashboard");
        }
      } catch {
        if (local) hydrate(local, null);
        setOfflineMode(true);
      } finally {
        setDraftHydrated(true);
        setLoading(false);
      }
    })();
  }, [authStatus, user, isUserEmailVerified, editMode, snapshotMode, navigate, getApiAuthHeaders, lang, hydrate, apiBase]);

  useEffect(() => {
    trackActivationEvent("career_discovery_started", {
      source: "career_dna",
      lang,
      state: profileExists ? "career_profile_in_progress" : "authenticated",
      profileComplete: profileExists,
    });
  }, [lang, profileExists]);

  const persistDraft = async (nextStep) => {
    const draft = {
      schemaVersion: DRAFT_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      basic,
      goals,
      dnaAnswers,
      readinessAnswers,
      cv,
      mbtiAnswers,
      showMbti,
      ui: { showAllRoles, goalsPanel, readinessPanel },
      lastStep: nextStep,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    const result = await saveOnboardingDraft(apiBase, getApiAuthHeaders, { step: nextStep, draft, lang });
    if (result?.offline) setOfflineMode(true);
  };

  useEffect(() => {
    if (loading || !draftHydrated || step >= 5) return;
    const handle = window.setTimeout(() => {
      const draft = {
        schemaVersion: DRAFT_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        basic,
        goals,
        dnaAnswers,
        readinessAnswers,
        cv,
        mbtiAnswers,
        showMbti,
        ui: { showAllRoles, goalsPanel, readinessPanel },
        lastStep: step,
      };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // Local persistence is a fallback; onboarding remains usable if storage is unavailable.
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [basic, goals, dnaAnswers, readinessAnswers, cv, mbtiAnswers, showMbti, showAllRoles, goalsPanel, readinessPanel, step, loading, draftHydrated]);

  const onNext = async () => {
    setError("");
    const nameOk = basic.fullName?.trim() || basic.firstName?.trim();
    if (
      step === 1 &&
      (!nameOk ||
        !basic.age ||
        !basic.university ||
        !(basic.degree || basic.department) ||
        !basic.educationStatus ||
        (basic.educationStatus === "currently_studying" && !basic.classYear) ||
        (["currently_studying", "masters_student", "phd_student"].includes(basic.educationStatus) &&
          !basic.expectedGraduationYear) ||
        (basic.educationStatus === "graduate" && !basic.graduationYear))
    ) {
      setError(tr ? "Zorunlu profil ve eğitim alanlarını doldur." : "Complete required profile and education fields.");
      return;
    }
    const residenceCode = getResidenceCountryCode(basic);
    const lookingForList = normalizeLookingFor(goals.lookingFor);
    if (step === 1 && !residenceCode) {
      setError(tr ? "İkamet ülkesi seç." : "Select country of residence.");
      return;
    }
    if (step === 1 && !(basic.residenceCity || basic.city)?.trim()) {
      setError(tr ? "İkamet şehri seç veya yaz." : "Select or enter city of residence.");
      return;
    }
    if (step === 1 && !resolveCountryCode(basic.universityCountryCode)) {
      setError(tr ? "Üniversite ülkesi seç." : "Select university country.");
      return;
    }
    if (step === 1 && !getUniversityCities(basic).length) {
      setError(tr ? "En az bir eğitim şehri seç veya yaz." : "Select or enter at least one education city.");
      return;
    }
    if (step === 1 && !basic.livingSituation) {
      setError(tr ? "Yaşam durumunu seç." : "Select living situation.");
      return;
    }
    if (step === 1) {
      const langValidation = validateLanguagesArray(basic.languages, lang);
      if (!langValidation.ok) {
        setError(langValidation.error || (tr ? "Dil bilgilerini kontrol et." : "Check language details."));
        return;
      }
    }
    if (step === 2 && !selectedIndustries.length) {
      setError(tr ? "En az bir sektör seç." : "Select at least one sector.");
      return;
    }
    if (step === 2 && !lookingForList.length) {
      setError(tr ? "En az bir hedef türü seç (Ne arıyorsun?)." : "Select at least one goal type.");
      return;
    }
    if (step === 2 && !goals.targetRoles.length) {
      setError(tr ? "En az bir hedef rol seç." : "Select at least one target role.");
      return;
    }
    if (step === 2 && !goals.primaryRole) {
      setError(tr ? "Birincil hedef rolünü seç." : "Select your primary target role.");
      return;
    }
    if (
      step === 2 &&
      !(goals.experienceLevels?.length || goals.experienceLevel || goals.seniority)
    ) {
      setError(tr ? "En az bir deneyim seviyesi seç." : "Select at least one experience level.");
      return;
    }
    if (step === 3 && !isDnaComplete(dnaAnswers, lang)) {
      setError(tr ? "DNA testi için 10 soruyu tamamla (1-5 arası)." : "Complete all 10 DNA questions (1-5).");
      return;
    }
    const next = Math.min(4, step + 1);
    setSaving(true);
    await persistDraft(next);
    setStep(next);
    setSaving(false);
  };

  const buildEducationLocationMetadata = useCallback((sourceBasic) => {
    const uniCountryCode = resolveCountryCode(sourceBasic.universityCountryCode || sourceBasic.universityCountry);
    const cities = getUniversityCities(sourceBasic);
    const uniCity = cities[0] || "";
    const university = String(sourceBasic.university || "").trim();
    const department = String(sourceBasic.degree || sourceBasic.department || "").trim();
    const graduationYear = String(
      sourceBasic.graduationYear || sourceBasic.expectedGraduationYear || ""
    ).trim();
    return {
      country: uniCountryCode,
      countryCode: uniCountryCode,
      countryNameTR: getCountryLabel(uniCountryCode, "TR"),
      countryNameEN: getCountryLabel(uniCountryCode, "EN"),
      city: uniCity,
      cities,
      educationCities: cities,
      university,
      universitySource: sourceBasic.universityManual ? "manual" : "catalog",
      department,
      graduationYear,
      educationStatus: sourceBasic.educationStatus || "",
      expectedGraduationYear: String(sourceBasic.expectedGraduationYear || "").trim(),
    };
  }, []);

  const onComplete = async () => {
    const validation = validateOnboardingForComplete({
      basic,
      goals,
      selectedIndustries,
      dnaAnswers,
      readinessAnswers,
      cv,
      lang,
    });
    if (!validation.ok) {
      setError(
        tr
          ? `Eksik alanlar: ${validation.missing.join(", ")}`
          : `Missing fields: ${validation.missing.join(", ")}`
      );
      return;
    }
    const experienceSignals = normalizeSignalSelection(
      basic.experienceSignals,
      EXPERIENCE_SIGNAL_OPTIONS,
      readinessAnswers.experience
    );
    const leadershipSignals = normalizeSignalSelection(
      basic.leadershipSignals,
      LEADERSHIP_SIGNAL_OPTIONS,
      readinessAnswers.leadership
    );
    const normalizedReadinessAnswers = {
      ...readinessAnswers,
      experience: strongestSignalBenchmark(
        experienceSignals,
        EXPERIENCE_SIGNAL_OPTIONS,
        readinessAnswers.experience
      ),
      leadership: strongestSignalBenchmark(
        leadershipSignals,
        LEADERSHIP_SIGNAL_OPTIONS,
        readinessAnswers.leadership
      ),
    };
    const portfolioLinks = normalizePortfolioLinks(basic);
    const cvUploaded = Boolean(cv.cvUploaded || cv.cvFileName || pendingCvFile);
    const cvSignalCount = Math.max(0, Number(cv.cvSignalCount || basic.cvSignalCount || 0));
    const analysisSources = buildAnalysisSources({
      dnaAnswers,
      goals,
      experienceSignals,
      leadershipSignals,
      readinessAnswers: normalizedReadinessAnswers,
      cvUploaded,
      links: portfolioLinks,
    });
    const generationSteps = buildGenerationSteps({ analysisSources, cvSignalCount, lang });
    const completeGenerationStep = async (stepId) => {
      setGenerationState((state) => ({ ...state, active: stepId }));
      await waitForGenerationStep();
      setGenerationState((state) => ({
        ...state,
        active: "",
        completed: [...new Set([...(state?.completed || []), stepId])],
      }));
    };
    const activateGenerationStep = (stepId) => {
      const index = generationSteps.findIndex((item) => item.id === stepId);
      setGenerationState((state) => ({
        ...state,
        active: stepId,
        completed: index > 0 ? generationSteps.slice(0, index).map((item) => item.id) : [],
      }));
    };

    setSaving(true);
    setError("");
    setGenerationState({
      visible: true,
      steps: generationSteps,
      completed: [],
      active: generationSteps[0]?.id || "",
    });
    try {
      activateGenerationStep("preferences");
      const cc = getResidenceCountryCode(basic);
      const uniCc = resolveCountryCode(basic.universityCountryCode);
      const mbtiType = resolveMbtiType(mbtiAnswers) || basic.mbtiType || "";
      const educationLocation = buildEducationLocationMetadata(basic);
      const cityFields = normalizeUniversityCitiesForProfile(basic);
      activateGenerationStep("experience");
      const payloadBasic = {
        ...basic,
        ...cityFields,
        fullName: basic.fullName?.trim() || [basic.firstName, basic.lastName].filter(Boolean).join(" "),
        department: basic.degree || basic.department,
        countryCode: cc,
        country: cc,
        residenceCountry: cc,
        residenceCountryCode: cc,
        residenceCity: (basic.residenceCity || basic.city || "").trim(),
        homeCity: (basic.residenceCity || basic.city || "").trim(),
        universityCountryCode: uniCc,
        universityCountry: uniCc,
        universitySource: basic.universityManual ? "manual" : "catalog",
        educationLocation,
        education_location: educationLocation,
        localCareerIntelligence: {
          education: educationLocation,
          opportunityFeed: {
            country: educationLocation.country,
            city: educationLocation.city,
            university: educationLocation.university,
          },
          careerMissions: {
            country: educationLocation.country,
            city: educationLocation.city,
            university: educationLocation.university,
          },
          careerGps: {
            country: educationLocation.country,
            city: educationLocation.city,
            university: educationLocation.university,
            department: educationLocation.department,
            graduationYear: educationLocation.graduationYear,
          },
        },
        countryNameTR: getCountryLabel(cc, "TR"),
        countryNameEN: getCountryLabel(cc, "EN"),
        city: (basic.residenceCity || basic.city || "").trim(),
        mbtiType,
        graduationYear: basic.graduationYear,
        expectedGraduationYear: basic.expectedGraduationYear,
        educationStatus: basic.educationStatus,
        classYear: basic.classYear,
        experienceLevel:
          primaryExperienceLevel(goals.experienceLevels) ||
          goals.experienceLevel ||
          goals.seniority,
        languages: normalizeLanguagesArray(basic.languages, lang),
        experienceSignals,
        leadershipSignals,
        ...portfolioLinks,
        cvUploaded,
        cvSignalCount,
        analysisSources,
      };
      const payloadGoals = normalizeGoalsLocation({
        ...goals,
        lookingFor: normalizeLookingFor(goals.lookingFor),
        industries: selectedIndustries,
        primaryIndustry: selectedIndustries[0] || "",
        preferredLocation: goals.workMode,
        targetRoles: (goals.targetRoles || []).slice(0, MAX_TARGET_ROLES),
      });
      activateGenerationStep("evidence");
      activateGenerationStep("role_matches");
      activateGenerationStep("career_snapshot");
      const result = await completeCareerOnboarding(apiBase, getApiAuthHeaders, {
        basic: {
          ...payloadBasic,
          ...cv,
          cvUploaded,
          cvSignalCount,
          analysisSources,
        },
        goals: payloadGoals,
        dnaAnswers,
        readinessAnswers: normalizedReadinessAnswers,
        cv: { ...cv, cvUploaded, cvSignalCount },
        experienceSignals,
        leadershipSignals,
        ...portfolioLinks,
        cvUploaded,
        cvSignalCount,
        analysisSources,
        lang,
      });
      if (result.error && !result.offline) {
        setGenerationState(null);
        setError(
          tr
            ? "Profil sunucuya kaydedilemedi. Bağlantını kontrol edip tekrar dene."
            : "Could not save to the server. Check your connection and try again."
        );
        return;
      }
      let profile = result.profile;
      if (result.offline || !profile) {
        profile = buildLocalOnboardingProfile({
          basic: payloadBasic,
          goals: payloadGoals,
          dnaAnswers,
          readinessAnswers: normalizedReadinessAnswers,
          cv: { ...cv, cvUploaded, cvSignalCount },
          experienceSignals,
          leadershipSignals,
          ...portfolioLinks,
          cvUploaded,
          cvSignalCount,
          analysisSources,
          lang,
        });
        saveLocalCareerProfile(profile);
        setOfflineMode(true);
      } else {
        saveLocalCareerProfile(profile);
        setOfflineMode(false);
      }
      profile = {
        ...profile,
        analysis_sources: analysisSources,
        basic_profile: {
          ...(profile?.basic_profile || {}),
          experienceSignals,
          leadershipSignals,
          ...portfolioLinks,
          cvUploaded,
          cvSignalCount,
          analysisSources,
        },
        career_snapshot: {
          ...(profile?.career_snapshot || profile?.career_gps?.snapshot || {}),
          analysisSources,
        },
      };
      await completeGenerationStep("career_snapshot");
      localStorage.removeItem(DRAFT_KEY);
      setCareerProfile?.(profile);
      setProfileExists(true);
      setSummary(profile);
      setStep(5);
      await waitForGenerationStep(100);
      setGenerationState(null);
    } catch {
      setGenerationState(null);
      setError(
        tr
          ? "Profil kaydedilemedi. İnternet bağlantını kontrol et veya daha sonra tekrar dene."
          : "Could not save your profile. Check your connection or try again later."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    const hasLocalDraft =
      typeof localStorage !== "undefined" &&
      Boolean(localStorage.getItem(DRAFT_KEY) || LEGACY_DRAFT_KEYS.some((key) => localStorage.getItem(key)));
    const loadingCopy = getCareerDiscoveryLoadingCopy({
      lang,
      hasLocalDraft,
      editMode,
      snapshotMode,
    });
    return (
      <div className="hf-onboarding-page hf-page">
        <div className="hf-loading-state" role="status">
          <strong>{loadingCopy.title}</strong>
          <span>{loadingCopy.support}</span>
        </div>
      </div>
    );
  }

  if (generationState?.visible) {
    return (
      <div className="hf-onboarding-page hf-page">
        <CareerIdentityBuilder state={generationState} lang={lang} />
      </div>
    );
  }

  return (
    <div className="hf-onboarding-page hf-page">
      <header style={{ marginBottom: 24 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Sparkles size={15} color="#60a5fa" />
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "#94a3b8", textTransform: "uppercase" }}>
            HireFit
          </span>
        </div>
        <h1 className="hf-page-title">{labels.title}</h1>
        <p className="hf-page-subtitle" style={{ marginBottom: 12 }}>{labels.subtitle}</p>
        {welcomeMode ? (
          <div className="hf-info-banner" style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
            <Sparkles size={14} style={{ flexShrink: 0, marginTop: 2, color: "#60a5fa" }} />
            <span>{"Welcome to HireFit. Let's understand your career goals."}</span>
          </div>
        ) : null}
        <div className="hf-info-banner" style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <Shield size={14} style={{ flexShrink: 0, marginTop: 2, color: "#60a5fa" }} />
          <span>{labels.privacy}</span>
        </div>
        {offlineMode ? (
          <p className="hf-onboard-helper" style={{ marginTop: 10, color: "#94a3b8" }}>
            {tr
              ? "Profil geçici olarak cihazında saklanıyor. Bağlantı gelince senkronize edilecek."
              : "Your profile is saved on this device temporarily. It will sync when you're back online."}
          </p>
        ) : null}
      </header>

      {error ? (
        <div className="hf-error-banner" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      {step < 5 ? (
        <>
          <CareerDnaHero />
          <CareerPreviewPanel preview={careerPreview} lang={lang} />
        </>
      ) : null}

      {step < 5 ? (
        <div className="hf-progress-steps" aria-hidden>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className={step >= n ? "is-done" : ""} />
          ))}
        </div>
      ) : (
        <div className="hf-progress-steps hf-progress-steps--complete" aria-hidden>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="is-done" />
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div key="s1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
            <h2 className="hf-onboard-step-title">{labels.step1}</h2>
            <div style={{ display: "grid", gap: 12 }}>
              <input className={inputClass} placeholder={tr ? "Ad Soyad *" : "Full name *"} value={basic.fullName || [basic.firstName, basic.lastName].filter(Boolean).join(" ")} onChange={(e) => setBasic({ ...basic, fullName: e.target.value, firstName: e.target.value.split(" ")[0] || "", lastName: e.target.value.split(" ").slice(1).join(" ") })} />
              <input className={inputClass} type="number" min={16} max={60} placeholder={tr ? "Yaş *" : "Age *"} value={basic.age} onChange={(e) => setBasic({ ...basic, age: e.target.value })} />
              <LocationCountryCityFields
                mode="residence"
                lang={lang}
                residenceCountryCode={getResidenceCountryCode(basic)}
                residenceCity={basic.residenceCity || basic.city}
                universityCountryCode={basic.universityCountryCode}
                universityCity={basic.universityCity}
                universityCities={basic.universityCities}
                onResidenceCountryChange={(code) =>
                  setBasic({
                    ...basic,
                    residenceCountryCode: code,
                    residenceCountry: code,
                    countryCode: code,
                    country: code,
                    residenceCity: !code ? "" : basic.residenceCity || basic.city,
                    city: !code ? "" : basic.residenceCity || basic.city,
                  })
                }
                onResidenceCityChange={(c) => setBasic({ ...basic, residenceCity: c, city: c })}
                onUniversityCountryChange={(code) =>
                  setBasic({
                    ...basic,
                    universityCountryCode: code,
                    universityCountry: code,
                    universityCity: "",
                    universityCities: [],
                    educationCity: "",
                    educationCities: [],
                    university: "",
                    universityManual: false,
                    universitySource: "",
                  })
                }
                onUniversityCitiesChange={(cities) => {
                  const cityFields = normalizeUniversityCitiesForProfile({ ...basic, universityCities: cities });
                  setBasic({
                    ...basic,
                    ...cityFields,
                    university: "",
                    universityManual: false,
                    universitySource: "",
                  });
                }}
              />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 8 }}>{tr ? "Yaşam Düzeni *" : "Living arrangement *"}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {LIVING_SITUATION_OPTIONS.map((o) => (
                    <Chip
                      key={o.id}
                      size="lg"
                      active={basic.livingSituation === o.id}
                      label={tr ? o.labelTr : o.labelEn}
                      onClick={() => setBasic({ ...basic, livingSituation: o.id })}
                    />
                  ))}
                </div>
                <p className="hf-location-fields__helper">
                  {tr
                    ? "Bu bilgi çalışma modeli ve lokasyon önerilerini daha doğru kişiselleştirmek için kullanılır."
                    : "This helps personalize work model and location recommendations more accurately."}
                </p>
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#c4b5fd", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 4 }}>{tr ? "Eğitim" : "Education"}</div>
              <div className="hf-location-fields__block">
                <label className={`hf-location-fields__label${!(basic.universityCountryCode && getUniversityCities(basic).length) ? " hf-location-fields__label--disabled" : ""}`}>
                  {tr ? "Üniversite *" : "University *"}
                </label>
                <UniversitySelect
                  lang={lang}
                  countryCode={basic.universityCountryCode}
                  city={getUniversityCities(basic)[0] || basic.universityCity}
                  value={basic.university}
                  manual={Boolean(basic.universityManual)}
                  onManualChange={(universityManual) => setBasic((b) => ({
                    ...b,
                    universityManual,
                    universitySource: universityManual ? "manual" : b.university ? "catalog" : "",
                  }))}
                  onChange={(university, meta = {}) => setBasic((b) => ({
                    ...b,
                    university,
                    universityManual: meta.source === "manual" ? true : meta.source === "catalog" || meta.source === "clear" ? false : b.universityManual,
                    universitySource: meta.source === "manual" ? "manual" : meta.source === "catalog" ? "catalog" : meta.source === "clear" ? "" : b.universitySource,
                  }))}
                />
                <p className="hf-location-fields__helper">
                  {tr
                    ? "Üniversite önerileri seçtiğin ülke ve şehre göre gelir. Listede yoksa manuel ekleyebilirsin."
                    : "University suggestions depend on selected country and city. If it is missing, add it manually."}
                </p>
              </div>
              <input className={inputClass} placeholder={tr ? "Bölüm *" : "Department *"} value={basic.degree || basic.department} onChange={(e) => setBasic({ ...basic, degree: e.target.value, department: e.target.value })} />
              <HFSelect
                value={basic.educationLanguage}
                onChange={(educationLanguage) => setBasic({ ...basic, educationLanguage })}
                options={educationLanguageOptions}
                placeholder={tr ? "Eğitim dili" : "Education language"}
                aria-label={tr ? "Eğitim dili" : "Education language"}
              />
              <div className="hf-education-status">
                <div className="hf-education-status__head">
                  <strong>{tr ? "Eğitim durumu *" : "Education status *"}</strong>
                  <span>
                    {tr
                      ? "Doğru zamanlama, rol hazırlığı tahminini değiştirir."
                      : "Timing changes how role readiness is interpreted."}
                  </span>
                </div>
                <div className="hf-onboard-looking-chips">
                  {EDUCATION_STATUS_OPTIONS.map((option) => (
                    <Chip
                      key={option.id}
                      size="lg"
                      active={basic.educationStatus === option.id}
                      label={tr ? option.labelTr : option.labelEn}
                      onClick={() =>
                        setBasic({
                          ...basic,
                          educationStatus: option.id,
                          educationLevel: educationLevelFromStatus(option.id, basic.educationLevel),
                          classYear: option.id === "currently_studying" ? basic.classYear : "",
                          graduationYear: option.id === "graduate" ? basic.graduationYear : "",
                          expectedGraduationYear:
                            ["currently_studying", "masters_student", "phd_student"].includes(option.id)
                              ? basic.expectedGraduationYear
                              : "",
                        })
                      }
                    />
                  ))}
                </div>
              </div>
              {basic.educationStatus === "currently_studying" ? (
                <HFSelect
                  value={basic.classYear}
                  onChange={(classYear) => setBasic({ ...basic, classYear })}
                  options={classYearOptions}
                  placeholder={tr ? "Sınıf *" : "Class year *"}
                  aria-label={tr ? "Sınıf" : "Class year"}
                />
              ) : null}
              {["currently_studying", "masters_student", "phd_student"].includes(basic.educationStatus) ? (
                <input
                  className={inputClass}
                  type="number"
                  min={new Date().getFullYear()}
                  max={new Date().getFullYear() + 12}
                  placeholder={tr ? "Beklenen mezuniyet yılı *" : "Expected graduation year *"}
                  value={basic.expectedGraduationYear}
                  onChange={(e) => setBasic({ ...basic, expectedGraduationYear: e.target.value })}
                />
              ) : null}
              {basic.educationStatus === "graduate" ? (
                <input
                  className={inputClass}
                  type="number"
                  min={1950}
                  max={new Date().getFullYear()}
                  placeholder={tr ? "Mezuniyet yılı *" : "Graduation year *"}
                  value={basic.graduationYear}
                  onChange={(e) => setBasic({ ...basic, graduationYear: e.target.value })}
                />
              ) : null}
              <input className={inputClass} placeholder={tr ? "GPA (önerilir)" : "GPA (recommended)"} value={basic.gpa} onChange={(e) => setBasic({ ...basic, gpa: e.target.value })} />
              <HFLanguageSection
                lang={lang}
                languages={basic.languages}
                onLanguagesChange={(languages) => setBasic({ ...basic, languages })}
              />
            </div>
          </motion.div>
        ) : null}

        {step === 2 ? (
          <motion.div key="s2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
            <h2 className="hf-onboard-step-title">{labels.step2}</h2>
            <OnboardingSubnav
              tabs={goalsTabs}
              active={goalsPanel}
              onChange={setGoalsPanel}
              ariaLabel={tr ? "Kariyer hedefi bölümleri" : "Career goal sections"}
            />
            <div
              id={`hf-onboard-panel-${goalsPanel}`}
              role="tabpanel"
              className="hf-onboard-tab-panel hf-onboard-tab-panel--goals"
            >
            <div className="hf-onboard-group-grid">
              {goalsPanel === "environment" ? (
              <div className="hf-onboard-sector-block">
                <span className="hf-onboard-step-badge">1. {tr ? "Önce sektör" : "Sector first"}</span>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>{tr ? "Sektör seç *" : "Select sector *"}</div>
                <p className="hf-onboard-helper">
                  {tr
                    ? "En çok çalışmak istediğin alanı HireFit'e öğret."
                    : "Teach AI which field you want to work in most."}
                </p>
                <div className="hf-onboard-looking-chips">
                  {INDUSTRIES.map((ind) => (
                    <Chip
                      key={ind.id}
                      size="lg"
                      active={selectedIndustries.includes(ind.id)}
                      label={tr ? ind.labelTr : ind.labelEn}
                      onClick={() => toggleIndustry(ind.id)}
                      disabled={
                        selectedIndustries.length >= MAX_TARGET_ROLES &&
                        !selectedIndustries.includes(ind.id)
                      }
                      title={
                        selectedIndustries.length >= MAX_TARGET_ROLES &&
                        !selectedIndustries.includes(ind.id)
                          ? tr
                            ? "En fazla 3 sektör"
                            : "Maximum 3 sectors"
                          : ""
                      }
                    />
                  ))}
                </div>
                <div className="hf-onboard-role-limit" aria-live="polite">
                  <span>{selectedIndustries.length}/{MAX_TARGET_ROLES}</span>
                  <p>
                    {industryLimitNotice ||
                      (tr
                        ? "Birincil, ikincil ve keşif sektörünü seç."
                        : "Choose a primary, secondary, and exploration sector.")}
                  </p>
                </div>
                <RankedPriorityList
                  items={selectedIndustries}
                  getItemLabel={(id) => getIndustryLabel(id, lang)}
                  onMove={moveRankedIndustry}
                  lang={lang}
                  kind="industry"
                />
              </div>
              ) : null}

              {goalsPanel === "target" ? (
              <div className="hf-onboard-looking-block">
                <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>{tr ? "Ne arıyorsun? *" : "Looking for *"}</div>
                <p className="hf-onboard-helper">
                  {tr
                    ? "İlk önceliğin iş önerilerinin sıralamasını belirler."
                    : "Your top priority shapes how job recommendations are ranked."}
                </p>
                <div className="hf-onboard-looking-chips">
                  {LOOKING_FOR_OPTIONS.map((o) => (
                    <Chip
                      key={o.id}
                      size="lg"
                      active={normalizeLookingFor(goals.lookingFor).includes(o.id)}
                      label={tr ? o.labelTr : o.labelEn}
                      onClick={() => toggleLookingFor(o.id)}
                      disabled={
                        normalizeLookingFor(goals.lookingFor).length >= MAX_TARGET_ROLES &&
                        !normalizeLookingFor(goals.lookingFor).includes(o.id)
                      }
                      title={
                        normalizeLookingFor(goals.lookingFor).length >= MAX_TARGET_ROLES &&
                        !normalizeLookingFor(goals.lookingFor).includes(o.id)
                          ? tr
                            ? "En fazla 3 tercih"
                            : "Maximum 3 preferences"
                          : ""
                      }
                    />
                  ))}
                </div>
                <div className="hf-onboard-role-limit" aria-live="polite">
                  <span>{normalizeLookingFor(goals.lookingFor).length}/{MAX_TARGET_ROLES}</span>
                  <p>
                    {lookingForLimitNotice ||
                      (tr
                        ? "Birincil, ikincil ve ek tercihini seç."
                        : "Choose a primary, secondary, and additional preference.")}
                  </p>
                </div>
                <RankedPriorityList
                  items={normalizeLookingFor(goals.lookingFor)}
                  getItemLabel={(id) => {
                    const row = LOOKING_FOR_OPTIONS.find((o) => o.id === id);
                    return row ? (tr ? row.labelTr : row.labelEn) : id;
                  }}
                  onMove={moveRankedLookingFor}
                  lang={lang}
                  kind="looking"
                />
              </div>
              ) : null}

              {goalsPanel === "environment" ? (
              <div className="hf-onboard-looking-block">
                <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>
                  {tr ? "Nasıl çalışmak istersin?" : "How would you like to work?"}
                </div>
                <p className="hf-onboard-helper">
                  {tr
                    ? "Bu tercih rol önerisini değiştirmez; fırsat ortamını daha doğru yorumlamamıza yardım eder."
                    : "This does not change role scoring; it helps us read your preferred work environment."}
                </p>
                <div className="hf-onboard-looking-chips">
                  {WORK_MODE_OPTIONS.map((o) => (
                    <Chip
                      key={o.id}
                      size="lg"
                      active={(goals.workMode || []).includes(o.id)}
                      label={tr ? o.labelTr : o.labelEn}
                      onClick={() =>
                        setGoals(
                          normalizeGoalsLocation({
                            ...goals,
                            workMode: toggleMulti(goals.workMode || [], o.id),
                          })
                        )
                      }
                    />
                  ))}
                </div>
              </div>
              ) : null}

              {goalsPanel === "environment" ? (
              <div className="hf-onboard-looking-block">
                <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>
                  {tr ? "Yurt dışında çalışmayı düşünüyor musun?" : "Are you considering working abroad?"}
                </div>
                <div className="hf-onboard-looking-chips">
                  {INTERNATIONAL_INTENT_OPTIONS.map((o) => (
                    <Chip
                      key={o.id}
                      size="lg"
                      active={goals.internationalInterest === o.id}
                      label={tr ? o.labelTr : o.labelEn}
                      onClick={() =>
                        setGoals(
                          normalizeGoalsLocation({
                            ...goals,
                            internationalInterest: o.id,
                            targetCountries: ["yes", "maybe"].includes(o.id) ? goals.targetCountries : [],
                            internationalIndustries: ["yes", "maybe"].includes(o.id) ? goals.internationalIndustries : [],
                          })
                        )
                      }
                    />
                  ))}
                </div>
                {["yes", "maybe"].includes(goals.internationalInterest) ? (
                  <div className="hf-international-fields">
                    <div>
                      <strong>{tr ? "\u00d6ncelikli \u00fclkelerin" : "Priority countries"}</strong>
                      {INTERNATIONAL_COUNTRY_GROUPS.map((group) => (
                        <div key={group.id} className="hf-international-fields__group">
                          <span>{tr ? group.labelTr : group.labelEn}</span>
                          <div className="hf-onboard-looking-chips">
                            {group.countries.map((country) => (
                              <Chip
                                key={country}
                                active={(goals.targetCountries || []).includes(country)}
                                label={country}
                                onClick={() => toggleInternationalCountry(country)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                      {(goals.targetCountries || []).length ? (
                        <RankedPriorityList
                          items={goals.targetCountries || []}
                          getItemLabel={(country) => country}
                          onMove={moveRankedInternationalCountry}
                          lang={lang}
                          kind="companyIndustry"
                        />
                      ) : null}
                    </div>
                    <div>
                      <strong>{tr ? "Yurt d\u0131\u015f\u0131nda hangi sekt\u00f6rleri hedefliyorsun?" : "Which sectors abroad are you targeting?"}</strong>
                      <p className="hf-onboard-helper">
                        {tr
                          ? "\u0130stersen yerel sekt\u00f6rlerinden farkl\u0131 bir y\u00f6n se\u00e7ebilirsin."
                          : "You can choose a different direction from your local sector focus."}
                      </p>
                      <div className="hf-onboard-looking-chips">
                        {INDUSTRIES.slice(0, 16).map((ind) => (
                          <Chip
                            key={ind.id}
                            active={(goals.internationalIndustries || []).includes(ind.id)}
                            label={tr ? ind.labelTr : ind.labelEn}
                            onClick={() => toggleInternationalIndustry(ind.id)}
                            disabled={
                              (goals.internationalIndustries || []).length >= MAX_TARGET_ROLES &&
                              !(goals.internationalIndustries || []).includes(ind.id)
                            }
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              ) : null}

              {goalsPanel === "roles" ? (
              <div className="hf-onboard-role-block">
                <span className="hf-onboard-step-badge">2. {tr ? "Sonra hedef rol" : "Then target role"}</span>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>
                  {tr ? "Hangi rolleri hedefliyorsun? *" : "Which roles are you targeting? *"}
                </div>
                <p className="hf-onboard-helper">
                  {tr
                    ? "Seçtiğin tüm sektörlerin rolleri birleştirilir. İlk 10 rolü gösteriyoruz."
                    : "Roles from all selected sectors are merged. We show the top 10 first."}
                </p>
                {selectedIndustries.length ? (
                  <>
                    <div id="career-role-options" className="hf-onboard-looking-chips" style={{ marginTop: 8 }}>
                      {visibleRoleOptions.map((role) => (
                        <RoleChip
                          key={role}
                          role={role}
                          active={goals.targetRoles.includes(role)}
                          lang={lang}
                          onClick={() => toggleTargetRole(role)}
                          disabled={
                            goals.targetRoles.length >= MAX_TARGET_ROLES &&
                            !goals.targetRoles.includes(role)
                          }
                        />
                      ))}
                    </div>
                    <div className="hf-onboard-role-limit" aria-live="polite">
                      <span>{goals.targetRoles.length}/{MAX_TARGET_ROLES}</span>
                      <p>
                        {roleLimitNotice ||
                          (tr
                            ? "Birincil, ikincil ve keşif rolünü seç."
                            : "Choose a primary, secondary, and exploration role.")}
                      </p>
                    </div>
                    {extraRoleOptions.length > 0 ? (
                      <button
                        type="button"
                        className="hf-onboard-show-more-roles"
                        aria-expanded={showAllRoles}
                        aria-controls="career-role-options"
                        onClick={() => setShowAllRoles((v) => !v)}
                      >
                        {showAllRoles
                          ? tr
                            ? "Daha az rol göster"
                            : "Show fewer roles"
                          : tr
                            ? "+ Daha Fazla Rol Göster"
                            : "+ Show more roles"}
                      </button>
                    ) : null}
                    {goals.targetRoles.length > 0 ? (
                      <RankedPriorityList
                        items={goals.targetRoles}
                        getItemLabel={(role) => getRoleLabel(role, lang)}
                        onMove={moveRankedRole}
                        lang={lang}
                        kind="role"
                      />
                    ) : null}
                  </>
                ) : (
                  <div className="hf-onboard-role-placeholder">
                    {tr ? "Önce sektör seç - roller sektörüne göre hazırlanır." : "Select a sector first - roles are tailored to your industry."}
                  </div>
                )}
              </div>
              ) : null}

              {goalsPanel === "target" ? (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 8 }}>
                  {tr ? "Deneyim seviyesi *" : "Experience level *"}
                </div>
                <p className="hf-onboard-helper" style={{ marginBottom: 8 }}>
                  {tr ? "Birden fazla seçebilirsin." : "You can select more than one."}
                </p>
                <div className="hf-onboard-looking-chips">
                  {EXPERIENCE_LEVELS.map((o) => (
                    <Chip
                      key={o.id}
                      size="lg"
                      active={(goals.experienceLevels || []).includes(o.id)}
                      label={tr ? o.labelTr : o.labelEn}
                      onClick={() => {
                        const experienceLevels = toggleMulti(goals.experienceLevels || [], o.id);
                        const primary = primaryExperienceLevel(experienceLevels);
                        setGoals(
                          normalizeGoalsLocation({
                            ...goals,
                            experienceLevels,
                            experienceLevel: primary,
                            seniority: primary,
                          })
                        );
                      }}
                    />
                  ))}
                </div>
              </div>
              ) : null}
              {goalsPanel === "environment" ? (
              <div className="hf-company-preference">
                <div className="hf-company-preference__head">
                  <strong>{tr ? "Şirket aşaması" : "Company Stage"}</strong>
                  <RecommendedBadge lang={lang} />
                </div>
                <p className="hf-onboard-helper" style={{ marginBottom: 8 }}>
                  {tr
                    ? "Startup ve kurumsal şirketlerde beklentiler oldukça farklıdır."
                    : "Expectations differ significantly between startups and enterprise companies."}
                </p>
                <div className="hf-onboard-looking-chips">
                  {COMPANY_STAGE_OPTIONS.map((option) => (
                    <Chip
                      key={option.id}
                      size="lg"
                      active={(goals.companyStages || []).includes(option.id)}
                      label={tr ? option.labelTr : option.labelEn}
                      onClick={() => {
                        const companyStages = toggleMulti(goals.companyStages || [], option.id);
                        setGoals(
                          normalizeGoalsLocation({
                            ...goals,
                            companyStages,
                          })
                        );
                      }}
                    />
                  ))}
                </div>
              </div>
              ) : null}
              {goalsPanel === "environment" ? (
              <div className="hf-company-preference">
                <div className="hf-company-preference__head">
                  <strong>{tr ? "Şirket sektörü" : "Company Industry"}</strong>
                  <RecommendedBadge lang={lang} />
                </div>
                <p className="hf-onboard-helper" style={{ marginBottom: 8 }}>
                  {tr
                    ? "En çok çalışmak istediğin şirket sektörlerini öncelik sırasıyla seç."
                    : "Select company industries in priority order."}
                </p>
                <div className="hf-onboard-looking-chips hf-onboard-looking-chips--wrap">
                  {COMPANY_INDUSTRY_OPTIONS.map((option) => (
                    <Chip
                      key={option.id}
                      size="lg"
                      active={(goals.companyIndustries || []).includes(option.id)}
                      label={tr ? option.labelTr : option.labelEn}
                      onClick={() => toggleCompanyIndustry(option.id)}
                      disabled={
                        (goals.companyIndustries || []).length >= MAX_TARGET_ROLES &&
                        !(goals.companyIndustries || []).includes(option.id)
                      }
                      title={
                        (goals.companyIndustries || []).length >= MAX_TARGET_ROLES &&
                        !(goals.companyIndustries || []).includes(option.id)
                          ? tr
                            ? "En fazla 3 şirket sektörü"
                            : "Maximum 3 company industries"
                          : ""
                      }
                    />
                  ))}
                </div>
                {(goals.companyIndustries || []).length ? (
                  <>
                    <div className="hf-onboard-role-limit" aria-live="polite">
                      <span>{(goals.companyIndustries || []).length}/{MAX_TARGET_ROLES}</span>
                      <p>
                        {companyIndustryLimitNotice ||
                          (tr
                            ? "Birincil, ikincil ve keşif sektörünü seç."
                            : "Choose a primary, secondary, and exploration industry.")}
                      </p>
                    </div>
                    <RankedPriorityList
                      items={goals.companyIndustries || []}
                      getItemLabel={(id) => {
                        const row = COMPANY_INDUSTRY_OPTIONS.find((o) => o.id === id);
                        return row ? (tr ? row.labelTr : row.labelEn) : id;
                      }}
                      onMove={moveRankedCompanyIndustry}
                      lang={lang}
                      kind="companyIndustry"
                    />
                  </>
                ) : null}
              </div>
              ) : null}
            </div>
            </div>
          </motion.div>
        ) : null}

        {step === 3 ? (
          <motion.div key="s3" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
            <h2 className="hf-onboard-step-title hf-onboard-step-title--compact">{labels.step3}</h2>
            <p className="hf-onboard-step-body">
              {tr
                ? "Bu bir MBTI testi değil - kariyer davranış modelini (Career Archetype) çıkarmak için 10 kısa soru."
                : "Not an MBTI test — 10 short questions to reveal your Career Archetype."}
            </p>
            <p className="hf-onboard-step-body hf-onboard-step-body--muted">
              {tr ? "1 = Kesinlikle katılmıyorum ? 5 = Kesinlikle katılıyorum" : "1 = Strongly disagree ? 5 = Strongly agree"}
            </p>
            <div style={{ display: "grid", gap: 16 }}>
              {dnaQuestions.map((q, qi) => (
                <div key={q.id} className="hf-onboard-dna-card">
                  <div className="hf-onboard-dna-card__prompt">
                    {qi + 1}. {q.prompt}
                  </div>
                  {q.type === "likert" ? (
                    <div className="hf-likert-row">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`hf-likert-btn${Number(dnaAnswers[q.id]) === n ? " hf-likert-btn--active" : ""}`}
                          onClick={() => setDnaAnswers({ ...dnaAnswers, [q.id]: n })}
                          title={q.scaleLabels?.[n - 1]}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 6 }}>
                      {(q.options || []).map((opt, oi) => (
                        <button
                          key={oi}
                          type="button"
                          onClick={() => setDnaAnswers({ ...dnaAnswers, [q.id]: oi })}
                          style={{
                            textAlign: "left",
                            padding: "9px 10px",
                            borderRadius: 8,
                            border: dnaAnswers[q.id] === oi ? "1px solid rgba(99,102,241,0.55)" : "1px solid rgba(148,163,184,0.15)",
                            background: dnaAnswers[q.id] === oi ? "rgba(99,102,241,0.2)" : "transparent",
                            color: "#cbd5e1",
                            fontSize: 12,
                            fontWeight: 650,
                            cursor: "pointer",
                            fontFamily: "var(--font-sans)",
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="hf-mbti-panel hf-mbti-panel--optional">
              <p style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 8px" }}>
                {tr ? "İsteğe bağlı" : "Optional"}
              </p>
              <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px", lineHeight: 1.5 }}>
                {tr
                  ? "MBTI ana sistem değildir. İstersen ek kişilik sinyali için kısa testi açabilirsin."
                  : "MBTI is not the core system. Open the short quiz only if you want extra personality signal."}
              </p>
              {!showMbti ? (
                <button
                  type="button"
                  className="hf-onboard-chip"
                  style={{ padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 12 }}
                  onClick={() => setShowMbti(true)}
                >
                  {tr ? "MBTI (isteğe bağlı)" : "MBTI (optional)"}
                </button>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {mbtiQuestions.map((mq) => (
                    <div key={mq.id}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 8 }}>{mq.prompt}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {mq.options.map((opt) => (
                          <Chip
                            key={opt.value}
                            size="lg"
                            active={mbtiAnswers[mq.id] === opt.value}
                            label={opt.label}
                            onClick={() => {
                              const next = { ...mbtiAnswers, [mq.id]: opt.value };
                              setMbtiAnswers(next);
                              setBasic({ ...basic, mbtiType: resolveMbtiType(next) });
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  {basic.mbtiType || resolveMbtiType(mbtiAnswers) ? (
                    <p style={{ fontSize: 12, color: "#a5b4fc", margin: 0 }}>
                      {tr ? "MBTI: " : "MBTI: "}
                      <strong>{basic.mbtiType || resolveMbtiType(mbtiAnswers)}</strong>
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </motion.div>
        ) : null}

        {step === 4 ? (
          <motion.div key="s4" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
            <h2 className="hf-onboard-step-title hf-onboard-step-title--compact">{labels.step4}</h2>
            <p className="hf-onboard-helper" style={{ marginBottom: 16 }}>
              {tr
                ? "Deneyim ve liderlikte sana uyan tüm sinyalleri seç; diğer alanlarda en yakın benchmarkı işaretle."
                : "Select every experience and leadership signal that applies; use the closest benchmark elsewhere."}
            </p>
            <OnboardingSubnav
              tabs={readinessTabs}
              active={readinessPanel}
              onChange={setReadinessPanel}
              ariaLabel={tr ? "Kariyer kanıtı bölümleri" : "Career evidence sections"}
            />
            <div
              id={`hf-onboard-panel-${readinessPanel}`}
              role="tabpanel"
              className="hf-onboard-tab-panel"
            >
            {readinessPanel === "evidence" ? (
            <>
            <HFCvSection
              lang={lang}
              cv={cv}
              onCvChange={setCv}
              getApiAuthHeaders={getApiAuthHeaders}
              onCvFileSelected={setPendingCvFile}
            />
            <CareerSignalLinks
              lang={lang}
              showCreative={hasCreativeDirection}
              value={{
                linkedin: basic.linkedin,
                github: basic.github,
                portfolio: basic.portfolio,
                website: basic.website,
                behance: basic.behance,
                dribbble: basic.dribbble,
              }}
              onChange={(links) => setBasic({ ...basic, ...links })}
            />
            </>
            ) : null}
            {readinessPanel === "experience" ? (
            <div className="hf-readiness-section" style={{ marginTop: 20 }}>
              {READINESS_PILLAR_KEYS.map((key) => {
                if (key === "experience" || key === "leadership") {
                  const signalOptions = key === "experience"
                    ? EXPERIENCE_SIGNAL_OPTIONS
                    : LEADERSHIP_SIGNAL_OPTIONS;
                  const signalValues = key === "experience"
                    ? basic.experienceSignals
                    : basic.leadershipSignals;
                  if (key === "leadership") {
                    const status = basic.leadershipExperienceStatus || "";
                    const examples = tr
                      ? ["Kulüp veya topluluk sorumluluğu", "Proje liderliği", "Küçük ekip koordinasyonu", "Mentor olmak", "Etkinlik düzenlemek", "Kurucu olmak", "Gönüllü ekip yönetmek"]
                      : ["Club or community responsibility", "Project leadership", "Small team coordination", "Mentoring", "Event organization", "Founder work", "Volunteer team coordination"];
                    return (
                      <div key={key} className="hf-readiness-block hf-leadership-disclosure">
                        <div className="hf-readiness-block__title">
                          {tr ? "Herhangi bir liderlik veya sorumluluk deneyimin oldu mu?" : "Have you had any leadership or responsibility experience?"}
                        </div>
                        <div className="hf-onboard-looking-chips">
                          {[
                            { id: "yes", labelTr: "Evet", labelEn: "Yes" },
                            { id: "no", labelTr: "Henüz olmadı", labelEn: "Not yet" },
                            { id: "unsure", labelTr: "Emin değilim", labelEn: "Not sure" },
                          ].map((option) => (
                            <Chip
                              key={option.id}
                              size="lg"
                              active={status === option.id}
                              label={tr ? option.labelTr : option.labelEn}
                              onClick={() => {
                                const patch = { ...basic, leadershipExperienceStatus: option.id };
                                if (option.id === "no") {
                                  patch.leadershipSignals = [];
                                  setReadinessAnswers({ ...readinessAnswers, leadership: "none" });
                                }
                                setBasic(patch);
                              }}
                            />
                          ))}
                        </div>
                        {status === "unsure" ? (
                          <div className="hf-leadership-examples">
                            <p>{tr ? "Bunlardan biri varsa liderlik sinyali sayılabilir:" : "Any of these can count as a leadership signal:"}</p>
                            <ul>
                              {examples.map((item) => <li key={item}>{item}</li>)}
                            </ul>
                          </div>
                        ) : null}
                        {status === "yes" ? (
                          <HFMultiSignalSelect
                            label={getReadinessPillarLabel(key, lang)}
                            helper={tr ? "Sana uyan sorumluluk örneklerini seç." : "Select the responsibility examples that apply."}
                            options={signalOptions}
                            values={signalValues}
                            lang={lang}
                            onChange={(optionId) => updateReadinessSignals(key, optionId)}
                          />
                        ) : null}
                      </div>
                    );
                  }
                  return (
                    <HFMultiSignalSelect
                      key={key}
                      label={getReadinessPillarLabel(key, lang)}
                      helper={tr ? "Uygun olanların tümünü seç." : "Select every signal that applies."}
                      options={signalOptions}
                      values={signalValues}
                      lang={lang}
                      onChange={(optionId) => updateReadinessSignals(key, optionId)}
                    />
                  );
                }
                const pillar = READINESS_BENCHMARKS[key];
                const selected = pillar.options.find((o) => o.id === readinessAnswers[key]);
                const selectedHint = selected
                  ? tr
                    ? selected.descriptionTr
                    : selected.descriptionEn
                  : "";
                return (
                  <div key={key} className="hf-readiness-block">
                    <div className="hf-readiness-block__title">{getReadinessPillarLabel(key, lang)}</div>
                    {key === "network" ? (
                      <p className="hf-onboard-helper hf-readiness-block__hint">
                        {tr
                          ? "Bağlantı sayısından çok, fırsat kalitesi önemli - mentor, sektör veya üniversite çevreni seç."
                          : "Opportunity quality matters more than raw count — choose mentors, industry, or university context."}
                      </p>
                    ) : null}
                    <div className="hf-onboard-looking-chips">
                      {pillar.options.map((opt) => (
                        <Chip
                          key={opt.id}
                          size="lg"
                          active={readinessAnswers[key] === opt.id}
                          label={tr ? opt.labelTr : opt.labelEn}
                          onClick={() =>
                            setReadinessAnswers({ ...readinessAnswers, [key]: opt.id })
                          }
                        />
                      ))}
                    </div>
                    {selectedHint ? (
                      <p className="hf-onboard-helper hf-readiness-block__hint">{selectedHint}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
            ) : null}
            {readinessPanel === "final" ? (
            <div className="hf-onboard-late-preference">
              <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 8 }}>
                {tr ? "Şirket büyüklüğü" : "Company size"}
              </div>
              <p className="hf-onboard-helper" style={{ marginBottom: 8 }}>
                {tr
                  ? "Bu tercih Career Snapshot'ta şirket ortamı ve hazırlık yorumunu daha netleştirir."
                  : "This helps the Career Snapshot read your preferred company environment more clearly."}
              </p>
              <div className="hf-onboard-looking-chips">
                {COMPANY_SIZE_OPTIONS.map((o) => (
                  <Chip
                    key={o.id}
                    size="lg"
                    active={(goals.companySizes || []).includes(o.id)}
                    label={tr ? o.labelTr : o.labelEn}
                    onClick={() =>
                      setGoals(
                        normalizeGoalsLocation({
                          ...goals,
                          companySizes: toggleMulti(goals.companySizes || [], o.id),
                        })
                      )
                    }
                  />
                ))}
              </div>
            </div>
            ) : null}
            </div>
          </motion.div>
        ) : null}

        {step === 5 && summary ? (
          <FirstCareerAnalysisFlow
            profile={summary}
            lang={lang}
            navigate={navigate}
            getApiAuthHeaders={getApiAuthHeaders}
            initialCvFile={pendingCvFile}
            onProfileUpdate={(p) => {
              setSummary(p);
              setCareerProfile?.(p);
            }}
          />
        ) : null}
      </AnimatePresence>

      {step < 5 ? (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, gap: 10 }}>
          <button
            type="button"
            disabled={step === 1 || saving}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.2)",
              background: "transparent",
              color: "#94a3b8",
              fontWeight: 700,
              cursor: step === 1 ? "not-allowed" : "pointer",
              opacity: step === 1 ? 0.4 : 1,
            }}
          >
            <ChevronLeft size={14} /> {labels.back}
          </button>
          {step < 4 ? (
            <button type="button" className="hf-btn-primary" disabled={saving} onClick={onNext} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {labels.next} <ChevronRight size={14} />
            </button>
          ) : (
            <button type="button" className="hf-btn-primary" disabled={saving} onClick={onComplete} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {saving ? (tr ? "Kaydediliyor..." : "Saving...") : labels.finish}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
