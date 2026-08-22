import { scoreBand } from "./evidenceTypes.js";

function tr(lang) {
  return String(lang || "").toUpperCase() === "TR";
}

const FACTOR_LABELS = {
  strength: { EN: "strength", TR: "kanıt gücü" },
  relevance: { EN: "relevance", TR: "role yakınlık" },
  recency: { EN: "recency", TR: "güncellik" },
  specificity: { EN: "specificity", TR: "somutluk" },
  credibility: { EN: "credibility", TR: "güvenilirlik" },
  ownership: { EN: "ownership", TR: "sahiplenme" },
  measurable_outcome: { EN: "measurable outcome", TR: "ölçülebilir sonuç" },
  role_alignment: { EN: "role alignment", TR: "role bağ" },
  source_quality: { EN: "source quality", TR: "kaynak kalitesi" },
};

export function evidenceExplanation(item, lang = "EN") {
  const isTurkish = tr(lang);
  const factors = item?.quality_breakdown?.factors || {};
  const top = Object.entries(factors).sort((a, b) => b[1] - a[1])[0]?.[0];
  const weak = Object.entries(factors).sort((a, b) => a[1] - b[1])[0]?.[0];
  const topLabel = FACTOR_LABELS[top]?.[isTurkish ? "TR" : "EN"] || top;
  const weakLabel = FACTOR_LABELS[weak]?.[isTurkish ? "TR" : "EN"] || weak;
  if (!item) return "";
  if (isTurkish) {
    return `${item.title} kanıtı ${topLabel} tarafında güçlü; ${weakLabel} tarafı kararı sınırlıyor.`;
  }
  return `${item.title} is strongest on ${topLabel}; ${weakLabel} is the limiter.`;
}

export function evidenceSetExplanation(report, lang = "EN") {
  const isTurkish = tr(lang);
  const strongest = report?.strongestEvidence?.[0];
  const weakest = report?.weakestEvidence?.[0];
  if (!strongest && !weakest) {
    return isTurkish
      ? "Henüz karar verecek kadar kanıt yok."
      : "There is not enough evidence to make a defensible read yet.";
  }
  if (isTurkish) {
    return strongest
      ? `${strongest.title} güven yaratıyor; ${weakest?.title || "eksik kanıt"} tarafı daha netleşmeli.`
      : `${weakest.title} tarafı recruiter güvenini sınırlıyor.`;
  }
  return strongest
    ? `${strongest.title} builds trust; ${weakest?.title || "missing proof"} needs to become clearer.`
    : `${weakest.title} limits recruiter confidence.`;
}

export function evidenceImprovementText(report, lang = "EN") {
  const isTurkish = tr(lang);
  const weakest = report?.weakestEvidence?.[0];
  const band = scoreBand(report?.overallEvidenceQuality || 0);
  if (weakest?.quality_breakdown?.factors?.measurable_outcome < 55) {
    return isTurkish
      ? `${weakest.title} için sonucu görünür yap.`
      : `Make the result visible for ${weakest.title}.`;
  }
  const missing = report?.missingEvidenceFields?.find((gap) => gap.field !== "occurred_at") ||
    report?.missingEvidenceFields?.[0];
  if (missing) {
    if (missing.field === "occurred_at") {
      return isTurkish
        ? "Kanıtın tarihini ve bağlamını netleştir."
        : "Clarify when the evidence happened and why it matters now.";
    }
    return isTurkish
      ? `${missing.label} için tek somut örnek ekle.`
      : `Add one concrete example for ${missing.label}.`;
  }
  if (band === "verified_outcome" || band === "strong") {
    return isTurkish
      ? "En güçlü kanıtı ilk okumada görünür hale getir."
      : "Move the strongest proof into the first read.";
  }
  return isTurkish
    ? "Tek role bağlı, ölçülebilir bir kanıt noktası oluştur."
    : "Create one measurable proof point tied to the target role.";
}
