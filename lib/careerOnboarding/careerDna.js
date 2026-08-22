import { TRAIT_DIMENSIONS, ARCHETYPE_TYPES } from "./traitConstants.js";

const LIKERT_SCALE_TR = [
  "Kesinlikle katılmıyorum",
  "Katılmıyorum",
  "Kararsızım",
  "Katılıyorum",
  "Kesinlikle katılıyorum",
];

const LIKERT_SCALE_EN = [
  "Strongly disagree",
  "Disagree",
  "Neutral",
  "Agree",
  "Strongly agree",
];

/** Likert item definitions — weights map to TRAIT_DIMENSIONS */
const LIKERT_ITEMS_TR = [
  { prompt: "Belirsizlik içinde karar alabilirim.", weights: { ambiguity_tolerance: 2, risk_taking: 1 } },
  { prompt: "İnsanları yönlendirmekten hoşlanırım.", weights: { leadership: 2, communication: 1 } },
  { prompt: "Verilerle çalışmayı severim.", weights: { analytical_thinking: 3 } },
  { prompt: "Yeni fikir üretmek beni motive eder.", weights: { creativity: 2, risk_taking: 1 } },
  { prompt: "Risk almaya açığım.", weights: { risk_taking: 2, execution: 1 } },
  { prompt: "Uzun vadeli plan yaparım.", weights: { analytical_thinking: 2, execution: 1 } },
  { prompt: "İnsan ilişkileri benim için önemlidir.", weights: { communication: 2, collaboration: 2 } },
  { prompt: "Detaylara dikkat ederim.", weights: { analytical_thinking: 2, execution: 1 } },
  { prompt: "Kendi başıma çalışmayı severim.", weights: { execution: 2, ambiguity_tolerance: 1 } },
  { prompt: "Sonuç odaklıyım.", weights: { execution: 3, leadership: 1 } },
];

const LIKERT_ITEMS_EN = [
  { prompt: "I can make decisions in uncertainty.", weights: { ambiguity_tolerance: 2, risk_taking: 1 } },
  { prompt: "I enjoy guiding people.", weights: { leadership: 2, communication: 1 } },
  { prompt: "I enjoy working with data.", weights: { analytical_thinking: 3 } },
  { prompt: "Generating new ideas motivates me.", weights: { creativity: 2, risk_taking: 1 } },
  { prompt: "I am open to taking risks.", weights: { risk_taking: 2, execution: 1 } },
  { prompt: "I make long-term plans.", weights: { analytical_thinking: 2, execution: 1 } },
  { prompt: "Relationships matter to me.", weights: { communication: 2, collaboration: 2 } },
  { prompt: "I pay attention to details.", weights: { analytical_thinking: 2, execution: 1 } },
  { prompt: "I prefer working independently.", weights: { execution: 2, ambiguity_tolerance: 1 } },
  { prompt: "I am results-driven.", weights: { execution: 3, leadership: 1 } },
];

export function getCareerDnaQuestions(lang = "TR") {
  const tr = String(lang || "").toUpperCase() === "TR";
  const items = tr ? LIKERT_ITEMS_TR : LIKERT_ITEMS_EN;
  const scaleLabels = tr ? LIKERT_SCALE_TR : LIKERT_SCALE_EN;
  return items.map((item, idx) => ({
    id: `likert_${idx + 1}`,
    prompt: item.prompt,
    type: "likert",
    weights: item.weights,
    scaleLabels,
    scaleMin: 1,
    scaleMax: 5,
  }));
}

export function scoreCareerDnaAnswers(answers = {}, lang = "TR") {
  const totals = Object.fromEntries(TRAIT_DIMENSIONS.map((d) => [d, 0]));
  const questions = getCareerDnaQuestions(lang);

  for (const qId of Object.keys(answers)) {
    const raw = answers[qId];
    const question = questions.find((x) => x.id === qId);
    if (!question) continue;

    if (question.type === "likert") {
      const val = Number(raw);
      if (!Number.isFinite(val) || val < 1 || val > 5) continue;
      for (const [dim, w] of Object.entries(question.weights || {})) {
        if (TRAIT_DIMENSIONS.includes(dim)) {
          totals[dim] = (totals[dim] || 0) + val * (Number(w) || 1);
        }
      }
      continue;
    }

    const choice = Number(raw);
    if (!Number.isFinite(choice)) continue;
    const opt = question.options?.[choice];
    if (!opt?.scores) continue;
    for (const [dim, pts] of Object.entries(opt.scores)) {
      if (TRAIT_DIMENSIONS.includes(dim)) totals[dim] = (totals[dim] || 0) + pts;
    }
  }
  return totals;
}

export function resolveCareerArchetype(traitScores) {
  const s = traitScores || {};
  const pick = (weights) =>
    Object.entries(weights).reduce((sum, [k, w]) => sum + (s[k] || 0) * w, 0);

  const ranked = [
    { id: "leader", score: pick({ leadership: 3, communication: 2, collaboration: 2 }) },
    { id: "founder", score: pick({ risk_taking: 3, leadership: 2, execution: 2 }) },
    { id: "builder", score: pick({ execution: 3, risk_taking: 2, ambiguity_tolerance: 1 }) },
    { id: "strategist", score: pick({ analytical_thinking: 3, ambiguity_tolerance: 2, communication: 1 }) },
    { id: "operator", score: pick({ execution: 3, collaboration: 2, analytical_thinking: 1 }) },
    { id: "analyst", score: pick({ analytical_thinking: 4, execution: 1 }) },
    { id: "creator", score: pick({ creativity: 4, communication: 1, risk_taking: 1 }) },
    { id: "researcher", score: pick({ analytical_thinking: 3, creativity: 2, execution: 1 }) },
    { id: "communicator", score: pick({ communication: 4, collaboration: 2, creativity: 1 }) },
  ].sort((a, b) => b.score - a.score);

  const top = ranked[0]?.id || "analyst";
  return ARCHETYPE_TYPES[top] || ARCHETYPE_TYPES.analyst;
}

export function resolveCareerDnaType(scores) {
  return resolveCareerArchetype(scores);
}

export function traitLabels(lang) {
  const tr = String(lang || "").toUpperCase() === "TR";
  return {
    leadership: tr ? "Liderlik" : "Leadership",
    communication: tr ? "İletişim" : "Communication",
    risk_taking: tr ? "Risk alma" : "Risk taking",
    analytical_thinking: tr ? "Analitik düşünme" : "Analytical thinking",
    creativity: tr ? "Yaratıcılık" : "Creativity",
    execution: tr ? "Uygulama" : "Execution",
    collaboration: tr ? "İş birliği" : "Collaboration",
    ambiguity_tolerance: tr ? "Belirsizlik toleransı" : "Ambiguity tolerance",
  };
}

export function dimensionLabels(lang) {
  return traitLabels(lang);
}

export const DNA_DIMENSIONS = TRAIT_DIMENSIONS;
export const DNA_TYPES = ARCHETYPE_TYPES;
