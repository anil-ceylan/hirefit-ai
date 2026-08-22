/**
 * Benchmark-based career readiness self-assessment (onboarding step 4).
 * UI shows descriptive tiers; backend maps each choice to a 1–5 score.
 */

export const READINESS_PILLAR_KEYS = ["english", "network", "experience", "projects", "leadership"];

/** @typedef {{ id: string, score: number, labelTr: string, labelEn: string }} ReadinessOption */

/** @type {Record<string, { labelTr: string, labelEn: string, options: ReadinessOption[] }>} */
export const READINESS_BENCHMARKS = {
  english: {
    labelTr: "İngilizce",
    labelEn: "English",
    options: [
      { id: "basic", score: 1, labelTr: "Temel", labelEn: "Basic" },
      { id: "conversational", score: 2, labelTr: "Günlük konuşma", labelEn: "Everyday conversation" },
      { id: "interview", score: 3, labelTr: "İş görüşmesi", labelEn: "Job interview level" },
      { id: "presentation", score: 4, labelTr: "Profesyonel sunum", labelEn: "Professional presentation" },
      { id: "fluent_pro", score: 5, labelTr: "Akıcı profesyonel", labelEn: "Fluent professional" },
    ],
  },
  network: {
    labelTr: "Network",
    labelEn: "Network",
    options: [
      {
        id: "no_professional_network",
        score: 1,
        labelTr: "Henüz profesyonel network'üm yok",
        labelEn: "I don't have a professional network yet",
        descriptionTr: "Hedef rolünle ilgili düzenli konuşabildiğin bir profesyonel henüz yok.",
        descriptionEn: "You do not yet have a professional you can regularly speak with about your target role.",
      },
      {
        id: "university_network",
        score: 2,
        labelTr: "Üniversite çevresi",
        labelEn: "University network",
        descriptionTr: "Fırsatların çoğu arkadaş, kulüp, akademisyen veya alumni çevrenden geliyor.",
        descriptionEn: "Most opportunities come through peers, clubs, faculty, or alumni.",
      },
      {
        id: "industry_contacts",
        score: 3,
        labelTr: "Sektör bağlantıları",
        labelEn: "Industry contacts",
        descriptionTr: "Hedef sektöründe bilgi veya yönlendirme isteyebileceğin bağlantıların var.",
        descriptionEn: "You have contacts who can offer context or direction in your target industry.",
      },
      {
        id: "mentors_senior",
        score: 4,
        labelTr: "Mentorlar / kıdemli profesyoneller",
        labelEn: "Mentors / senior professionals",
        descriptionTr: "Kariyer kararlarını test edebildiğin kıdemli profesyoneller bulunuyor.",
        descriptionEn: "You can test career decisions with senior professionals.",
      },
      {
        id: "strong_professional_network",
        score: 5,
        labelTr: "Güçlü profesyonel network",
        labelEn: "Strong professional network",
        descriptionTr: "Network'ün düzenli olarak bilgi, tanıştırma veya fırsat üretiyor.",
        descriptionEn: "Your network regularly creates insight, introductions, or opportunities.",
      },
    ],
  },
  experience: {
    labelTr: "Deneyim",
    labelEn: "Experience",
    options: [
      { id: "none", score: 1, labelTr: "Hiç yok", labelEn: "None yet" },
      { id: "club", score: 2, labelTr: "Kulüp deneyimi", labelEn: "Club / society experience" },
      { id: "one_internship", score: 3, labelTr: "1 staj", labelEn: "One internship" },
      { id: "multiple_internships", score: 4, labelTr: "Birden fazla staj", labelEn: "Multiple internships" },
      { id: "work_experience", score: 5, labelTr: "İş deneyimi", labelEn: "Work experience" },
    ],
  },
  projects: {
    labelTr: "Projeler",
    labelEn: "Projects",
    options: [
      { id: "none", score: 1, labelTr: "Yok", labelEn: "None" },
      { id: "1_2", score: 2, labelTr: "1–2 proje", labelEn: "1–2 projects" },
      { id: "3_5", score: 3, labelTr: "3–5 proje", labelEn: "3–5 projects" },
      { id: "6_10", score: 4, labelTr: "6–10 proje", labelEn: "6–10 projects" },
      { id: "10_plus", score: 5, labelTr: "10+ proje", labelEn: "10+ projects" },
    ],
  },
  leadership: {
    labelTr: "Liderlik",
    labelEn: "Leadership",
    options: [
      { id: "none", score: 1, labelTr: "Yok", labelEn: "None" },
      { id: "small_team", score: 2, labelTr: "Küçük ekip", labelEn: "Small team" },
      { id: "club_community", score: 3, labelTr: "Kulüp / Topluluk", labelEn: "Club / community" },
      { id: "project_lead", score: 4, labelTr: "Proje liderliği", labelEn: "Project lead" },
      {
        id: "founder_cofounder",
        score: 4.5,
        labelTr: "Kurucu / Co-Founder",
        labelEn: "Founder / Co-Founder",
        descriptionTr:
          "Kendi girişimini, startupını, freelance işini veya iş fikrini aktif olarak yönettim.",
        descriptionEn:
          "I actively ran my own venture, startup, freelance business, or business idea.",
      },
      { id: "large_team", score: 5, labelTr: "Büyük ekip yönetimi", labelEn: "Large team management" },
    ],
  },
};

export function getReadinessPillarLabel(key, lang = "TR") {
  const pillar = READINESS_BENCHMARKS[key];
  if (!pillar) return key;
  return String(lang).toUpperCase() === "TR" ? pillar.labelTr : pillar.labelEn;
}

export function getReadinessOption(key, optionId) {
  const pillar = READINESS_BENCHMARKS[key];
  if (!pillar) return null;
  return pillar.options.find((o) => o.id === optionId) || null;
}

export function getReadinessOptionLabel(key, optionId, lang = "TR") {
  const opt = getReadinessOption(key, optionId);
  if (!opt) return "";
  return String(lang).toUpperCase() === "TR" ? opt.labelTr : opt.labelEn;
}

/** Resolve legacy numeric 1–5 or benchmark id to option */
function resolveOption(key, raw) {
  const pillar = READINESS_BENCHMARKS[key];
  if (!pillar) return null;
  if (raw == null || raw === "") return null;

  if (typeof raw === "number" || (typeof raw === "string" && /^\d+$/.test(raw.trim()))) {
    const n = Number(raw);
    if (n >= 1 && n <= 5) return pillar.options[n - 1] || null;
  }

  const id = String(raw).trim();
  if (key === "network") {
    const legacyNetworkMap = {
      "0_5": "no_professional_network",
      "5_20": "university_network",
      "20_50": "industry_contacts",
      "50_100": "mentors_senior",
      "100_plus": "strong_professional_network",
    };
    const mapped = legacyNetworkMap[id];
    if (mapped) return pillar.options.find((o) => o.id === mapped) || null;
  }
  return pillar.options.find((o) => o.id === id) || null;
}

/**
 * @param {Record<string, string|number>} raw
 * @returns {{ benchmarks: Record<string, string>, scores: Record<string, number> }}
 */
export function normalizeReadinessAnswers(raw = {}) {
  const benchmarks = {};
  const scores = {};

  for (const key of READINESS_PILLAR_KEYS) {
    const option = resolveOption(key, raw[key]);
    if (option) {
      benchmarks[key] = option.id;
      scores[key] = option.score;
    }
  }

  return { benchmarks, scores };
}

export function isReadinessComplete(raw = {}) {
  const { benchmarks } = normalizeReadinessAnswers(raw);
  return READINESS_PILLAR_KEYS.every((k) => Boolean(benchmarks[k]));
}

export function emptyReadinessAnswers() {
  return Object.fromEntries(READINESS_PILLAR_KEYS.map((k) => [k, ""]));
}
