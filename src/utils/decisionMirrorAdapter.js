import { generateReflection } from "../../lib/decisionOS/reflection/index.js";

export const ENABLE_SYMBOLIC_REFLECTION_PACKS = false;

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_RE = /(?:\+?\d[\s().-]*){8,}/;
const BIRTH_RE = /\b(birth|birthday|birthdate|born|doğum|dogum|saat|konum|location)\b/i;
const VALUE_LABEL_TR = Object.freeze({
  Growth: "gelişim",
  Security: "güvenlik",
  Freedom: "özgürlük",
  Recognition: "takdir görme",
  Impact: "etki",
  Creativity: "yaratıcılık",
  Learning: "öğrenme",
  Community: "aidiyet",
  Stability: "istikrar",
  Achievement: "başarı",
});

function clean(value, max = 180) {
  return String(value || "")
    .replace(EMAIL_RE, "")
    .replace(PHONE_RE, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function compactList(values, max = 3) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => clean(value, 180)).filter(Boolean))].slice(0, max);
}

export function validateDecisionMirrorPrivacy(payload = {}) {
  const text = JSON.stringify(payload || {});
  const violations = [];
  if (EMAIL_RE.test(text)) violations.push({ code: "EMAIL_PRESENT" });
  if (PHONE_RE.test(text)) violations.push({ code: "PHONE_PRESENT" });
  if (BIRTH_RE.test(text)) violations.push({ code: "BIRTH_DATA_PRESENT" });
  if (/cvText|jdText|rawCv|rawJobDescription|fullName|email|phone/i.test(text)) {
    violations.push({ code: "RAW_OR_PII_FIELD_PRESENT" });
  }
  return {
    valid: violations.length === 0,
    violations,
  };
}

function buildSafeReflectionInput({ decision = {}, lang = "TR" } = {}) {
  const tr = lang === "TR";
  const safeDecision = {
    action: clean(decision.action, 140),
    role: clean(decision.role, 120),
    opportunity: clean(decision.opportunity, 140),
    blocker: clean(decision.blocker, 140),
    impact: clean(decision.impact, 120),
    confidenceLabel: clean(decision.confidenceLabel, 40),
  };
  return {
    decision: safeDecision.role
      ? `${safeDecision.role}: ${safeDecision.action}`
      : safeDecision.action,
    context: {
      product: "HireFit",
      language: tr ? "TR" : "EN",
      decisionType: "career_direction",
      recommendationContext: {
        opportunity: safeDecision.opportunity,
        blocker: safeDecision.blocker,
        expectedImpact: safeDecision.impact,
        confidence: safeDecision.confidenceLabel,
      },
    },
    evidence: [
      safeDecision.role
        ? {
            id: "weekly_decision_role",
            title: "Recommended career direction",
            textSummary: safeDecision.role,
            sourceType: "career_snapshot_summary",
          }
        : null,
      safeDecision.blocker
        ? {
            id: "weekly_decision_blocker",
            title: "Current blocker",
            textSummary: safeDecision.blocker,
            sourceType: "weekly_decision_summary",
          }
        : null,
    ].filter(Boolean),
    memory: {},
    optionalPacks: ENABLE_SYMBOLIC_REFLECTION_PACKS ? ["decision_style"] : [],
  };
}

function translateQuestion(question, { tr, valueLabel, biasLabel, decisionRole }) {
  if (!tr) return clean(question, 180);
  const localValueLabel = VALUE_LABEL_TR[valueLabel] || valueLabel;
  if (/important to you/i.test(question)) {
    return decisionRole
      ? `${decisionRole} yönünü gerçekten istediğin için mi değerlendiriyorsun, yoksa dış beklenti mi etkiliyor?`
      : "Bu yönü gerçekten istediğin için mi değerlendiriyorsun, yoksa dış beklenti mi etkiliyor?";
  }
  if (/loss|disappeared|opportunity/i.test(question)) {
    return "Bu fırsat ortadan kalksaydı en çok neyi kaybetmiş hissederdin?";
  }
  if (/fear/i.test(question)) {
    return "Korku etkisini azaltsaydın bu karara aynı şekilde bakar mıydın?";
  }
  if (/evidence/i.test(question)) {
    return "Bu kararı daha net görmek için hangi kanıtı görmen gerekirdi?";
  }
  if (valueLabel) {
    return `Bu karar ${localValueLabel} değerine mi, yoksa başka bir önceliğine mi daha çok hizmet ediyor?`;
  }
  if (biasLabel) {
    return `Şunu düşünmek faydalı olabilir: ${biasLabel} bu kararı olduğundan daha güçlü ya da zayıf gösteriyor olabilir mi?`;
  }
  return "Bu karar güvenlik, gelişim, özgürlük veya etki değerlerinden hangisine daha çok hizmet ediyor?";
}

function buildLocalizedViewModel(reflection, { lang = "TR", decision = {} } = {}) {
  const tr = lang === "TR";
  const values = reflection.valueAlignment?.alignedValues || [];
  const tensions = reflection.valueAlignment?.possibleTensions || [];
  const biases = reflection.potentialBiases || [];
  const valueLabel = values[0]?.label || "";
  const biasLabel = biases[0]?.label || "";
  const decisionRole = clean(decision.role, 90);
  const fallbackQuestions = tr
    ? [
        "Bu fırsat ortadan kalksaydı en çok neyi kaybetmiş hissederdin?",
        "Bu karar güvenlik, gelişim, özgürlük veya etki değerlerinden hangisine daha çok hizmet ediyor?",
        "Şunu düşünmek faydalı olabilir: prestij, güvenlik veya dış beklenti bu kararı olduğundan farklı gösteriyor olabilir mi?",
      ]
    : [
        "If this opportunity disappeared tomorrow, what would you feel you had lost?",
        "Does this decision serve security, growth, freedom, or impact most right now?",
        "It may be useful to ask whether prestige, safety, or outside expectations are changing how this option feels.",
      ];
  const translatedQuestions = compactList(
    [
      ...reflection.reflectionQuestions.map((question) => translateQuestion(question, { tr, valueLabel, biasLabel, decisionRole })),
      ...fallbackQuestions,
    ],
    3
  );

  return {
    available: true,
    summary: tr
      ? "Bu bölüm öneriyi değiştirmez; bu yönün sende hangi motivasyon ve önceliklere dokunduğunu daha net görmen için var."
      : "This does not change the recommendation; it helps you see which motivations and priorities may sit underneath it.",
    questions: translatedQuestions,
    valueTension: tensions[0]?.framing
      ? tr
        ? "Gelişim isteği ile güvenlik ihtiyacı aynı anda etkili olabilir."
        : clean(tensions[0].framing, 160)
      : values.length >= 2
        ? tr
          ? `${VALUE_LABEL_TR[values[0].label] || values[0].label} ve ${VALUE_LABEL_TR[values[1].label] || values[1].label} aynı anda önemli görünebilir.`
          : `${values[0].label} and ${values[1].label} may both matter here.`
        : tr
          ? "Gelişim isteği ile güvenlik ihtiyacı aynı anda etkili olabilir."
          : "Growth and security may both be influencing how this decision feels.",
    journalPrompt: tr
      ? "Bu kararı neden istediğini, en büyük umudunu ve en büyük çekinceni üç kısa cümleyle yaz."
      : clean(reflection.decisionJournalPrompt?.prompt, 180) || "Write why you want this, your biggest hope, and your biggest concern in three short sentences.",
    safetyNote: tr
      ? "Karar Aynası öneriyi, skorları veya rol eşleşmesini değiştirmez."
      : "Decision Mirror does not change the recommendation, scores, or role match.",
    metadata: {
      symbolicPacksEnabled: ENABLE_SYMBOLIC_REFLECTION_PACKS,
      questionCount: translatedQuestions.length,
      validationValid: Boolean(reflection.validation?.valid),
    },
  };
}

export function buildDecisionMirrorViewModel({ decision = {}, lang = "TR" } = {}) {
  try {
    const input = buildSafeReflectionInput({ decision, lang });
    const privacy = validateDecisionMirrorPrivacy(input);
    if (!privacy.valid) {
      return { available: false, reason: "privacy_violation", privacy };
    }
    const reflection = generateReflection(input);
    if (!reflection?.validation?.valid) {
      return { available: false, reason: "reflection_invalid" };
    }
    const viewModel = buildLocalizedViewModel(reflection, { lang, decision });
    if (!viewModel.questions.length) return { available: false, reason: "empty_reflection" };
    return viewModel;
  } catch (error) {
    if (import.meta.env?.DEV && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("hirefit:decision-mirror-warning", {
          detail: { reason: "generation_failed", message: String(error?.message || error || "").slice(0, 120) },
        })
      );
    }
    return { available: false, reason: "generation_failed" };
  }
}
