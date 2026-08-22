/**
 * Optional mini MBTI — 4 dichotomies, stored on profile as mbtiType (e.g. "INTJ").
 */

export const MBTI_QUESTIONS = [
  {
    id: "ei",
    promptTr: "Enerjini daha çok nereden alırsın?",
    promptEn: "Where do you get your energy?",
    options: [
      { value: "E", labelTr: "İnsanlarla birlikteyken (E)", labelEn: "With people (E)" },
      { value: "I", labelTr: "Yalnızken veya küçük grupla (I)", labelEn: "Alone or small group (I)" },
    ],
  },
  {
    id: "sn",
    promptTr: "Yeni bilgiyi nasıl işlersin?",
    promptEn: "How do you process new information?",
    options: [
      { value: "S", labelTr: "Somut gerçekler ve deneyim (S)", labelEn: "Concrete facts (S)" },
      { value: "N", labelTr: "Olasılıklar ve fikirler (N)", labelEn: "Possibilities and ideas (N)" },
    ],
  },
  {
    id: "tf",
    promptTr: "Karar verirken önceliğin…",
    promptEn: "When deciding, you prioritize…",
    options: [
      { value: "T", labelTr: "Mantık ve nesnellik (T)", labelEn: "Logic and objectivity (T)" },
      { value: "F", labelTr: "Değerler ve insan etkisi (F)", labelEn: "Values and people impact (F)" },
    ],
  },
  {
    id: "jp",
    promptTr: "Günlük düzenin…",
    promptEn: "Your daily style is…",
    options: [
      { value: "J", labelTr: "Planlı ve yapılandırılmış (J)", labelEn: "Planned and structured (J)" },
      { value: "P", labelTr: "Esnek ve spontane (P)", labelEn: "Flexible and spontaneous (P)" },
    ],
  },
];

export function getMbtiQuestions(lang = "TR") {
  const tr = String(lang || "").toUpperCase() === "TR";
  return MBTI_QUESTIONS.map((q) => ({
    id: q.id,
    prompt: tr ? q.promptTr : q.promptEn,
    options: q.options.map((o) => ({
      value: o.value,
      label: tr ? o.labelTr : o.labelEn,
    })),
  }));
}

export function resolveMbtiType(answers = {}) {
  const letters = ["ei", "sn", "tf", "jp"].map((id) => answers[id]).filter(Boolean);
  return letters.length === 4 ? letters.join("") : "";
}
