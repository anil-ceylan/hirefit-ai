import { ARCHETYPE_TYPES, TRAIT_DIMENSIONS } from "./traitConstants.js";
import { resolveCareerArchetype, traitLabels, scoreCareerDnaAnswers } from "./careerDna.js";
import { resolveRankedArchetypes } from "../careerIntelligence/identityEngineV3.js";
import { getRolesForIndustry } from "./industries.js";
import { normalizeRoleList } from "./roleCatalog.js";

function tr(lang) {
  return String(lang || "").toUpperCase() === "TR";
}

function topTraits(scores, n = 3) {
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

const ARCHETYPE_COPY = {
  founder: {
    strengthsEn: ["Vision-driven", "Takes initiative", "Comfort with uncertainty"],
    strengthsTr: ["Vizyon odaklı", "İnisiyatif alır", "Belirsizliğe uyum"],
    weaknessesEn: ["May skip structure", "Spread too thin"],
    weaknessesTr: ["Yapıyı atlayabilir", "Çok fazla işe yayılır"],
  },
  researcher: {
    strengthsEn: ["Deep curiosity", "Evidence-first", "Pattern spotting"],
    strengthsTr: ["Derin merak", "Kanıt öncelikli", "Örüntü yakalama"],
    weaknessesEn: ["Slower to decide", "Less visible impact early"],
    weaknessesTr: ["Karar vermek yavaş", "Erken etki az görünür"],
  },
  communicator: {
    strengthsEn: ["Clear storytelling", "Stakeholder empathy", "Influence"],
    strengthsTr: ["Net hikaye anlatımı", "Paydaş empati", "Etkileme"],
    weaknessesEn: ["May under-index on data", "Avoids conflict"],
    weaknessesTr: ["Veriyi ikinci plana atabilir", "Çatışmadan kaçınır"],
  },
  builder: {
    strengthsEn: ["Ships fast", "Hands-on problem solving", "Turns ideas into products"],
    strengthsTr: ["Hızlı teslim", "Pratik problem çözme", "Fikri ürüne çevirir"],
    weaknessesEn: ["May skip long planning", "Can overload on scope"],
    weaknessesTr: ["Uzun planlamayı atlayabilir", "Kapsamı şişirebilir"],
  },
  strategist: {
    strengthsEn: ["Systems thinking", "Clear frameworks", "Long-range planning"],
    strengthsTr: ["Sistem düşüncesi", "Net çerçeveler", "Uzun vadeli plan"],
    weaknessesEn: ["Analysis paralysis risk", "Slower to ship"],
    weaknessesTr: ["Analiz felci riski", "Teslimat yavaş olabilir"],
  },
  operator: {
    strengthsEn: ["Reliable execution", "Process design", "Cross-team coordination"],
    strengthsTr: ["Güvenilir uygulama", "Süreç tasarımı", "Ekipler arası koordinasyon"],
    weaknessesEn: ["Less creative exploration", "Change resistance"],
    weaknessesTr: ["Daha az yaratıcı keşif", "Değişime direnç"],
  },
  analyst: {
    strengthsEn: ["Data-driven decisions", "Rigorous thinking", "Detail orientation"],
    strengthsTr: ["Veri odaklı karar", "Titiz düşünce", "Detay odaklılık"],
    weaknessesEn: ["May under-communicate vision", "Perfectionism"],
    weaknessesTr: ["Vizyonu az iletebilir", "Mükemmeliyetçilik"],
  },
  creator: {
    strengthsEn: ["Original ideas", "Storytelling", "User empathy"],
    strengthsTr: ["Özgün fikirler", "Hikaye anlatımı", "Kullanıcı empati"],
    weaknessesEn: ["Inconsistent follow-through", "Scope drift"],
    weaknessesTr: ["Takipte tutarsızlık", "Kapsam kayması"],
  },
  leader: {
    strengthsEn: ["Inspires teams", "Ownership mindset", "Stakeholder influence"],
    strengthsTr: ["Ekibi motive eder", "Sahiplenme", "Paydaş etkisi"],
    weaknessesEn: ["May delegate too early", "High expectations on others"],
    weaknessesTr: ["Erken devredebilir", "Başkalarından yüksek beklenti"],
  },
};

export function buildDnaResult({ answers, lang = "TR", primaryIndustry = "" } = {}) {
  const isTr = tr(lang);
  const traitScores = scoreCareerDnaAnswers(answers, lang);
  const archetype = resolveCareerArchetype(traitScores);
  const archetypeRanked = resolveRankedArchetypes(traitScores);
  const labels = traitLabels(lang);
  const copy = ARCHETYPE_COPY[archetype.id] || ARCHETYPE_COPY.analyst;

  const strengths = (isTr ? copy.strengthsTr : copy.strengthsEn).map((text, i) => ({
    key: `s${i}`,
    label: topTraits(traitScores, 3)[i] ? labels[topTraits(traitScores, 3)[i]] : text,
    text,
  }));

  const weaknesses = (isTr ? copy.weaknessesTr : copy.weaknessesEn).map((text, i) => ({
    key: `w${i}`,
    label: weakTraits(traitScores, 2)[i] ? labels[weakTraits(traitScores, 2)[i]] : text,
    text,
  }));

  const industryRoles = primaryIndustry ? getRolesForIndustry(primaryIndustry) : [];
  const archetypePaths = archetype.paths || [];
  const recommendedPaths = normalizeRoleList([...archetypePaths, ...industryRoles]).slice(0, 6);

  return {
    traitScores,
    typeId: archetype.id,
    typeLabel: isTr ? archetype.labelTr : archetype.labelEn,
    archetypeRanked: archetypeRanked.slice(0, 3),
    archetype: {
      id: archetype.id,
      label: isTr ? archetype.labelTr : archetype.labelEn,
    },
    strengths: isTr ? copy.strengthsTr : copy.strengthsEn,
    weaknesses: isTr ? copy.weaknessesTr : copy.weaknessesEn,
    strengthTraits: topTraits(traitScores, 3).map((k) => labels[k]),
    weaknessTraits: weakTraits(traitScores, 2).map((k) => labels[k]),
    recommendedPaths,
    summary: isTr
      ? `${archetype.labelTr} arketipi — güçlü yönlerin ${topTraits(traitScores, 2).map((k) => labels[k]).join(", ")}.`
      : `${archetype.labelEn} archetype — top traits: ${topTraits(traitScores, 2).map((k) => labels[k]).join(", ")}.`,
  };
}
