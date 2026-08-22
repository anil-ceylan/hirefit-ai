function norm(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ğüşıöçİĞÜŞÖÇ\s/&-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const EVIDENCE_COHERENCE_CATEGORIES = Object.freeze({
  measurable_impact: [
    /metric|measure|quant|impact|outcome|result|kpi|business impact|user impact|ölç|olc|sonuç|sonuc|etki|metrik/,
  ],
  ownership: [
    /ownership|owner|owned|founder|builder|sahiplen|kurucu|uçtan uca|uctan uca/,
  ],
  stakeholder_influence: [
    /stakeholder|cross-functional|paydaş|paydas|team|coordination|iletişim|iletisim|collaboration/,
  ],
  business_case: [
    /business case|case work|case study|iş vakası|is vakasi|vaka|problem.*karar|decision case|strategy case/,
  ],
  role_specific_skill: [
    /sql|dashboard|roadmap|prd|backlog|user research|financial model|github|portfolio|tool|araç|arac|beceri/,
  ],
  execution: [
    /execution|deliver|ship|launch|operate|workflow|process|uygulama|teslim|canlı|canli|süreç|surec/,
  ],
  leadership: [
    /leadership|led|managed|team lead|lider|yönet|yonet/,
  ],
  communication: [
    /communication|presentation|story|headline|summary|iletişim|iletisim|sunum|özet|ozet|hikaye/,
  ],
  credibility: [
    /verified|proof|evidence|source|cv|linkedin|portfolio|github|kanıt|kanit|doğrula|dogrula|kaynak/,
  ],
  recency: [
    /recent|current|date|timeline|güncel|guncel|tarih/,
  ],
  portfolio_proof: [
    /portfolio|case study|public link|github|demo|repo|portföy|portfoy|yayın|yayin/,
  ],
});

export function detectEvidenceCategories(text) {
  const normalized = norm(text);
  if (!normalized) return [];
  return Object.entries(EVIDENCE_COHERENCE_CATEGORIES)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(normalized)))
    .map(([category]) => category);
}

function overlap(a = [], b = []) {
  const right = new Set(b);
  return a.filter((item) => right.has(item));
}

function evidenceCategories(report) {
  const items = [
    ...(report?.strongestEvidence || []),
    ...(report?.weakestEvidence || []),
    ...(report?.evidenceItems || []).slice(0, 4),
  ];
  return [
    ...new Set(items.flatMap((item) =>
      detectEvidenceCategories(`${item.type} ${item.title} ${item.description} ${(item.skills || []).join(" ")} ${(item.domains || []).join(" ")}`)
    )),
  ];
}

function roleAligned(report, roleContext) {
  if (!roleContext) return true;
  const score = Number(report?.roleSpecificEvidenceScore);
  if (!Number.isFinite(score)) return false;
  return score >= 40;
}

export function evaluateDecisionCoherence({
  blocker = "",
  action = "",
  roleContext = "",
  evidenceReport = null,
  candidateReason = "",
  minConfidence = 25,
} = {}) {
  const blockerCategories = detectEvidenceCategories(blocker);
  const actionCategories = detectEvidenceCategories(action);
  const reasonCategories = detectEvidenceCategories(candidateReason || evidenceReport?.explanationText);
  const reportCategories = evidenceCategories(evidenceReport);
  const blockerActionOverlap = overlap(blockerCategories, actionCategories);
  const blockerEvidenceOverlap = overlap(blockerCategories, [...reasonCategories, ...reportCategories]);
  const actionEvidenceOverlap = overlap(actionCategories, [...reasonCategories, ...reportCategories]);
  const confidence = Number(evidenceReport?.confidenceScore ?? 0);
  const confidenceOk = confidence >= minConfidence;
  const roleContextOk = roleAligned(evidenceReport, roleContext);
  const categoryOk = blockerCategories.length === 0
    ? actionCategories.length === 0 || actionEvidenceOverlap.length > 0
    : blockerActionOverlap.length > 0 && blockerEvidenceOverlap.length > 0 && actionEvidenceOverlap.length > 0;
  const useEvidenceReason = Boolean(
    evidenceReport?.evidenceItems?.length &&
      candidateReason &&
      confidenceOk &&
      roleContextOk &&
      categoryOk
  );

  return {
    useEvidenceReason,
    selectedBlocker: blocker,
    candidateEvidenceReason: candidateReason || evidenceReport?.explanationText || "",
    coherenceFactors: {
      blockerCategories,
      actionCategories,
      reasonCategories,
      reportCategories,
      blockerActionOverlap,
      blockerEvidenceOverlap,
      actionEvidenceOverlap,
      confidence,
      minConfidence,
      confidenceOk,
      roleContext,
      roleContextOk,
      categoryOk,
    },
  };
}

export function buildDecisionCoherenceReport({
  blocker,
  existingReason,
  action,
  roleContext,
  evidenceReport,
  candidateReason,
  fallbackReason,
  minConfidence,
} = {}) {
  const coherence = evaluateDecisionCoherence({
    blocker,
    action,
    roleContext,
    evidenceReport,
    candidateReason,
    minConfidence,
  });
  const finalReason = coherence.useEvidenceReason
    ? coherence.candidateEvidenceReason
    : (fallbackReason || existingReason || "");
  return {
    selectedBlocker: blocker || "",
    existingReason: existingReason || "",
    candidateEvidenceReason: coherence.candidateEvidenceReason,
    coherenceResult: coherence.useEvidenceReason ? "evidence_used" : "fallback_used",
    coherenceFactors: coherence.coherenceFactors,
    finalReason,
    fallbackReason: fallbackReason || existingReason || "",
  };
}
