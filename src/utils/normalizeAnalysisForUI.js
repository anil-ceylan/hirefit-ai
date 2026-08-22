/**
 * Strict UI view model for analyzer results.
 * Raw AI / report text must never be rendered directly — only fields from this module.
 */

import {
  isTaskLikeRoleLabel,
  normalizeCareerRoleId,
  normalizeCareerRoleLabel,
  roleProximityBand,
  roleTaxonomyLabel,
} from "../../lib/analyze-v2/roleTaxonomy.js";
import { buildPersonalizedOnboardingInsights } from "../../lib/careerOnboarding/personalizedInsights.js";

const ANALYTICS_TAXONOMY_RE =
  /\b(sql|dashboard|reporting|raporlama|analytics|analitik|process\s+visibility|süreç\s+görünürlüğü|surec\s+gorunurlugu|veri\s+analiz|data\s+analysis|excel|power\s?bi|tableau|business\s+analys|iş\s+analiz|is\s+analiz|process\s+mapping|gereksinim|requirement|workflow)\b/i;
/** Reason text that must never be labeled Pazarlama. */
const ANALYTICS_BLOCK_MARKETING_RE =
  /\b(dashboard|sql|reporting|raporlama|süreç|surec|veri|analytics|workflow)\b/i;
const MARKETING_TAXONOMY_RE =
  /\b(acquisition|edinim|campaign|kampanya|content\s+marketing|funnel|audience|kitle|brand|marka|social\s+media|demand\s+generation|seo|linkedin|instagram|pazarlama|growth\s+marketing|paid\s+media|reklam)\b/i;
const PRODUCT_TAXONOMY_RE =
  /\b(prd|backlog|roadmap|user\s+stor|kullanıcı\s+hikayesi|kullanici\s+hikayesi|product\s+management|ürün\s+yönetimi|urun\s+yonetimi|product\s+owner)\b/i;
const PRODUCT_REASON_RE =
  /\b(prd|backlog|roadmap|kullanıcı|kullanici|ürün\s+sahiplenmesi|urun\s+sahiplenmesi|prioritization|önceliklendirme|onceliklendirme|user\s+stor|product\s+owner|product\s+management|ürün\s+yönetimi|urun\s+yonetimi|\bproduct\b|\bürün\b|\burun\b)/i;
const GTM_TAXONOMY_RE =
  /\b(gtm|go[-\s]?to[-\s]?market|pricing|market\s+sizing|revenue|gelir|büyüme\s+stratejisi|buyume\s+stratejisi|growth\s+strategy)\b/i;

const FORBIDDEN_VISIBLE_PATTERNS = [
  { re: /Temel\s+deneyim\s+.*yar/i, tr: "Temel geçmişin role giriş için yeterli", en: "Your baseline background is enough to enter the conversation" },
  { re: /Recruiter\s+i.*in\s+okunabilir\s+kan.*t\s+d.*k/i, tr: "CV’de bu role özel kanıt net değil", en: "Role-specific proof is not clear on the CV" },
  { re: /Role\s+k.*smen\s+oturuyor/i, tr: "Rol hikayesi tam kilitlenmiyor", en: "The role story does not fully lock" },
  { re: /Karars.z\s+recruiter\s+b.lgesi/i, tr: "İkna eşiğinde", en: "On the persuasion edge" },
  { re: /Tek\s+bir\s+bo.luk\s+izole\s+edilemedi/i, tr: "Net tek sorun yok; konumlama dağınık", en: "No single issue; positioning is scattered" },
  { re: /candidate\s+demonstrates|overall\s+good\s+profile|strong\s+communication\s+skills/gi, tr: "", en: "" },
  { re: /Analiz\s+tamamland[ıi]|Daha\s+fazla\s+optimizasyon\s+gerekli|Genel\s+olarak\s+uygun|Sinyal\s+d[üu]ş[üu]k/gi, tr: "", en: "" },
  { re: /analysis\s+complete|further\s+optimization\s+needed|alignment\s+moderate|low\s+signal/gi, tr: "", en: "" },
  { re: /ownership\s+taraf[ıi]n[ıi]\s+g[üu]çlendiriyor/gi, tr: "sahiplenme net", en: "ownership reads clearly" },
  { re: /kurumsal\s+filtre\s+daha\s+fazla\s+[öo]l[çc]ek\s+kan[ıi]t[ıi]\s+ister/gi, tr: "kurumsal ekiplerde daha somut çıktı görmek isterler", en: "corporate teams will want clearer proof of output" },
  { re: /kat[ıi]\s+kurumsal\s+execution\s+funnel['’]?[ıi]nda\s+[öo]l[çc]ek\s+kan[ıi]t[ıi]\s+sorulur/gi, tr: "kurumsal ekiplerde daha somut çıktı görmek isterler", en: "corporate teams will want clearer proof of output" },
  { re: /Bu\s+y.*nde\s+daha\s+do.*al\s+okunuyorsun/i, tr: "Bu alanda CV daha ikna edici duruyor", en: "Your CV reads more convincing in this lane" },
  { re: /Profilin\s+farkl.*role\s+daha\s+do.*al\s+oturuyor/i, tr: "CV’n bu rolden çok başka bir alana daha güçlü kanıt veriyor", en: "Your CV reads more convincing in another career lane" },
  { re: /\bProduct\s+sinyali\b/gi, tr: "Ürün tarafı", en: "Product side" },
  { re: /\bürün\s+sinyali\b/gi, tr: "Ürün tarafı", en: "Product side" },
  { re: /sinyal\s+yoğunluğu|sinyal\s+yogunlugu|signal\s+density/gi, tr: "uzmanlık netliği", en: "expertise clarity" },
  { re: /kapsam\s+sinyalleri|kapsam\s+sinyali|scope\s+signals?/gi, tr: "somut örnekler", en: "concrete examples" },
  { re: /güçlü\s+sinyal|guclu\s+sinyal|strong\s+signals?/gi, tr: "güçlü kanıt", en: "strong proof" },
  { re: /\baTS\b/g, tr: "ATS", en: "ATS" },
  { re: /gerçek\s+execution/gi, tr: "gerçek iş çıkarma", en: "real delivery" },
  { re: /\bexecution\s+kanıtı\b/gi, tr: "iş çıkarma kanıtı", en: "delivery proof" },
  { re: /\bexecution\s+proof\b/gi, tr: "iş çıkarma kanıtı", en: "delivery proof" },
  { re: /\bexecution\b/gi, tr: "iş çıkarma", en: "delivery" },
  { re: /responsible\s+for|experience\s+in|contribute\s+to|management\s+processes|creation\s+and/gi, tr: "", en: "" },
  { re: /"\s*:\s*"|^\s*[\[{]|[\]}]\s*$/g, tr: "", en: "" },
  { re: /\balignment\b/i, tr: "eşleşme", en: "match" },
  { re: /\bsinyalleri\b/gi, tr: "güçlü taraflar", en: "strong sides" },
  { re: /\bsinyali\b/gi, tr: "tarafı", en: "side" },
  { re: /\bsinyaller\b/gi, tr: "taraflar", en: "sides" },
  { re: /\bsinyal\b/gi, tr: "taraf", en: "read" },
  { re: /\bsignals\b/gi, tr: "taraflar", en: "reads" },
  { re: /\bsignal\b/gi, tr: "taraf", en: "read" },
  { re: /CV[''\u2019\u2018]?\s*ne\s+şu\s+formatta|CV[''\u2019\u2018]?\s*ne\s+su\s+formatta/i, tr: "", en: "" },
  { re: /1\s*cümle\s*ekle/i, tr: "", en: "" },
  { re: /%\s*Y\b|\b%Y\b/i, tr: "", en: "" },
  { re: /%\s*X\b|\b%X\b/i, tr: "", en: "" },
  { re: /sonuç\s+elde\s+ettim|sonuc\s+elde\s+ettim/i, tr: "", en: "" },
  { re: /Mevcut\s+uyum\s+skoru/i, tr: "", en: "" },
  { re: /Düzeltme\s+sonrası|Düzeltme\s+sonrasi/i, tr: "", en: "" },
  { re: /Bu\s+adımı\s+uygularsan/i, tr: "", en: "" },
  { re: /uyumun\s*['']?\s*\d/i, tr: "", en: "" },
  { re: /role-fit|role\s*-\s*fit/i, tr: "role daha uygun", en: "closer role fit" },
  { re: /\b\d{1,3}\s*%/g, tr: "", en: "" },
];

const FORBIDDEN_POISON = [
  /CV[''\u2019\u2018]?\s*ne\s+şu\s+formatta|CV[''\u2019\u2018]?\s*ne\s+su\s+formatta/i,
  /şu\s+formatta\s+1\s*cümle|1\s*cümle\s*ekle/i,
  /X\s*sürecini|X\s*surecini/i,
  /%\s*Y\b|\b%Y\b/i,
  /sonuç\s+elde\s+ettim|sonuc\s+elde\s+ettim/i,
  /Mevcut\s+uyum\s+skoru|Düzeltme\s+sonrası|Düzeltme\s+sonrasi/i,
  /Bu\s+adımı\s+uygularsan/i,
  /uyumun\s*%?\s*\d/i,
  /Örn\s*:\s*%|%\s*artırdım/i,
  /Tek\s+bir\s+bo.luk\s+izole\s+edilemedi/i,
  /Net\s+tek\s+sorun\s+yok/i,
  /Bu\s+rol.n\s+arad.*deneyim\s+CV.*yeterince/i,
  /What\s+this\s+role\s+needs\s+does\s+not\s+read\s+clearly/i,
  /candidate\s+demonstrates|overall\s+good\s+profile|strong\s+communication\s+skills/i,
  /Analiz\s+tamamland[ıi]|Daha\s+fazla\s+optimizasyon\s+gerekli|Genel\s+olarak\s+uygun|Sinyal\s+d[üu]ş[üu]k/i,
  /analysis\s+complete|further\s+optimization\s+needed|alignment\s+moderate|low\s+signal/i,
  /ATS role language/i,
  /based on simulated/i,
  /model detected/i,
  /analysis engine/i,
  /role classifier/i,
  /reason_code/i,
  /structured_analysis/i,
  /execution traces/i,
  /prompt artifact/i,
  /simulated recruiter reasoning/i,
];

const VISIBLE_LEAKAGE_RE = [
  /\{[\s\S]*"[\w]+"\s*:/,
  /```/,
  /reason_code|structured_analysis|role_classifier/i,
  /ATS role language/i,
  /analysis engine|model detected|based on simulated/i,
  /execution traces|prompt artifact/i,
];

const ATS_DISPLAY_LABELS = {
  Backlog: "Backlog Management",
  PRD: "PRD",
  Roadmap: "Roadmap",
  Stakeholder: "Stakeholder Management",
  "Stakeholder Management": "Stakeholder Management",
  "Product Discovery": "Product Discovery",
  "User Research": "User Research",
  Prioritization: "Prioritization",
  Analytics: "Analytics",
  Dashboard: "Dashboard",
  SQL: "SQL",
};

function isTr(lang) {
  return String(lang || "").toUpperCase() === "TR";
}

function cleanToken(text) {
  return String(text ?? "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function oneSentence(text, lang) {
  const t = cleanToken(text);
  if (!t) return "";
  const parts = t.split(/(?<=[.!?…])\s+/).map((x) => x.trim()).filter(Boolean);
  return parts[0] || t.slice(0, 220);
}

function looksPoison(t) {
  const s = String(t || "");
  return FORBIDDEN_POISON.some((re) => re.test(s));
}

function sanitizeVisibleTurkish(text, lang) {
  if (!isTr(lang)) return cleanToken(text);
  let t = cleanToken(text);
  if (!t) return "";

  const replacements = [
    [/Built and launched HireFit[^.]{0,120}/gi, "HireFit'i kurup canlıya almış olman"],
    [/Built and launched/gi, "Kurup canlıya almış olman"],
    [/an AI[- ]powered career/gi, "kariyer"],
    [/AI[- ]powered/gi, ""],
    [/gerçek execution kanıtı/gi, "gerçek iş çıkarma kanıtı"],
    [/execution kanıtı/gi, "iş çıkarma kanıtı"],
    [/execution proof/gi, "iş çıkarma kanıtı"],
    [/ownership proof/gi, "sahiplenme kanıtı"],
    [/creates real execution proof/gi, "gerçek iş çıkarma kanıtı yaratıyor"],
    [/creates ownership proof/gi, "sahiplenme kanıtı yaratıyor"],
    [/yaratıyor\.?\s*gerçek iş çıkarma kanıtı yaratıyor/gi, "gerçek iş çıkarma kanıtı yaratıyor"],
    [/\bthe recruiter\b/gi, "recruiter"],
    [/\bthis role\b/gi, "bu rol"],
    [/\bfirst read\b/gi, "ilk okuma"],
  ];
  for (const [re, value] of replacements) {
    t = t.replace(re, value);
  }

  if (/HireFit/i.test(t) && /(built|launched|kurup|canlıya|canliya)/i.test(t)) {
    return "HireFit'i kurup canlıya almış olman gerçek iş çıkarma kanıtı yaratıyor.";
  }

  const latinWords = (t.match(/\b[A-Za-z]{3,}\b/g) || []).filter(
    (w) => !/^(HireFit|SQL|PRD|GTM|KPI|API|UI|UX|AWS|CRM|SEO|PM|AI|CV|JD)$/i.test(w)
  );
  const turkishChars = /[ğıüşöçİĞÜŞÖÇ]/;
  if (latinWords.length >= 3 && !turkishChars.test(t)) {
    if (/built|launched|shipped|founded/i.test(t) && /HireFit/i.test(t)) {
      return "HireFit'i kurup canlıya almış olman gerçek iş çıkarma kanıtı yaratıyor.";
    }
    if (/built|launched|shipped|founded/i.test(t)) {
      return "Kurup canlıya aldığın iş gerçek iş çıkarma kanıtı yaratıyor.";
    }
    if (/dashboard|sql|reporting|analytics/i.test(t)) {
      return "Dashboard ve analiz tarafın süreç görünürlüğü kanıtı veriyor.";
    }
  }

  return t.replace(/\s{2,}/g, " ").replace(/\s+([,.;])/g, "$1").trim();
}

function resolveProductRoleId(text) {
  if (/product\s+strategy|ürün\s+stratejisi|urun\s+stratejisi|positioning|market\s+sizing|önceliklendirme|onceliklendirme/i.test(text)) {
    return "product_strategy";
  }
  return "product_management";
}

function analyticsRoleFromContext(text) {
  return /\bsql\b|dashboard|analytics|workflow|power\s?bi|tableau|veri\s+analiz|data\s+analysis/i.test(text)
    ? "data_analysis"
    : "business_analysis";
}

function roleDisplayLabel(roleId, lang) {
  if (isTr(lang)) {
    if (roleId === "data_analysis") return "Veri & Analiz";
    if (roleId === "business_analysis") return "İş Analizi";
    if (roleId === "product_management") return "Ürün Yönetimi";
    if (roleId === "product_strategy") return "Ürün Stratejisi";
  }
  return roleTaxonomyLabel(roleId, lang);
}

function hasCvProductEvidence(cvText) {
  const cv = String(cvText || "");
  return PRODUCT_REASON_RE.test(cv) || PRODUCT_TAXONOMY_RE.test(cv) || /\b(hirefit|roadmap|prd|backlog)\b/i.test(cv);
}

function adjustRoleSuggestionScore(roleId, score, identityEngine, cvText) {
  let n = Number(score) || 0;
  if (
    identityEngine?.primaryIdentity?.id === "FounderBuilder" &&
    roleId === "product_management" &&
    hasCvProductEvidence(cvText)
  ) {
    n = Math.max(n, 62);
  }
  return n;
}

function guardRoleTaxonomy(roleId, contextText = "", rawRoleLabel = "") {
  const text = `${String(contextText || "")} ${String(rawRoleLabel || "")}`;
  const hasAnalytics = ANALYTICS_TAXONOMY_RE.test(text);
  const hasMarketing = MARKETING_TAXONOMY_RE.test(text);
  const hasProductReason = PRODUCT_REASON_RE.test(text);
  const hasProduct = hasProductReason || PRODUCT_TAXONOMY_RE.test(text);
  const hasGtm = GTM_TAXONOMY_RE.test(text);
  const labelSaysMarketing = /pazarlama|marketing/i.test(rawRoleLabel) || roleId === "marketing";
  let next = roleId;

  if (labelSaysMarketing && ANALYTICS_BLOCK_MARKETING_RE.test(text)) {
    next = analyticsRoleFromContext(text);
  }

  if (hasProductReason) {
    const productRole = resolveProductRoleId(text);
    if (
      labelSaysMarketing ||
      !["product_management", "product_strategy", "ai_product_operations"].includes(next)
    ) {
      next = productRole;
    }
  } else if (hasProduct && !["product_management", "product_strategy", "ai_product_operations"].includes(next)) {
    next = resolveProductRoleId(text);
  }

  if (hasGtm && ["marketing", "business_analysis", "data_analysis", "project_management"].includes(next) && !hasAnalytics) {
    next = /growth\s+strategy|büyüme\s+stratejisi|buyume\s+stratejisi/i.test(text)
      ? "growth_strategy"
      : "strategy_operations";
  }

  if (next === "marketing" && (ANALYTICS_BLOCK_MARKETING_RE.test(text) || (hasAnalytics && !hasMarketing))) {
    next = analyticsRoleFromContext(text);
  }

  if (next === "marketing" && hasProduct && !hasMarketing) {
    next = resolveProductRoleId(text);
  }

  return next;
}

function stripVisibleLeakage(text) {
  const t = cleanToken(text);
  if (!t) return "";
  if (VISIBLE_LEAKAGE_RE.some((re) => re.test(t))) return "";
  if (t.length > 180 && /[{}[\]]/.test(t)) return "";
  if (/^(responsible for|contribute to|requirements include)/i.test(t)) return "";
  return t;
}

function formatAtsKeywordForDisplay(keyword) {
  const label = cleanToken(keyword);
  if (!label || !isCleanAtsKeyword(label)) return "";
  return ATS_DISPLAY_LABELS[label] || label;
}

function extractCompanyNameFromJd(jdText) {
  const jd = String(jdText || "");
  const patterns = [
    /(?:company|şirket|employer|işveren|firma)\s*[:\-]\s*([A-ZÇĞİÖŞÜ][A-Za-zÇĞİÖŞÜçğıöşü0-9&.\-\s]{2,48})/i,
    /(?:at|@)\s+([A-Z][A-Za-z0-9&.\-]{2,40})/,
    /^([A-Z][A-Za-z0-9&.\-]{2,40})\s+(?:is hiring|araıyor|ariyor|looking for)/im,
  ];
  for (const re of patterns) {
    const m = jd.match(re);
    if (m?.[1]) return cleanToken(m[1]).replace(/\s+(Inc|LLC|Ltd|A\.Ş|AS)\.?$/i, "").slice(0, 60);
  }
  return "";
}

function applyForbiddenGuard(text, lang) {
  const tr = isTr(lang);
  let t = cleanToken(text);
  if (!t) return "";
  for (const rule of FORBIDDEN_VISIBLE_PATTERNS) {
    t = t.replace(rule.re, tr ? rule.tr : rule.en);
  }
  t = removeSyntheticPolish(t, lang).replace(/\s{2,}/g, " ").trim();
  if (tr) t = sanitizeVisibleTurkish(t, lang);
  t = stripVisibleLeakage(t);
  return t.replace(/\s{2,}/g, " ").trim();
}

function matchBandFromScore(score, lang) {
  const n = Math.round(Number(score) || 0);
  const tr = isTr(lang);
  if (n < 50) return tr ? "Role uzak duruyor" : "Far from the role";
  if (n < 70) return tr ? "Rol köprüsü zayıf" : "Weak role bridge";
  return tr ? "Rol hikayesi net" : "Clear role story";
}

function verdictLabelFromScore(score, lang) {
  const n = Math.round(Number(score) || 0);
  const tr = isTr(lang);
  if (n < 50) return tr ? "İlk filtre zor" : "Hard first screen";
  if (n < 70) return tr ? "İkna eşiğinde" : "On the persuasion edge";
  return tr ? "İlk filtreyi geçebilir" : "Can clear first screen";
}

function rejectionRiskBandFromScore(score, lang) {
  const n = Math.round(Number(score) || 0);
  const tr = isTr(lang);
  if (n < 55) return tr ? "İlk eleme riski yüksek" : "High first-screen risk";
  if (n < 70) return tr ? "İlk elemede soru işareti" : "Question mark on first screen";
  if (n < 82) return tr ? "Kırmızı bayrak yok ama kanıt eksik" : "No hard red flag, proof is thin";
  return tr ? "İlk filtre için rahat" : "Comfortable for first screen";
}

function roleFitBandFromScore(score, lang) {
  const n = Math.round(Number(score) || 0);
  const tr = isTr(lang);
  if (n < 55) return tr ? "Pozisyon izi parçalı" : "Positioning is split";
  if (n < 75) return tr ? "Rol hikayesi tam kilitlenmiyor" : "The role story does not fully lock";
  return tr ? "Rol hikayesi net" : "Role story is clear";
}

function outcomeBandFromScore(score, lang) {
  const n = Math.round(Number(score) || 0);
  const tr = isTr(lang);
  if (n < 50) return tr ? "Zor geçer" : "Hard to clear";
  if (n < 60) return tr ? "Net evet değil" : "Not a clear yes";
  if (n < 70) return tr ? "Shortlist sınırında" : "Shortlist boundary";
  if (n < 82) return tr ? "Mülakat çıkabilir" : "Interview can happen";
  if (n < 90) return tr ? "İlk filtreyi geçebilir" : "Can clear first screen";
  return tr ? "Güçlü ilerler" : "Moves forward strongly";
}

function roleSuggestionFitBand(score, lang) {
  return roleProximityBand(score, lang);
}

function verdictStyleFromScore(score) {
  const n = Math.round(Number(score) || 0);
  if (n < 55) {
    return { icon: "❌", color: "#f87171", glow: "0 0 44px rgba(239,68,68,0.28)" };
  }
  if (n < 75) {
    return { icon: "⚠️", color: "#f59e0b", glow: "0 0 44px rgba(245,158,11,0.24)" };
  }
  return { icon: "✅", color: "#34d399", glow: "0 0 44px rgba(16,185,129,0.24)" };
}

function headlineFromScore(score, lang) {
  const n = Math.round(Number(score) || 0);
  const tr = isTr(lang);
  if (n < 55) return tr ? "İlk filtre zor geçer." : "The first screen is hard to clear.";
  if (n < 75) return tr ? "Mülakat çıkabilir ama garanti değil." : "An interview is possible, not automatic.";
  return tr ? "İlk filtreyi geçebilir." : "This can clear the first screen.";
}

function subheadlineFromScore(score, lang) {
  const n = Math.round(Number(score) || 0);
  const tr = isTr(lang);
  if (n < 55) {
    return tr
      ? "Başlık ve deneyim bu ilanın beklediği role net bağlanmıyor."
      : "The title and experience do not connect clearly to what this posting expects.";
  }
  if (n < 75) {
    return tr
      ? "Deneyim var; ama recruiter bunun hangi role evrileceğini hemen okuyamıyor."
      : "There is experience, but the recruiter cannot immediately read where it compounds.";
  }
  return tr
    ? "Kanıtlar ilanın aradığı role yeterince yakın duruyor."
    : "The proof sits close enough to what this posting is asking for.";
}

function pickStrength(engineV2, analysisData, lang) {
  const tr = isTr(lang);
  const strengths = [
    ...(Array.isArray(engineV2?.Recruiter?.strengths) ? engineV2.Recruiter.strengths : []),
    ...(Array.isArray(engineV2?.ATS?.matched_skills) ? engineV2.ATS.matched_skills : []),
    ...(Array.isArray(analysisData?.matched_skills) ? analysisData.matched_skills : []),
    ...(Array.isArray(analysisData?.strengths) ? analysisData.strengths : []),
  ];
  const first = strengths.map((x) => cleanToken(x)).find((x) => x.length >= 8 && !looksPoison(x));
  if (first) return applyForbiddenGuard(oneSentence(first, lang), lang);
  if (tr) return "Profilde net bir güçlü taraf henüz öne çıkmıyor.";
  return "No clear strength stands out on a quick scan yet.";
}

function pickGap(engineV2, analysisData, lang) {
  const tr = isTr(lang);
  const fromGap = cleanToken(engineV2?.Gaps?.biggest_gap || "");
  const reasons = Array.isArray(engineV2?.Gaps?.rejection_reasons) ? engineV2.Gaps.rejection_reasons : [];
  const high = reasons
    .filter((r) => String(r?.impact || "").toLowerCase() === "high")
    .map((r) => cleanToken(r?.issue ?? r))
    .find((x) => x.length >= 8 && !looksPoison(x));
  const fromAnalysis = Array.isArray(analysisData?.rejection_reasons?.high)
    ? analysisData.rejection_reasons.high.map(cleanToken).find((x) => x.length >= 8 && !looksPoison(x))
    : "";
  const raw = fromGap || high || fromAnalysis || cleanToken(analysisData?.fit_summary || "");
  const cleaned = applyForbiddenGuard(oneSentence(raw, lang), lang);
  if (cleaned && !looksPoison(cleaned)) return cleaned;
  if (tr) return "Bu rolün aradığı deneyim CV'de yeterince görünmüyor.";
  return "What this role needs does not read clearly on your CV.";
}

function pickDecision(engineV2, score, lang) {
  const tr = isTr(lang);
  const verdict = String(engineV2?.Decision?.final_verdict || "").toLowerCase();
  const risky =
    verdict === "apply_with_risk" ||
    verdict === "apply_with_fixes" ||
    verdict === "apply_with_fix" ||
    (Number(score) < 75 && verdict !== "apply_now");
  if (verdict === "do_not_apply" || Number(score) < 55) {
    return tr
      ? "Recruiter burada önce role özel kanıt arar; şu haliyle ilk tur zor."
      : "A recruiter would first look for role-specific proof; as written, first screen is hard.";
  }
  if (risky) {
    return tr
      ? "Recruiter seni tamamen elemez; ama kanıt sorusunda duraksar."
      : "A recruiter may not reject you outright, but would pause on the proof.";
  }
  return tr
    ? "İlk tur için konuşmaya değer; karar kanıtların netliğine kalır."
    : "Worth a first conversation; the decision depends on how clearly the proof reads.";
}

function pickMainBlocker(engineV2, analysisData, lang, cvText = "", jdText = "") {
  const tr = isTr(lang);
  const cognition = buildRecruiterCognition(cvText, jdText, null, lang);
  const signals = cognition.signals;
  const next = nextBestMove(signals, [], lang);
  const simple = `${biggestBlockerLine(signals, lang)} ${next}`;
  if (!looksPoison(simple)) return simple;
  const intel = inferCareerIntelligence(cvText, jdText);
  const candidates = [
    cleanToken(engineV2?.Output?.core_problem),
    ...(Array.isArray(engineV2?.Decision?.what_to_fix_first) ? engineV2.Decision.what_to_fix_first : []),
    ...(Array.isArray(analysisData?.improvements) ? analysisData.improvements : []),
    pickGap(engineV2, analysisData, lang),
  ];
  for (const c of candidates) {
    if (looksPoison(c)) continue;
    const line = applyForbiddenGuard(oneSentence(c, lang), lang);
    if (line && !looksPoison(line)) return line;
  }
  if (intel.hasBuilder && intel.targetCorporate) {
    return tr
      ? `${biggestBlockerLine(signals, lang)} ${next}`
      : `${biggestBlockerLine(signals, lang)} ${next}`;
  }
  if (intel.hasProduct && intel.targetExecutionHeavy) {
    return tr
      ? `${cognition.chains.product.evidenceFromCV} ürün tarafını açıyor; eksik kalan kanıt operasyonel teslim ve takip.`
      : `${cognition.chains.product.evidenceFromCV} opens the product story; the missing proof is operational delivery and follow-through.`;
  }
  return tr
    ? `${cognition.chains.roleBridge.evidenceFromCV}; seni yavaşlatan şey bunun hedef role nasıl taşındığının net okunmaması.`
    : `${cognition.chains.roleBridge.evidenceFromCV}; what slows you down is that the transfer into this role is not clear enough.`;
}

function pickRecruiterNudge(engineV2, analysisData, lang, cvText = "", jdText = "") {
  const tr = isTr(lang);
  const cognition = buildRecruiterCognition(cvText, jdText, null, lang);
  const move = nextBestMove(cognition.signals, [], lang);
  if (move) return move;
  const intel = inferCareerIntelligence(cvText, jdText);
  const gap = pickGap(engineV2, analysisData, lang);
  if (/ürün|product/i.test(gap) && /operasyon|operations/i.test(gap)) {
    return tr
      ? "Ürün tarafın güçlü ama operasyon deneyimi daha net görünmeli."
      : "Your product side reads strong—operations experience should read clearer.";
  }
  if (/ürün|product/i.test(gap)) {
    return tr
      ? "Ürün tarafı daha doğal okunuyor; hedef rol bunu görecek şekilde konumlanmalı."
      : "The product side reads more naturally; positioning should make that obvious for the target role.";
  }
  if (intel.hasBuilder) {
    return tr
      ? "Bu profili sıradan başvuru gibi değil, ownership hikayesi olarak paketlemek gerekir."
      : "This profile should be packaged as an ownership story, not a standard application.";
  }
  if (intel.hasData && intel.hasStrategy) {
    return tr
      ? "Analiz ve stratejiyi aynı karar hikayesine bağlarsan recruiter güveni yükselir."
      : "Recruiter confidence rises when analysis and strategy connect into one decision story.";
  }
  return pickMainBlocker(engineV2, analysisData, lang, cvText, jdText);
}

function buildRoleSuggestions(engineV2, analysisData, cvText, lang, buildRoleSuggestionsFromCv) {
  const tr = isTr(lang);
  const fromModel = Array.isArray(engineV2?.Output?.role_suggestions)
    ? engineV2.Output.role_suggestions
    : Array.isArray(engineV2?.RoleFit?.role_fit)
      ? engineV2.RoleFit.role_fit
      : [];
  let rows = fromModel.slice(0, 3).map((item) => ({
    role: cleanToken(item?.role || ""),
    score: Number(item?.score) || 0,
    reason: cleanToken(item?.reason || ""),
  }));
  if (!rows.length && typeof buildRoleSuggestionsFromCv === "function") {
    const built = buildRoleSuggestionsFromCv(cvText, lang);
    rows = (built?.better_roles || []).map((item) => ({
      role: cleanToken(item?.role || ""),
      score: Number(item?.score) || 0,
      reason: cleanToken(item?.reason || ""),
    }));
  }
  return rows
    .filter((r) => r.role)
    .map((r) => ({
      role: applyForbiddenGuard(r.role, lang),
      fitBand: roleSuggestionFitBand(r.score, lang),
      reason: applyForbiddenGuard(
        oneSentence(r.reason || (tr ? "Bu alanda CV daha ikna edici duruyor." : "Your CV reads more convincing in this lane."), lang),
        lang
      ),
    }));
}

function buildTaxonomyRoleSuggestions(engineV2, analysisData, cvText, jdTextRaw, lang, buildRoleSuggestionsFromCv, identityEngine = null) {
  const tr = isTr(lang);
  const jdText = String(jdTextRaw || engineV2?.JD?.raw || engineV2?.Job?.description || analysisData?.job_description || "");
  const intel = inferCareerIntelligence(cvText, jdText);
  const fromModel = Array.isArray(engineV2?.Output?.role_suggestions)
    ? engineV2.Output.role_suggestions
    : Array.isArray(engineV2?.RoleFit?.role_fit)
      ? engineV2.RoleFit.role_fit
      : [];
  let rows = fromModel.slice(0, 6).map((item) => ({
    role: cleanToken(item?.role || ""),
    score: Number(item?.score) || 0,
    reason: cleanToken([
      item?.reason,
      item?.evidence,
      item?.recruiter_reasoning,
      item?.positioning,
    ].filter(Boolean).join(" ")),
    evidence: cleanToken(item?.evidence || ""),
    recruiter_reasoning: cleanToken(item?.recruiter_reasoning || ""),
    positioning: cleanToken(item?.positioning || ""),
    proximity_confidence: cleanToken(item?.proximity_confidence || ""),
  }));
  if (!rows.length && typeof buildRoleSuggestionsFromCv === "function") {
    const built = buildRoleSuggestionsFromCv(cvText, lang);
    rows = (built?.better_roles || []).map((item) => ({
      role: cleanToken(item?.role || ""),
      score: Number(item?.score) || 0,
      reason: cleanToken(item?.reason || ""),
    }));
  }
  if (!rows.length) {
    const fallbackRoles = [];
    const hasRoleEvidence = (id) => Boolean(findEvidenceUnit(cvText, roleEvidencePatterns(id)));
    if (hasRoleEvidence("product_management") || hasRoleEvidence("product_strategy")) fallbackRoles.push("Product Strategy", "Product Management");
    if (hasRoleEvidence("growth") || hasRoleEvidence("growth_strategy")) fallbackRoles.push("Growth Strategy", "Growth");
    if (hasRoleEvidence("ai_product_operations")) fallbackRoles.push("AI Product Operations");
    if (hasRoleEvidence("strategy_operations") || hasRoleEvidence("project_management")) fallbackRoles.push("Strategy & Operations", "Project Management");
    if (hasRoleEvidence("data_analysis")) fallbackRoles.push("Data Analysis");
    if (hasRoleEvidence("customer_success")) fallbackRoles.push("Customer Success");
    if (hasRoleEvidence("business_development")) fallbackRoles.push("Business Development");
    if (!fallbackRoles.length) fallbackRoles.push("Business Analysis", "Project Management", "Strategy & Operations");
    rows = fallbackRoles.slice(0, 4).map((role, idx) => ({
      role,
      score: Math.max(54, 76 - idx * 6),
      reason: "",
    }));
  }
  const seen = new Set();
  const mapped = rows
    .map((r) => {
      const roleContext = isTaskLikeRoleLabel(r.role)
        ? `${r.reason || ""} ${r.evidence || ""} ${cvText || ""}`
        : `${r.reason || ""} ${r.evidence || ""}`;
      let roleId = normalizeCareerRoleId(r.role, roleContext);
      roleId = guardRoleTaxonomy(roleId, roleContext, r.role);
      let lines = buildRoleCardLines(roleId, identityEngine, lang).slice(0, 2);
      roleId = guardRoleTaxonomy(roleId, `${roleContext} ${lines.join(" ")}`, r.role);
      lines = buildRoleCardLines(roleId, identityEngine, lang).slice(0, 2);
      const adjustedScore = adjustRoleSuggestionScore(roleId, r.score, identityEngine, cvText);
      const role = roleDisplayLabel(roleId, tr ? "TR" : "EN");
      const reason = roleAdjacencyReason(roleId, r, cvText, jdText, lang, identityEngine);
      const roleEvidence = findEvidenceUnit(cvText, roleEvidencePatterns(roleId));
      const compressedEvidence = buildEvidenceCompression(roleId, cvText, jdText, lang);
      const fitBand = roleProximityBand(adjustedScore, lang);
      const missingProof = applyForbiddenGuard((lines[1] || roleUpgradeProof(roleId, lang)).replace(/^Eksik:\s*/i, "").replace(/^Missing:\s*/i, ""), lang);
      return {
        role,
        matchPercent: Math.max(0, Math.min(99, Math.round(adjustedScore || 0))),
        fitBand,
        lines,
        reason: applyForbiddenGuard(lines[0] || reason, lang),
        whyThisRoleFits: applyForbiddenGuard(lines[0] || reason, lang),
        missingProof,
        confidenceUpgrade: applyForbiddenGuard(roleConfidenceUpgrade(roleId, lang), lang),
        recruiterReasoning: applyForbiddenGuard(oneSentence(r.recruiter_reasoning || compressedEvidence.lensLine, lang), lang),
        transferableEvidence: applyForbiddenGuard(oneSentence(roleEvidence || r.evidence || r.reason || missingEvidenceLabel("roleBridge", lang), lang), lang),
        positioning: applyForbiddenGuard(oneSentence(r.positioning || compressedEvidence.lensLine || marketFitFrame(intel, lang), lang), lang),
        proximityConfidence: fitBand,
      };
    })
    .filter((r) => {
      if (!r.role || seen.has(r.role)) return false;
      seen.add(r.role);
      return true;
    });
  return rankRoleSuggestions(mapped, lang, identityEngine);
}

function rankRoleSuggestions(rows, lang, identityEngine = null) {
  const tr = isTr(lang);
  const sorted = [...rows].sort((a, b) => (Number(b.matchPercent) || 0) - (Number(a.matchPercent) || 0));
  const top = sorted.slice(0, 2);
  if (!top.length) return top;

  const primaryId = identityEngine?.primaryIdentity?.id;
  let lead = Math.max(Number(top[0].matchPercent) || 58, 68);
  if (primaryId === "FounderBuilder" && /ürün|urun|product/i.test(top[0].role)) {
    lead = Math.max(lead, 74);
  }
  lead = Math.min(88, lead);
  top[0].matchPercent = lead;
  top[0].fitBand = roleProximityBand(lead, lang);
  top[0].proximityConfidence = top[0].fitBand;

  if (top.length > 1) {
    const rawGap = lead - (Number(top[1].matchPercent) || 0);
    const gap = rawGap < 12 ? 16 : Math.min(20, Math.max(13, rawGap));
    const second = Math.max(48, lead - gap);
    top[1].matchPercent = second;
    top[1].fitBand = roleProximityBand(second, lang);
    top[1].proximityConfidence = top[1].fitBand;
    const gain = Math.min(22, Math.max(11, lead - second));
    top[0].potentialGainPercent = gain;
    top[1].altGainPercent = Math.max(6, Math.min(14, lead - second));
    top[0].potentialGainReason = applyForbiddenGuard(
      primaryId === "FounderBuilder" && /ürün|urun|product/i.test(top[0].role)
        ? (tr
          ? "Founder deneyimi sahiplenmeye doğal oturuyor."
          : "Founder experience maps naturally into ownership.")
        : (tr
          ? "Bu rolde aynı deneyim recruiter güvenini daha hızlı kuruyor."
          : "The same experience builds recruiter trust faster in this lane."),
      lang
    );
    if (rawGap < 10) {
      top[0].rankNote = tr
        ? "İki rol yakın; üstteki kanıt bu ilanda daha net okunuyor."
        : "Both lanes are close; the top one reads clearer for this posting.";
    }
  }
  top.forEach((row) => {
    row.fastestImprovement = applyForbiddenGuard(
      roleFastestImprovement(row.role, row.missingProof, null, lang),
      lang
    );
  });
  return top;
}

function hasAny(text, patterns) {
  return patterns.some((re) => re.test(String(text || "")));
}

function splitEvidenceUnits(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .split(/\n+|(?<=[.!?])\s+/)
    .map((x) => cleanToken(x))
    .filter((x) => x.length >= 8 && x.length <= 220);
}

function findEvidenceUnit(text, patterns) {
  const units = splitEvidenceUnits(text);
  return units.find((unit) => hasAny(unit, patterns) && !/\b(no|not|without|yok|değil|degil|belirtilmemiş|belirtilmemis)\b/i.test(unit)) || "";
}

function evidenceDisplay(text) {
  return cleanToken(text).replace(/[.!?;:]\s*$/, "");
}

function missingEvidenceLabel(kind, lang) {
  const tr = isTr(lang);
  const labels = {
    productArtifacts: tr ? "PRD/backlog/roadmap çıktısı CV'de net değil" : "PRD/backlog/roadmap proof is not clear on the CV",
    scale: tr ? "ölçülebilir veya tekrarlanabilir etki CV'de net değil" : "Measurable or repeatable impact is not clear on the CV",
    stakeholder: tr ? "stakeholder kapsamı CV'de net değil" : "Stakeholder scope is not clear on the CV",
    tools: tr ? "role özel araç izi CV'de net değil" : "Role-specific tool proof is not clear on the CV",
    market: tr ? "pazar/kampanya çıktısı CV'de net değil" : "Market or campaign output is not clear on the CV",
    roleBridge: tr ? "bu role taşınan somut örnek CV'de net değil" : "Concrete transfer proof for this role is not clear on the CV",
  };
  return labels[kind] || labels.roleBridge;
}

function isMissingEvidenceText(text) {
  const s = String(text || "").toLowerCase();
  return /net deÄŸil|net değil|not clear|jd taraf|expectation|bu role taÅŸÄ±nan|bu role taşınan|somut Ã¶rnek|somut örnek/.test(s);
}

function buildEvidenceChain({
  claim,
  cvText,
  jdText,
  cvPatterns = [],
  jdPatterns = [],
  missingKind = "roleBridge",
  interpretation,
  impact,
  lang,
}) {
  const cvEvidence = findEvidenceUnit(cvText, cvPatterns);
  const jdEvidence = findEvidenceUnit(jdText, jdPatterns);
  return {
    claim,
    evidenceFromCV: cvEvidence || missingEvidenceLabel(missingKind, lang),
    evidenceFromJD: jdEvidence || (isTr(lang) ? "JD tarafında beklenti açık yazılmamış" : "JD expectation is not explicit"),
    recruiterInterpretation: interpretation,
    riskOrConfidenceImpact: impact,
    hasCvEvidence: Boolean(cvEvidence),
    hasJdEvidence: Boolean(jdEvidence),
  };
}

function inferCareerIntelligence(cvText, jdText) {
  const cv = String(cvText || "");
  const jd = String(jdText || "");
  const all = `${cv} ${jd}`;
  return {
    hasBuilder: hasAny(cv, [/hirefit/i, /launched|shipped|built|founded|created|canlıya|yayına|kurdum|geliştirdim|gelistirdim/i]),
    hasFounder: hasAny(cv, [/founder|co[-\s]?founder|kurucu|startup|girişim|girisim/i]),
    hasProduct: hasAny(all, [/product|ürün|urun|roadmap|prd|backlog|user stor|user flow|müşteri geri bildirimi|musteri geri bildirimi/i]),
    hasStrategy: hasAny(all, [/strategy|strateji|market|positioning|pricing|competitive|business case|go[-\s]?to[-\s]?market|gtm/i]),
    hasGrowth: hasAny(all, [/growth|funnel|activation|retention|acquisition|conversion|seo|campaign|kampanya|linkedin|instagram/i]),
    hasData: hasAny(all, [/sql|excel|dashboard|analytics|analysis|analiz|power\s?bi|tableau|metric|metrik|kpi/i]),
    hasOps: hasAny(all, [/operations|operasyon|process|süreç|surec|delivery|stakeholder|coordination|paydaş|paydas/i]),
    hasAi: hasAny(all, [/\bai\b|llm|prompt|automation|yapay zeka|workflow automation/i]),
    hasMetrics: hasAny(cv, [/\d+\s?%/, /\d+\s?(k|m|users|clients|projects|hours|days)\b/i, /\bKPI\b/i, /metric|metrik/i]),
    targetCorporate: hasAny(jd, [/corporate|enterprise|kurumsal|matrix|stakeholder management|cross-functional|compliance/i]),
    targetExecutionHeavy: hasAny(jd, [/execution|operate|operations|delivery|process|süreç|surec|tracking|koordine|coordinate/i]),
    targetAmbiguity: hasAny(jd, [/ambiguity|0[-\s]?to[-\s]?1|early stage|startup|ownership|sahiplen|build from scratch/i]),
    targetStrictSpecialist: hasAny(jd, [/must have|required|minimum|years|sql|excel|certification|technical depth|uzman/i]),
  };
}

function signalLevel(value) {
  if (value >= 75) return "strong";
  if (value >= 48) return "partial";
  return "weak";
}

function buildInternalSignalEngine(cvText, jdText, score, lang) {
  const intel = inferCareerIntelligence(cvText, jdText);
  const ownershipEvidence = findEvidenceUnit(cvText, [/owner|owned|led|founder|kurucu|sahiplen|hirefit|launched|shipped|built|canlıya|yayına|kurdum|yönettim|yonettim/i]);
  const executionEvidence = findEvidenceUnit(cvText, [/launched|shipped|built|delivered|operated|implemented|canlıya|yayına|teslim|geliştirdim|gelistirdim|uyguladım|uyguladim/i]);
  const scaleEvidence = findEvidenceUnit(cvText, [/\d+\s?%/, /\d+\s?(k|m|users|clients|projects|hours|days)\b/i, /\bKPI\b/i, /metric|metrik|revenue|gelir|team|ekip/i]);
  const roleBridgeEvidence = findEvidenceUnit(cvText, [/stakeholder|paydaş|paydas|delivery|roadmap|prd|backlog|sql|excel|dashboard|campaign|gtm|operations|operasyon|analysis|analiz/i]);
  const jdRoleDemand = findEvidenceUnit(jdText, [/ownership|stakeholder|delivery|roadmap|prd|backlog|sql|excel|dashboard|campaign|operations|strategy|product|growth|data|analysis/i]);
  const targetClear = Boolean(roleBridgeEvidence && jdRoleDemand);
  const ownershipScore = ownershipEvidence ? 88 : intel.hasFounder || intel.hasBuilder ? 72 : 32;
  const executionScore = executionEvidence ? 82 : intel.hasOps ? 58 : 30;
  const scaleScore = scaleEvidence ? 78 : 28;
  const roleBridgeScore = targetClear ? 76 : roleBridgeEvidence || jdRoleDemand ? 52 : 25;
  const firstScreenScore = Number.isFinite(Number(score)) ? Math.max(24, Math.min(90, Number(score))) : (targetClear ? 65 : 45);
  const trustScore = Math.round((ownershipScore + executionScore + scaleScore) / 3);
  const narrativeScore = Math.round((firstScreenScore + roleBridgeScore + (intel.hasBuilder || intel.hasData || intel.hasGrowth ? 62 : 42)) / 3);
  const ambiguityScore = intel.hasBuilder || intel.hasFounder ? 84 : executionEvidence ? 62 : 35;
  const corporateScore = Math.round((scaleScore * 0.4) + (roleBridgeScore * 0.35) + (executionScore * 0.25));
  const builderScore = Math.round((ownershipScore * 0.45) + (executionScore * 0.35) + (ambiguityScore * 0.2));
  const careerLane =
    intel.hasProduct || intel.hasBuilder ? "product_builder" :
      intel.hasGrowth ? "growth_gtm" :
        intel.hasData ? "data_analysis" :
          intel.hasOps ? "strategy_ops" :
            "structured_generalist";
  return {
    ownership: { level: signalLevel(ownershipScore), score: ownershipScore, evidence: ownershipEvidence || missingEvidenceLabel("roleBridge", lang) },
    executionProof: { level: signalLevel(executionScore), score: executionScore, evidence: executionEvidence || missingEvidenceLabel("roleBridge", lang) },
    scaleProof: { level: signalLevel(scaleScore), score: scaleScore, evidence: scaleEvidence || missingEvidenceLabel("scale", lang) },
    roleBridge: { level: signalLevel(roleBridgeScore), score: roleBridgeScore, evidence: roleBridgeEvidence || missingEvidenceLabel("roleBridge", lang), jdEvidence: jdRoleDemand || "" },
    firstScreenClarity: { level: signalLevel(firstScreenScore), score: firstScreenScore },
    trustEvidence: { level: signalLevel(trustScore), score: trustScore },
    narrativeCoherence: { level: signalLevel(narrativeScore), score: narrativeScore },
    ambiguityTolerance: { level: signalLevel(ambiguityScore), score: ambiguityScore },
    corporateReadiness: { level: signalLevel(corporateScore), score: corporateScore },
    builderFit: { level: signalLevel(builderScore), score: builderScore },
    careerLeverage: { lane: careerLane, frame: marketFitFrame(intel, lang) },
    archetypeRead: builderScore > corporateScore + 12 ? "builder" : corporateScore > builderScore + 12 ? "corporate" : "mixed",
  };
}

function countPatternHits(text, patterns) {
  const src = String(text || "");
  return patterns.reduce((sum, re) => sum + (re.test(src) ? 1 : 0), 0);
}

function buildSignalStacking(cvText, jdText, signals, lang) {
  const cv = String(cvText || "");
  const productHits = countPatternHits(cv, [
    /founder|kurucu|hirefit/i,
    /launched|shipped|built|canlÄ±ya|yayÄ±na|geliÅŸtirdim|gelistirdim/i,
    /user feedback|kullanÄ±cÄ± geri|kullanici geri|customer feedback/i,
    /iteration|iterate|iterasyon/i,
    /roadmap|prd|backlog|user stor/i,
    /analytics|metric|metrik|kpi|dashboard/i,
    /gtm|go[-\s]?to[-\s]?market|acquisition|campaign|growth/i,
    /workflow|automation|ops|operasyon/i,
  ]);
  const opsHits = countPatternHits(`${cv} ${jdText}`, [/stakeholder|paydaÅŸ|paydas/i, /process|sÃ¼reÃ§|surec/i, /delivery|teslim/i, /scale|team|ekip/i]);
  const dataHits = countPatternHits(cv, [/sql|excel|dashboard|analytics|analysis|analiz|metric|metrik|kpi/i]);
  const isolatedFounder =
    /founder|kurucu/i.test(cv) &&
    productHits <= 2 &&
    signals.executionProof.level === "weak" &&
    signals.scaleProof.level === "weak";
  const evidenceDensity = Math.min(100, Math.round(productHits * 10 + opsHits * 8 + dataHits * 8));
  const executionRealism =
    productHits >= 4 || (signals.executionProof.level !== "weak" && signals.ownership.level !== "weak")
      ? "realistic"
      : isolatedFounder
        ? "inflated"
        : "thin";
  return {
    productHits,
    opsHits,
    dataHits,
    evidenceDensity,
    isolatedFounder,
    executionRealism,
    operationalMaturity: signalLevel(Math.min(100, opsHits * 18 + signals.executionProof.score * 0.45)),
    proofStack:
      productHits >= 5
        ? (isTr(lang) ? "Ã¼rÃ¼n/builder kanÄ±tÄ± Ã¼st Ã¼ste biniyor" : "product/builder proof stacks up")
        : productHits >= 3
          ? (isTr(lang) ? "Ã¼rÃ¼n/builder kanÄ±tÄ± var ama tamamlanmalÄ±" : "product/builder proof exists but needs completion")
          : (isTr(lang) ? "kanÄ±tlar tek baÅŸÄ±na kalÄ±yor" : "proof points are still isolated"),
  };
}

function buildTrustCalibrationEngine(cvText, jdText, signals, stack) {
  const cv = String(cvText || "");
  const jargonHits = countPatternHits(cv, [
    /strategic|innovative|passionate|dynamic|visionary|synergy|leverage|optimi[sz]e/i,
    /mÃ¼kemmel|mukemmel|tutkulu|vizyoner|yenilikÃ§i|yenilikci|stratejik/i,
  ]);
  const titleHits = countPatternHits(cv, [/founder|co[-\s]?founder|head of|director|lead|kurucu|lider/i]);
  const proofHits = countPatternHits(cv, [
    /launched|shipped|built|delivered|canlÄ±ya|yayÄ±na|teslim/i,
    /\d+\s?%|\d+\s?(k|m|users|clients|projects)\b/i,
    /stakeholder|paydaÅŸ|paydas|customer|user feedback|kullanÄ±cÄ±/i,
    /roadmap|prd|backlog|dashboard|sql|excel|campaign|gtm/i,
  ]);
  const abstractionRatio = jargonHits / Math.max(1, proofHits);
  const titleCredibility = titleHits > 0 && proofHits >= 3 ? "credible" : titleHits > 0 ? "needs_proof" : "not_title_led";
  const founderLegitimacy = /founder|kurucu/i.test(cv)
    ? (stack.isolatedFounder ? "inflated" : stack.executionRealism === "realistic" ? "credible" : "partial")
    : "not_founder_led";
  const base = Math.round(
    signals.trustEvidence.score * 0.25 +
    signals.roleBridge.score * 0.2 +
    signals.scaleProof.score * 0.2 +
    signals.executionProof.score * 0.2 +
    signals.narrativeCoherence.score * 0.15
  );
  const penalty = (stack.isolatedFounder ? 18 : 0) + (abstractionRatio > 0.7 ? 10 : 0);
  const recruiterDefensibility = Math.max(0, Math.min(100, base - penalty));
  return {
    executionDensity: stack.evidenceDensity,
    ownershipDepth: signals.ownership.score,
    repeatabilityProof: signals.scaleProof.score,
    stakeholderComplexity: countPatternHits(`${cv} ${jdText}`, [/stakeholder|paydaÅŸ|paydas|cross-functional|team|ekip|client|mÃ¼ÅŸteri|musteri/i]) * 20,
    measurableOutcomePresence: signals.scaleProof.level !== "weak",
    operationalRealism: stack.executionRealism,
    narrativeConsistency: signals.narrativeCoherence.score,
    abstractionVsEvidenceRatio: Number(abstractionRatio.toFixed(2)),
    signalInflationRisk: stack.isolatedFounder || abstractionRatio > 0.7 ? "elevated" : "controlled",
    titleCredibility,
    jargonDensity: jargonHits,
    founderLegitimacy,
    recruiterDefensibility,
    trustLabel: recruiterDefensibility >= 76 ? "defensible" : recruiterDefensibility >= 55 ? "interesting_but_needs_proof" : "hard_to_defend",
  };
}

function buildCareerDefensibility(signals, trust, stack, lang) {
  const tr = isTr(lang);
  const canDefend = trust.recruiterDefensibility >= 68 && signals.roleBridge.level !== "weak";
  const hesitation =
    trust.signalInflationRisk === "elevated"
      ? (tr ? "unvan gÃ¼Ã§lÃ¼ ama arkasÄ±ndaki iÅŸ daha net gÃ¶rÃ¼nmeli" : "title is strong but the work behind it needs to be clearer")
      : signals.scaleProof.level === "weak"
        ? (tr ? "sonuÃ§ bÃ¼yÃ¼klÃ¼ÄŸÃ¼ hemen okunmuyor" : "scale of outcome is not immediately clear")
        : signals.roleBridge.level === "weak"
          ? (tr ? "hedef role kÃ¶prÃ¼ recruiter'a bÄ±rakÄ±lÄ±yor" : "the bridge to the target role is left for the recruiter to infer")
          : (tr ? "kanÄ±t savunulabilir ama daha gÃ¶rÃ¼nÃ¼r olmalÄ±" : "proof is defensible but should be easier to see");
  return {
    canDefendInterview: canDefend,
    shortlistJustification: canDefend
      ? (tr ? "Recruiter bu profili gÃ¶rÃ¼ÅŸmeye savunabilir." : "A recruiter can defend interviewing this profile.")
      : (tr ? "Recruiter ilgilenebilir ama shortlist savunmasÄ± iÃ§in daha net kanÄ±t ister." : "A recruiter may be interested but needs clearer proof to defend a shortlist."),
    hesitationStartsAt: hesitation,
    politicalHiringRisk:
      signals.corporateReadiness.level === "weak" && signals.builderFit.level !== "weak"
        ? "corporate_panel_risk"
        : trust.recruiterDefensibility < 55
          ? "shortlist_defense_risk"
          : "manageable",
    upsideRead: stack.executionRealism === "realistic" ? "high_upside" : signals.builderFit.level !== "weak" ? "possible_upside" : "unclear_upside",
  };
}

function buildRoleNarrativeCoherence(cvText, jdText, signals, lang) {
  const tr = isTr(lang);
  const headlineEvidence = findEvidenceUnit(cvText, [/summary|profile|objective|Ã¶zet|ozet|headline|title/i]);
  const projectEvidence = findEvidenceUnit(cvText, [/project|proje|hirefit|launched|built|dashboard|campaign|roadmap|prd|backlog/i]);
  const certEvidence = findEvidenceUnit(cvText, [/certificate|certification|sertifika|course|kurs|bootcamp/i]);
  const jdDemand = findEvidenceUnit(jdText, [/product|strategy|operations|data|growth|marketing|stakeholder|sql|roadmap|delivery/i]);
  const forcedBridge = signals.roleBridge.level === "weak" || signals.narrativeCoherence.level !== "strong";
  return {
    headlineSupportsTarget: Boolean(headlineEvidence && jdDemand),
    projectsSupportTarget: Boolean(projectEvidence && jdDemand),
    certificatesReinforceNarrative: Boolean(certEvidence && jdDemand),
    founderClarifiesOrConfuses: signals.builderFit.score > signals.corporateReadiness.score + 15 ? "clarifies_builder_story" : forcedBridge ? "can_confuse_target_role" : "neutral",
    achievementsPointSameDirection: signals.narrativeCoherence.level === "strong",
    recruiterMustBridgeGaps: forcedBridge,
    visibleSummary: forcedBridge
      ? (tr ? "Hikaye tek role net baÄŸlanmÄ±yor." : "The story does not attach cleanly to one role.")
      : (tr ? "Hikaye hedef role baÄŸlanabiliyor." : "The story can connect to the target role."),
  };
}

function buildMicroPsychology(signals, trust, defensibility, coherence, lang) {
  const tr = isTr(lang);
  let primary = "hesitation";
  if (trust.recruiterDefensibility >= 76) primary = "confidence";
  else if (signals.builderFit.level === "strong" && trust.signalInflationRisk !== "elevated") primary = "curiosity";
  else if (coherence.recruiterMustBridgeGaps) primary = "confusion";
  else if (trust.signalInflationRisk === "elevated") primary = "skepticism";
  return {
    primaryEmotion: primary,
    curiosity: signals.builderFit.score,
    hesitation: 100 - trust.recruiterDefensibility,
    trust: trust.recruiterDefensibility,
    confusion: coherence.recruiterMustBridgeGaps ? 72 : 28,
    skepticism: trust.signalInflationRisk === "elevated" ? 78 : 30,
    ambiguityFatigue: signals.firstScreenClarity.level === "weak" ? 80 : 35,
    visible:
      primary === "confidence"
        ? (tr ? "Recruiter bunu savunabilir." : "A recruiter can defend this.")
        : primary === "curiosity"
          ? (tr ? "Recruiter ilgilenir; ama kanÄ±tÄ± hÄ±zlÄ± gÃ¶rmek ister." : "A recruiter gets curious, but wants proof fast.")
          : primary === "confusion"
            ? (tr ? "Recruiter seni Ã§Ã¶zmek iÃ§in ekstra efor harcar." : "The recruiter has to spend extra effort to place you.")
            : defensibility.canDefendInterview
              ? (tr ? "Ä°lgi var; karar kanÄ±tÄ±n netliÄŸine kalÄ±r." : "There is interest; the decision depends on proof clarity.")
              : (tr ? "Merak var ama gÃ¼ven tam kapanmÄ±yor." : "There is curiosity, but trust does not fully close."),
  };
}

function buildAdaptiveRoleScoring(rawScore, signals, trust, defensibility, signalHierarchy = null, eliteTrust = null) {
  const lane = signals.careerLeverage.lane;
  const weights = lane === "product_builder"
    ? { ats: 0.12, trust: 0.2, execution: 0.22, narrative: 0.14, bridge: 0.12, scale: 0.1, defensibility: 0.1 }
    : lane === "strategy_ops"
      ? { ats: 0.14, trust: 0.18, execution: 0.16, narrative: 0.18, bridge: 0.16, scale: 0.1, defensibility: 0.08 }
      : lane === "data_analysis"
        ? { ats: 0.18, trust: 0.15, execution: 0.12, narrative: 0.12, bridge: 0.18, scale: 0.15, defensibility: 0.1 }
        : { ats: 0.15, trust: 0.18, execution: 0.17, narrative: 0.16, bridge: 0.16, scale: 0.1, defensibility: 0.08 };
  const ats = Number.isFinite(Number(rawScore)) ? Number(rawScore) : 50;
  const hierarchyScore = signalHierarchy?.proofScore ?? signals.trustEvidence.score;
  const eliteConviction = eliteTrust?.conviction ?? trust.recruiterDefensibility;
  const value =
    ats * weights.ats +
    signals.trustEvidence.score * weights.trust +
    signals.executionProof.score * weights.execution +
    signals.narrativeCoherence.score * weights.narrative +
    signals.roleBridge.score * weights.bridge +
    signals.scaleProof.score * weights.scale +
    ((trust.recruiterDefensibility * 0.45) + (hierarchyScore * 0.3) + (eliteConviction * 0.25)) * weights.defensibility;
  const riskPenalty =
    eliteTrust?.founderTitleInflation
      ? 11
      : trust.signalInflationRisk === "elevated"
        ? 7
        : defensibility.politicalHiringRisk !== "manageable"
          ? 5
          : 0;
  const adjusted = Math.max(0, Math.min(100, Math.round(value - riskPenalty)));
  return {
    adjusted,
    lane,
    weights,
    band: adjusted >= 76 ? "defensible" : adjusted >= 56 ? "possible_but_needs_proof" : "hard_to_defend",
    hiddenOnly: true,
  };
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function buildSignalHierarchy(cvText, jdText, signals, stack, lang) {
  const cv = String(cvText || "");
  const all = `${cv} ${jdText || ""}`;
  const weakHits = countPatternHits(cv, [
    /certificate|certification|course|bootcamp|sertifika|kurs/i,
    /founder|co[-\s]?founder|head of|director|lead|kurucu/i,
    /strategic|innovative|visionary|passionate|dynamic|synergy|leverage/i,
    /startup|girişim|girisim/i,
  ]);
  const mediumHits = countPatternHits(cv, [
    /project|case study|proje|workflow|process|dashboard|analysis|analiz/i,
    /prd|backlog|roadmap|documentation|dokümantasyon|dokumantasyon/i,
    /sql|excel|power\s?bi|tableau|figma|analytics/i,
  ]);
  const strongHits = countPatternHits(cv, [
    /launched|shipped|released|built|delivered|operated|implemented/i,
    /canlıya|canliya|yayına|yayina|teslim|uyguladım|uyguladim/i,
    /onboarding|gtm|go[-\s]?to[-\s]?market|kpi|metric|metrik|user feedback|customer feedback/i,
    /iteration|iterasyon|roadmap decision|stakeholder|paydaş|paydas/i,
  ]);
  const eliteHits = countPatternHits(all, [
    /scaled|repeatable|system|process creation|organizational|cross-functional/i,
    /ölçek|olcek|tekrarlanabilir|sistem kur|süreç kur|surec kur/i,
    /\d+\s?%|\d+\s?(k|m|users|clients|revenue|gelir|projects)\b/i,
    /tradeoff|prioritization|önceliklendirme|onceliklendirme/i,
  ]);
  const proofWeight = weakHits * 6 + mediumHits * 14 + strongHits * 24 + eliteHits * 34;
  const fakeSophisticationRisk =
    weakHits >= 3 && strongHits + eliteHits <= 1
      ? "high"
      : weakHits > mediumHits + strongHits + eliteHits
        ? "medium"
        : "low";
  const executionRealism =
    eliteHits >= 2 || strongHits >= 3 || stack.executionRealism === "realistic"
      ? "real"
      : fakeSophisticationRisk === "high"
        ? "wording_heavy"
        : "partial";
  const proofTier =
    eliteHits >= 2
      ? "elite"
      : strongHits >= 2
        ? "strong"
        : mediumHits >= 2
          ? "medium"
          : "weak";
  return {
    weakHits,
    mediumHits,
    strongHits,
    eliteHits,
    proofTier,
    proofScore: clampScore(proofWeight),
    fakeSophisticationRisk,
    executionRealism,
    operationalMaturity: clampScore(eliteHits * 28 + strongHits * 16 + signals.executionProof.score * 0.3),
    compressWeakSignals: weakHits > strongHits + eliteHits,
    amplifyStackedStrongSignals: strongHits + eliteHits >= 4,
    hiddenSummary: isTr(lang)
      ? `Kanıt hiyerarşisi ${proofTier}; zayıf=${weakHits}, orta=${mediumHits}, güçlü=${strongHits}, elit=${eliteHits}.`
      : `Proof hierarchy is ${proofTier}; weak=${weakHits}, medium=${mediumHits}, strong=${strongHits}, elite=${eliteHits}.`,
  };
}

function buildEliteTrustCalibration(cvText, jdText, signals, stack, hierarchy, trust, defensibility, lang) {
  const cv = String(cvText || "");
  const highAgency = signals.ownership.level !== "weak" && signals.executionProof.level !== "weak";
  const realBuilder = highAgency && hierarchy.strongHits + hierarchy.eliteHits >= 3 && !stack.isolatedFounder;
  const operatorMentality = signals.executionProof.score >= 70 && signals.corporateReadiness.score >= 58;
  const strategistWithoutExecution =
    /strategy|strateji|market|positioning|business model|prioritization/i.test(`${cv} ${jdText || ""}`) &&
    signals.executionProof.level === "weak";
  const productThinkerWithoutShipping =
    /product|ürün|urun|roadmap|prd|backlog/i.test(`${cv} ${jdText || ""}`) &&
    signals.executionProof.level === "weak";
  const founderTitleInflation =
    /founder|co[-\s]?founder|kurucu/i.test(cv) &&
    (stack.isolatedFounder || hierarchy.fakeSophisticationRisk === "high");
  const conviction = clampScore(
    trust.recruiterDefensibility * 0.32 +
      hierarchy.proofScore * 0.26 +
      signals.roleBridge.score * 0.16 +
      signals.scaleProof.score * 0.14 +
      signals.narrativeCoherence.score * 0.12 -
      (founderTitleInflation ? 14 : 0)
  );
  const scrutinyRisk = clampScore(
    100 -
      (hierarchy.eliteHits * 18 + hierarchy.strongHits * 11 + signals.scaleProof.score * 0.24 + trust.recruiterDefensibility * 0.22)
  );
  const survivesSecondReview = conviction >= 68 && scrutinyRisk < 52 && !founderTitleInflation;
  return {
    conviction,
    hesitationBeginsAt:
      founderTitleInflation
        ? (isTr(lang) ? "unvan güçlü; arkasındaki çıktı yeterince sert değil" : "the title is strong; the output behind it is not hard enough")
        : signals.scaleProof.level === "weak"
          ? (isTr(lang) ? "etki büyüklüğü ilk bakışta görünmüyor" : "impact size is not visible on first read")
          : signals.roleBridge.level === "weak"
            ? (isTr(lang) ? "recruiter hedef role köprüyü kendi kurmak zorunda" : "the recruiter has to build the bridge to the target role")
            : (isTr(lang) ? "kanıt var; daha hızlı okunmalı" : "proof exists; it needs to read faster"),
    canDefendInterviewInternally: defensibility.canDefendInterview || conviction >= 70,
    survivesSecondRecruiterReview: survivesSecondReview,
    signalsCollapseUnderScrutiny: scrutinyRisk >= 64 || founderTitleInflation,
    smartButShallow: signals.firstScreenClarity.score >= 60 && hierarchy.proofTier === "weak",
    polishedButWeak: hierarchy.fakeSophisticationRisk === "high",
    founderTitleInflation,
    realBuilder,
    operatorMentality,
    strategistWithoutExecution,
    productThinkerWithoutShipping,
    highAgencyProfile: highAgency,
    corporateSafeProfile: signals.corporateReadiness.score >= 70 && scrutinyRisk < 55,
    startupNativeProfile: signals.builderFit.score >= 72 && signals.ambiguityTolerance.score >= 70,
    ambiguousButHighUpside: conviction >= 55 && conviction < 72 && signals.builderFit.level === "strong",
    riskyButDefensible: conviction >= 62 && scrutinyRisk >= 48,
    politicallyDifficultHire: defensibility.politicalHiringRisk !== "manageable" || scrutinyRisk >= 70,
    easyInternalShortlistDefense: conviction >= 76 && survivesSecondReview,
    scrutinyRisk,
  };
}

function buildDefensibilityReasoning(signals, eliteTrust, hierarchy, lang) {
  const tr = isTr(lang);
  const burden =
    eliteTrust.founderTitleInflation
      ? (tr ? "kurucu unvanının arkasındaki çıktı" : "output behind the founder title")
      : signals.scaleProof.level === "weak"
        ? (tr ? "etki büyüklüğü" : "impact size")
        : signals.roleBridge.level === "weak"
          ? (tr ? "hedef role doğrudan köprü" : "direct bridge to the target role")
          : (tr ? "kanıtın hızlı okunması" : "fast proof readability");
  return {
    internalDefendability: eliteTrust.canDefendInterviewInternally ? "defensible" : "needs_more_proof",
    hiringRisk: eliteTrust.politicallyDifficultHire ? "panel_risk" : eliteTrust.riskyButDefensible ? "manageable_risk" : "low_to_moderate",
    perceptionRisk: eliteTrust.polishedButWeak ? "polished_without_enough_proof" : "normal",
    ambiguityBurden: signals.narrativeCoherence.level === "weak" ? "high" : "manageable",
    trustBurden: burden,
    proofSufficiency: hierarchy.proofTier,
    executionCredibility: hierarchy.executionRealism,
    scaleCredibility: signals.scaleProof.level,
    visibleAngle: tr
      ? `Recruiter bu profili savunacaksa önce ${burden} tarafını netleştirmek ister.`
      : `To defend this profile, the recruiter first needs clearer ${burden}.`,
  };
}

function buildRecruiterMicroPsychology(signals, eliteTrust, defensibilityReasoning, lang) {
  const tr = isTr(lang);
  const primary =
    eliteTrust.easyInternalShortlistDefense
      ? "confidence"
      : eliteTrust.realBuilder
        ? "intrigue"
        : eliteTrust.polishedButWeak || eliteTrust.founderTitleInflation
          ? "skepticism"
          : signals.narrativeCoherence.level === "weak"
            ? "ambiguity_fatigue"
            : "hesitation";
  return {
    primary,
    curiosity: clampScore(signals.builderFit.score * 0.55 + eliteTrust.conviction * 0.45),
    hesitation: clampScore(100 - eliteTrust.conviction),
    skepticism: eliteTrust.polishedButWeak || eliteTrust.founderTitleInflation ? 82 : 34,
    intrigue: eliteTrust.realBuilder || eliteTrust.ambiguousButHighUpside ? 78 : 42,
    confidence: eliteTrust.conviction,
    ambiguityFatigue: defensibilityReasoning.ambiguityBurden === "high" ? 78 : 36,
    upsidePerception: eliteTrust.startupNativeProfile || eliteTrust.realBuilder ? "high" : eliteTrust.ambiguousButHighUpside ? "interesting" : "unclear",
    trustAcceleration: eliteTrust.easyInternalShortlistDefense ? "fast" : eliteTrust.canDefendInterviewInternally ? "medium" : "slow",
    visibleHint:
      primary === "skepticism"
        ? (tr ? "Recruiter merak eder; sonra kanıtı sıkıştırır." : "The recruiter gets curious, then presses for proof.")
        : primary === "ambiguity_fatigue"
          ? (tr ? "Recruiter seni hızlı yerleştiremiyor; bu da okuma yükü yaratıyor." : "The recruiter cannot place you quickly; that creates reading load.")
          : primary === "intrigue"
            ? (tr ? "Merak yaratıyor; güven kanıt görünür oldukça artar." : "It creates intrigue; trust rises as proof becomes visible.")
            : (tr ? "İlk okuma savunulabilir; karar kanıtın netliğine kalır." : "The first read is defensible; the decision turns on proof clarity."),
  };
}

function buildEvidenceCompression(roleId, cvText, jdText, lang) {
  const tr = isTr(lang);
  const evidence = findEvidenceUnit(cvText, roleEvidencePatterns(roleId));
  const hasEvidence = Boolean(evidence);
  const ev = evidence ? evidenceDisplay(evidence) : missingEvidenceLabel("roleBridge", lang);
  const productish = roleId === "product_management" || roleId === "product_strategy" || roleId === "ai_product_operations";
  const strategyish = roleId === "strategy_operations" || roleId === "business_analysis" || roleId === "product_strategy";
  const opsish = roleId === "project_management" || roleId === "strategy_operations" || roleId === "gtm_operations" || roleId === "ai_product_operations";
  const dataish = roleId === "data_analysis" || roleId === "business_analysis";
  const growthish = roleId === "growth" || roleId === "growth_strategy" || roleId === "marketing" || roleId === "gtm_operations" || roleId === "business_development";
  let lens = tr
    ? "Recruiter burada aynı deneyimi daha hızlı güvene çevirir."
    : "The recruiter turns the same experience into trust faster here.";
  if (roleId === "product_management") {
    lens = tr
      ? "Recruiter burada kullanıcı problemi sahiplenme ve ürün kararı tarafını daha hızlı görüyor."
      : "The recruiter sees user problem ownership and product decision-making faster here.";
  } else if (roleId === "strategy_operations") {
    lens = tr
      ? "Recruiter burada pazar, büyüme ve execution sistemi düşüncesini daha hızlı görüyor."
      : "The recruiter sees market, growth, and execution-system thinking faster here.";
  } else if (roleId === "business_analysis") {
    lens = tr
      ? "Recruiter burada süreç, veri ve görünürlük kurma tarafını daha hızlı görüyor."
      : "The recruiter sees process, data, and visibility-building faster here.";
  } else if (productish) {
    lens = tr
      ? "Recruiter burada kullanıcı problemi ile ürün kararını daha hızlı bağlıyor."
      : "The recruiter connects user problems to product decisions faster here.";
  } else if (strategyish) {
    lens = tr
      ? "Recruiter burada belirsizliği parçalayıp karar kalitesi üretmeni daha hızlı görüyor."
      : "The recruiter sees ambiguity-breaking and decision quality faster here.";
  } else if (opsish) {
    lens = tr
      ? "Recruiter burada dağınık işi takip edilebilir sisteme çevirmeni daha hızlı görüyor."
      : "The recruiter sees trackable execution systems faster here.";
  } else if (dataish) {
    lens = tr
      ? "Recruiter burada sayı, çıktı ve karar arasındaki bağı daha hızlı görüyor."
      : "The recruiter sees the link between numbers, output, and decisions faster here.";
  } else if (growthish) {
    lens = tr
      ? "Recruiter burada dağıtım, mesaj ve kullanıcı kazanımı tarafını daha hızlı görüyor."
      : "The recruiter sees distribution, messaging, and acquisition faster here.";
  }
  return {
    hasEvidence,
    evidenceLine: hasEvidence
      ? (tr ? `CV'de "${ev}" var.` : `The CV shows "${ev}".`)
      : ev,
    lensLine: lens,
  };
}

function buildRoleDNAEngine(cvText, jdText, businessValue, lang) {
  const roleIds = [
    "product_management",
    "strategy_operations",
    "data_analysis",
    "growth",
    "business_development",
    "project_management",
  ];
  return roleIds.reduce((acc, roleId) => {
    const compressed = buildEvidenceCompression(roleId, cvText, jdText, lang);
    acc[roleId] = {
      roleId,
      recruiterLens: compressed.lensLine,
      evidenceRead: compressed.evidenceLine,
      businessNeed: businessValue.roleExistsFor,
      missingUpgrade: roleUpgradeProof(roleId, lang),
    };
    return acc;
  }, {});
}

function removeSyntheticPolish(text, lang) {
  const tr = isTr(lang);
  let t = cleanToken(text);
  if (!t) return "";
  const replacements = [
    [/Recruiter güveni, sahiplenilmiş iş ve karar alma kanıtı gördüğünde yükselir\./gi, tr ? "Recruiter sahiplenilmiş iş görünce daha hızlı güvenir." : "Recruiter trust rises when owned work is easy to see."],
    [/Bu profil ownership ortamında daha hızlı güven verir; katı kurumsal execution funnel'ında ölçek kanıtı sorulur\./gi, tr ? "Builder tarafın güçlü; kurumsal ekiplerde daha somut çıktı görmek isterler." : "The builder side is strong; corporate teams will want clearer output."],
    [/Execution proof insufficient\.?/gi, tr ? "İş çıkardığın belli; etki büyüklüğü hemen okunmuyor." : "The work is there; the size of impact is not easy to read."],
    [/Role alignment appears fragmented\.?/gi, tr ? "Hikaye tek role net bağlanmıyor." : "The story does not attach cleanly to one role."],
    [/Candidate demonstrates/gi, tr ? "CV'de görünen şey" : "What the CV shows"],
    [/optimization/gi, tr ? "netleştirme" : "sharpening"],
  ];
  for (const [re, value] of replacements) {
    t = t.replace(re, value);
  }
  t = t
    .replace(/\btherefore\b/gi, "")
    .replace(/\bfurthermore\b/gi, "")
    .replace(/\bin conclusion\b/gi, "")
    .replace(/\bpotentially\b/gi, "")
    .replace(/\bconsider\b/gi, "choose")
    .replace(/\bcould\b/gi, "can")
    .replace(/\bwould\b/gi, "will")
    .replace(/\boptimi[sz]e\b/gi, "sharpen")
    .replace(/\benhance\b/gi, "sharpen")
    .replace(/\bimprove\b/gi, "sharpen")
    .replace(/\s*;\s*/g, "; ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (/Eksik kanıt:|Missing proof:|Ana Sınırlayıcı|Primary Limiter/i.test(t)) return t;
  const sentences = t.split(/(?<=[.!?…])\s+/).filter(Boolean);
  if (sentences.length > 2) return sentences.slice(0, 2).join(" ");
  return t;
}

function buildBusinessValueEngine(cvText, jdText, lang) {
  const jd = String(jdText || "");
  const cv = String(cvText || "");
  const needs = [
    { key: "Product Delivery", patterns: [/product|roadmap|prd|backlog|delivery|ship|launch|ürün|urun/i] },
    { key: "Growth", patterns: [/growth|acquisition|activation|retention|funnel|conversion|campaign/i] },
    { key: "Revenue", patterns: [/revenue|sales|pipeline|pricing|monetization|gelir|satış|satis/i] },
    { key: "Retention", patterns: [/retention|churn|customer success|renewal|support|müşteri|musteri/i] },
    { key: "Process Efficiency", patterns: [/process|operations|workflow|automation|efficiency|süreç|surec|operasyon/i] },
    { key: "Strategy Execution", patterns: [/strategy|market|prioritization|business case|go[-\s]?to[-\s]?market|strateji/i] },
    { key: "Customer Success", patterns: [/customer|client|onboarding|account|support|müşteri|musteri/i] },
    { key: "Cost Reduction", patterns: [/cost|budget|efficiency|saving|maliyet|tasarruf/i] },
  ];
  const picked = needs.find((need) => hasAny(jd, need.patterns)) || needs.find((need) => hasAny(cv, need.patterns)) || needs[5];
  const evidence = findEvidenceUnit(cv, [
    /launched|shipped|built|delivered|implemented|canlıya|canliya|yayına|yayina/i,
    /growth|revenue|sales|campaign|customer|user feedback|kullanıcı|kullanici/i,
    /dashboard|sql|excel|analysis|analiz|workflow|process|automation/i,
  ]);
  return {
    roleExistsFor: picked.key,
    cvEvidence: evidence || missingEvidenceLabel("roleBridge", lang),
    businessNeedLabel: isTr(lang) ? {
      "Product Delivery": "Ürün teslimi",
      Growth: "Büyüme",
      Revenue: "Gelir",
      Retention: "Elde tutma",
      "Process Efficiency": "Süreç verimliliği",
      "Strategy Execution": "Strateji uygulama",
      "Customer Success": "Müşteri başarısı",
      "Cost Reduction": "Maliyet düşürme",
    }[picked.key] : picked.key,
  };
}

function buildProofGapEngine(cvText, jdText, signals, businessValue, lang) {
  const tr = isTr(lang);
  const cv = String(cvText || "");
  const jd = String(jdText || "");
  const gaps = [
    {
      category: "Scale Proof",
      missing: tr ? "Ölçek kanıtı" : "scale proof",
      active: signals.scaleProof.level === "weak",
      explanation: tr
        ? "CV'de iş çıkardığın görünüyor; bunun kaç kullanıcıya, müşteriye veya sonuca ulaştığı görünmüyor."
        : "The CV shows work shipped; it does not show how many users, customers, or outcomes it reached.",
    },
    {
      category: "Product Proof",
      missing: tr ? "Ürün kanıtı" : "product proof",
      active: /product|ürün|urun|roadmap|prd|backlog/i.test(jd) && !/roadmap|prd|backlog|user stor|user feedback/i.test(cv),
      explanation: tr
        ? "İlan ürün sahipliği bekliyor; CV'de PRD, backlog, roadmap veya kullanıcı geri bildirimi net görünmüyor."
        : "The role expects product ownership; PRD, backlog, roadmap, or user feedback proof is not clear.",
    },
    {
      category: "Execution Proof",
      missing: tr ? "Execution kanıtı" : "execution proof",
      active: signals.executionProof.level === "weak",
      explanation: tr
        ? "CV niyeti anlatıyor; teslim edilmiş işin sonucu ilk bakışta yakalanmıyor."
        : "The CV shows intent; the result of delivered work is not easy to catch.",
    },
    {
      category: "Ownership Proof",
      missing: tr ? "Sahiplenme kanıtı" : "ownership proof",
      active: signals.ownership.level === "weak",
      explanation: tr
        ? "Recruiter işin kime ait olduğunu ve kararları senin taşıyıp taşımadığını hızlı okuyamıyor."
        : "The recruiter cannot quickly tell whether you owned the work and the decisions.",
    },
    {
      category: "Customer Proof",
      missing: tr ? "Müşteri/kullanıcı kanıtı" : "customer proof",
      active: /customer|client|user|müşteri|musteri|kullanıcı|kullanici/i.test(jd) && !/customer|client|user feedback|müşteri|musteri|kullanıcı|kullanici/i.test(cv),
      explanation: tr
        ? "Rol kullanıcı veya müşteri etkisine bakıyor; CV'de temas ve öğrenme izi zayıf."
        : "The role cares about customer or user impact; contact and learning proof is thin.",
    },
    {
      category: "Revenue Proof",
      missing: tr ? "Gelir kanıtı" : "revenue proof",
      active: /revenue|sales|pipeline|pricing|growth|gelir|satış|satis/i.test(jd) && !/revenue|sales|pipeline|pricing|conversion|gelir|satış|satis|\d+\s?%/i.test(cv),
      explanation: tr
        ? "Rol ticari sonuca yakın; CV gelir, pipeline veya dönüşüm etkisini göstermiyor."
        : "The role sits near commercial results; the CV does not show revenue, pipeline, or conversion impact.",
    },
    {
      category: "Analytical Proof",
      missing: tr ? "Analitik kanıt" : "analytical proof",
      active: /sql|excel|dashboard|analytics|analysis|data|veri/i.test(jd) && !/sql|excel|dashboard|analytics|analysis|analiz|data|veri/i.test(cv),
      explanation: tr
        ? "İlan veriyle karar bekliyor; CV'de araç, analiz veya dashboard çıktısı görünmüyor."
        : "The role expects decisions with data; tool, analysis, or dashboard output is not visible.",
    },
    {
      category: "Operational Proof",
      missing: tr ? "Operasyonel kanıt" : "operational proof",
      active: /operations|process|delivery|workflow|coordination|operasyon|süreç|surec/i.test(jd) && signals.corporateReadiness.level === "weak",
      explanation: tr
        ? "Rol takip ve sistem ister; CV'de işi tekrarlanabilir sürece çevirdiğin net değil."
        : "The role needs follow-through and systems; repeatable operating proof is not clear.",
    },
    {
      category: "Leadership Proof",
      missing: tr ? "Liderlik kanıtı" : "leadership proof",
      active: /lead|manager|stakeholder|cross-functional|team|ekip|paydaş|paydas/i.test(jd) && !/lead|managed|stakeholder|team|ekip|paydaş|paydas|cross-functional/i.test(cv),
      explanation: tr
        ? "Rol başkalarıyla iş yürütmeyi bekliyor; CV'de ekip, paydaş veya karar alanı belirsiz."
        : "The role expects work through others; team, stakeholder, or decision scope is unclear.",
    },
    {
      category: "Domain Proof",
      missing: tr ? "Domain kanıtı" : "domain proof",
      active: /fintech|saas|retail|ecommerce|health|finance|bank|ai|b2b|b2c/i.test(jd) && !/fintech|saas|retail|ecommerce|health|finance|bank|ai|b2b|b2c/i.test(cv),
      explanation: tr
        ? "İlan belirli bir alana yakın; CV o domain'e neden güvenileceğini göstermiyor."
        : "The posting sits near a specific domain; the CV does not show why that domain should trust you.",
    },
  ];
  const activeGap = gaps.find((gap) => gap.active);
  const selected = activeGap || {
    category: "Execution Proof",
    missing: tr ? "Son kanıt" : "final proof",
    active: false,
    explanation: tr
      ? "Temel kanıt var; şimdi en güçlü sonucu ilk bakışta daha görünür yapmak gerekir."
      : "Core proof exists; the strongest result now needs to be easier to see first.",
  };
  return {
    category: selected.category,
    missingProof: selected.missing,
    isMissing: Boolean(activeGap),
    explanation: selected.explanation,
    businessNeed: businessValue.roleExistsFor,
    businessImpact: activeGap
      ? (tr
        ? `Business impact: ${businessValue.businessNeedLabel} tarafında risk kararın ertelenmesi.`
        : `Business impact: risk in ${businessValue.roleExistsFor} delays the decision.`)
      : (tr
        ? `Business impact: ${businessValue.businessNeedLabel} tarafında karar daha hızlı savunulur.`
        : `Business impact: the decision is easier to defend for ${businessValue.roleExistsFor}.`),
    visible: activeGap
      ? (tr
        ? `Eksik kanıt: ${selected.missing}. ${selected.explanation}`
        : `Missing proof: ${selected.missing}. ${selected.explanation}`)
      : (tr
        ? `Son kanıt: ${selected.explanation}`
        : `Final proof: ${selected.explanation}`),
  };
}

function buildConsequenceEngine(proofGap, businessValue, lang) {
  const tr = isTr(lang);
  return {
    recruiter: tr ? "Recruiter ilgilenir ama kanıtı hızlı göremez." : "The recruiter may care, but cannot see the proof fast.",
    hiringManager: tr ? "Hiring manager görüşme slotunu riske atmadan önce daha sert çıktı ister." : "The hiring manager wants harder output before risking an interview slot.",
    decision: tr ? "Karar ertelenir; daha net profiller öne geçebilir." : "The decision gets delayed; clearer profiles can move ahead.",
    businessConsequence: proofGap.businessImpact,
    visible: tr
      ? `${proofGap.visible} Sonuç: hiring manager ${businessValue.businessNeedLabel} için daha net kanıt bekler.`
      : `${proofGap.visible} Result: the hiring manager waits for clearer proof for ${businessValue.roleExistsFor}.`,
  };
}

function buildHiringManagerLayer(cvText, jdText, signals, businessValue, proofGap, lang) {
  const proof = findEvidenceUnit(cvText, [
    /launched|shipped|built|delivered|implemented|dashboard|roadmap|campaign|revenue|customer|user feedback/i,
    /canlıya|canliya|yayına|yayina|teslim|müşteri|musteri|kullanıcı|kullanici/i,
  ]) || missingEvidenceLabel("roleBridge", lang);
  const confidence = clampScore(
    signals.executionProof.score * 0.26 +
      signals.roleBridge.score * 0.22 +
      signals.scaleProof.score * 0.22 +
      signals.ownership.score * 0.18 +
      signals.corporateReadiness.score * 0.12
  );
  return {
    problemCompanyIsHiringFor: businessValue.roleExistsFor,
    evidenceThatCanSolveIt: proof,
    missingEvidence: proofGap.category,
    riskInterviewSlot: confidence < 68,
    confidence,
    visibleRead: isTr(lang)
      ? `Hiring manager ${businessValue.businessNeedLabel} için ${proofGap.missingProof} görmek ister.`
      : `The hiring manager wants ${proofGap.missingProof} for ${businessValue.roleExistsFor}.`,
  };
}

function buildInterviewProbabilityModel(score, signals, eliteTrust, proofGap, hiringManager, businessValue) {
  const ats = Number.isFinite(Number(score)) ? Number(score) : 50;
  const recruiterConfidence = clampScore(eliteTrust.conviction);
  const hiringManagerConfidence = hiringManager.confidence;
  const businessFit = clampScore(
    signals.roleBridge.score * 0.34 +
      signals.executionProof.score * 0.24 +
      signals.scaleProof.score * 0.18 +
      signals.narrativeCoherence.score * 0.14 +
      ats * 0.1
  );
  const proofStrength = clampScore(
    signals.executionProof.score * 0.28 +
      signals.ownership.score * 0.22 +
      signals.scaleProof.score * 0.22 +
      signals.trustEvidence.score * 0.18 +
      (proofGap.category === "Scale Proof" ? -6 : 0)
  );
  const roleClarity = signals.firstScreenClarity.score;
  const weightedDecision = clampScore(
    recruiterConfidence * 0.24 +
      hiringManagerConfidence * 0.24 +
      businessFit * 0.2 +
      proofStrength * 0.2 +
      roleClarity * 0.12
  );
  return {
    recruiterConfidence,
    hiringManagerConfidence,
    businessFit,
    proofStrength,
    roleClarity,
    weightedDecision,
    businessNeed: businessValue.roleExistsFor,
    decisionBand: weightedDecision >= 76 ? "move_forward" : weightedDecision >= 58 ? "borderline" : "stalls",
    hiddenOnly: true,
  };
}

function identityLabel(id, lang) {
  const tr = isTr(lang);
  const labels = {
    FounderBuilder: tr ? "Founder / Builder" : "Founder / Builder",
    Product: tr ? "Product" : "Product",
    Strategy: tr ? "Strategy" : "Strategy",
    BusinessOperations: tr ? "Business Operations" : "Business Operations",
    BusinessAnalysis: tr ? "Business Analysis" : "Business Analysis",
    Marketing: tr ? "Marketing" : "Marketing",
    Sales: tr ? "Sales" : "Sales",
    Finance: tr ? "Finance" : "Finance",
    DataAnalytics: tr ? "Data Analytics" : "Data Analytics",
  };
  return labels[id] || id;
}

function identityBand(score, lang) {
  const tr = isTr(lang);
  const n = Number(score) || 0;
  if (n >= 66) return tr ? "Güçlü" : "Strong";
  if (n >= 36) return tr ? "Orta" : "Medium";
  return tr ? "Zayıf" : "Weak";
}

function buildIdentityEngine(cvText, jdText, signals, lang) {
  const cv = String(cvText || "");
  const all = `${cv} ${jdText || ""}`;
  const scoreFrom = (patterns, base = 18) => clampScore(base + countPatternHits(all, patterns) * 16);
  const rawScores = {
    FounderBuilder: clampScore(
      18 +
        countPatternHits(cv, [/founder|co[-\s]?founder|kurucu|startup|girişim|girisim/i, /built|launched|shipped|canlıya|canliya|yayına|yayina|hirefit/i, /owner|owned|led|sahiplen/i]) * 18 +
        signals.ownership.score * 0.18 +
        signals.executionProof.score * 0.12
    ),
    Product: clampScore(scoreFrom([/product|ürün|urun|roadmap|prd|backlog|user stor|user feedback|kullanıcı|kullanici/i], 16) + signals.roleBridge.score * 0.12),
    Strategy: scoreFrom([/strategy|strateji|market|positioning|pricing|business case|prioritization|önceliklendirme|onceliklendirme|gtm/i], 18),
    BusinessOperations: scoreFrom([/operations|operasyon|process|süreç|surec|workflow|delivery|stakeholder|coordination|paydaş|paydas/i], 18),
    BusinessAnalysis: scoreFrom([/business analys|iş analiz|is analiz|requirement|gereksinim|dashboard|reporting|raporlama|process mapping/i], 16),
    Marketing: scoreFrom([/marketing|pazarlama|campaign|kampanya|content|seo|linkedin|instagram|brand|landing page/i], 14),
    Sales: scoreFrom([/sales|satış|satis|pipeline|crm|lead generation|partnership|business development|revenue|gelir/i], 14),
    Finance: scoreFrom([/finance|finans|budget|bütçe|butce|accounting|investment|valuation|p&l|cost|maliyet/i], 12),
    DataAnalytics: scoreFrom([/data|veri|sql|excel|dashboard|analytics|analysis|analiz|metric|metrik|kpi|power\s?bi|tableau/i], 16),
  };
  const ranked = Object.entries(rawScores)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([id, score]) => ({ id, label: identityLabel(id, lang), score, band: identityBand(score, lang) }));
  const primary = ranked[0];
  const second = ranked[1];
  const tr = isTr(lang);
  const identityReason = (() => {
    if (primary.id === "FounderBuilder") {
      return tr
        ? "Recruiter ilk okumada fikri alıp ürüne çeviren bir builder görüyor."
        : "The recruiter first sees a builder who turns an idea into a shipped product.";
    }
    if (primary.id === "Product") {
      return tr
        ? "Recruiter ilk okumada kullanıcı problemi, öncelik ve ürün kararı tarafını görüyor."
        : "The recruiter first sees user problems, prioritization, and product decisions.";
    }
    if (primary.id === "Strategy") {
      return tr
        ? "Recruiter ilk okumada pazar, büyüme ve karar kalitesi tarafını görüyor."
        : "The recruiter first sees market thinking, growth, and decision quality.";
    }
    if (primary.id === "BusinessOperations") {
      return tr
        ? "Recruiter ilk okumada sistem, takip ve execution tarafını görüyor."
        : "The recruiter first sees systems, follow-through, and execution.";
    }
    if (primary.id === "BusinessAnalysis") {
      return tr
        ? "Recruiter ilk okumada süreç, veri ve görünürlük kurma tarafını görüyor."
        : "The recruiter first sees process, data, and visibility-building.";
    }
    if (primary.id === "DataAnalytics") {
      return tr
        ? "Recruiter ilk okumada metrik, analiz ve karar desteği tarafını görüyor."
        : "The recruiter first sees metrics, analysis, and decision support.";
    }
    return tr
      ? `Recruiter ilk okumada ${primary.label} kimliğini görüyor.`
      : `The recruiter first sees a ${primary.label} identity.`;
  })();
  return {
    rawScores,
    identities: ranked.map(({ id, label, score, band }) => ({ id, label, score, band })),
    publicIdentities: ranked.map(({ id, label, band }) => ({ id, label, band })),
    primaryIdentity: {
      id: primary.id,
      label: primary.label,
      band: primary.band,
    },
    secondaryIdentity: second ? {
      id: second.id,
      label: second.label,
      band: second.band,
    } : null,
    identityReason,
  };
}

function identityConflictEngine(identityEngine, lang) {
  const tr = isTr(lang);
  const ranked = identityEngine.identities || [];
  const strong = ranked.filter((item) => item.score >= 66);
  const [first, second] = ranked;
  const conflict = Boolean(first && second && first.score >= 58 && second.score >= 58 && first.score - second.score <= 16);
  return {
    hasConflict: conflict || strong.length >= 3,
    competingIdentities: conflict ? [first, second].map((x) => ({ id: x.id, label: x.label, band: x.band })) : strong.slice(0, 3).map((x) => ({ id: x.id, label: x.label, band: x.band })),
    identityConflict: conflict
      ? (tr
        ? `${first.label} ve ${second.label} sinyalleri aynı anda güçlü. Recruiter hangi kimliğin baskın olduğunu ilk okumada seçemiyor.`
        : `${first.label} and ${second.label} signals are both strong. The recruiter cannot quickly choose which identity should dominate.`)
      : "",
  };
}

function buildIdentityClarity(identityEngine, conflict, lang) {
  const ranked = identityEngine.identities || [];
  const first = ranked[0]?.score || 0;
  const second = ranked[1]?.score || 0;
  const gap = first - second;
  const score = conflict.hasConflict
    ? Math.min(65, clampScore(44 + Math.max(0, gap)))
    : first >= 66 && gap >= 18
      ? 84
      : first >= 50 && gap >= 10
        ? 62
        : 34;
  return {
    score,
    band: identityBand(score, lang),
    label: isTr(lang) ? "Kimlik Netliği" : "Identity Clarity",
  };
}

const ATS_KEYWORD_LIBRARY = [
  { label: "AI", variants: ["ai", "artificial intelligence", "yapay zeka", "yapay zekâ"] },
  { label: "SQL", variants: ["sql"] },
  { label: "Python", variants: ["python"] },
  { label: "Power BI", variants: ["power bi", "powerbi"] },
  { label: "Tableau", variants: ["tableau"] },
  { label: "Looker", variants: ["looker"] },
  { label: "Azure", variants: ["azure"] },
  { label: "AWS", variants: ["aws", "amazon web services"] },
  { label: "LLM", variants: ["llm", "large language model", "large language models"] },
  { label: "RAG", variants: ["rag", "retrieval augmented generation"] },
  { label: "CRM", variants: ["crm", "salesforce", "hubspot"] },
  { label: "GTM", variants: ["gtm", "go to market", "go-to-market"] },
  { label: "Roadmap", variants: ["roadmap", "yol haritasi", "yol haritası"] },
  { label: "Backlog", variants: ["backlog"] },
  { label: "PRD", variants: ["prd", "product requirements document"] },
  { label: "Stakeholder", variants: ["stakeholder", "paydas", "paydaş"] },
  { label: "Prioritization", variants: ["prioritization", "onceliklendirme", "önceliklendirme"] },
  { label: "Product Metrics", variants: ["product metrics", "product metric", "urun metrik", "ürün metrik"] },
  { label: "Release Planning", variants: ["release planning", "surum planlama", "sürüm planlama"] },
  { label: "Analytics", variants: ["analytics", "analitik"] },
  { label: "Reporting", variants: ["reporting", "raporlama"] },
  { label: "Dashboard", variants: ["dashboard", "gosterge paneli", "gösterge paneli"] },
  { label: "Product Strategy", variants: ["product strategy", "urun stratejisi", "ürün stratejisi"] },
  { label: "Product Management", variants: ["product management", "urun yonetimi", "ürün yönetimi"] },
  { label: "User Research", variants: ["user research", "ux research", "kullanici arastirma", "kullanıcı araştırma"] },
  { label: "Product Discovery", variants: ["product discovery", "ürün keşfi", "urun kesfi", "discovery"] },
  { label: "User Feedback", variants: ["user feedback", "kullanici geri bildirimi", "kullanıcı geri bildirimi"] },
  { label: "Stakeholder Management", variants: ["stakeholder management", "paydas yonetimi", "paydaş yönetimi"] },
  { label: "KPI", variants: ["kpi", "metric", "metrics", "metrik"] },
  { label: "Market Analysis", variants: ["market analysis", "pazar analizi"] },
  { label: "Competitive Analysis", variants: ["competitive analysis", "rakip analizi"] },
  { label: "Positioning", variants: ["positioning", "konumlandirma", "konumlandırma"] },
  { label: "Customer Segmentation", variants: ["customer segmentation", "musteri segmentasyonu", "müşteri segmentasyonu"] },
  { label: "Pricing", variants: ["pricing", "fiyatlandirma", "fiyatlandırma"] },
  { label: "Business Case", variants: ["business case", "is vakasi", "iş vakası"] },
  { label: "Funnel", variants: ["funnel", "huni"] },
  { label: "Activation", variants: ["activation", "aktivasyon"] },
  { label: "Retention", variants: ["retention", "elde tutma"] },
  { label: "Acquisition", variants: ["acquisition", "edinim"] },
  { label: "Conversion", variants: ["conversion", "donusum", "dönüşüm"] },
  { label: "Lifecycle", variants: ["lifecycle", "yasam dongusu", "yaşam döngüsü"] },
  { label: "Campaign", variants: ["campaign", "kampanya"] },
  { label: "Experimentation", variants: ["experimentation", "experiment", "deney"] },
  { label: "Requirements", variants: ["requirements", "requirement", "gereksinim"] },
  { label: "Process Mapping", variants: ["process mapping", "surec haritalama", "süreç haritalama"] },
  { label: "Workflow", variants: ["workflow", "is akisi", "iş akışı"] },
  { label: "Documentation", variants: ["documentation", "dokumantasyon", "dokümantasyon"] },
  { label: "Data Analysis", variants: ["data analysis", "veri analizi"] },
  { label: "Visualization", variants: ["visualization", "gorsellestirme", "görselleştirme"] },
  { label: "Financial Analysis", variants: ["financial analysis", "finansal analiz"] },
  { label: "Excel", variants: ["excel"] },
  { label: "Jira", variants: ["jira"] },
  { label: "Agile", variants: ["agile", "scrum", "cevik", "çevik"] },
  { label: "Market Research", variants: ["market research", "pazar arastirmasi", "pazar araştırması"] },
  { label: "Depot Operations", variants: ["depo operasyonlari", "depo operasyonları", "warehouse operations"] },
  { label: "Logistics Operations", variants: ["lojistik operasyonlari", "lojistik operasyonları", "logistics operations"] },
  { label: "Road Transportation", variants: ["kara tasimaciligi", "kara taşımacılığı", "road transportation"] },
  { label: "Air Freight", variants: ["hava tasimaciligi", "hava taşımacılığı", "air freight"] },
  { label: "Sea Freight", variants: ["deniz tasimaciligi", "deniz taşımacılığı", "sea freight"] },
  { label: "Supply Chain", variants: ["supply chain", "tedarik zinciri"] },
  { label: "Procurement", variants: ["procurement", "satinalma", "satınalma", "satın alma"] },
  { label: "Inventory", variants: ["inventory", "envanter", "stok"] },
  { label: "Route Planning", variants: ["route planning", "rota planlama"] },
];

const ATS_INTENT_KEYWORDS = {
  "Product Management": ["AI", "Product Management", "Roadmap", "Backlog", "PRD", "User Research", "Product Discovery", "Stakeholder", "Stakeholder Management", "Prioritization", "Product Metrics", "KPI", "Release Planning", "User Feedback"],
  "Product Strategy": ["Product Strategy", "Market Analysis", "Competitive Analysis", "Positioning", "Customer Segmentation", "Pricing", "GTM", "Business Case", "Prioritization", "KPI"],
  "Growth / GTM": ["Funnel", "Activation", "Retention", "Acquisition", "Conversion", "CRM", "Lifecycle", "Campaign", "KPI", "Experimentation", "GTM"],
  "Business Operations": ["Process Mapping", "Workflow", "Stakeholder", "Reporting", "Dashboard", "KPI", "Documentation", "Excel"],
  "Business Analysis": ["Requirements", "Process Mapping", "Workflow", "Reporting", "Dashboard", "SQL", "Excel", "Power BI", "Stakeholder", "Documentation"],
  "Data / Analytics": ["SQL", "Python", "Dashboard", "Data Analysis", "Visualization", "Reporting", "Power BI", "Tableau", "KPI", "Analytics"],
  "AI Product / AI Operations": ["AI", "LLM", "RAG", "Workflow", "Product Management", "Roadmap", "User Feedback", "KPI", "Analytics", "Azure"],
  Finance: ["Financial Analysis", "Excel", "KPI", "Reporting", "Dashboard", "Data Analysis"],
  Marketing: ["Campaign", "Acquisition", "Conversion", "CRM", "Analytics", "KPI", "Market Research", "Customer Segmentation"],
  Sales: ["CRM", "Acquisition", "Conversion", "GTM", "Customer Segmentation", "KPI"],
  "Software / Engineering": ["Python", "SQL", "AWS", "Azure", "RAG", "LLM", "Agile", "Jira"],
  "Supply Chain / Logistics": ["Depot Operations", "Logistics Operations", "Road Transportation", "Air Freight", "Sea Freight", "Supply Chain", "Procurement", "Inventory", "Route Planning", "Dashboard", "Excel", "KPI"],
  "General Business": ["Excel", "Reporting", "Dashboard", "Stakeholder", "KPI", "Process Mapping", "Market Research"],
};

/** Company-domain terms — never surface for non-logistics role intent. */
const LOGISTICS_ATS_LABELS = new Set([
  "Depot Operations",
  "Logistics Operations",
  "Road Transportation",
  "Air Freight",
  "Sea Freight",
  "Supply Chain",
  "Procurement",
  "Inventory",
  "Route Planning",
]);

const ATS_GENERIC_KEYWORDS = new Set([
  "team",
  "good",
  "work",
  "responsible",
  "experience",
  "candidate",
  "ability",
  "strong",
  "excellent",
  "communication",
  "collaboration",
  "skills",
  "business",
  "company",
  "role",
  "position",
  "project",
  "management",
  "operations",
  "calisma",
  "çalışma",
  "deneyim",
  "sorumlu",
  "ekip",
  "iyi",
]);

function normalizeAtsToken(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^\p{L}\p{N}+#.\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCleanAtsKeyword(keyword) {
  const normalized = normalizeAtsToken(keyword);
  if (!normalized || normalized.length < 2 || normalized.length > 34) return false;
  if (normalized.split(/\s+/).length > 3) return false;
  if (ATS_GENERIC_KEYWORDS.has(normalized)) return false;
  if (/responsible for|experience in|contribute to|creation and|management processes/i.test(String(keyword || ""))) return false;
  return !/^(and|or|with|for|the|bir|ve|ile|icin|için)$/.test(normalized);
}

function dedupeAtsKeywords(items, limit = 12) {
  const out = [];
  const seen = new Set();
  for (const raw of items || []) {
    const label = cleanToken(raw);
    const key = normalizeAtsToken(label);
    if (!isCleanAtsKeyword(label) || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= limit) break;
  }
  return out;
}

function keywordVariants(keyword) {
  const raw = String(keyword || "");
  const entry = ATS_KEYWORD_LIBRARY.find((item) => item.label.toLowerCase() === raw.toLowerCase());
  return entry ? [entry.label, ...entry.variants] : [raw];
}

function keywordExistsInText(keyword, text) {
  const hay = normalizeAtsToken(text);
  return keywordVariants(keyword).some((variant) => {
    const token = normalizeAtsToken(variant);
    if (!token) return false;
    return new RegExp(`(^|\\s)${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`, "i").test(hay);
  });
}

function canonicalAtsKeyword(raw) {
  const normalized = normalizeAtsToken(raw);
  if (!isCleanAtsKeyword(raw)) return "";
  const entry = ATS_KEYWORD_LIBRARY.find((item) =>
    normalizeAtsToken(item.label) === normalized ||
    item.variants.some((variant) => normalizeAtsToken(variant) === normalized)
  );
  return entry?.label || cleanToken(raw);
}

function classifyAtsRoleIntent(jdText) {
  const jd = String(jdText || "");
  if (/product strategy|ürün stratejisi|urun stratejisi/i.test(jd)) return "Product Strategy";
  if (/product manager|product owner|ürün yönetic|urun yonetic|product management|\bpm\b/i.test(jd)) {
    return "Product Management";
  }
  if (/supply chain|logistics specialist|lojistik uzman|warehouse specialist|transportation specialist/i.test(jd)) {
    return "Supply Chain / Logistics";
  }
  const scores = {
    "Product Management": countPatternHits(jd, [/product manager|product owner|ürün yönetic|urun yonetic|product management|\bpm\b/i, /roadmap|backlog|prd|user research|user feedback|stakeholder|prioritization/i]),
    "Product Strategy": countPatternHits(jd, [/product strategy|ürün stratejisi|urun stratejisi/i, /market analysis|competitive|positioning|pricing|business case|customer segmentation|gtm/i]),
    "Growth / GTM": countPatternHits(jd, [/growth|gtm|go[-\s]?to[-\s]?market|acquisition|activation|retention|conversion|funnel|lifecycle/i]),
    "Business Operations": countPatternHits(jd, [/business operations|operations manager|operasyon|process improvement|workflow|coordination/i]),
    "Business Analysis": countPatternHits(jd, [/business analyst|iş analisti|is analisti|requirements|process mapping|documentation/i]),
    "Data / Analytics": countPatternHits(jd, [/data analyst|analytics|sql|python|dashboard|power\s?bi|tableau|visualization|reporting/i]),
    "AI Product / AI Operations": countPatternHits(jd, [/ai product|ai operations|llm|rag|workflow automation|yapay zeka/i]),
    Finance: countPatternHits(jd, [/finance|financial|budget|accounting|investment|valuation|finans/i]),
    Marketing: countPatternHits(jd, [/marketing|campaign|seo|content|brand|pazarlama/i]),
    Sales: countPatternHits(jd, [/sales|crm|pipeline|lead generation|business development|satış|satis/i]),
    "Software / Engineering": countPatternHits(jd, [/software engineer|developer|frontend|backend|full stack|react|node|api|python|java|typescript/i]),
    "Supply Chain / Logistics": countPatternHits(jd, [
      /supply chain|logistics|lojistik/i,
      /depo|warehouse|procurement|inventory|shipment|route planning/i,
      /kara taşımacılığı|hava taşımacılığı|deniz taşımacılığı|road transportation|air freight|sea freight/i,
    ]),
  };
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[1] > 0 ? ranked[0][0] : "General Business";
}

function resolveCareerNarrativeAxis(jdText, identityEngine, lang) {
  const tr = isTr(lang);
  const jdIntent = classifyAtsRoleIntent(jdText);
  const posting = inferPostingRoleFamily(jdText, lang);
  const primaryId = identityEngine?.primaryIdentity?.id || "";
  const productPosting = /product|ürün|urun/i.test(`${jdText || ""} ${posting}`);
  const logisticsRolePosting = /supply chain|logistics|lojistik|depo|warehouse|freight|taşımacılık|tasimacilik/i.test(String(jdText || ""));

  if (logisticsRolePosting && !productPosting && primaryId !== "FounderBuilder" && primaryId !== "Product") {
    return {
      roleIntent: "Supply Chain / Logistics",
      narrativeLabel: tr ? "Lojistik / tedarik zinciri" : "Supply chain / logistics",
      source: "posting",
    };
  }

  if (primaryId === "FounderBuilder" && productPosting) {
    return {
      roleIntent: /product strategy|ürün stratejisi|urun stratejisi/i.test(String(jdText || ""))
        ? "Product Strategy"
        : "Product Management",
      narrativeLabel: tr ? "Product Builder" : "Product Builder",
      source: "identity",
    };
  }

  if (primaryId === "Product" || productPosting) {
    return {
      roleIntent: /product strategy|ürün stratejisi|urun stratejisi/i.test(String(jdText || ""))
        ? "Product Strategy"
        : "Product Management",
      narrativeLabel: tr ? "Ürün" : "Product",
      source: primaryId === "Product" ? "identity" : "posting",
    };
  }

  if (jdIntent === "Supply Chain / Logistics" && (productPosting || primaryId === "FounderBuilder")) {
    return {
      roleIntent: "Product Management",
      narrativeLabel: tr ? "Product Builder" : "Product Builder",
      source: "identity_override",
    };
  }

  if (primaryId === "Strategy") {
    return {
      roleIntent: jdIntent === "Growth / GTM" ? "Growth / GTM" : "Product Strategy",
      narrativeLabel: identityEngine?.primaryIdentity?.label || (tr ? "Strateji" : "Strategy"),
      source: "identity",
    };
  }

  return {
    roleIntent: jdIntent,
    narrativeLabel: identityEngine?.primaryIdentity?.label || posting,
    source: "jd",
  };
}

function stripLogisticsAtsKeywords(keywords, roleIntent) {
  if (roleIntent === "Supply Chain / Logistics") return keywords;
  return (keywords || []).filter((kw) => !LOGISTICS_ATS_LABELS.has(kw));
}

function allowedAtsKeywordsForIntent(intent) {
  return new Set(ATS_INTENT_KEYWORDS[intent] || ATS_INTENT_KEYWORDS["General Business"]);
}

function filterKeywordsForIntent(items, intent, limit = 12) {
  const allowed = allowedAtsKeywordsForIntent(intent);
  return dedupeAtsKeywords(
    (items || [])
      .map(canonicalAtsKeyword)
      .filter((keyword) => keyword && allowed.has(keyword)),
    limit
  );
}

function extractAtsKeywordsFromJd(jdText, modelTop = [], intent = classifyAtsRoleIntent(jdText)) {
  const jd = String(jdText || "");
  const allowed = allowedAtsKeywordsForIntent(intent);
  const hits = [];
  for (const item of ATS_KEYWORD_LIBRARY) {
    if (!allowed.has(item.label)) continue;
    if (item.variants.some((variant) => keywordExistsInText(variant, jd))) hits.push(item.label);
  }
  const cleanModel = filterKeywordsForIntent(modelTop, intent, 12);
  const fallback = [...allowed].filter((keyword) => keywordExistsInText(keyword, jd));
  return dedupeAtsKeywords([...hits, ...cleanModel, ...fallback], 12);
}

function atsBandLabel(type, band, lang) {
  const tr = isTr(lang);
  if (type === "risk") {
    const labels = tr
      ? { Low: "Düşük", Medium: "Orta", High: "Yüksek" }
      : { Low: "Low", Medium: "Medium", High: "High" };
    return labels[band] || labels.Medium;
  }
  const labels = tr
    ? { Weak: "Zayıf", Partial: "Kısmi", Strong: "Güçlü" }
    : { Weak: "Weak", Partial: "Partial", Strong: "Strong" };
  return labels[band] || labels.Partial;
}

function atsMatchScore(atsIntelligence) {
  if (!atsIntelligence) return 58;
  const coverage = atsIntelligence.keywordCoverage || {};
  const total = Math.max(1, Number(coverage.total) || 1);
  const matched = Math.max(0, Number(coverage.matched) || 0);
  const coverageScore = Math.round((matched / total) * 100);
  const bandFloor =
    atsIntelligence.matchBand === "Strong" ? 72 :
    atsIntelligence.matchBand === "Partial" ? 48 :
    24;
  const riskPenalty =
    atsIntelligence.riskBand === "High" ? 16 :
    atsIntelligence.riskBand === "Medium" ? 7 :
    0;
  return clampScore(Math.max(bandFloor, coverageScore) - riskPenalty);
}

function buildAtsIntelligence(engineV2, analysisData, cvText, jdText, lang, identityEngine = null) {
  const tr = isTr(lang);
  const ats = engineV2?.ATS || analysisData?.ATS || analysisData?.ats || {};
  const cv = String(cvText || "");
  const jd = String(jdText || "");
  const narrative = resolveCareerNarrativeAxis(jd, identityEngine, lang);
  const roleIntent = narrative.roleIntent;
  const topKeywords = stripLogisticsAtsKeywords(
    extractAtsKeywordsFromJd(jd, ats.top_keywords || analysisData?.top_keywords || [], roleIntent),
    roleIntent
  );
  const matched = topKeywords.filter((keyword) => keywordExistsInText(keyword, cv));
  const missing = topKeywords.filter((keyword) => !keywordExistsInText(keyword, cv));
  const modelMatched = stripLogisticsAtsKeywords(
    filterKeywordsForIntent([...(ats.matched_skills || []), ...(analysisData?.matched_skills || [])], roleIntent, 12)
      .filter((keyword) => !matched.some((hit) => normalizeAtsToken(hit) === normalizeAtsToken(keyword))),
    roleIntent
  );
  const modelMissing = stripLogisticsAtsKeywords(
    filterKeywordsForIntent([...(ats.missing_keywords_hard || []), ...(ats.missing_keywords || []), ...(analysisData?.missing_skills || [])], roleIntent, 12)
      .filter((keyword) => !missing.some((hit) => normalizeAtsToken(hit) === normalizeAtsToken(keyword))),
    roleIntent
  );
  const matchedKeywords = dedupeAtsKeywords([...matched, ...modelMatched], 12);
  let missingCriticalKeywords = dedupeAtsKeywords([...missing, ...modelMissing], 5);
  if (missingCriticalKeywords.length < 3) {
    const intentFallback = [...allowedAtsKeywordsForIntent(roleIntent)]
      .filter((kw) => !keywordExistsInText(kw, cv))
      .slice(0, 5);
    missingCriticalKeywords = dedupeAtsKeywords([...missingCriticalKeywords, ...intentFallback], 5);
  }
  const displayMissingCritical = missingCriticalKeywords
    .map((kw) => formatAtsKeywordForDisplay(kw))
    .filter(Boolean)
    .slice(0, 5);
  const total = Math.max(topKeywords.length, matchedKeywords.length + missingCriticalKeywords.length, 1);
  const matchedCount = Math.min(total, matchedKeywords.length);
  const coverageRatio = matchedCount / total;
  const keywordRisk = matchedCount < 5;
  const matchBand = matchedCount >= 5 || coverageRatio >= 0.66
    ? "Strong"
    : coverageRatio >= 0.34 || matchedCount >= 3
      ? "Partial"
      : "Weak";
  const formattingRisks = dedupeAtsKeywords(ats.parsing_issues || analysisData?.parsing_issues || [], 4);
  const riskBand =
    matchBand === "Weak" || keywordRisk
      ? (formattingRisks.length >= 2 || missingCriticalKeywords.length >= 5 ? "High" : "Medium")
      : matchBand === "Partial" || formattingRisks.length
        ? "Medium"
        : "Low";
  const atsDecisionImpact =
    riskBand === "High" && matchBand === "Weak"
      ? (tr ? "ATS ilk filtreyi zorlaştırır; recruiter güveni tek başına yetmez." : "ATS makes the first filter harder; recruiter trust alone is not enough.")
      : keywordRisk
        ? (tr ? "CV'de 5+ kritik terim görünürse ATS ve recruiter eşleşmesi güçlenir." : "If 5+ critical terms are visible, ATS and recruiter matching gets stronger.")
        : (tr ? "ATS bu kararı destekliyor; ana mesele recruiter kanıtında kalıyor." : "ATS supports the decision; the main issue stays recruiter proof.");
  const visualEvidence = buildAtsVisualEvidence(
    cv,
    topKeywords,
    matchedKeywords,
    displayMissingCritical,
    identityEngine,
    lang
  );
  const foundCount = matchedKeywords.length;
  const missingCount = missingCriticalKeywords.length;
  const previewTerms = displayMissingCritical.slice(0, 3);
  const moreCount = Math.max(0, displayMissingCritical.length - 3);
  const missingTerms = displayMissingCritical.map((kw) => formatAtsKeywordForDisplay(kw)).filter(Boolean).slice(0, 5);
  const foundTerms = matchedKeywords.map((kw) => formatAtsKeywordForDisplay(kw)).filter(Boolean).slice(0, 5);
  const compact = {
    riskLabel: atsBandLabel("risk", riskBand, lang),
    scanFormat: {
      riskLabel: atsBandLabel("risk", riskBand, lang),
      foundTerms,
      missingTerms,
      helperText: tr
        ? "ATS bu terimleri ilk filtrede arayabilir."
        : "ATS may search for these terms in the first filter.",
    },
    missingOnly: {
      title: tr ? "Eksik Anahtar Kelimeler" : "Missing critical keywords",
      helperText: tr
        ? "ATS bu terimleri ilk filtrede arayabilir."
        : "ATS may search for these terms in the first filter.",
      terms: missingTerms,
    },
    foundCount,
    missingCount,
    previewTerms: missingTerms.slice(0, 3),
    moreCount: Math.max(0, missingTerms.length - 3),
    fullTerms: displayMissingCritical,
    fullFound: matchedKeywords.map((kw) => formatAtsKeywordForDisplay(kw)).filter(Boolean),
  };
  return {
    roleIntent,
    careerNarrative: narrative.narrativeLabel,
    narrativeSource: narrative.source,
    riskBand,
    riskLabel: atsBandLabel("risk", riskBand, lang),
    matchBand,
    matchLabel: atsBandLabel("match", matchBand, lang),
    matchedKeywords,
    missingCriticalKeywords,
    displayMissingCritical,
    visualEvidence,
    compact,
    keywordCoverage: {
      matched: matchedCount,
      total,
    },
    formattingRisks,
    keywordRisk,
    hiddenOnly: false,
  };
}

function scoreLabel(value, lang) {
  const tr = isTr(lang);
  const n = Number(value) || 0;
  if (n <= 35) return tr ? "Zayıf" : "Weak";
  if (n <= 65) return tr ? "Orta" : "Medium";
  return tr ? "Güçlü" : "Strong";
}

function normalizeMarketBand(value, lang) {
  const tr = isTr(lang);
  const v = String(value || "").toLowerCase();
  if (/high|yüksek|yuksel|strong/i.test(v)) return tr ? "Yüksek" : "High";
  if (/low|düşük|dusuk|weak/i.test(v)) return tr ? "Düşük" : "Low";
  return tr ? "Orta" : "Medium";
}

function estimatedLabel(text, isEstimated, lang) {
  const tr = isTr(lang);
  const t = cleanToken(text);
  if (!t) return "";
  if (!isEstimated) return t;
  return tr ? `Tahmini okuma: ${t}` : `Estimated read: ${t}`;
}

function scorecardStatusFromBand(band, lang) {
  const tr = isTr(lang);
  const b = String(band || "");
  if (b === (tr ? "Güçlü" : "Strong")) return "pass";
  if (b === (tr ? "Zayıf" : "Weak")) return "warn";
  return "neutral";
}

function buildRecruiterScorecard(decisionSignals, atsIntelligence, lang) {
  const tr = isTr(lang);
  const atsBand =
    atsIntelligence?.matchBand === "Strong"
      ? (tr ? "Güçlü" : "Strong")
      : atsIntelligence?.matchBand === "Partial"
        ? (tr ? "Orta" : "Medium")
        : (tr ? "Zayıf" : "Weak");
  const rows = [
    { key: "recruiterInterest", label: tr ? "Recruiter İlgisi" : "Recruiter Interest", band: scoreLabel(decisionSignals?.RecruiterConfidence, lang) },
    { key: "proofStrength", label: tr ? "Kanıt Gücü" : "Proof Strength", band: scoreLabel(decisionSignals?.EvidenceStrength, lang) },
    { key: "atsCompatibility", label: tr ? "ATS Uyumu" : "ATS Compatibility", band: atsBand },
    { key: "roleAlignment", label: tr ? "Rol Uyumu" : "Role Alignment", band: scoreLabel(decisionSignals?.RoleAlignment, lang) },
    { key: "storyClarity", label: tr ? "Hikaye Netliği" : "Story Clarity", band: scoreLabel(decisionSignals?.NarrativeClarity, lang) },
  ].map((row) => ({
    ...row,
    status: scorecardStatusFromBand(row.band, lang),
    icon: scorecardStatusFromBand(row.band, lang) === "pass" ? "✓" : scorecardStatusFromBand(row.band, lang) === "warn" ? "⚠" : "•",
  }));
  return { title: tr ? "Recruiter Skor Kartı" : "Recruiter Scorecard", rows };
}

function extractCvAtsFoundSignals(cvText, identityEngine, lang) {
  const tr = isTr(lang);
  const cv = String(cvText || "");
  const hits = [];
  if (/founder|kurucu|co-?founder/i.test(cv)) hits.push(tr ? "Founder" : "Founder");
  if (/startup|girişim|girisim|early[- ]stage/i.test(cv)) hits.push(tr ? "Startup" : "Startup");
  if (/product|ürün|urun/i.test(cv)) hits.push(tr ? "Product" : "Product");
  if (/\bai\b|yapay zeka|machine learning|ml\b/i.test(cv)) hits.push(tr ? "AI Product" : "AI Product");
  if (/roadmap|backlog|prd/i.test(cv)) hits.push(tr ? "Roadmap" : "Roadmap");
  if (identityEngine?.primaryIdentity?.label && hits.length < 5) {
    const label = cleanToken(identityEngine.primaryIdentity.label);
    if (label && !hits.includes(label)) hits.push(label);
  }
  return hits.slice(0, 5);
}

function buildAtsVisualEvidence(cvText, topKeywords, matchedKeywords, displayMissingCritical, identityEngine, lang) {
  const tr = isTr(lang);
  const cv = String(cvText || "");
  const foundInCv = extractCvAtsFoundSignals(cv, identityEngine, lang);
  const requiredByJob = dedupeAtsKeywords(topKeywords, 6)
    .map((kw) => formatAtsKeywordForDisplay(kw))
    .filter(Boolean)
    .slice(0, 5)
    .map((term) => ({
      term,
      met: keywordExistsInText(term, cv) || matchedKeywords.some((m) => formatAtsKeywordForDisplay(m) === term),
    }));
  const missing = (displayMissingCritical || [])
    .map((term) => ({ term: formatAtsKeywordForDisplay(term) || term }))
    .filter((x) => x.term)
    .slice(0, 5);
  return { foundInCv, requiredByJob, missing };
}

function inferCompanyProfile(jdText, roleIntent) {
  const jd = String(jdText || "").toLowerCase();
  if (/startup|seed|early[- ]stage|girişim|girisim/i.test(jd)) return "Startup";
  if (/scale[- ]?up|series [abc]|hypergrowth|unicorn/i.test(jd)) return "Scaleup";
  if (/enterprise|fortune|global|multinational|kurumsal|lojistik|logistics/i.test(jd)) return "Enterprise";
  if (/product/i.test(String(roleIntent || ""))) return "Scaleup";
  return "Enterprise";
}

function companyRewardsForProfile(profile, lang) {
  const tr = isTr(lang);
  const map = {
    Startup: [
      tr ? "Sahiplenme" : "Ownership",
      tr ? "Execution" : "Execution",
      tr ? "Belirsizlik toleransı" : "Ambiguity tolerance",
    ],
    Scaleup: [
      tr ? "Deney" : "Experimentation",
      tr ? "Büyüme" : "Growth",
      tr ? "Önceliklendirme" : "Prioritization",
    ],
    Enterprise: [
      tr ? "Süreç" : "Process",
      tr ? "Paydaş yönetimi" : "Stakeholder management",
      tr ? "Dokümantasyon" : "Documentation",
    ],
  };
  return map[profile] || map.Scaleup;
}

function extractFixBeforeSnippet(cvText, fixId, cognition, lang) {
  const tr = isTr(lang);
  const units = splitEvidenceUnits(cvText).filter((u) => u.length > 12);
  if (fixId === "ats-role-language") {
    return evidenceDisplay(units.find((u) => u.length < 140) || units[0] || (tr ? "Özet satırı ilan dilini taşımıyor." : "Summary line does not mirror posting language."));
  }
  if (fixId === "product-ownership") {
    return evidenceDisplay(cognition?.signals?.ownership?.evidence || units[0] || (tr ? "Ürün sahipliği cümlesi zayıf." : "Product ownership line is weak."));
  }
  if (fixId === "proof-gap") {
    return evidenceDisplay(cognition?.signals?.executionProof?.evidence || units[0] || (tr ? "Somut çıktı görünmüyor." : "No concrete output visible."));
  }
  return evidenceDisplay(units[0] || (tr ? "İlk ekran mesajı zayıf." : "First-screen message is weak."));
}

function buildWhyItMatters(fixId, primaryLimiter, lang) {
  const tr = isTr(lang);
  const map = {
    "ats-role-language": tr
      ? "İlanın beklediği terimler ilk filtrede görünmüyor."
      : "Posting terms may not survive the first filter.",
    "product-ownership": tr
      ? "Recruiter ürün rolünde sahiplenme kanıtı arar."
      : "Recruiters look for ownership proof in product roles.",
    "proof-gap": tr
      ? "İlk 10 saniyede savunulabilir kanıt yoksa güven oluşmaz."
      : "Without defensible proof in 10 seconds, trust does not form.",
    "role-bridge": tr
      ? "Rol geçişi ilk okumada yavaşsa shortlist dışı kalırsın."
      : "If the role transition reads slowly, you miss the shortlist.",
    "expected-lift": tr
      ? "Ana sinyal zayıf bantta kaldığı sürece karar riskli kalır."
      : "While the main signal stays weak, the decision stays risky.",
  };
  return applyForbiddenGuard(map[fixId] || map["proof-gap"], lang);
}

function roleFastestImprovement(role, missingProof, atsIntelligence, lang) {
  const tr = isTr(lang);
  const term = (atsIntelligence?.displayMissingCritical || [])[0];
  if (term) {
    const label = formatAtsKeywordForDisplay(term) || term;
    return tr ? `${label} sahipliği örneği ekle.` : `Add a ${label} ownership example.`;
  }
  const firstGap = String(missingProof || "").split(/[,;]/)[0]?.trim();
  if (firstGap && firstGap.length < 80) {
    return tr ? `${firstGap} kanıtını tek satıra taşı.` : `Move ${firstGap} proof into one line.`;
  }
  return tr ? "En güçlü çıktıyı özetin üstüne taşı." : "Move your strongest output to the top of the summary.";
}

function buildDecisionSignals(cognition, score, identityClarity = null, atsIntelligence = null) {
  const signals = cognition.signals;
  const interview = cognition.interviewProbability || {};
  const hierarchy = cognition.signalHierarchy || {};
  const recruiterConfidence = clampScore(interview.recruiterConfidence ?? cognition.eliteTrustCalibration?.conviction ?? score);
  const evidenceStrength = clampScore(
    (interview.proofStrength ?? 0) * 0.45 +
      (hierarchy.proofScore ?? signals.trustEvidence.score) * 0.25 +
      signals.executionProof.score * 0.15 +
      signals.scaleProof.score * 0.15
  );
  const roleAlignment = clampScore(
    (interview.businessFit ?? 0) * 0.42 +
      signals.roleBridge.score * 0.28 +
      signals.corporateReadiness.score * 0.12 +
      signals.builderFit.score * 0.1 +
      (Number(score) || 0) * 0.08
  );
  const narrativeClarity = clampScore(
    signals.firstScreenClarity.score * 0.42 +
      signals.narrativeCoherence.score * 0.38 +
      signals.roleBridge.score * 0.2
  );
  return {
    RecruiterConfidence: recruiterConfidence,
    EvidenceStrength: evidenceStrength,
    RoleAlignment: roleAlignment,
    NarrativeClarity: narrativeClarity,
    IdentityClarity: identityClarity?.score ?? narrativeClarity,
    ATSMatch: atsMatchScore(atsIntelligence),
  };
}

function applyVerdictHierarchy(decisionSignals, proofGap, lang, atsIntelligence = null) {
  const tr = isTr(lang);
  const minSignal = Math.min(
    decisionSignals.RecruiterConfidence,
    decisionSignals.EvidenceStrength,
    decisionSignals.RoleAlignment,
    decisionSignals.NarrativeClarity,
    decisionSignals.IdentityClarity ?? decisionSignals.NarrativeClarity,
    decisionSignals.ATSMatch ?? decisionSignals.RoleAlignment
  );
  const avgSignal = Math.round(
    (decisionSignals.RecruiterConfidence +
      decisionSignals.EvidenceStrength +
      decisionSignals.RoleAlignment +
      decisionSignals.NarrativeClarity +
      (decisionSignals.IdentityClarity ?? decisionSignals.NarrativeClarity) * 1.25 +
      (decisionSignals.ATSMatch ?? decisionSignals.RoleAlignment) * 0.65) / 5.9
  );
  let state =
    decisionSignals.RecruiterConfidence >= 66
      ? (minSignal > 55 && avgSignal >= 66 ? "GREEN" : "YELLOW")
      : minSignal < 36 || avgSignal < 48
        ? "RED"
        : minSignal > 55 && avgSignal >= 66
          ? "GREEN"
          : "YELLOW";
  if (atsIntelligence?.riskBand === "High" && atsIntelligence?.matchBand === "Weak" && state === "GREEN") {
    state = "YELLOW";
  }
  if (atsIntelligence?.riskBand === "High" && Number(decisionSignals.ATSMatch) < 36 && state === "GREEN") {
    state = "YELLOW";
  }
  const copy = {
    RED: {
      hero: tr ? "İlk filtre zor geçer." : "The first screen is hard.",
      verdictLabel: tr ? "Savunması zor" : "Hard to defend",
      cta: tr ? "Önce kanıt oluştur" : "Build proof first",
      secondaryCta: tr ? "Daha net role bak" : "Check a clearer lane",
      blockerHeadline: tr ? "Eksik Kanıt" : "Missing Proof",
      blockerAction: tr ? "Önce tek sert kanıt ekle." : "Add one hard proof point first.",
      noteTone: tr ? "Recruiter güveni şu an düşük." : "Recruiter trust is low right now.",
      styleScore: 45,
    },
    YELLOW: {
      hero: tr ? "Shortlist sınırında." : "Right on the shortlist line.",
      verdictLabel: tr ? "İkna eşiği" : "Persuasion edge",
      cta: tr ? "Kanıtı güçlendirip başvur" : "Strengthen proof, then apply",
      secondaryCta: tr ? "Daha net okunan role bak" : "Check the clearer lane",
      blockerHeadline: tr ? "Eksik Kanıt" : "Missing Proof",
      blockerAction: tr ? "Kanıtı tek satırda görünür yap." : "Make the proof visible in one line.",
      noteTone: tr ? "Potansiyel var; güven tam kapanmıyor." : "There is potential; trust does not fully close.",
      styleScore: 65,
    },
    GREEN: {
      hero: tr ? "Mülakat ihtimali yüksek." : "Interview odds are strong.",
      verdictLabel: tr ? "Net okunuyor" : "Clear read",
      cta: tr ? "Başvur" : "Apply",
      secondaryCta: tr ? "Alternatif rolleri karşılaştır" : "Compare adjacent lanes",
      blockerHeadline: tr ? "Son Kanıt" : "Final Proof",
      blockerAction: tr ? "En güçlü kanıtı öne taşı." : "Move the strongest proof forward.",
      noteTone: tr ? "Recruiter güveni çoğunlukla oluşuyor." : "Recruiter trust mostly forms.",
      styleScore: 82,
    },
  }[state];
  const metricLabels = [
    {
      key: "recruiterConfidence",
      label: tr ? "Recruiter Güveni" : "Recruiter Confidence",
      value: scoreLabel(decisionSignals.RecruiterConfidence, lang),
      hint: tr ? "İlk okuma güveni" : "First-read trust",
    },
    {
      key: "evidenceStrength",
      label: tr ? "Kanıt Gücü" : "Evidence Strength",
      value: scoreLabel(decisionSignals.EvidenceStrength, lang),
      hint: tr ? "CV'deki sert kanıt" : "Hard proof on the CV",
    },
    {
      key: "roleAlignment",
      label: tr ? "Rol Uyumu" : "Role Alignment",
      value: scoreLabel(decisionSignals.RoleAlignment, lang),
      hint: tr ? "İlanla bağ" : "Link to the posting",
    },
    {
      key: "identityClarity",
      label: tr ? "Kimlik Netliği" : "Identity Clarity",
      value: scoreLabel(decisionSignals.IdentityClarity ?? decisionSignals.NarrativeClarity, lang),
      hint: tr ? "Recruiter kategorisi" : "Recruiter category",
    },
    {
      key: "narrativeClarity",
      label: tr ? "Hikaye Netliği" : "Narrative Clarity",
      value: scoreLabel(decisionSignals.NarrativeClarity, lang),
      hint: tr ? "Tek bakışta anlaşılma" : "One-scan clarity",
    },
  ];
  return {
    state,
    ...copy,
    metrics: metricLabels,
    mustSurfaceProofGap: decisionSignals.EvidenceStrength < 40,
    proofGapLabel: proofGap?.missingProof || (tr ? "Kanıt" : "Proof"),
  };
}

function buildPrimaryLimiter(decisionSignals, lang) {
  const tr = isTr(lang);
  const labels = {
    ATSMatch: tr ? "ATS anahtar kelime eşleşmesi" : "ATS keyword match",
    RecruiterConfidence: tr ? "Recruiter Güveni" : "Recruiter Confidence",
    EvidenceStrength: tr ? "Kanıt Gücü" : "Evidence Strength",
    RoleAlignment: tr ? "Rol Uyumu" : "Role Alignment",
    IdentityClarity: tr ? "Kimlik Netliği" : "Identity Clarity",
    NarrativeClarity: tr ? "Hikaye Netliği" : "Narrative Clarity",
  };
  const entries = Object.entries(decisionSignals);
  const [key, value] = entries.reduce((lowest, current) => Number(current[1]) < Number(lowest[1]) ? current : lowest, entries[0]);
  return {
    key,
    label: labels[key] || (key === "IdentityClarity" ? (tr ? "Kimlik Netliği" : "Identity Clarity") : key),
    value: Number(value) || 0,
    band: scoreLabel(value, lang),
  };
}

function buildVerdictExplanation(cognition, decisionSignals, verdictHierarchy, limiter, lang, identityEngine = null, identityConflict = null) {
  const tr = isTr(lang);
  const signals = cognition.signals;
  const proofGap = cognition.proofGap;
  if (identityConflict?.hasConflict && (limiter.key === "IdentityClarity" || verdictHierarchy.state !== "GREEN")) {
    return identityConflict.identityConflict;
  }
  if (limiter.key === "IdentityClarity") {
    return tr
      ? `Recruiter ilk okumada seni ${identityEngine?.primaryIdentity?.label || "tek bir kategori"} olarak görmek istiyor; kimlik kararı gecikiyor.`
      : `The recruiter wants to place you as ${identityEngine?.primaryIdentity?.label || "one category"} on first read; the identity decision slows down.`;
  }
  if (limiter.key === "ATSMatch") {
    return tr
      ? "ATS eşleşmesi zayıf; recruiter ilgilense bile ilk filtre riski yükselir."
      : "ATS match is weak; even with recruiter interest, first-filter risk rises.";
  }
  if (verdictHierarchy.state === "GREEN" && limiter.value >= 66) {
    return tr
      ? "Recruiter güveni oluşmuş durumda; kanıtlar hedef role yeterince hızlı bağlanıyor."
      : "Recruiter trust is mostly formed; the proof connects to the role fast enough.";
  }
  if (limiter.key === "EvidenceStrength") {
    if (signals.ownership.level !== "weak" && signals.scaleProof.level === "weak") {
      return tr
        ? "Güçlü sahiplenme var ancak kurumsal ölçekte tekrar edilebilir sonuç görünmüyor."
        : "Ownership is visible, but repeatable scale proof is not.";
    }
    return tr
      ? `${proofGap.missingProof} zayıf kaldığı için recruiter güveni tam kapanmıyor.`
      : `${proofGap.missingProof} is thin, so recruiter trust does not fully close.`;
  }
  if (limiter.key === "RoleAlignment") {
    return tr
      ? "Recruiter güveni oluşuyor ancak hedef rol ile profil arasındaki bağ tam net değil."
      : "Recruiter trust is forming, but the profile-to-role link is not fully clear.";
  }
  if (limiter.key === "NarrativeClarity") {
    return tr
      ? "Deneyim var ancak başlık, özet ve projeler tek kariyer hikayesine bağlanmıyor."
      : "The experience exists, but title, summary, and projects do not tell one career story.";
  }
  return tr
    ? "Recruiter ilgilenir ancak ilk tur kararı için daha sert kanıt bekler."
    : "The recruiter may care, but needs harder proof for a first-round decision.";
}

function buildProgressionPreview(limiter, lang) {
  const tr = isTr(lang);
  if (limiter.key === "EvidenceStrength") {
    return tr
      ? "Bu değişiklik Kanıt Gücü sinyalini yükseltir ve profilin savunulabilirliğini artırır."
      : "This raises Evidence Strength and makes the profile easier to defend.";
  }
  if (limiter.key === "RoleAlignment") {
    return tr
      ? "Bu değişiklik Rol Uyumu sinyalini yükseltir ve recruiter tarafında ilk tur güvenini artırır."
      : "This raises Role Alignment and increases first-screen recruiter trust.";
  }
  if (limiter.key === "NarrativeClarity") {
    return tr
      ? "Bu değişiklik Hikaye Netliği sinyalini yükseltir ve recruiter'ın seni daha hızlı konumlandırmasını sağlar."
      : "This raises Narrative Clarity and helps the recruiter place you faster.";
  }
  if (limiter.key === "IdentityClarity") {
    return tr
      ? "Bu değişiklik Kimlik Netliği sinyalini yükseltir ve recruiter'ın seni daha hızlı kategoriye koymasını sağlar."
      : "This raises Identity Clarity and helps the recruiter categorize you faster.";
  }
  if (limiter.key === "ATSMatch") {
    return tr
      ? "Bu değişiklik ATS eşleşmesini yükseltir ve ilk filtrenin gereksiz riskini azaltır."
      : "This raises ATS match and lowers unnecessary first-filter risk.";
  }
  return tr
    ? "Bu değişiklik Recruiter Güveni sinyalini yükseltir ve ilk okuma riskini azaltır."
    : "This raises Recruiter Confidence and lowers first-read risk.";
}

function buildBeforeAfterStatePreview(decisionSignals, limiter, verdictHierarchy, progressionPreview, identityEngine = null, identityClarity = null, atsIntelligence = null) {
  const liftedSignals = { ...decisionSignals };
  liftedSignals[limiter.key] = clampScore(Number(liftedSignals[limiter.key]) + 14);
  return {
    beforeState: {
      verdictState: verdictHierarchy.state,
      primaryLimiter: limiter.key,
      signals: decisionSignals,
      identity: identityEngine ? {
        primaryIdentity: identityEngine.primaryIdentity,
        identityClarity,
      } : null,
      atsIntelligence,
    },
    afterStatePreview: {
      changedSignal: limiter.key,
      expectedEffect: progressionPreview,
      signalsPreview: liftedSignals,
      rendered: false,
    },
  };
}

function buildIdentityVerdictLine(identityEngine, identityConflict, verdictExplanation, lang) {
  const tr = isTr(lang);
  if (identityConflict?.hasConflict && identityConflict.identityConflict) return identityConflict.identityConflict;
  const label = identityEngine?.primaryIdentity?.label || (tr ? "tek bir kimlik" : "one identity");
  const reason = String(verdictExplanation || "").replace(/[.!?]\s*$/, "");
  return tr
    ? `Recruiter seni ilk okumada ${label} olarak görüyor; ${reason.charAt(0).toLowerCase()}${reason.slice(1)}.`
    : `The recruiter first reads you as ${label}; ${reason.charAt(0).toLowerCase()}${reason.slice(1)}.`;
}

function bandRank(value, lang) {
  const label = scoreLabel(value, lang);
  if (/zay|weak/i.test(label)) return 0;
  if (/orta|medium/i.test(label)) return 1;
  return 2;
}

function signalBandFromLabel(label) {
  if (/zay|weak/i.test(String(label || ""))) return 0;
  if (/orta|medium/i.test(String(label || ""))) return 1;
  return 2;
}

function expectedImpactLift(limiter) {
  if (limiter.value <= 35) return 32;
  if (limiter.value <= 65) return 22;
  return 10;
}

function verdictRank(state) {
  if (state === "GREEN") return 2;
  if (state === "YELLOW") return 1;
  return 0;
}

function buildExpectedImpactEngine(decisionSignals, limiter, verdictHierarchy, lang, atsIntelligence = null) {
  const tr = isTr(lang);
  const previewSignals = { ...decisionSignals };
  const lift = expectedImpactLift(limiter);
  previewSignals[limiter.key] = clampScore(Number(previewSignals[limiter.key]) + lift);
  if (limiter.key === "NarrativeClarity") {
    previewSignals.RoleAlignment = clampScore(Number(previewSignals.RoleAlignment) + 12);
  } else if (limiter.key === "RoleAlignment") {
    previewSignals.NarrativeClarity = clampScore(Number(previewSignals.NarrativeClarity) + 8);
  } else if (limiter.key === "EvidenceStrength") {
    previewSignals.RecruiterConfidence = clampScore(Number(previewSignals.RecruiterConfidence) + 8);
  } else if (limiter.key === "RecruiterConfidence") {
    previewSignals.EvidenceStrength = clampScore(Number(previewSignals.EvidenceStrength) + 6);
  } else if (limiter.key === "IdentityClarity") {
    previewSignals.NarrativeClarity = clampScore(Number(previewSignals.NarrativeClarity) + 8);
    previewSignals.RoleAlignment = clampScore(Number(previewSignals.RoleAlignment) + 8);
  } else if (limiter.key === "ATSMatch") {
    previewSignals.RoleAlignment = clampScore(Number(previewSignals.RoleAlignment) + 8);
  }
  const previewAts = atsIntelligence ? {
    ...atsIntelligence,
    riskBand: atsIntelligence.riskBand === "High" ? "Medium" : atsIntelligence.riskBand,
    riskLabel: atsBandLabel("risk", atsIntelligence.riskBand === "High" ? "Medium" : atsIntelligence.riskBand, lang),
    matchBand: atsIntelligence.matchBand === "Weak" ? "Partial" : atsIntelligence.matchBand,
    matchLabel: atsBandLabel("match", atsIntelligence.matchBand === "Weak" ? "Partial" : atsIntelligence.matchBand, lang),
  } : null;
  const previewHierarchy = applyVerdictHierarchy(previewSignals, null, lang, previewAts);
  const labelMap = {
    ATSMatch: tr ? "ATS anahtar kelime eşleşmesi" : "ATS keyword match",
    RecruiterConfidence: tr ? "Recruiter Güveni" : "Recruiter Confidence",
    EvidenceStrength: tr ? "Kanıt Gücü" : "Evidence Strength",
    RoleAlignment: tr ? "Rol Uyumu" : "Role Alignment",
    IdentityClarity: tr ? "Kimlik Netliği" : "Identity Clarity",
    NarrativeClarity: tr ? "Hikaye Netliği" : "Narrative Clarity",
  };
  const affectedKeys = [
    limiter.key,
    ...(limiter.key === "NarrativeClarity" ? ["RoleAlignment"] : []),
    ...(limiter.key === "RoleAlignment" ? ["NarrativeClarity"] : []),
    ...(limiter.key === "EvidenceStrength" ? ["RecruiterConfidence"] : []),
    ...(limiter.key === "RecruiterConfidence" ? ["EvidenceStrength"] : []),
    ...(limiter.key === "IdentityClarity" ? ["NarrativeClarity", "RoleAlignment"] : []),
    ...(limiter.key === "ATSMatch" ? ["RoleAlignment"] : []),
  ];
  const affectedSignals = [...new Set(affectedKeys)].map((key) => ({
    key,
    label: labelMap[key],
    current: scoreLabel(decisionSignals[key], lang),
    expected: scoreLabel(previewSignals[key], lang),
    changesBand: bandRank(previewSignals[key], lang) > bandRank(decisionSignals[key], lang),
  }));
  const verdictMayChange = verdictRank(previewHierarchy.state) > verdictRank(verdictHierarchy.state);
  const changedBands = affectedSignals.filter((row) => row.changesBand).length;
  const displaySignals = affectedSignals.filter((row) => row.changesBand);
  const expectedGains = [
    { key: "ATSMatch", label: "ATS Match" },
    { key: "RecruiterConfidence", label: tr ? "Recruiter Trust" : "Recruiter Trust" },
    { key: "RoleAlignment", label: tr ? "Role Alignment" : "Role Alignment" },
  ].map((row) => ({
    ...row,
    current: Math.round(Number(decisionSignals[row.key]) || 0),
    expected: Math.round(Number(previewSignals[row.key]) || 0),
    gain: Math.max(0, Math.round((Number(previewSignals[row.key]) || 0) - (Number(decisionSignals[row.key]) || 0))),
  }));
  const impactLevel = verdictMayChange || changedBands >= 2
    ? (tr ? "Yüksek Etki" : "High Impact")
    : changedBands === 1
      ? (tr ? "Orta Etki" : "Medium Impact")
      : (tr ? "Küçük Etki" : "Small Impact");
  const interviewBefore =
    verdictHierarchy.state === "GREEN"
      ? (tr ? "Yüksek" : "High")
      : verdictHierarchy.state === "YELLOW"
        ? (tr ? "Orta" : "Medium")
        : (tr ? "Düşük" : "Low");
  const interviewAfter =
    previewHierarchy.state === "GREEN"
      ? (tr ? "Yüksek" : "High")
      : previewHierarchy.state === "YELLOW"
        ? (tr ? "Orta" : "Medium")
        : (tr ? "Düşük" : "Low");
  const outcomeRows = [
    {
      key: "ats",
      label: "ATS",
      current: atsIntelligence?.matchLabel || scoreLabel(decisionSignals.ATSMatch, lang),
      expected: previewAts?.matchLabel || scoreLabel(previewSignals.ATSMatch, lang),
      improves: Boolean(previewAts && previewAts.matchBand !== atsIntelligence?.matchBand),
    },
    {
      key: "roleMatch",
      label: tr ? "Rol uyumu" : "Role match",
      current: scoreLabel(decisionSignals.RoleAlignment, lang),
      expected: scoreLabel(previewSignals.RoleAlignment, lang),
      improves: bandRank(previewSignals.RoleAlignment, lang) > bandRank(decisionSignals.RoleAlignment, lang),
    },
    {
      key: "interview",
      label: tr ? "Mülakat ihtimali" : "Interview probability",
      current: interviewBefore,
      expected: interviewAfter,
      improves: verdictRank(previewHierarchy.state) > verdictRank(verdictHierarchy.state),
    },
  ].filter((row) => row.current || row.expected);
  return {
    affectedSignal: limiter.key,
    lift,
    affectedSignals,
    displaySignals,
    outcomeRows,
    impactLevel,
    reason: tr
      ? "Bu değişiklik ana sınırlayıcıyı hedefliyor."
      : "This change targets the primary limiter.",
    verdictMayChange,
    currentVerdict: verdictHierarchy.hero,
    expectedVerdict: previewHierarchy.hero,
    expectedResult: verdictMayChange
      ? (tr ? `${verdictHierarchy.hero} → ${previewHierarchy.hero}` : `${verdictHierarchy.hero} → ${previewHierarchy.hero}`)
      : (tr ? "Mülakat ihtimali artar." : "Interview odds rise."),
    expectedGains,
    previewSignals,
    previewVerdictState: previewHierarchy.state,
    hiddenOnly: false,
  };
}

function buildExpectedIdentityImpact(identityEngine, identityClarity, expectedImpact, limiter, lang) {
  const tr = isTr(lang);
  const expectedClarityScore = expectedImpact.previewSignals?.IdentityClarity ?? identityClarity.score;
  const currentBand = identityClarity.band;
  const expectedBand = identityBand(expectedClarityScore, lang);
  const changesClarity = signalBandFromLabel(expectedBand) > signalBandFromLabel(currentBand);
  const primary = identityEngine.primaryIdentity;
  const secondary = identityEngine.secondaryIdentity;
  const expectedPrimary =
    (primary?.id === "FounderBuilder" && secondary?.id === "Product") ||
    (primary?.id === "Product" && secondary?.id === "FounderBuilder")
      ? { id: "ProductBuilder", label: tr ? "Product Builder" : "Product Builder", band: expectedBand }
      : primary;
  return {
    before: {
      primaryIdentity: primary,
      identityClarity,
    },
    after: {
      primaryIdentity: expectedPrimary,
      identityClarity: {
        score: expectedClarityScore,
        band: expectedBand,
        label: identityClarity.label,
      },
    },
    changes: changesClarity,
  };
}

/**
 * @typedef {object} CompanyIntelligenceModel
 * @property {boolean} dataAvailable
 * @property {boolean} architectureReady
 * @property {string|null} companyGrowthSignal
 * @property {string|null} hiringActivity
 * @property {string[]|null} departmentGrowth
 * @property {string|null} businessExpansion
 * @property {string|null} hiringPriority
 * @property {number|null} growthConfidence
 */

/**
 * @typedef {object} MarketIntelligenceModel
 * @property {boolean} dataAvailable
 * @property {boolean} architectureReady
 * @property {string|null} marketDemand
 * @property {string|null} roleCompetition
 * @property {string|null} salaryRange
 * @property {string[]|null} skillTrend
 * @property {string|null} careerTrend
 * @property {number|null} marketConfidence
 */

function buildCompanyIntelligence(engineV2, analysisData, jdText, roleIntent, lang) {
  const tr = isTr(lang);
  const company = engineV2?.Company || engineV2?.company_intel || analysisData?.company || {};
  const jd = String(jdText || "");
  const hasData = Boolean(
    company?.name ||
    company?.growth_signals?.length ||
    company?.hiring_activity ||
    company?.expansion_signals?.length
  );
  const companyName = cleanToken(company?.name || extractCompanyNameFromJd(jd) || "");
  const productRole = /product/i.test(String(roleIntent || ""));
  const logisticsJd = /logistics|lojistik|supply chain|depo|warehouse|freight/i.test(jd) && !productRole;
  const companyProfile = inferCompanyProfile(jd, roleIntent);
  const profileLabels = {
    Startup: tr ? "Startup" : "Startup",
    Scaleup: tr ? "Scaleup" : "Scaleup",
    Enterprise: tr ? "Enterprise" : "Enterprise",
  };
  const growthByProfile = {
    Startup: tr ? "Hızlı" : "Fast",
    Scaleup: tr ? "Hızlı" : "Fast",
    Enterprise: tr ? "Orta" : "Medium",
  };
  const hiringStyleByProfile = {
    Startup: tr ? "Hızlı karar, az süreç" : "Fast decisions, lean process",
    Scaleup: tr ? "Deney + ölçek" : "Experimentation at scale",
    Enterprise: tr ? "Süreç ve paydaş hizası" : "Process and stakeholder alignment",
  };

  const fallbackDisplay = {
    companyName: companyName || (tr ? "İlandaki şirket" : "Company in posting"),
    companyProfile: profileLabels[companyProfile],
    companyStage: logisticsJd
      ? (tr ? "Kurumsal lojistik şirketi" : "Enterprise logistics company")
      : productRole
        ? (tr ? "Ürün ve dijital dönüşüm odağında büyüyen şirket" : "Company scaling product and digital transformation")
        : (tr ? "Kurumsal işletme" : "Enterprise business"),
    growthSpeed: growthByProfile[companyProfile],
    hiringStyle: hiringStyleByProfile[companyProfile],
    hiringContext: productRole
      ? (tr ? "Dijital dönüşüm ve ürün genişlemesi." : "Digital transformation and product expansion.")
      : logisticsJd
        ? (tr ? "Operasyonel verimlilik ve lojistik ağ güçlendirme." : "Operational efficiency and network scale.")
        : (tr ? "Role özel yetkin ekip kurulumu." : "Building a team for this role."),
    whatRecruitersReward: companyRewardsForProfile(companyProfile, lang),
    whatCompanyValues: companyRewardsForProfile(companyProfile, lang),
    likelyRecruiterFocus: tr
      ? "Bu kişi ölçülebilir sonuç üretebilir mi?"
      : "Can this person drive measurable outcomes?",
  };

  const display = hasData
    ? {
        companyName: companyName || fallbackDisplay.companyName,
        companyProfile: cleanToken(company?.profile || company?.company_profile || fallbackDisplay.companyProfile),
        companyStage: cleanToken(company?.stage || company?.company_stage || fallbackDisplay.companyStage),
        growthSpeed: cleanToken(company?.growth_speed || fallbackDisplay.growthSpeed),
        hiringStyle: cleanToken(company?.hiring_style || fallbackDisplay.hiringStyle),
        hiringContext: cleanToken(company?.hiring_context || company?.hiring_activity || fallbackDisplay.hiringContext),
        whatRecruitersReward: (company?.recruiter_rewards || company?.values || fallbackDisplay.whatRecruitersReward)
          .map?.((x) => cleanToken(x)) || fallbackDisplay.whatRecruitersReward,
        whatCompanyValues: (company?.values || company?.what_company_values || fallbackDisplay.whatCompanyValues)
          .map?.((x) => cleanToken(x)) || fallbackDisplay.whatCompanyValues,
        likelyRecruiterFocus: cleanToken(company?.recruiter_focus || fallbackDisplay.likelyRecruiterFocus),
      }
    : fallbackDisplay;

  const isEstimated = !hasData;
  const rewards = (display.whatRecruitersReward || []).slice(0, 3).map((x) => applyForbiddenGuard(x, lang));
  const compactDisplay = {
    companyProfile: estimatedLabel(display.companyProfile, isEstimated, lang),
    hiringContext: estimatedLabel(oneSentence(display.hiringContext, lang), isEstimated, lang),
    whatRecruitersReward: rewards,
    recruiterQuestion: estimatedLabel(oneSentence(display.likelyRecruiterFocus, lang), isEstimated, lang),
    likelyRecruiterFocus: estimatedLabel(oneSentence(display.likelyRecruiterFocus, lang), isEstimated, lang),
    whatCompanyValues: applyForbiddenGuard(
      productRole
        ? (tr ? "Ürün çıkışı, müşteri etkisi, hızlı öğrenme" : "Shipping, customer impact, fast learning")
        : (tr ? "Ölçülebilir sonuç, sahiplenme, ekip uyumu" : "Measurable outcomes, ownership, team fit"),
      lang
    ),
    whatStandsOut: rewards[0] || applyForbiddenGuard(tr ? "Somut iş çıkarma" : "Concrete execution", lang),
    whatFiltersOut: applyForbiddenGuard(
      tr ? "Rol dili zayıf veya kanıtsız profiller" : "Weak role language or proof-light profiles",
      lang
    ),
    interviewBehavior: applyForbiddenGuard(
      tr ? "Net sahiplenme, ölçülebilir sonuç, sakin savunma" : "Clear ownership, measurable outcomes, calm defense",
      lang
    ),
  };
  const showCard = Boolean(companyName || jd.length > 40 || hasData);

  return {
    dataAvailable: hasData,
    architectureReady: true,
    isEstimated,
    showCard,
    compactDisplay,
    display,
    companyName: display.companyName,
    companyGrowthSignal: hasData
      ? cleanToken(company?.growth_signal || company?.growth_signals?.[0] || "")
      : null,
    hiringActivity: hasData ? (company?.hiring_activity || null) : null,
    departmentGrowth: hasData ? (company?.department_growth || []) : null,
    businessExpansion: hasData
      ? cleanToken(company?.business_expansion || company?.expansion_signals?.[0] || "")
      : display.hiringContext,
    hiringPriority: hasData
      ? cleanToken(company?.hiring_priority || company?.hiring_priority_estimate || "")
      : null,
    growthConfidence: hasData && Number.isFinite(Number(company?.growth_confidence))
      ? Math.round(Number(company.growth_confidence))
      : null,
    growthSignals: company?.growth_signals || [],
    expansionSignals: company?.expansion_signals || company?.business_expansion || [],
    technologyAdoption: company?.technology_adoption || company?.tech_signals || [],
    summary: hasData
      ? cleanToken(company?.summary || "")
      : display.hiringContext,
  };
}

function buildMarketIntelligence(engineV2, analysisData, roleSuggestions, atsIntelligence, roleIntent, lang) {
  const tr = isTr(lang);
  const market = engineV2?.Market || analysisData?.market || {};
  const hasData = Boolean(market?.role_demand || market?.salary_estimate || market?.skill_trends?.length);
  const topRole = roleSuggestions?.[0]?.role || "";
  const productRole = /product/i.test(`${topRole} ${roleIntent || ""}`);
  const skillFallback = (atsIntelligence?.displayMissingCritical || atsIntelligence?.missingCriticalKeywords || [])
    .map((kw) => formatAtsKeywordForDisplay(kw))
    .filter(Boolean)
    .slice(0, 4);
  const intentSkills = [...allowedAtsKeywordsForIntent(roleIntent || "Product Management")]
    .slice(0, 4)
    .map((kw) => formatAtsKeywordForDisplay(kw));
  const mostRequestedSkills = skillFallback.length ? skillFallback : intentSkills;

  const fallbackDisplay = {
    roleDemand: productRole ? (tr ? "Yüksek" : "High") : (tr ? "Orta" : "Medium"),
    competitionLevel: tr ? "Orta" : "Medium",
    mostRequestedSkills,
  };

  const display = hasData
    ? {
        roleDemand: normalizeMarketBand(market?.role_demand || market?.market_demand || fallbackDisplay.roleDemand, lang),
        competitionLevel: normalizeMarketBand(market?.competitiveness || market?.role_competition || fallbackDisplay.competitionLevel, lang),
        mostRequestedSkills: (market?.emerging_skills || market?.skill_trends || mostRequestedSkills)
          .map((x) => formatAtsKeywordForDisplay(cleanToken(x)))
          .filter(Boolean)
          .slice(0, 5),
      }
    : {
        roleDemand: normalizeMarketBand(fallbackDisplay.roleDemand, lang),
        competitionLevel: normalizeMarketBand(fallbackDisplay.competitionLevel, lang),
        mostRequestedSkills: fallbackDisplay.mostRequestedSkills.slice(0, 5),
      };

  const criticalSkills = display.mostRequestedSkills.slice(0, 5);
  const growthTrend = hasData
    ? normalizeMarketBand(market?.career_growth_trend || market?.skill_demand_trend || (productRole ? (tr ? "Yükselen" : "Rising") : (tr ? "Stabil" : "Stable")), lang)
    : productRole
      ? (tr ? "Yükselen" : "Rising")
      : (tr ? "Stabil" : "Stable");
  const juniorEntryDifficulty = hasData
    ? normalizeMarketBand(market?.junior_entry_difficulty || market?.entry_barrier || (tr ? "Orta" : "Medium"), lang)
    : productRole
      ? (tr ? "Yüksek" : "High")
      : (tr ? "Orta" : "Medium");
  const salaryBand = hasData
    ? cleanToken(market?.salary_estimate || market?.salary_range || "")
    : null;
  const displayCompact = {
    roleDemand: display.roleDemand,
    competitionLevel: display.competitionLevel,
    criticalSkills,
    criticalSkillsLine: criticalSkills.join(", "),
    growthTrend,
    juniorEntryDifficulty,
    salaryBand: salaryBand || null,
  };

  return {
    dataAvailable: hasData,
    architectureReady: true,
    display,
    displayCompact,
    targetRole: topRole,
    marketDemand: display.roleDemand,
    roleCompetition: display.competitionLevel,
    salaryRange: hasData ? cleanToken(market?.salary_estimate || market?.salary_range || "") : null,
    skillTrend: display.mostRequestedSkills,
    careerTrend: hasData ? cleanToken(market?.career_growth_trend || market?.career_trend || "") : null,
    marketConfidence: hasData && Number.isFinite(Number(market?.market_confidence))
      ? Math.round(Number(market.market_confidence))
      : null,
    roleDemand: market?.role_demand || null,
    competitiveness: market?.competitiveness || null,
    emergingSkills: display.mostRequestedSkills,
    salaryEstimate: market?.salary_estimate || null,
    careerGrowthTrend: market?.career_growth_trend || null,
    skillDemandTrend: market?.skill_demand_trend || null,
    summary: display.roleDemand,
  };
}

function recruiterTrustBand(score, lang) {
  const tr = isTr(lang);
  const n = Math.round(Number(score) || 0);
  if (n >= 75) return { key: "very_strong", label: tr ? "Çok Güçlü" : "Very Strong" };
  if (n >= 60) return { key: "strong", label: tr ? "Güçlü" : "Strong" };
  if (n >= 45) return { key: "medium", label: tr ? "Orta" : "Medium" };
  return { key: "weak", label: tr ? "Zayıf" : "Weak" };
}

function buildDecisionWhyOneLiner({ decision, decisionSignals, atsIntelligence, eliminatingBlockerSentence, lang }) {
  const tr = isTr(lang);
  const recruiterOk = Number(decisionSignals?.RecruiterConfidence) >= 50;
  const atsWeak =
    atsIntelligence?.matchBand === "Weak" ||
    Number(decisionSignals?.ATSMatch) < 45 ||
    atsIntelligence?.riskBand === "High";
  if (decision === "APPLY") {
    return applyForbiddenGuard(
      tr ? "Recruiter ve ATS bu ilan için yeterince hizalı; savunulabilir bir profil." : "Recruiter and ATS are aligned enough; the profile is defensible.",
      lang
    );
  }
  if (decision === "RISKY_APPLY" && recruiterOk && atsWeak) {
    return applyForbiddenGuard(
      tr
        ? "Recruiter görüşebilir ancak ATS eşleşmesi ilk turda elenme riski yaratıyor."
        : "Recruiter may engage, but ATS match creates first-round screen-out risk.",
      lang
    );
  }
  if (decision === "RISKY_APPLY") {
    return applyForbiddenGuard(
      eliminatingBlockerSentence ||
        (tr ? "Potansiyel var; kanıt henüz tam kapanmıyor." : "There is potential; proof does not fully close yet."),
      lang
    );
  }
  return applyForbiddenGuard(
    tr
      ? "İlk tur kanıtı ve ATS uyumu bu ilan için henüz yeterli değil."
      : "First-round proof and ATS fit are not strong enough for this posting yet.",
    lang
  );
}

function buildWowMoment({
  fixEngine,
  roleAlternativesDetail,
  score,
  decisionSignals,
  atsIntelligence,
  lang,
}) {
  const tr = isTr(lang);
  const topFix = fixEngine?.fixes?.[0];
  const topRole = roleAlternativesDetail?.[0];
  const current = Math.round(Number(score) || 0);
  const roleGain = topRole ? Math.max(0, (topRole.matchPercent || 0) - current) : 0;
  const recruiterOk = Number(decisionSignals?.RecruiterConfidence) >= 50;
  const atsWeak =
    atsIntelligence?.matchBand === "Weak" ||
    Number(decisionSignals?.ATSMatch) < 45 ||
    atsIntelligence?.riskBand === "High";

  if (topFix?.pointsGain >= 8 && topFix?.suggestedRewrite) {
    const snippet = String(topFix.suggestedRewrite).slice(0, 72);
    return {
      type: "fix",
      title: tr ? "Sana en çok puan kazandıracak tek değişiklik" : "The one change that gains you the most points",
      message: applyForbiddenGuard(
        tr
          ? `Bu ifadeyi CV'ne taşıyarak +${topFix.pointsGain} puan kazanabilirsin.`
          : `Move this line onto your CV for +${topFix.pointsGain} points.`,
        lang
      ),
      highlight: applyForbiddenGuard(snippet + (topFix.suggestedRewrite.length > 72 ? "…" : ""), lang),
      gain: topFix.pointsGain,
    };
  }
  if (topRole && roleGain >= 8) {
    return {
      type: "role",
      title: tr ? "Sana en çok puan kazandıracak tek değişiklik" : "The one change that gains you the most points",
      message: applyForbiddenGuard(
        tr
          ? `Yanlış role başvuruyor olabilirsin. ${topRole.role} rolünde %${roleGain} daha güçlüsün.`
          : `You may be applying to the wrong role. You are ${roleGain}% stronger in ${topRole.role}.`,
        lang
      ),
      highlight: topRole.role,
      gain: roleGain,
    };
  }
  if (recruiterOk && atsWeak) {
    return {
      type: "split",
      title: tr ? "Sana en çok puan kazandıracak tek değişiklik" : "The one change that gains you the most points",
      message: applyForbiddenGuard(
        tr ? "ATS seni eliyor ama recruiter görüşmek isteyebilir." : "ATS may filter you out, but a recruiter may still want to talk.",
        lang
      ),
      highlight: null,
      gain: topFix?.pointsGain ?? 0,
    };
  }
  return {
    type: "fix",
    title: tr ? "Sana en çok puan kazandıracak tek değişiklik" : "The one change that gains you the most points",
    message: applyForbiddenGuard(
      topFix
        ? (tr ? `Önce ${topFix.categoryLabel || "CV"} düzeltmesi: +${topFix.pointsGain} puan.` : `Start with ${topFix.categoryLabel || "CV"} fix: +${topFix.pointsGain} pts.`)
        : (tr ? "CV kanıtını güçlendir; skor hızla toparlanır." : "Strengthen CV proof; score recovers quickly."),
      lang
    ),
    highlight: topFix?.suggestedRewrite ? applyForbiddenGuard(String(topFix.suggestedRewrite).slice(0, 72), lang) : null,
    gain: topFix?.pointsGain ?? 0,
  };
}

function buildFixLoopCenter(score, fixEngine, outcomeProjection, recruiterTrust, atsIntelligence, lang) {
  const tr = isTr(lang);
  const current = outcomeProjection?.currentScore ?? clampScore(Math.round(Number(score) || 0));
  const projected = outcomeProjection?.projectedScore ?? current;
  const fixes = (fixEngine?.fixes || []).slice(0, 2);
  const trustGain = fixes.reduce((sum, f) => sum + Math.round((Number(f.pointsGain) || 0) * 0.55), 0);
  const trustAfterScore = clampScore((recruiterTrust?.score ?? 50) + trustGain);
  const trustBefore = recruiterTrustBand(recruiterTrust?.score ?? 50, lang);
  const trustAfter = recruiterTrustBand(trustAfterScore, lang);
  const atsBefore = atsIntelligence?.riskLabel || atsBandLabel("risk", atsIntelligence?.riskBand || "Medium", lang);
  let atsAfterBand = atsIntelligence?.riskBand || "Medium";
  if (fixes.some((f) => f.category === "ATS") && atsAfterBand === "High") atsAfterBand = "Medium";
  else if (fixes.some((f) => f.category === "ATS") && atsAfterBand === "Medium") atsAfterBand = "Low";
  const atsAfter = atsBandLabel("risk", atsAfterBand, lang);
  return {
    title: tr ? "FIX LOOP" : "FIX LOOP",
    currentScore: current,
    projectedScore: projected,
    scoreRangeLabel: `${current} → ${projected}`,
    atsRisk: {
      before: atsBefore,
      after: atsAfter,
      transitionLabel: `${atsBefore} → ${atsAfter}`,
    },
    recruiterTrust: {
      beforeBand: trustBefore.label,
      afterBand: trustAfter.label,
      beforeScore: recruiterTrust?.score ?? 0,
      afterScore: trustAfterScore,
      transitionLabel: `${trustBefore.label} → ${trustAfter.label}`,
    },
    projectedDecision: outcomeProjection?.projectedDecision,
    steps: fixes.map((fix, idx) => ({
      order: idx + 1,
      label: fix.categoryLabel || fix.category,
      gain: Number(fix.pointsGain) || 0,
      gainLabel: `+${Number(fix.pointsGain) || 0}`,
    })),
    architectureReady: true,
  };
}

function projectedDecisionFromScore(n, lang) {
  const tr = isTr(lang);
  const score = Math.round(Number(n) || 0);
  if (score >= 70) return { key: "APPLY", label: tr ? "BAŞVUR" : "APPLY" };
  if (score >= 62) return { key: "PERSUASION_THRESHOLD", label: tr ? "İKNA EŞİĞİ" : "PERSUASION THRESHOLD" };
  if (score >= 50) return { key: "RISKY_APPLY", label: tr ? "RİSKLİ BAŞVUR" : "RISKY APPLY" };
  return { key: "DO_NOT_APPLY", label: tr ? "BAŞVURMA" : "DO NOT APPLY" };
}

function firstRoundRiskLabel(score, lang) {
  const tr = isTr(lang);
  const n = Math.round(Number(score) || 0);
  if (n >= 68) return tr ? "Düşük" : "Low";
  if (n >= 55) return tr ? "Orta" : "Medium";
  return tr ? "Yüksek" : "High";
}

function computeDecisionConfidencePercent(decisionSignals, verdictHierarchy, atsIntelligence, score) {
  const n = Number(score) || 0;
  const recruiter = Number(decisionSignals?.RecruiterConfidence) || 0;
  const evidence = Number(decisionSignals?.EvidenceStrength) || 0;
  const roleAlign = Number(decisionSignals?.RoleAlignment) || 0;
  const ats = Number(decisionSignals?.ATSMatch) || 0;
  const verdictBoost =
    verdictHierarchy?.state === "GREEN" ? 12 : verdictHierarchy?.state === "YELLOW" ? 4 : -8;
  const atsBoost =
    atsIntelligence?.matchBand === "Strong" ? 8 : atsIntelligence?.matchBand === "Partial" ? 3 : -6;
  return clampScore(Math.round(n * 0.22 + recruiter * 0.28 + evidence * 0.18 + roleAlign * 0.14 + ats * 0.1 + verdictBoost + atsBoost));
}

function buildApplicationDecision({
  verdictHierarchy,
  decisionSignals,
  score,
  atsIntelligence,
  primaryLimiter,
  cognition,
  identityEngine,
  eliminatingBlockerSentence,
  lang,
}) {
  const tr = isTr(lang);
  const n = Number(score) || 0;
  const confidencePercent = computeDecisionConfidencePercent(decisionSignals, verdictHierarchy, atsIntelligence, score);
  let decision = "RISKY_APPLY";
  if (
    verdictHierarchy?.state === "GREEN" &&
    n >= 70 &&
    Number(decisionSignals?.RecruiterConfidence) >= 66 &&
    Number(decisionSignals?.ATSMatch) >= 48
  ) {
    decision = "APPLY";
  } else if (
    verdictHierarchy?.state === "RED" ||
    n < 48 ||
    Number(decisionSignals?.RecruiterConfidence) < 36 ||
    (atsIntelligence?.riskBand === "High" && atsIntelligence?.matchBand === "Weak" && n < 58)
  ) {
    decision = "DO_NOT_APPLY";
  } else if (
    n >= 62 &&
    Number(decisionSignals?.RecruiterConfidence) >= 52 &&
    verdictHierarchy?.state !== "RED"
  ) {
    decision = "PERSUASION_THRESHOLD";
  }
  const labelMap = {
    APPLY: tr ? "BAŞVUR" : "APPLY",
    PERSUASION_THRESHOLD: tr ? "RİSKLİ BAŞVUR" : "RISKY APPLY",
    RISKY_APPLY: tr ? "RİSKLİ BAŞVUR" : "RISKY APPLY",
    DO_NOT_APPLY: tr ? "BAŞVURMA" : "DO NOT APPLY",
  };
  const displayDecision =
    decision === "PERSUASION_THRESHOLD" ? "RISKY_APPLY" : decision;
  const reasonByDecision = {
    APPLY: tr
      ? "Recruiter ve ATS okuması bu ilan için yeterince hizalı."
      : "Recruiter and ATS reads are aligned enough for this posting.",
    PERSUASION_THRESHOLD: tr
      ? "Potansiyel var; birkaç kanıt düzeltmesi kararı taşıyabilir."
      : "There is potential; a few proof fixes can carry the decision.",
    RISKY_APPLY: eliminatingBlockerSentence || (tr
      ? "Potansiyel var; savunma henüz tam kapanmıyor."
      : "There is potential; the case is not fully defensible yet."),
    DO_NOT_APPLY: tr
      ? "İlk tur kanıtı ve ATS eşleşmesi bu ilan için henüz yeterince güçlü değil."
      : "First-round proof and ATS match are not strong enough for this posting yet.",
  };
  const outcomeByDecision = {
    APPLY: tr
      ? "Mülakat turuna geçme ihtimali güçlü."
      : "Strong chance of reaching the interview stage.",
    PERSUASION_THRESHOLD: tr
      ? "Recruiter görüşür; shortlist için kanıtı netleştir."
      : "Recruiter will engage; clarify proof for shortlist.",
    RISKY_APPLY: tr
      ? "Recruiter incelemesine ulaşabilir; shortlist belirsiz kalır."
      : "May reach recruiter review; shortlisting remains uncertain.",
    DO_NOT_APPLY: tr
      ? "İlk turda elenme riski yüksek; önce kanıt ve ATS uyumunu güçlendir."
      : "High first-round rejection risk; strengthen proof and ATS fit first.",
  };
  const pros = [];
  const cons = [];
  if (Number(decisionSignals?.RecruiterConfidence) >= 50) {
    pros.push(tr ? "Recruiter ilgisi var" : "Recruiter interest exists");
  }
  if (identityEngine?.primaryIdentity?.id === "FounderBuilder") {
    pros.push(tr ? "Founder deneyimi" : "Founder experience");
    pros.push(tr ? "Gerçek ürün çıkardı" : "Real product shipped");
    pros.push(tr ? "Güçlü sahiplenme" : "Strong ownership");
  } else if (Number(decisionSignals?.EvidenceStrength) >= 55) {
    pros.push(tr ? "İş çıkarma kanıtı görünür" : "Execution proof is visible");
  }
  if (cognition?.signals?.ownership?.level !== "weak" && identityEngine?.primaryIdentity?.id !== "FounderBuilder") {
    pros.push(tr ? "Sahiplenme sinyali var" : "Ownership signal is present");
  }
  if (primaryLimiter?.key === "EvidenceStrength" || cognition?.proofGap?.missingProof) {
    cons.push(tr ? "Ürün kanıtı zayıf" : "Product evidence weak");
  }
  if (primaryLimiter?.key === "IdentityClarity" || primaryLimiter?.key === "NarrativeClarity") {
    cons.push(tr ? "Kimlik hikayesi net değil" : "Identity story not clear");
  }
  if (Number(decisionSignals?.RoleAlignment) < 50) {
    cons.push(tr ? "Rol uyumu zayıf" : "Role fit weak");
  }
  const whyReasons = [];
  if (decision === "APPLY") {
    whyReasons.push(tr ? "Recruiter ve ilan hizalı" : "Recruiter and posting aligned");
    whyReasons.push(tr ? "Kanıt savunulabilir" : "Proof is defensible");
    whyReasons.push(tr ? "İlk tur geçişi güçlü" : "Strong first-screen pass");
  } else if (decision === "PERSUASION_THRESHOLD") {
    whyReasons.push(tr ? "Profil ilgi çekiyor" : "Profile draws interest");
    whyReasons.push(tr ? "Kanıt neredeyse yeterli" : "Proof is almost sufficient");
    whyReasons.push(tr ? "ATS veya rol dili küçük düzeltmeyle toparlanır" : "ATS or role language can recover with small fixes");
  } else if (decision === "RISKY_APPLY") {
    if (Number(decisionSignals?.RecruiterConfidence) >= 50) {
      whyReasons.push(tr ? "Profil ilgi çekiyor" : "Profile draws interest");
    }
    if (atsIntelligence?.matchBand === "Weak" || Number(decisionSignals?.ATSMatch) < 45) {
      whyReasons.push(tr ? "ATS uyumsuzluğu" : "ATS mismatch");
    }
    if (primaryLimiter?.key === "EvidenceStrength") {
      whyReasons.push(tr ? "Ürün sahipliği yeterince görünmüyor" : "Product ownership not visible enough");
    } else {
      whyReasons.push(tr ? "İlk tur eleme riski" : "First-round screen-out risk");
    }
  } else {
    whyReasons.push(tr ? "ATS uyumsuzluğu" : "ATS mismatch");
    whyReasons.push(tr ? "İlk tur eleme riski" : "First-round screen-out risk");
    whyReasons.push(tr ? "Ürün sahipliği yeterince görünmüyor" : "Product ownership not visible enough");
  }
  const evidence = [
    cognition?.signals?.executionProof?.evidence,
    cognition?.signals?.ownership?.evidence,
    cognition?.signals?.roleBridge?.evidence,
  ]
    .map((x) => evidenceDisplay(x))
    .filter(Boolean)
    .slice(0, 3);
  const missingEvidence = (atsIntelligence?.missingCriticalKeywords || [])
    .slice(0, 4)
    .map((x) => applyForbiddenGuard(x, lang));
  if (cognition?.proofGap?.missingProof && !missingEvidence.length) {
    missingEvidence.push(applyForbiddenGuard(oneSentence(cognition.proofGap.missingProof, lang), lang));
  }
  const whyOneLiner = buildDecisionWhyOneLiner({
    decision: displayDecision,
    decisionSignals,
    atsIntelligence,
    eliminatingBlockerSentence,
    lang,
  });
  return {
    decision: displayDecision,
    label: labelMap[displayDecision],
    whyOneLiner,
    title: tr ? "Son Karar" : "Final Verdict",
    reason: applyForbiddenGuard(reasonByDecision[decision], lang),
    whyReasons: whyReasons.slice(0, 3).map((x) => applyForbiddenGuard(x, lang)),
    confidence: scoreLabel(decisionSignals?.RecruiterConfidence, lang),
    confidencePercent,
    expectedOutcome: applyForbiddenGuard(outcomeByDecision[decision], lang),
    pros: pros.slice(0, 3).map((x) => applyForbiddenGuard(x, lang)),
    cons: cons.slice(0, 2).map((x) => applyForbiddenGuard(x, lang)),
    evidence: evidence.map((x) => applyForbiddenGuard(sanitizeVisibleTurkish(x, lang), lang)),
    missingEvidence,
    primaryLimiter: primaryLimiter?.key || null,
    architectureReady: true,
  };
}

const FIX_ID_TO_CATEGORY = {
  "ats-role-language": "ATS",
  "product-ownership": "Product Ownership",
  "proof-gap": "Business Impact",
  "role-bridge": "Role Alignment",
  "expected-lift": "Story Clarity",
};

const FIX_CATEGORY_PRIORITY = {
  ATS: 1,
  "Product Ownership": 2,
  "Business Impact": 3,
  "Role Alignment": 4,
  Positioning: 5,
  "Story Clarity": 6,
};

function fixCategoryLabel(category, lang) {
  const tr = isTr(lang);
  const map = {
    ATS: "ATS",
    "Product Ownership": tr ? "Ürün Sahiplenmesi" : "Product Ownership",
    "Business Impact": tr ? "İş Etkisi" : "Business Impact",
    Positioning: tr ? "Konumlandırma" : "Positioning",
    "Role Alignment": tr ? "Rol Uyumu" : "Role Alignment",
    "Story Clarity": tr ? "Hikaye Netliği" : "Story Clarity",
  };
  return map[category] || category;
}

function priorityMetaForRank(rank, lang) {
  const tr = isTr(lang);
  if (rank === 1) return { rankLabel: "#1", impactLabel: tr ? "En Büyük Kazanç" : "Biggest Gain" };
  if (rank === 2) return { rankLabel: "#2", impactLabel: tr ? "En Büyük Kazanç" : "Biggest Gain" };
  if (rank === 3) return { rankLabel: "#3", impactLabel: tr ? "Orta Kazanç" : "Medium Gain" };
  return { rankLabel: `#${rank}`, impactLabel: tr ? "Destekleyici" : "Supporting" };
}

function mapImprovementToCategory(id, primaryLimiter) {
  return FIX_ID_TO_CATEGORY[id] || (primaryLimiter?.key === "ATSMatch" ? "ATS" : "Story Clarity");
}

function buildRecruiterTrust(cognition, decisionSignals, cvText, identityEngine, lang) {
  const tr = isTr(lang);
  const score = clampScore(
    Math.round(
      Number(decisionSignals?.RecruiterConfidence || 0) * 0.42 +
        Number(decisionSignals?.EvidenceStrength || 0) * 0.33 +
        Number(decisionSignals?.RoleAlignment || 0) * 0.25
    )
  );
  const cv = String(cvText || "");
  const positive = [];
  if (/founder|kurucu|co-?founder/i.test(cv)) {
    positive.push(tr ? "Canlı ürün çıkardı" : "Live product shipped");
  }
  if (/intern|staj/i.test(cv)) {
    positive.push(tr ? "Staj deneyimi" : "Internship experience");
  }
  if (/hirefit|launched|shipped|built|canlıya/i.test(cv)) {
    positive.push(tr ? "Somut ürün çıkışı" : "Concrete product delivery");
  }
  if (identityEngine?.primaryIdentity?.id === "FounderBuilder") {
    positive.push(tr ? "Founder profili" : "Founder profile");
  }
  if (Number(decisionSignals?.EvidenceStrength) >= 55 && positive.length < 3) {
    positive.push(tr ? "İş çıkarma sinyali" : "Execution signal");
  }
  if (!positive.length) {
    positive.push(tr ? "Temel deneyim görünür" : "Baseline experience visible");
  }

  const weak = [];
  if (Number(decisionSignals?.EvidenceStrength) < 55) {
    weak.push(tr ? "Ölçülebilir sonuç sınırlı" : "Limited measurable outcomes");
  }
  if (cognition?.proofGap?.missingProof) {
    weak.push(tr ? "Ürün sahipliği kanıtı belirsiz" : "Product ownership proof unclear");
  }
  if (Number(decisionSignals?.NarrativeClarity) < 50) {
    weak.push(tr ? "İlk okuma hikayesi zayıf" : "First-read story weak");
  }
  if (!weak.length) {
    weak.push(tr ? "Rol dili tam kapanmıyor" : "Role language not fully closed");
  }

  let interpretation = "";
  if (score >= 78) {
    interpretation = tr
      ? "Recruiter büyük ihtimalle görüşür.\nKısa liste için kanıtı netleştir."
      : "Recruiter will very likely engage.\nSharpen proof for shortlist.";
  } else if (score >= 65) {
    interpretation = tr
      ? "Recruiter görüşür.\nKısa liste garanti değil."
      : "Recruiter will engage.\nShortlist is not guaranteed.";
  } else if (score >= 50) {
    interpretation = tr
      ? "Recruiter okur.\nİlk filtre riski sürüyor."
      : "Recruiter will read.\nFirst-filter risk remains.";
  } else {
    interpretation = tr
      ? "Recruiter geçebilir.\nİlk tur baskısı yüksek."
      : "Recruiter may pass.\nFirst-round pressure is high.";
  }

  const band = recruiterTrustBand(score, lang);
  return {
    title: tr ? "Recruiter Güveni" : "Recruiter Trust",
    score,
    band: band.label,
    bandKey: band.key,
    scoreLabel: band.label,
    whyTrusts: positive.slice(0, 2).map((x) => applyForbiddenGuard(x, lang)),
    whyHesitates: weak.slice(0, 2).map((x) => applyForbiddenGuard(x, lang)),
    interpretation: applyForbiddenGuard(interpretation, lang),
    interpretationLines: interpretation.split("\n").map((x) => applyForbiddenGuard(x, lang)),
    positiveSignals: positive.slice(0, 2).map((x) => applyForbiddenGuard(x, lang)),
    weakSignals: weak.slice(0, 2).map((x) => applyForbiddenGuard(x, lang)),
  };
}

function buildRecruiterReadingCompact(recruiterView, lang) {
  const tr = isTr(lang);
  const oneSentence = (text) => {
    const t = applyForbiddenGuard(String(text || "").trim(), lang);
    if (!t) return "";
    const first = t.split(/(?<=[.!?])\s+/)[0];
    return first.length > 160 ? `${first.slice(0, 157)}…` : first;
  };
  return {
    title: tr ? "Recruiter Okuması" : "Recruiter Reading",
    strongestSignal: oneSentence(recruiterView?.strength) || (tr ? "Temel deneyim okunuyor." : "Baseline experience reads."),
    biggestConcern: oneSentence(recruiterView?.gap) || (tr ? "Kanıt henüz tam kapanmıyor." : "Proof does not fully close."),
    recruiterConclusion: oneSentence(recruiterView?.decision) || (tr ? "İlk tur savunması sınırlı." : "First-round case stays limited."),
  };
}

function interviewChanceFromScore(score, decisionSignals) {
  const n = Number(score) || 0;
  const rc = Number(decisionSignals?.RecruiterConfidence) || 0;
  const ats = Number(decisionSignals?.ATSMatch) || 0;
  return clampScore(Math.round(n * 1.05 + rc * 0.1 + ats * 0.05));
}

function shortlistChanceFromScore(score, decisionSignals) {
  const n = Number(score) || 0;
  const rc = Number(decisionSignals?.RecruiterConfidence) || 0;
  return clampScore(Math.round(n * 0.52 + rc * 0.22));
}

function buildRecruiterVerdictMeter(score, outcomeProjection, decisionSignals, lang) {
  const tr = isTr(lang);
  const current = outcomeProjection?.currentScore ?? clampScore(Math.round(Number(score) || 0));
  const projected = outcomeProjection?.projectedScore ?? current;
  const beforePercent = clampScore(interviewChanceFromScore(current, decisionSignals));
  const afterPercent = clampScore(Math.min(92, interviewChanceFromScore(projected, decisionSignals)));
  const gainPercent = Math.max(0, afterPercent - beforePercent);
  return {
    title: tr ? "RECRUITER VERDICT" : "RECRUITER VERDICT",
    beforePercent,
    afterPercent,
    gainPercent,
    beforeLabel: tr ? "İlk görüşmeye çağrılma ihtimali" : "Chance of first interview",
    afterLabel: tr ? "Fix sonrası" : "After fix",
  };
}

function buildShortlistChance(score, outcomeProjection, decisionSignals, lang) {
  const tr = isTr(lang);
  const current = outcomeProjection?.currentScore ?? clampScore(Math.round(Number(score) || 0));
  const projected = outcomeProjection?.projectedScore ?? current;
  const currentPercent = clampScore(shortlistChanceFromScore(current, decisionSignals));
  const afterPercent = clampScore(Math.min(90, shortlistChanceFromScore(projected, decisionSignals)));
  const gainPercent = Math.max(0, afterPercent - currentPercent);
  return {
    title: tr ? "SHORTLIST CHANCE" : "SHORTLIST CHANCE",
    currentPercent,
    afterPercent,
    gainPercent,
  };
}

function buildCareerWallet(careerProfile, careerGrowth, score, lang) {
  const tr = isTr(lang);
  const base = Number(score) || Number(careerGrowth?.careerScore) || 55;
  const dnaType = careerProfile?.career_dna?.typeId || "";
  const targets = careerProfile?.target_roles || careerProfile?.best_fit_roles || [];
  const laneDefs = [
    { key: "product", label: "Product Management", boost: /product|builder|ürün/i },
    { key: "strategy", label: "Strategy", boost: /strateg|operator|consult/i },
    { key: "growth", label: "Growth", boost: /growth|hacker|marketing/i },
    { key: "business", label: "Business", boost: /business|analyst|generalist/i },
    { key: "consulting", label: "Consulting", boost: /consult|strategist|operator/i },
  ];
  const colors = ["#818cf8", "#38bdf8", "#34d399", "#fbbf24", "#f472b6"];
  const roleLanes = laneDefs.map((lane, idx) => {
    let s = base;
    if (targets.some((t) => String(t).toLowerCase().includes(lane.key) || lane.boost.test(t))) s += 12;
    if (lane.boost.test(dnaType) || lane.boost.test(careerProfile?.career_identity || "")) s += 8;
    s = Math.max(28, Math.min(92, Math.round(s)));
    return { key: lane.key, label: lane.label, score: s, color: colors[idx] };
  });
  return {
    careerScore: careerGrowth?.careerScore ?? base,
    monthlyGrowth: careerGrowth?.scoreDelta ?? 0,
    roleLanes,
    timeline: careerGrowth?.timeline || [],
    title: tr ? "CAREER WALLET" : "CAREER WALLET",
  };
}

function buildCareerMemory(comparison, profile, lang) {
  if (!comparison) return null;
  const tr = isTr(lang);
  const improvedItems = Array.isArray(comparison.improved) ? comparison.improved.filter(Boolean) : [];
  const worseItems = Array.isArray(comparison.worse) ? comparison.worse.filter(Boolean) : [];
  const stayedItems = Array.isArray(comparison.stayedStrong) ? comparison.stayedStrong.filter(Boolean) : [];
  if (
    !comparison.isFirstProfile &&
    !improvedItems.length &&
    !worseItems.length &&
    !stayedItems.length
  ) {
    return null;
  }
  return {
    title: comparison.title || (tr ? "CAREER MEMORY" : "CAREER MEMORY"),
    subtitle: String(comparison.subtitle || "").trim(),
    isFirstProfile: Boolean(comparison.isFirstProfile),
    identity: applyForbiddenGuard(String(comparison.identity || profile?.career_identity || "").trim(), lang),
    level: String(comparison.level || profile?.career_level || "").trim(),
    analysisCount: Number(comparison.analysisCount || profile?.analysis_count) || 0,
    improved: {
      label: tr ? "Ne gelişti?" : "What improved?",
      items: improvedItems.map((x) => applyForbiddenGuard(String(x), lang)),
    },
    worse: {
      label: tr ? "Ne zayıfladı?" : "What got worse?",
      items: worseItems.map((x) => applyForbiddenGuard(String(x), lang)),
    },
    stayedStrong: {
      label: tr ? "Ne güçlü kaldı?" : "What stayed strong?",
      items: stayedItems.map((x) => applyForbiddenGuard(String(x), lang)),
    },
    strongSignals: (profile?.strong_signals || []).slice(0, 6).map((x) => applyForbiddenGuard(String(x), lang)),
    weakSignals: (profile?.weak_signals || []).slice(0, 6).map((x) => applyForbiddenGuard(String(x), lang)),
  };
}

function buildCareerMomentum(outcomeProjection, fixEngine, fixLoopCenter, lang) {
  const tr = isTr(lang);
  const current = outcomeProjection?.currentScore ?? 0;
  const projected = outcomeProjection?.projectedScore ?? current;
  const total = Math.max(0, projected - current);
  const fixes = fixEngine?.fixes || [];
  const atsGain = fixes.filter((f) => f.category === "ATS").reduce((s, f) => s + (Number(f.pointsGain) || 0), 0) || Math.round(total * 0.45);
  const trustGain =
    fixes.filter((f) => f.category === "Product Ownership" || f.category === "Business Impact").reduce((s, f) => s + (Number(f.pointsGain) || 0), 0) ||
    Math.round(total * 0.35);
  const roleGain = fixes.filter((f) => f.category === "Role Alignment").reduce((s, f) => s + (Number(f.pointsGain) || 0), 0) || Math.max(0, total - atsGain - trustGain);
  const pillars = [
    { key: "ats", label: tr ? "ATS Güçlenmesi" : "ATS strength", gain: atsGain, percent: clampScore(55 + atsGain * 2), color: "#38bdf8" },
    { key: "trust", label: tr ? "Recruiter Güveni" : "Recruiter trust", gain: trustGain, percent: clampScore(50 + trustGain * 2), color: "#a78bfa" },
    { key: "role", label: tr ? "Role Match" : "Role match", gain: roleGain, percent: clampScore(48 + roleGain * 2), color: "#34d399" },
  ];
  return {
    title: tr ? "CAREER MOMENTUM" : "CAREER MOMENTUM",
    total,
    pillars,
    scoreRange: fixLoopCenter?.scoreRangeLabel || `${current} → ${projected}`,
  };
}

function buildCvHeatmap(cognition, decisionSignals, score, lang) {
  const tr = isTr(lang);
  const own = cognition?.signals?.ownership?.level === "strong" ? 78 : cognition?.signals?.ownership?.level === "medium" ? 58 : 42;
  const exec = cognition?.signals?.executionProof?.level === "strong" ? 80 : cognition?.signals?.executionProof?.level === "medium" ? 55 : 40;
  const sections = [
    { key: "summary", label: tr ? "Özet" : "Summary", score: clampScore(Number(decisionSignals?.NarrativeClarity) || Number(score) || 50) },
    { key: "experience", label: tr ? "Deneyim" : "Experience", score: clampScore(Number(decisionSignals?.EvidenceStrength) || 52) },
    { key: "projects", label: tr ? "Projeler" : "Projects", score: clampScore(Math.round((own + exec) / 2)) },
    { key: "skills", label: tr ? "Yetkinlikler" : "Skills", score: clampScore(Number(decisionSignals?.ATSMatch) || Number(decisionSignals?.RoleAlignment) || 48) },
    { key: "education", label: tr ? "Eğitim" : "Education", score: clampScore(Math.min(72, Math.round(Number(score) * 0.85) || 55)) },
  ];
  return {
    title: tr ? "CV HEATMAP" : "CV HEATMAP",
    sections,
  };
}

function buildFirstScreenPulse({
  eliminationBlock,
  outcomeProjection,
  recruiterReaction,
  applicationDecision,
  decisionHero,
  lang,
}) {
  const tr = isTr(lang);
  const blockingText = eliminationBlock?.reasons?.join(" ") || (tr ? "ATS ve kanıt ilk turda zayıf." : "ATS and proof are weak on first screen.");
  const current = outcomeProjection?.currentScore ?? 0;
  const projected = outcomeProjection?.projectedScore ?? current;
  const verdictRow = recruiterReaction?.rows?.find((r) => r.key === "verdict");
  return {
    blockingTitle: tr ? "Seni şu an eleyen şey" : "What's filtering you out",
    blockingText: applyForbiddenGuard(blockingText, lang),
    afterFixTitle: tr ? "Düzeltirsen ne olur" : "If you fix it",
    afterFixText: `${current} → ${projected} · ${outcomeProjection?.projectedDecision?.label || applicationDecision?.label || ""}`,
    recruiterCallTitle: tr ? "Recruiter'ın kararı" : "Recruiter's call",
    recruiterCallText: applyForbiddenGuard(verdictRow?.value || recruiterReaction?.decisionSummary || "", lang),
    ctaLabel: decisionHero?.primaryCtaLabel || (tr ? "CV'yi Güçlendir" : "Strengthen CV"),
  };
}

function buildRecruiterReactionPanel(cognition, identityEngine, recruiterView, decisionSignals, recruiterTrust, lang) {
  const tr = isTr(lang);
  const isFounder = identityEngine?.primaryIdentity?.id === "FounderBuilder";
  const firstLook = isFounder
    ? (tr ? "Kurucu profili — ürün çıkarmış biri gibi duruyor." : "Founder profile — reads like someone who shipped.")
    : (tr ? "Deneyim var ama rol hikayesi ilk bakışta dağınık." : "Experience is there, but the role story feels scattered at first glance.");
  const stopper =
    cognition?.proofGap?.missingProof
      ? applyForbiddenGuard(oneSentence(cognition.proofGap.missingProof, lang), lang)
      : (tr ? "Ürün sahipliği CV'de net kapanmıyor; beni durduruyor." : "Product ownership doesn't close on the CV — that's what stops me.");
  const needToConvince =
    Number(decisionSignals?.EvidenceStrength) < 55
      ? (tr ? "Tek somut çıktı ve ölçülebilir etkiyi görmek istiyorum." : "I need one concrete output and measurable impact on the page.")
      : (tr ? "Rol dilini ilk 10 saniyede net görmek istiyorum." : "I need the role language to read clearly in 10 seconds.");
  const firstQuestion = isFounder
    ? (tr ? "Bu üründe hangi kararları sen verdin — roadmap mi, öncelik mi?" : "Which calls did you own on this product — roadmap or priorities?")
    : (tr ? "Bu rolde tek başına hangi sonucu teslim ettin?" : "What outcome did you deliver solo in this role?");
  const myCall =
    Number(decisionSignals?.RecruiterConfidence) >= 62
      ? (tr ? "Görüşürüm — kanıt netleşirse listeye alırım." : "I'd take the call — shortlist if proof sharpens.")
      : Number(decisionSignals?.RecruiterConfidence) >= 48
        ? (tr ? "Okurum ama ilk turda tereddüt ederim." : "I'd read it, but I'd hesitate on the first screen.")
        : (tr ? "Muhtemelen geçerim; savunma zayıf." : "I'd probably pass; the case is thin.");
  const rows = [
    { key: "look", emoji: "👀", label: tr ? "İlk gördüğüm şey" : "First thing I notice", value: applyForbiddenGuard(firstLook, lang) },
    { key: "stop", emoji: "⚠️", label: tr ? "Beni durduran şey" : "What stops me", value: applyForbiddenGuard(stopper, lang) },
    { key: "convince", emoji: "🔥", label: tr ? "İkna olmam için gereken" : "What I need to be convinced", value: applyForbiddenGuard(needToConvince, lang) },
    { key: "question", emoji: "📝", label: tr ? "Soracağım ilk soru" : "First question I'd ask", value: applyForbiddenGuard(firstQuestion, lang) },
    { key: "verdict", emoji: "✅", label: tr ? "Kararım" : "My call", value: applyForbiddenGuard(myCall, lang) },
  ];
  return {
    title: tr ? "Recruiter Tepkisi" : "Recruiter reaction",
    rows,
    trustBand: recruiterTrust?.band || recruiterTrust?.scoreLabel,
    decisionSummary: rows[4].value,
  };
}

function buildRecruiterThinking(cognition, identityEngine, recruiterView, decisionSignals, lang) {
  const tr = isTr(lang);
  const oneSentence = (text) => {
    const t = applyForbiddenGuard(String(text || "").trim(), lang);
    if (!t) return "";
    const first = t.split(/(?<=[.!?])\s+/)[0];
    return first.length > 140 ? `${first.slice(0, 137)}…` : first;
  };
  const isFounder = identityEngine?.primaryIdentity?.id === "FounderBuilder";
  const firstImpression = isFounder
    ? (tr ? "Kurucu gibi duruyor; ürün çıkarmış biri." : "Reads like a founder who has shipped.")
    : (tr ? "Deneyimli ama rol hikayesi henüz net değil." : "Experienced, but the role story is not fully clear yet.");
  const strongestSignal =
    cognition?.signals?.executionProof?.level === "strong"
      ? (tr ? "Canlı ürün çıkarmış — bu beni durdurur." : "Shipped a live product — that makes me pause.")
      : cognition?.signals?.ownership?.level === "strong"
        ? (tr ? "Sahiplenme hissi var; işi yapmış gibi." : "Feels like ownership; like they did the work.")
        : (tr ? "Temel deneyim okunuyor." : "Baseline experience comes through.");
  const biggestDoubt =
    oneSentence(recruiterView?.gap) ||
    (tr ? "Ürün sahipliği CV'de tam kapanmıyor." : "Product ownership does not fully close on the CV.");
  const firstQuestion = isFounder
    ? (tr ? "Bu üründe hangi kararları sen verdin?" : "Which decisions did you own on this product?")
    : (tr ? "Bu rolde ölçülebilir çıktın neydi?" : "What was your measurable outcome in this role?");
  const myDecision =
    Number(decisionSignals?.RecruiterConfidence) >= 62
      ? (tr ? "30 saniyede: görüşürüm, kanıtı netleştirirse shortlist olur." : "In 30 seconds: I'd talk; shortlist if proof sharpens.")
      : Number(decisionSignals?.RecruiterConfidence) >= 48
        ? (tr ? "30 saniyede: okurum ama ilk turda tereddüt ederim." : "In 30 seconds: I'd read, but I'd hesitate on first screen.")
        : (tr ? "30 saniyede: muhtemelen geçerim; kanıt zayıf." : "In 30 seconds: I'd likely pass; proof is weak.");
  const rows = [
    {
      key: "impression",
      label: tr ? "İlk izlenim" : "First impression",
      sublabel: tr ? "Bu aday bana ne hissettiriyor?" : "How does this candidate feel to me?",
      value: applyForbiddenGuard(firstImpression, lang),
    },
    {
      key: "signal",
      label: tr ? "En güçlü sinyal" : "Strongest signal",
      sublabel: tr ? "Beni etkileyen taraf ne?" : "What stands out?",
      value: applyForbiddenGuard(strongestSignal, lang),
    },
    {
      key: "doubt",
      label: tr ? "En büyük şüphe" : "Biggest doubt",
      sublabel: tr ? "Neden eleyebilirim?" : "Why might I pass?",
      value: applyForbiddenGuard(biggestDoubt, lang),
    },
    {
      key: "question",
      label: tr ? "Soracağım ilk soru" : "First question I'd ask",
      sublabel: tr ? "Mülakatta ilk ne sorarım?" : "What I'd open with in the interview",
      value: applyForbiddenGuard(firstQuestion, lang),
    },
    {
      key: "verdict",
      label: tr ? "Kararım" : "My call",
      sublabel: tr ? "30 saniyede verdiğim karar" : "Decision in 30 seconds",
      value: applyForbiddenGuard(myDecision, lang),
    },
  ];
  return {
    title: tr ? "Recruiter Simülasyonu" : "Recruiter simulation",
    rows,
    firstImpression: rows[0].value,
    favoriteThing: rows[1].value,
    biggestDoubt: rows[2].value,
    firstQuestion: rows[3].value,
    decisionSummary: rows[4].value,
  };
}

function atsExampleLineForKeyword(keyword, lang) {
  const tr = isTr(lang);
  const k = String(keyword || "").toLowerCase();
  if (/roadmap/i.test(k)) {
    return tr
      ? "Müşteri geri bildirimine göre ürün roadmap'ini önceliklendirdim."
      : "Prioritized the product roadmap based on customer feedback.";
  }
  if (/prd|requirement/i.test(k)) {
    return tr
      ? "İş hedeflerine bağlı PRD yazıp paydaşlarla hizaladım."
      : "Wrote PRDs tied to business goals and aligned stakeholders.";
  }
  if (/user research|araştırma/i.test(k)) {
    return tr
      ? "Kullanıcı görüşmeleriyle ihtiyaçları doğrulayıp roadmap'e taşıdım."
      : "Validated needs through user interviews and fed them into the roadmap.";
  }
  if (/product management|ürün yönetimi/i.test(k)) {
    return tr
      ? "Uçtan uca product management sürecinde roadmap ve çıktı sahipliği aldım."
      : "Owned roadmap and delivery across the product management lifecycle.";
  }
  if (/backlog/i.test(k)) {
    return tr
      ? "Backlog'u iş değerine göre önceliklendirip sprint çıktısını yönettim."
      : "Prioritized backlog by business value and managed sprint outcomes.";
  }
  return tr
    ? `${keyword} kapsamında sahiplenme ve ölçülebilir çıktıyı CV'de görünür kıldım.`
    : `Made ownership and measurable outcomes visible for ${keyword} on the CV.`;
}

function buildAtsKeywordRemedies(atsIntelligence, jdText, lang) {
  const tr = isTr(lang);
  const jd = String(jdText || "");
  const missing =
    atsIntelligence?.compact?.scanFormat?.missingTerms ||
    (atsIntelligence?.displayMissingCritical || [])
      .map((kw) => formatAtsKeywordForDisplay(kw))
      .filter(Boolean);
  return missing.slice(0, 5).map((keyword, idx) => {
    const inJd = jd.toLowerCase().includes(String(keyword).toLowerCase());
    return {
      keyword,
      whyImportant: applyForbiddenGuard(
        inJd
          ? (tr ? `İlanda ${keyword} geçiyor; ATS ilk filtrede arar.` : `${keyword} appears in the posting; ATS scans for it early.`)
          : (tr ? `Bu rol için ${keyword} beklenen dil; ATS eşleşmesini güçlendirir.` : `${keyword} is expected language for this role; it strengthens ATS match.`),
        lang
      ),
      howToAdd: applyForbiddenGuard(
        tr
          ? `${keyword} için sahiplenme + çıktı cümlesi ekle.`
          : `Add an ownership + outcome line for ${keyword}.`,
        lang
      ),
      exampleLine: applyForbiddenGuard(atsExampleLineForKeyword(keyword, lang), lang),
      pointsGain: idx === 0 ? 4 : idx === 1 ? 3 : 2,
      pointsGainLabel: `+${idx === 0 ? 4 : idx === 1 ? 3 : 2}`,
    };
  });
}

function buildRoleAlternativesDetail(roleSuggestions, atsIntelligence, score, lang) {
  const tr = isTr(lang);
  const medals = ["🥇", "🥈"];
  const missingFromAts = (atsIntelligence?.displayMissingCritical || [])
    .map((kw) => formatAtsKeywordForDisplay(kw))
    .filter(Boolean)
    .slice(0, 4);

  return (roleSuggestions || []).slice(0, 2).map((row, idx) => {
    const matchPercent = Math.round(Number(row.matchPercent) || 0);
    const pointsGain =
      idx === 0
        ? Math.round(Number(row.potentialGainPercent) || Math.max(8, matchPercent - (Number(score) || 0)))
        : Math.round(Number(row.altGainPercent) || Math.max(6, matchPercent - (Number(roleSuggestions[0]?.matchPercent) || 0)));
    const missingProof = (row.missingProof || "")
      .split(/[,;]/)
      .map((x) => cleanToken(x))
      .filter((x) => x.length > 1 && x.length < 40)
      .slice(0, 4);
    const missingList = missingProof.length ? missingProof : missingFromAts;

    const whyStrong = applyForbiddenGuard(
      row.whyThisRoleFits || row.reason || (tr ? "Founder deneyimi ürün sahipliğine dönüşüyor." : "Founder experience translates into ownership."),
      lang
    );
    const projectedScore = clampScore(Math.round(matchPercent + Math.max(8, pointsGain * 0.9)));
    const missingLine = missingList.slice(0, 3).join(tr ? " ve " : " and ");
    const ifGapClosedLabel = tr
      ? `Tahmini skor %${projectedScore}.`
      : `Estimated score ${projectedScore}%.`;
    return {
      medal: medals[idx] || "•",
      role: applyForbiddenGuard(row.role, lang),
      matchPercent,
      matchLabel: tr ? `Uyum: %${matchPercent}` : `Fit: ${matchPercent}%`,
      pointsGain,
      projectedScore,
      projectedScoreLabel: ifGapClosedLabel,
      ifGapClosedLabel,
      missingLine,
      whyItFits: whyStrong,
      whyStrong,
      missingProof: missingList.map((x) => applyForbiddenGuard(x, lang)),
      fastestImprovement: applyForbiddenGuard(
        row.fastestImprovement || roleFastestImprovement(row.role, row.missingProof, atsIntelligence, lang),
        lang
      ),
    };
  });
}

function buildHeroEliminationBlock({
  atsIntelligence,
  decisionSignals,
  primaryLimiter,
  cognition,
  fixEngine,
  eliminatingBlockerSentence,
  lang,
}) {
  const tr = isTr(lang);
  const reasons = [];
  const atsWeak =
    atsIntelligence?.matchBand === "Weak" ||
    Number(decisionSignals?.ATSMatch) < 45 ||
    atsIntelligence?.riskBand === "High";
  if (atsWeak) {
    reasons.push(tr ? "ATS eşleşmesi zayıf." : "ATS match is weak.");
  }
  if (
    primaryLimiter?.key === "EvidenceStrength" ||
    cognition?.proofGap?.missingProof ||
    Number(decisionSignals?.EvidenceStrength) < 55
  ) {
    reasons.push(tr ? "CV ürün sahipliğini yeterince göstermiyor." : "CV does not show product ownership clearly enough.");
  }
  if (primaryLimiter?.key === "ATSMatch" && !reasons.some((r) => /ATS/i.test(r))) {
    reasons.push(tr ? "ATS anahtar kelime eşleşmesi düşük." : "ATS keyword match is low.");
  }
  if (!reasons.length && eliminatingBlockerSentence) {
    reasons.push(applyForbiddenGuard(eliminatingBlockerSentence, lang));
  }
  if (!reasons.length && primaryLimiter?.label) {
    reasons.push(applyForbiddenGuard(`${primaryLimiter.label} zayıf.`, lang));
  }
  const gain = fixEngine?.topGain ?? fixEngine?.fixes?.[0]?.pointsGain ?? 0;
  return {
    title: tr ? "SENİ ŞU AN ELEYEN ŞEY" : "WHAT IS FILTERING YOU OUT",
    reasons: reasons.slice(0, 2),
    expectedGain: gain,
    expectedGainLabel: tr ? `+${gain} puan` : `+${gain} pts`,
  };
}

function buildOutcomeProjection(score, fixEngine, lang) {
  const tr = isTr(lang);
  const current = clampScore(Math.round(Number(score) || 0));
  const fixes = (fixEngine?.fixes || []).slice(0, 2);
  const scoreSteps = [{ key: "now", label: tr ? "Şu an" : "Now", score: current }];
  let running = current;
  fixes.forEach((fix, idx) => {
    running = clampScore(running + (Number(fix.pointsGain) || 0));
    scoreSteps.push({
      key: `fix-${idx + 1}`,
      label: tr ? `${idx + 1}. düzeltme sonrası` : `After fix ${idx + 1}`,
      score: running,
    });
  });
  const projectedScore = scoreSteps[scoreSteps.length - 1].score;
  const projectedDecision = projectedDecisionFromScore(projectedScore, lang);
  const riskBefore = firstRoundRiskLabel(current, lang);
  const riskAfter = firstRoundRiskLabel(projectedScore, lang);
  return {
    title: tr ? "BUNU DÜZELTİRSEN NE OLUR" : "IF YOU FIX THIS",
    subtitle: tr ? "Beklenen skor değişimi" : "Expected score change",
    scoreSteps,
    currentScore: current,
    projectedScore,
    projectedDecision,
    firstRoundRisk: {
      before: riskBefore,
      after: riskAfter,
      transitionLabel: `${riskBefore} → ${riskAfter}`,
    },
    architectureReady: true,
  };
}

function winningPathActionForFix(fix, lang) {
  const tr = isTr(lang);
  const byCategory = {
    ATS: tr ? "ATS eşleşmesini düzelt" : "Fix ATS match",
    "Product Ownership": tr ? "Ürün sahipliği kanıtını görünür yap" : "Make product ownership visible",
    "Business Impact": tr ? "Ölçülebilir iş etkisini ekle" : "Add measurable business impact",
    Positioning: tr ? "Konumlandırmayı netleştir" : "Clarify positioning",
    "Role Alignment": tr ? "Rol uyumunu güçlendir" : "Strengthen role alignment",
    "Story Clarity": tr ? "Hikayeyi sadeleştir" : "Simplify your story",
  };
  return applyForbiddenGuard(byCategory[fix.category] || fix.categoryLabel || (tr ? "CV düzeltmesi" : "CV fix"), lang);
}

function buildWinningPath(fixEngine, outcomeProjection, lang) {
  const tr = isTr(lang);
  const fixes = (fixEngine?.fixes || []).slice(0, 2);
  const steps = fixes.map((fix, idx) => ({
    order: idx + 1,
    action: winningPathActionForFix(fix, lang),
    gain: Number(fix.pointsGain) || 0,
    gainLabel: `+${Number(fix.pointsGain) || 0}`,
  }));
  steps.push({
    order: steps.length + 1,
    action: tr ? "Yeniden analiz et" : "Re-analyze",
    gain: 0,
    gainLabel: "",
  });
  const from = outcomeProjection?.currentScore ?? 0;
  const to = outcomeProjection?.projectedScore ?? from;
  const projectedDecision = outcomeProjection?.projectedDecision || projectedDecisionFromScore(to, lang);
  return {
    title: tr ? "En hızlı yükseliş planı" : "Fastest lift plan",
    steps,
    scoreRange: `${from} → ${to}`,
    projectedScore: to,
    projectedDecision,
    projectedDecisionLabel: projectedDecision.label,
    recruiterOutcome: applyForbiddenGuard(
      tr ? "Kısa liste ihtimali yükselir." : "Shortlist odds improve.",
      lang
    ),
    architectureReady: true,
  };
}

function buildDecisionHero({
  headline,
  verdictHierarchy,
  applicationDecision,
  atsIntelligence,
  decisionSignals,
  eliminatingBlockerSentence,
  primaryLimiter,
  lang,
}) {
  const tr = isTr(lang);
  const confidencePercent = applicationDecision?.confidencePercent ?? null;
  const recruiterStrong = Number(decisionSignals?.RecruiterConfidence) >= 50;
  const atsWeak =
    atsIntelligence?.matchBand === "Weak" ||
    Number(decisionSignals?.ATSMatch) < 45 ||
    atsIntelligence?.riskBand === "High";
  let biggestProblem = applyForbiddenGuard(eliminatingBlockerSentence || "", lang);
  if (!biggestProblem && primaryLimiter?.label) {
    biggestProblem = applyForbiddenGuard(`${primaryLimiter.label} zayıf.`, lang);
  }
  return {
    headline: applyForbiddenGuard(headline || verdictHierarchy?.hero || "", lang),
    confidencePercent,
    recruiterLine: recruiterStrong
      ? (tr ? "Recruiter ilgilenir." : "Recruiters will show interest.")
      : (tr ? "Recruiter ilgisi zayıf." : "Recruiter interest is weak."),
    atsLine: atsWeak
      ? (tr ? "ATS tarafında elenebilirsin." : "ATS may filter you out.")
      : (tr ? "ATS filtresini geçebilirsin." : "You can pass the ATS filter."),
    biggestProblem,
  };
}

function buildRoleAlternativesPreview(roleSuggestions, score, lang) {
  const tr = isTr(lang);
  const medals = ["🥇", "🥈"];
  return (roleSuggestions || []).slice(0, 2).map((row, idx) => {
    const matchPercent = Math.round(Number(row.matchPercent) || 0);
    const pointsGain =
      idx === 0
        ? Math.round(Number(row.potentialGainPercent) || Math.max(8, matchPercent - (Number(score) || 0)))
        : Math.round(Number(row.altGainPercent) || Math.max(6, (Number(roleSuggestions[0]?.matchPercent) || 0) - matchPercent));
    return {
      medal: medals[idx] || "•",
      role: applyForbiddenGuard(row.role, lang),
      matchPercent,
      pointsGain,
    };
  });
}

function buildFixEngine({
  cvStrengthen,
  primaryLimiter,
  expectedImpact,
  cognition,
  atsIntelligence,
  cvText,
  score,
  lang,
}) {
  const tr = isTr(lang);
  const gainById = {
    "ats-role-language": 14,
    "product-ownership": 12,
    "proof-gap": 11,
    "role-bridge": 9,
    "expected-lift": 7,
  };
  const whyByCategory = {
    ATS: tr
      ? "ATS ve recruiter bu rol dilini ilk bakışta arar."
      : "ATS and recruiters look for this role language on first scan.",
    "Product Ownership": tr
      ? "Ürün rollerinde sahiplenme kanıtı shortlist için kritik."
      : "Ownership proof is critical for product-role shortlists.",
    "Business Impact": tr
      ? "Ölçülebilir etki olmadan güven oluşmaz."
      : "Trust does not form without measurable impact.",
    "Role Alignment": tr
      ? "Rol geçişi ilk 10 saniyede net olmalı."
      : "Role transition must read clearly in 10 seconds.",
    "Story Clarity": tr
      ? "Hikaye netliği recruiter kararını hızlandırır."
      : "Story clarity speeds recruiter decisions.",
    Positioning: tr
      ? "Konumlandırma netliği savunmayı güçlendirir."
      : "Positioning clarity strengthens your case.",
  };

  const byCategory = new Map();
  for (const item of cvStrengthen?.improvements || []) {
    const category = mapImprovementToCategory(item.id, primaryLimiter);
    if (byCategory.has(category)) continue;
    const pointsGain = gainById[item.id] ?? 8;
    const suggestedRewrite = applyForbiddenGuard(item.suggestedText || item.suggestedRewrite, lang);
    const problem = applyForbiddenGuard(item.problem || item.issue, lang);
    byCategory.set(category, {
      id: item.id,
      category,
      categoryLabel: fixCategoryLabel(category, lang),
      problem,
      whyItMatters: applyForbiddenGuard(whyByCategory[category] || whyByCategory["Story Clarity"], lang),
      suggestedRewrite,
      beforeSnippet: problem,
      afterSnippet: suggestedRewrite,
      copyText: suggestedRewrite,
      pointsGain,
      applyFixReady: false,
    });
  }

  if (!byCategory.has("ATS") && (primaryLimiter?.key === "ATSMatch" || atsIntelligence?.matchBand === "Weak")) {
    const atsProblem = tr ? "Roadmap sahipliği CV'de görünmüyor." : "Roadmap ownership is not visible on the CV.";
    const atsRewrite = tr
      ? "Müşteri geri bildirimine göre roadmap önceliklendirmesini yönettim."
      : "Prioritized roadmap initiatives based on customer feedback and business goals.";
    byCategory.set("ATS", {
      id: "ats-role-language",
      category: "ATS",
      categoryLabel: fixCategoryLabel("ATS", lang),
      problem: atsProblem,
      whyItMatters: whyByCategory.ATS,
      suggestedRewrite: atsRewrite,
      beforeSnippet: atsProblem,
      afterSnippet: atsRewrite,
      copyText: atsRewrite,
      pointsGain: 14,
      applyFixReady: false,
    });
  }

  const fixes = [...byCategory.values()]
    .sort((a, b) => b.pointsGain - a.pointsGain)
    .slice(0, 4)
    .map((fix, idx) => {
      const meta = priorityMetaForRank(idx + 1, lang);
      return { ...fix, rank: idx + 1, ...meta };
    });

  const topGain = fixes[0]?.pointsGain ?? 12;

  return {
    title: tr ? "CV'Yİ GÜÇLENDİR" : "STRENGTHEN YOUR CV",
    fixes,
    topGain,
    architectureReady: true,
  };
}

function buildFixRecommendations(fixEngine) {
  return fixEngine?.fixes || [];
}

function buildCvStrengthenSection({
  primaryLimiter,
  cognition,
  atsIntelligence,
  identityEngine,
  roleSuggestions,
  expectedImpact,
  jdText,
  lang,
}) {
  const tr = isTr(lang);
  const posting = inferPostingRoleFamily(jdText, lang);
  const productPosting = /product|ürün|urun/i.test(`${jdText || ""} ${posting}`);
  const missingKw = (atsIntelligence?.missingCriticalKeywords || []).slice(0, 2);
  const topRole = roleSuggestions?.[0]?.role || posting;
  const improvements = [];

  const pushImprovement = (id, problem, suggestedText, expectedImpact) => {
    const guardedProblem = applyForbiddenGuard(problem, lang);
    const guardedText = applyForbiddenGuard(suggestedText, lang);
    const guardedImpact = applyForbiddenGuard(expectedImpact, lang);
    improvements.push({
      id,
      problem: guardedProblem,
      suggestedText: guardedText,
      expectedImpact: guardedImpact,
      issue: guardedProblem,
      suggestedRewrite: guardedText,
      impact: guardedImpact,
      applyFixReady: false,
    });
  };

  if (primaryLimiter?.key === "ATSMatch" || atsIntelligence?.matchBand === "Weak") {
    const missingDisplay = (atsIntelligence?.displayMissingCritical || missingKw)
      .map((kw) => formatAtsKeywordForDisplay(kw))
      .filter(Boolean)
      .slice(0, 2);
    const rewrite = productPosting
      ? (tr
        ? "Müşteri geri bildirimi ve iş hedeflerine göre roadmap önceliklendirmesini yönettim."
        : "Led roadmap prioritization using customer feedback and business goals.")
      : (tr
        ? `${topRole} için ölçülebilir sonuç ve sahiplenmeyi tek cümlede öne çıkardım.`
        : `Surfaced measurable outcomes and ownership for ${topRole} in one line.`);
    pushImprovement(
      "ats-role-language",
      tr ? "Özet ve proje satırları ilan dilini taşımıyor." : "Summary and project lines do not mirror posting language.",
      rewrite,
      tr ? "İlan eşleşmesi ve ilk filtre geçişi güçlenir." : "Posting match and first-filter pass improve."
    );
  }

  if ((productPosting || identityEngine?.primaryIdentity?.id === "FounderBuilder") && !improvements.some((x) => x.id === "ats-role-language")) {
    pushImprovement(
      "product-ownership",
      tr ? "Ürün sahipliği ilk bakışta net değil." : "Product ownership is not clear on first read.",
      tr
        ? "Kullanıcı geri bildirimi ve iş hedeflerine göre ürün önceliklendirmesini yönettim."
        : "Led product prioritization based on user feedback and business goals.",
      tr ? "Ürün rolünde savunulabilirliği artırır." : "Raises defensibility for product roles."
    );
  }

  if (primaryLimiter?.key === "EvidenceStrength" && cognition?.proofGap?.missingProof) {
    const gap = oneSentence(cognition.proofGap.missingProof, lang);
    pushImprovement(
      "proof-gap",
      gap,
      tr
        ? "Tek somut çıktıyı, etkisini ve hedef role bağlantısını özetin ilk satırına taşı."
        : "Move one concrete output, its impact, and role tie-in to the first summary line.",
      tr ? "Kanıt gücünü ve savunulabilirliği artırır." : "Raises evidence strength and defensibility."
    );
  }

  if (primaryLimiter?.key === "RoleAlignment" || primaryLimiter?.key === "NarrativeClarity") {
    pushImprovement(
      "role-bridge",
      tr ? `CV ${topRole} geçişini ilk okumada yavaş gösteriyor` : `CV shows the ${topRole} transition too slowly on first read`,
      tr
        ? `${topRole} için tek proje satırında sahiplenme, çıktı ve sonucu aynı cümlede bağla.`
        : `In one project line for ${topRole}, tie ownership, output, and result in one sentence.`,
      tr ? "Rol uyumunu ve recruiter hızını artırır." : "Improves role fit and recruiter read speed."
    );
  }

  const impactHint = expectedImpact?.outcomeRows?.[0];
  if (improvements.length < 3 && impactHint) {
    pushImprovement(
      "expected-lift",
      tr ? "Ana sinyal henüz zayıf bantta" : "Main signal still in a weak band",
      tr
        ? "En güçlü kanıtı özetin üstüne taşı ve ölçülebilir sonuç ekle."
        : "Move the strongest proof to the top of the summary and add a measurable outcome.",
      tr
        ? `${impactHint.label}: ${impactHint.current} → ${impactHint.expected} beklenir.`
        : `Expected ${impactHint.label}: ${impactHint.current} → ${impactHint.expected}.`
    );
  }

  return {
    title: tr ? "CV'Yİ GÜÇLENDİR" : "STRENGTHEN YOUR CV",
    improvements: improvements.slice(0, 3),
    architectureReady: true,
  };
}

function buildApplyFixArchitecture(cvStrengthen, careerImprovementLoop, lang) {
  const tr = isTr(lang);
  return {
    enabled: false,
    architectureReady: true,
    label: tr ? "Öneriyi Uygula" : "Apply suggestion",
    flow: ["select_improvement", "patch_cv_section", "reanalyze", "compare_delta"],
    endpoints: {
      applyFix: "/api/apply-fix",
      reanalyze: "/api/analyze-v2",
    },
    improvements: (cvStrengthen?.improvements || []).map((item) => ({
      id: item.id,
      applyFixReady: false,
      targetSection: item.targetSection || "summary",
    })),
    refreshCta: careerImprovementLoop?.refreshCta || (tr ? "AI ile CV'yi bu ilana göre yenile" : "Refresh CV for this posting with AI"),
    compareReady: Boolean(careerImprovementLoop?.features?.beforeAfterScore),
  };
}

function buildAnalysisComparisonModel({
  score,
  decisionSignals,
  atsIntelligence,
  expectedImpact,
  verdictHierarchy,
  progressDelta,
  lang,
}) {
  const tr = isTr(lang);
  const preview = expectedImpact?.previewSignals || {};
  const interviewBefore =
    verdictHierarchy?.state === "GREEN"
      ? (tr ? "Yüksek" : "High")
      : verdictHierarchy?.state === "YELLOW"
        ? (tr ? "Orta" : "Medium")
        : (tr ? "Düşük" : "Low");
  const interviewAfter =
    expectedImpact?.previewVerdictState === "GREEN"
      ? (tr ? "Yüksek" : "High")
      : expectedImpact?.previewVerdictState === "YELLOW"
        ? (tr ? "Orta" : "Medium")
        : (tr ? "Düşük" : "Low");
  const beforeAnalysis = {
    score: Math.round(Number(score) || 0),
    atsMatch: Math.round(Number(decisionSignals?.ATSMatch) || 0),
    atsMatchLabel: atsIntelligence?.matchLabel || scoreLabel(decisionSignals?.ATSMatch, lang),
    roleMatch: Math.round(Number(decisionSignals?.RoleAlignment) || 0),
    roleMatchLabel: scoreLabel(decisionSignals?.RoleAlignment, lang),
    recruiterConfidence: Math.round(Number(decisionSignals?.RecruiterConfidence) || 0),
    recruiterConfidenceLabel: scoreLabel(decisionSignals?.RecruiterConfidence, lang),
    interviewProbability: interviewBefore,
    verdictState: verdictHierarchy?.state || "YELLOW",
  };
  const afterAnalysis = {
    score: clampScore(Math.round(Number(score) || 0) + Math.round((expectedImpact?.lift || 12) * 0.35)),
    atsMatch: Math.round(Number(preview.ATSMatch ?? decisionSignals?.ATSMatch) || 0),
    atsMatchLabel: scoreLabel(preview.ATSMatch ?? decisionSignals?.ATSMatch, lang),
    roleMatch: Math.round(Number(preview.RoleAlignment ?? decisionSignals?.RoleAlignment) || 0),
    roleMatchLabel: scoreLabel(preview.RoleAlignment ?? decisionSignals?.RoleAlignment, lang),
    recruiterConfidence: Math.round(Number(preview.RecruiterConfidence ?? decisionSignals?.RecruiterConfidence) || 0),
    recruiterConfidenceLabel: scoreLabel(preview.RecruiterConfidence ?? decisionSignals?.RecruiterConfidence, lang),
    interviewProbability: interviewAfter,
    verdictState: expectedImpact?.previewVerdictState || verdictHierarchy?.state,
  };
  const delta = {
    scoreDelta: afterAnalysis.score - beforeAnalysis.score,
    rows: [
      {
        key: "ats",
        label: "ATS",
        before: beforeAnalysis.atsMatch,
        after: afterAnalysis.atsMatch,
        beforeLabel: beforeAnalysis.atsMatchLabel,
        afterLabel: afterAnalysis.atsMatchLabel,
      },
      {
        key: "roleMatch",
        label: tr ? "Rol uyumu" : "Role match",
        before: beforeAnalysis.roleMatch,
        after: afterAnalysis.roleMatch,
        beforeLabel: beforeAnalysis.roleMatchLabel,
        afterLabel: afterAnalysis.roleMatchLabel,
      },
      {
        key: "recruiterConfidence",
        label: tr ? "Recruiter güveni" : "Recruiter confidence",
        before: beforeAnalysis.recruiterConfidence,
        after: afterAnalysis.recruiterConfidence,
        beforeLabel: beforeAnalysis.recruiterConfidenceLabel,
        afterLabel: afterAnalysis.recruiterConfidenceLabel,
      },
      {
        key: "interview",
        label: tr ? "Mülakat ihtimali" : "Interview probability",
        before: beforeAnalysis.interviewProbability,
        after: afterAnalysis.interviewProbability,
        improves: interviewAfter !== interviewBefore,
      },
    ],
    interviewProbabilityChange: interviewAfter !== interviewBefore
      ? (tr ? "Artar" : "Increases")
      : (tr ? "Sınırlı artış" : "Limited increase"),
    progressDelta: progressDelta || null,
  };
  return {
    architectureReady: true,
    beforeAnalysis,
    afterAnalysis,
    delta,
  };
}

function buildApplicationStrategy(applicationDecision, eliminatingBlockerSentence, expectedImpact, roleSuggestions, lang) {
  const tr = isTr(lang);
  let recommendation = "APPLY_AFTER_FIXES";
  if (applicationDecision?.decision === "APPLY") recommendation = "APPLY_NOW";
  if (applicationDecision?.decision === "DO_NOT_APPLY") recommendation = "SKIP_ROLE";

  const labelMap = {
    APPLY_NOW: tr ? "Şimdi başvur" : "Apply now",
    APPLY_AFTER_FIXES: tr ? "Düzeltip başvur" : "Apply after fixes",
    SKIP_ROLE: tr ? "Bu rolü atla" : "Skip role",
  };
  const reasonMap = {
    APPLY_NOW: tr
      ? "Recruiter ve ATS okuması bu ilan için yeterince hizalı."
      : "Recruiter and ATS reads are aligned enough for this posting.",
    APPLY_AFTER_FIXES: eliminatingBlockerSentence || (tr
      ? "Potansiyel var; önce CV'deki ana blokajı netleştir."
      : "There is potential; clear the main CV blocker first."),
    SKIP_ROLE: tr
      ? "İlk tur savunması zayıf; enerjiyi daha güçlü role yönlendirmek daha mantıklı."
      : "First-round defense is weak; energy is better spent on a stronger lane.",
  };
  const outcomeMap = {
    APPLY_NOW: tr ? "Mülakat ihtimali yüksek kalır." : "Interview odds stay strong.",
    APPLY_AFTER_FIXES: expectedImpact?.expectedResult || (tr
      ? "ATS ve rol uyumu bandı yukarı çıkabilir."
      : "ATS and role-fit bands can move up."),
    SKIP_ROLE: roleSuggestions?.[0]?.role
      ? (tr
        ? `${roleSuggestions[0].role} hattında daha hızlı güven kurulur.`
        : `Trust builds faster in the ${roleSuggestions[0].role} lane.`)
      : (tr ? "Alternatif role odaklan." : "Focus on an alternative lane."),
  };
  return {
    recommendation,
    label: labelMap[recommendation],
    reason: applyForbiddenGuard(reasonMap[recommendation], lang),
    expectedOutcome: applyForbiddenGuard(outcomeMap[recommendation], lang),
    architectureReady: true,
  };
}

function buildCareerImprovementLoop(progressDelta, lang) {
  const tr = isTr(lang);
  return {
    architectureReady: true,
    steps: [
      { id: "analyze", label: tr ? "Analiz" : "Analyze", status: "complete" },
      { id: "fix", label: tr ? "Düzelt" : "Fix", status: "active" },
      { id: "reanalyze", label: tr ? "Yeniden analiz" : "Re-analyze", status: "pending" },
      { id: "compare", label: tr ? "Karşılaştır" : "Compare", status: "pending" },
      { id: "improve", label: tr ? "İyileştir" : "Improve", status: "pending" },
    ],
    features: {
      aiCvRefresh: false,
      beforeAfterScore: Boolean(progressDelta?.scoreDelta),
      deltaExplanation: Boolean(progressDelta?.summary),
    },
    refreshCta: tr ? "AI ile CV'yi bu ilana göre yenile" : "Refresh CV for this posting with AI",
    progressDelta: progressDelta || null,
  };
}

function buildExpectedAtsImpact(atsIntelligence, limiter, lang) {
  if (!atsIntelligence || limiter.key !== "ATSMatch") return null;
  const nextRisk = atsIntelligence.riskBand === "High" ? "Medium" : atsIntelligence.riskBand;
  const nextMatch = atsIntelligence.matchBand === "Weak" ? "Partial" : atsIntelligence.matchBand;
  const riskChanges = nextRisk !== atsIntelligence.riskBand;
  const matchChanges = nextMatch !== atsIntelligence.matchBand;
  if (!riskChanges && !matchChanges) return null;
  return {
    before: {
      riskBand: atsIntelligence.riskBand,
      riskLabel: atsIntelligence.riskLabel,
      matchBand: atsIntelligence.matchBand,
      matchLabel: atsIntelligence.matchLabel,
    },
    after: {
      riskBand: nextRisk,
      riskLabel: atsBandLabel("risk", nextRisk, lang),
      matchBand: nextMatch,
      matchLabel: atsBandLabel("match", nextMatch, lang),
    },
    changes: true,
  };
}

function buildBeforeAfterPreview(cognition, limiter, roleSuggestions, lang, identityEngine = null) {
  const tr = isTr(lang);
  const topRole = roleSuggestions?.[0]?.role || (tr ? "hedef rol" : "target role");
  const identity = identityEngine?.primaryIdentity?.label || profileIdentityLabel(cognition.signals, lang);
  const before =
    cognition.signals.careerLeverage.lane === "product_builder"
      ? (tr ? "AI Product Builder | Founder" : "AI Product Builder | Founder")
      : `${identity}`;
  let after = before;
  if (limiter.key === "IdentityClarity") {
    after = tr ? `${identity} | net recruiter kimliği` : `${identity} | clear recruiter identity`;
  } else if (limiter.key === "ATSMatch") {
    after = tr ? `${identity} | ilan dili daha net` : `${identity} | clearer posting language`;
  } else if (limiter.key === "RoleAlignment" || limiter.key === "NarrativeClarity") {
    after = tr ? `${identity} | ${topRole} adayı` : `${identity} | ${topRole} candidate`;
  } else if (limiter.key === "EvidenceStrength") {
    after = tr ? `${identity} | ölçülebilir sonuç` : `${identity} | measurable outcome`;
  } else {
    after = tr ? `${identity} | savunulabilir profil` : `${identity} | defensible profile`;
  }
  return { before, after, rendered: false };
}

function buildProgressDelta(previousState, decisionSignals, verdictHierarchy, lang, identityEngine = null, identityClarity = null, atsIntelligence = null) {
  if (!previousState?.signals) return null;
  const tr = isTr(lang);
  const labels = {
    ATSMatch: tr ? "ATS anahtar kelime eşleşmesi" : "ATS keyword match",
    RecruiterConfidence: tr ? "Recruiter Güveni" : "Recruiter Confidence",
    EvidenceStrength: tr ? "Kanıt Gücü" : "Evidence Strength",
    RoleAlignment: tr ? "Rol Uyumu" : "Role Alignment",
    IdentityClarity: tr ? "Kimlik Netliği" : "Identity Clarity",
    NarrativeClarity: tr ? "Hikaye Netliği" : "Narrative Clarity",
  };
  const changes = Object.keys(labels).map((key) => {
    const beforeLabel = scoreLabel(previousState.signals[key], lang);
    const afterLabel = scoreLabel(decisionSignals[key], lang);
    return {
      key,
      label: labels[key],
      before: beforeLabel,
      after: afterLabel,
      improved: signalBandFromLabel(afterLabel) > signalBandFromLabel(beforeLabel),
    };
  }).filter((row) => row.improved);
  const verdictImproved = verdictRank(verdictHierarchy.state) > verdictRank(previousState.verdictState);
  const previousIdentityClarity = previousState.identity?.identityClarity?.score;
  const currentIdentityClarity = identityClarity?.score;
  const identityImproved =
    Number.isFinite(Number(previousIdentityClarity)) &&
    Number.isFinite(Number(currentIdentityClarity)) &&
    bandRank(currentIdentityClarity, lang) > bandRank(previousIdentityClarity, lang);
  const identityImpact = identityImproved ? {
    before: {
      primaryIdentity: previousState.identity?.primaryIdentity || null,
      identityClarity: previousState.identity?.identityClarity || null,
    },
    after: {
      primaryIdentity: identityEngine?.primaryIdentity || null,
      identityClarity,
    },
  } : null;
  const previousAts = previousState.atsIntelligence || null;
  const atsRiskImproved = previousAts && atsIntelligence && previousAts.riskBand === "High" && atsIntelligence.riskBand !== "High";
  const atsMatchImproved = previousAts && atsIntelligence && signalBandFromLabel(atsIntelligence.matchLabel) > signalBandFromLabel(previousAts.matchLabel);
  const atsImpact = (atsRiskImproved || atsMatchImproved) ? {
    before: previousAts,
    after: atsIntelligence,
  } : null;
  const deltaRows = [
    { key: "ATSMatch", label: "ATS" },
    { key: "RecruiterConfidence", label: tr ? "Recruiter Trust" : "Recruiter Trust" },
    { key: "RoleAlignment", label: tr ? "Role Alignment" : "Role Alignment" },
  ].map((row) => {
    const beforeScore = Math.round(Number(previousState.signals[row.key]) || 0);
    const afterScore = Math.round(Number(decisionSignals[row.key]) || 0);
    return {
      ...row,
      beforeScore,
      afterScore,
      delta: Math.max(0, afterScore - beforeScore),
      before: scoreLabel(beforeScore, lang),
      after: scoreLabel(afterScore, lang),
    };
  });
  const totalImprovement = deltaRows.reduce((sum, row) => sum + row.delta, 0);
  const deltaComparison = {
    rows: deltaRows,
    totalImprovement,
    improved: totalImprovement > 0,
  };
  if (!changes.length && !verdictImproved && !identityImpact && !atsImpact && totalImprovement <= 0) {
    return {
      changes: [],
      verdict: null,
      identityImpact,
      atsImpact,
      deltaComparison,
      celebration: "",
      hiddenOnly: true,
    };
  }
  const top = changes[0];
  return {
    changes,
    verdict: verdictImproved ? {
      before: previousState.verdictState,
      after: verdictHierarchy.state,
    } : null,
    identityImpact,
    atsImpact,
    deltaComparison,
    celebration: atsImpact
      ? (tr ? "ATS eşleşmesi güçlendi." : "ATS match improved.")
      : identityImpact
      ? (tr ? "Kimlik Netliği sinyali yükseldi." : "Identity Clarity improved.")
      : totalImprovement > 0
      ? (tr ? "Bu güncelleme recruiter okumasını güçlendirdi." : "This update strengthened the recruiter read.")
      : top
      ? (tr ? `${top.label} sinyali yükseldi.` : `${top.label} improved.`)
      : (tr ? "Bu güncelleme recruiter okumasını güçlendirdi." : "This update strengthened the recruiter read."),
    hiddenOnly: false,
  };
}

function heroFromInterviewModel(model, score, lang) {
  const tr = isTr(lang);
  if (!model) return headlineFromScore(score, lang);
  if (model.decisionBand === "move_forward") return tr ? "İlk görüşme savunulabilir." : "A first interview is defensible.";
  if (model.decisionBand === "borderline") return tr ? "Shortlist sınırında." : "Right on the shortlist line.";
  return tr ? "İlk filtre zor geçer." : "The first screen is hard to clear.";
}

function buildObjectionEngine(signals, proofGap, hiringManager, eliteTrust, lang) {
  const tr = isTr(lang);
  let objection = tr
    ? `İlginç profil; ama ${proofGap.missingProof} net değil.`
    : `Interesting profile, but ${proofGap.missingProof} is not clear.`;
  if (eliteTrust.founderTitleInflation) {
    objection = tr
      ? "İlginç kurucu profili; ama unvanın arkasındaki ölçek ve çıktı net değil."
      : "Interesting founder profile, but scale and output behind the title are not clear.";
  } else if (signals.executionProof.level !== "weak" && signals.scaleProof.level === "weak") {
    objection = tr
      ? "İş çıkardığı belli; ama bunun ne kadar büyüdüğü okunmuyor."
      : "The work is visible, but its size is not.";
  } else if (hiringManager.confidence < 55) {
    objection = tr
      ? "Hiring manager bu görüşmenin hangi iş problemine cevap vereceğini net görmeyebilir."
      : "The hiring manager may not see which business problem this interview would answer.";
  }
  return {
    strongest_objection: objection,
    proofCategory: proofGap.category,
    visible: objection,
  };
}

function buildHiringDecisionNextAction(proofGap, roleSuggestions, signals, lang) {
  const tr = isTr(lang);
  const topRole = roleSuggestions?.[0]?.role || "";
  if (proofGap?.isMissing === false) {
    return tr
      ? "Sonraki hamle: en güçlü sonucu özetin ilk satırına taşı."
      : "Next move: move the strongest result into the first summary line.";
  }
  if (proofGap.category === "Scale Proof") {
    return tr
      ? "Sonraki hamle: özete tek ölçülebilir ürün/iş sonucu ekle."
      : "Next move: add one measurable product or business outcome to the summary.";
  }
  if (proofGap.category === "Product Proof") {
    return tr
      ? "Sonraki hamle: CV'de PRD/backlog/roadmap çıktısını görünür yap."
      : "Next move: make PRD/backlog/roadmap output visible on the CV.";
  }
  if (proofGap.category === "Revenue Proof") {
    return tr
      ? "Sonraki hamle: gelir, pipeline veya dönüşüm etkisini tek satırla yaz."
      : "Next move: write revenue, pipeline, or conversion impact in one line.";
  }
  if (proofGap.category === "Analytical Proof") {
    return tr
      ? "Sonraki hamle: kullandığın analiz aracını ve karar etkisini aynı satıra bağla."
      : "Next move: connect the analysis tool and decision impact in the same line.";
  }
  if (/ürün|urun|product/i.test(topRole) || signals.careerLeverage.lane === "product_builder") {
    return tr
      ? "Sonraki hamle: Product Management hikayesini başlık, özet ve projelerde aynı çizgiye getir."
      : "Next move: align title, summary, and projects around a Product Management story.";
  }
  return tr
    ? "Sonraki hamle: en güçlü iş çıktını hedef rolün istediği kanıta bağla."
    : "Next move: connect your strongest work output to the proof this role needs.";
}

function buildOneAction(limiter, proofGap, roleSuggestions, signals, lang) {
  const tr = isTr(lang);
  if (limiter.key === "RoleAlignment") {
    return tr
      ? "Sonraki hamle: hedef rolü başlık, özet ve en güçlü proje satırında aynı isimle yaz."
      : "Next move: name the target role the same way in title, summary, and strongest project line.";
  }
  if (limiter.key === "NarrativeClarity") {
    return tr
      ? "Sonraki hamle: özete tek kariyer yönü yaz ve projeleri o yöne bağla."
      : "Next move: write one career direction in the summary and tie projects to it.";
  }
  if (limiter.key === "RecruiterConfidence") {
    return tr
      ? "Sonraki hamle: recruiter'ın savunacağı tek sonucu özete taşı."
      : "Next move: move one recruiter-defensible result into the summary.";
  }
  if (limiter.key === "IdentityClarity") {
    return tr
      ? "Sonraki hamle: özette tek recruiter kimliği seç ve diğer kanıtları ona bağla."
      : "Next move: choose one recruiter identity in the summary and tie the other proof to it.";
  }
  if (limiter.key === "ATSMatch") {
    return tr
      ? "Sonraki Hamle: CV'ye ilandaki 2-3 kritik terimi doğal ve kanıtlı şekilde ekle."
      : "Next move: add 2-3 critical posting terms naturally with proof.";
  }
  return buildHiringDecisionNextAction(proofGap, roleSuggestions, signals, lang);
}

function proofGapShortLine(proofGap, lang) {
  const tr = isTr(lang);
  if (!proofGap) return tr ? "Kanıt görünmüyor." : "Proof is not visible.";
  if (proofGap.isMissing === false) return tr ? "En güçlü kanıt önde olmalı." : "The strongest proof should move forward.";
  if (proofGap.category === "Scale Proof") return tr ? "Etki görünmüyor." : "Impact size is not visible.";
  if (proofGap.category === "Product Proof") return tr ? "Ürün çıktısı görünmüyor." : "Product output is not visible.";
  if (proofGap.category === "Execution Proof") return tr ? "Teslim edilen iş net değil." : "Delivered work is not clear.";
  if (proofGap.category === "Ownership Proof") return tr ? "Sahiplik net değil." : "Ownership is not clear.";
  if (proofGap.category === "Customer Proof") return tr ? "Kullanıcı kanıtı eksik." : "User proof is missing.";
  if (proofGap.category === "Revenue Proof") return tr ? "Gelir etkisi görünmüyor." : "Revenue impact is not visible.";
  if (proofGap.category === "Analytical Proof") return tr ? "Analitik çıktı eksik." : "Analytical output is missing.";
  if (proofGap.category === "Operational Proof") return tr ? "Operasyonel sistem kanıtı eksik." : "Operational system proof is missing.";
  if (proofGap.category === "Leadership Proof") return tr ? "Liderlik kapsamı belirsiz." : "Leadership scope is unclear.";
  if (proofGap.category === "Domain Proof") return tr ? "Domain kanıtı eksik." : "Domain proof is missing.";
  return proofGap.missingProof ? `${proofGap.missingProof}.` : (tr ? "Kanıt eksik." : "Proof is missing.");
}

function limiterBlockerHeadline(verdictHierarchy, limiter, lang) {
  const tr = isTr(lang);
  if (limiter.key === "ATSMatch") return tr ? "ATS anahtar kelime eşleşmesi" : "ATS keyword match";
  if (verdictHierarchy.state === "GREEN") return verdictHierarchy.blockerHeadline;
  if (limiter.key === "IdentityClarity") return tr ? "Kimlik Kararı" : "Identity Decision";
  if (limiter.key === "EvidenceStrength") return tr ? "Eksik Kanıt" : "Missing Proof";
  return tr ? "Ana Sınırlayıcı" : "Primary Limiter";
}

function inferPostingRoleFamily(jdText, lang) {
  const tr = isTr(lang);
  const jd = String(jdText || "").toLowerCase();
  if (/product manager|product owner|ürün yönetic|urun yonetic|product management|\bpm\b/i.test(jd)) {
    return tr ? "Product" : "Product";
  }
  if (/business analyst|iş analisti|is analisti|business analysis/i.test(jd)) {
    return tr ? "Business Analysis" : "Business Analysis";
  }
  if (/strategy|strateji|operations|operasyon/i.test(jd) && !/product|ürün|urun/i.test(jd)) {
    return tr ? "Strategy & Operations" : "Strategy & Operations";
  }
  if (/marketing|pazarlama|growth|büyüme|buyume/i.test(jd)) {
    return tr ? "Growth" : "Growth";
  }
  if (/data analyst|veri analiz|sql|dashboard/i.test(jd)) {
    return tr ? "Data Analysis" : "Data Analysis";
  }
  return tr ? "hedef rol" : "target role";
}

function humanLimiterSentence({ limiter, identityEngine, cognition, jdText, lang }) {
  const tr = isTr(lang);
  const primary = identityEngine?.primaryIdentity;
  const posting = inferPostingRoleFamily(jdText, lang);
  const proofGap = cognition?.proofGap;
  const productPosting = /product|ürün|urun/i.test(`${jdText || ""} ${posting}`);

  if (limiter.key === "ATSMatch") {
    return tr
      ? "ATS anahtar kelime eşleşmesi."
      : "ATS keyword match.";
  }

  if (primary?.id === "FounderBuilder" && productPosting) {
    return tr
      ? "Founder kimliği ürün rolüne tam çevrilmiyor."
      : "Founder identity does not fully convert to the product role.";
  }
  if (limiter.key === "NarrativeClarity") {
    if (primary?.id === "FounderBuilder" && productPosting) {
      return tr
        ? "Founder kimliği ürün rolüne tam çevrilmiyor."
        : "Founder identity does not fully convert to the product role.";
    }
    if (primary) {
      return tr
        ? `Recruiter seni ${primary.label} olarak okuyor; ilan ${posting} kanıtı bekliyor.`
        : `The recruiter reads you as ${primary.label}; the posting expects ${posting} proof.`;
    }
    return tr
      ? "Kariyer hikayesi hedef role ilk okumada net bağlanmıyor."
      : "The career story does not connect to the target role fast enough on first read.";
  }
  if (limiter.key === "IdentityClarity") {
    if (primary) {
      return tr
        ? `Recruiter seni ${primary.label} olarak okuyor; ilan ${posting} kanıtı bekliyor.`
        : `The recruiter reads you as ${primary.label}; the posting expects ${posting} proof.`;
    }
  }
  if (limiter.key === "EvidenceStrength" && proofGap?.missingProof) {
    return tr
      ? `${proofGap.missingProof} ilk turda net görünmüyor.`
      : `${proofGap.missingProof} is not clear on the first pass.`;
  }
  if (limiter.key === "RoleAlignment") {
    return tr
      ? `CV bu ilanın beklediği ${posting} geçişini ilk okumada yeterince hızlı göstermiyor.`
      : `The CV does not show the ${posting} transition fast enough on first read.`;
  }
  if (limiter.key === "RecruiterConfidence") {
    return tr
      ? "Recruiter güveni ilk turda tam kapanmıyor."
      : "Recruiter confidence does not fully close on the first screen.";
  }
  return tr
    ? "İlk tur kararı için kanıt henüz yeterince net görünmüyor."
    : "Proof is not yet clear enough for a first-round decision.";
}

function buildEliminatingBlockerSentence({ limiter, identityEngine, cognition, jdText, lang }) {
  const tr = isTr(lang);
  const primary = identityEngine?.primaryIdentity;
  const posting = inferPostingRoleFamily(jdText, lang);
  const proofGap = cognition?.proofGap;
  const productPosting = /product|ürün|urun/i.test(`${jdText || ""} ${posting}`);
  let sentence = "";

  if (limiter.key === "ATSMatch") {
    sentence = primary?.id === "FounderBuilder" && productPosting
      ? (tr
        ? "ATS eşleşmesi zayıf; CV ürün sahipliğini yeterince görünür kılmıyor."
        : "ATS match is weak; the CV does not make product ownership visible enough.")
      : (tr
        ? "ATS eşleşmesi zayıf; CV ilanın kritik rol terimlerini yeterince taşımıyor."
        : "ATS match is weak; the CV does not carry enough of the posting's role language.");
  } else if (limiter.key === "IdentityClarity" || (primary?.id === "FounderBuilder" && productPosting)) {
    sentence = tr
      ? `Recruiter seni ${primary?.label || "tek kategori"} olarak okuyor; ${posting} kanıtı ilk turda net değil.`
      : `The recruiter reads you as ${primary?.label || "one category"}; ${posting} proof is not clear on the first screen.`;
  } else if (limiter.key === "EvidenceStrength") {
    const gap = proofGapShortLine(proofGap, lang).replace(/[.!?]\s*$/, "");
    sentence = tr
      ? `${gap}; recruiter bu kanıtı görmeden kısa listeyi savunamaz.`
      : `${gap}; the recruiter cannot defend the shortlist without seeing that proof.`;
  } else if (limiter.key === "RoleAlignment") {
    sentence = tr
      ? `CV bu ilanın beklediği ${posting} geçişini ilk okumada yeterince hızlı göstermiyor.`
      : `The CV does not show the ${posting} transition fast enough on first read.`;
  } else if (limiter.key === "NarrativeClarity") {
    sentence = tr
      ? "Başlık, deneyim ve hedef rol aynı recruiter kimliğine bağlanmıyor."
      : "Title, experience, and target role do not point to one recruiter identity.";
  } else {
    sentence = tr
      ? "Recruiter ilk tur için savunulabilir kanıtı hızlı okuyamıyor."
      : "The recruiter cannot read defensible first-round proof fast enough.";
  }
  return oneSentence(sentence, lang);
}

function compactEvidenceForBullet(evidence, lang) {
  const tr = isTr(lang);
  const ev = evidenceDisplay(evidence);
  if (!ev) return tr ? "sahiplendiğim proje" : "owned project";
  if (tr) {
    if (/hirefit/i.test(ev)) return "HireFit'i canlıya alma deneyimim";
    if (/built|launched|shipped|founded|canlıya|canliya|yayına|yayina|kurup/i.test(ev)) return "canlıya aldığım ürün/proje";
    if (/dashboard|sql|reporting|analytics|rapor|analiz/i.test(ev)) return "dashboard ve analiz çıktım";
    return sanitizeVisibleTurkish(ev, lang).replace(/[.!?]\s*$/, "");
  }
  return ev;
}

const COACHING_BULLET_RE =
  /improve your|gain more|learn |communication skills|soft skills|network more|be more|should consider|önerilir|geliştirmelisin|deneyim kazan|iletişim becer/i;

function buildRecruiterWantedBullets(cognition, limiter, roleSuggestions, atsIntelligence, lang, narrativeAxis = null) {
  const tr = isTr(lang);
  const topRole = roleSuggestions?.[0]?.role || (tr ? "hedef rol" : "target role");
  const role = String(topRole || "").toLowerCase();
  const productish =
    /ürün|urun|product|ai product/.test(role) ||
    /product|ürün|urun|builder/i.test(String(narrativeAxis?.narrativeLabel || ""));
  const dataish = /analiz|analysis|data|veri/.test(role);
  const growthish = /growth|büyüme|buyume|gtm/.test(role) && !productish;
  const missingKeywords = (atsIntelligence?.missingCriticalKeywords || []).slice(0, 2);

  const pool = productish
    ? [
      tr ? "Roadmap sahipliği" : "Roadmap ownership",
      tr ? "Ürün kararı örnekleri" : "Product decision examples",
      tr ? "Kullanıcı geri bildirimiyle iyileştirme" : "User-feedback-driven improvements",
      tr ? "PRD / backlog çıktısı" : "PRD / backlog output",
      tr ? "Ürün metrikleri" : "Product metrics",
    ]
    : dataish
      ? [
        tr ? "SQL / dashboard çıktısı" : "SQL / dashboard output",
        tr ? "Raporlama ve karar görünürlüğü" : "Reporting and decision visibility",
        tr ? "Süreç haritalama kanıtı" : "Process mapping proof",
      ]
      : growthish
        ? [
          tr ? "Kanal ve dönüşüm denemeleri" : "Channel and conversion experiments",
          tr ? "Kampanya veya edinim çıktısı" : "Campaign or acquisition output",
          tr ? "Ölçülebilir büyüme etkisi" : "Measurable growth impact",
        ]
        : [
          tr ? "Hedef role bağlı somut çıktı" : "Concrete output tied to the target role",
          tr ? "Paydaş yönetimi" : "Stakeholder management",
          tr ? "Ölçülebilir iş etkisi" : "Measurable business impact",
        ];

  for (const kw of missingKeywords) {
    pool.push(tr ? `${kw} kanıtı` : `${kw} proof`);
  }

  const bullets = [...new Set(pool)]
    .map((line) => applyForbiddenGuard(line, lang))
    .filter((line) => line && !COACHING_BULLET_RE.test(line));

  while (bullets.length < 3) {
    bullets.push(productish
      ? (tr ? "Stakeholder yönetimi" : "Stakeholder management")
      : (tr ? "Ölçülebilir sonuç" : "Measurable outcome"));
  }
  return bullets.slice(0, 3);
}

function buildSimulationDecisionLine({ decisionState, primary, productPosting, posting, alternateRole, lang }) {
  const tr = isTr(lang);
  if (decisionState === "Hold") {
    if (primary?.id === "FounderBuilder" && productPosting) {
      return tr
        ? "Görüşme ihtimali var; ama CV ilk okumada ürün yönünü yeterince hızlı göstermiyor."
        : "Interview is possible, but the CV does not show the product direction fast enough on first read.";
    }
    return tr
      ? "Recruiter ilgilenir; kısa liste için rol kanıtını net görmek ister."
      : "The recruiter is interested but wants clearer role proof before shortlisting.";
  }
  if (decisionState === "Shortlist") {
    return tr
      ? "Kısa listeye alınabilir; son kontrol kanıtın netliğinde."
      : "Can be shortlisted; the last check is proof clarity.";
  }
  if (decisionState === "Reject") {
    return tr
      ? "İlk turda savunulabilir kanıt henüz yeterince görünür değil."
      : "Defensible proof is not visible enough on the first screen.";
  }
  if (decisionState === "Redirect") {
    const lane = alternateRole || posting;
    return tr
      ? `Bu ilandan çok ${lane} hattında daha hızlı güven kurulur.`
      : `Trust builds faster in the ${lane} lane than in this posting.`;
  }
  return tr
    ? "Recruiter ilgilenir; kısa liste için rol kanıtını net görmek ister."
    : "The recruiter is interested but wants clearer role proof before shortlisting.";
}

function inferRecruiterDecisionState({
  verdictHierarchy,
  identityConflict,
  decisionSignals,
  score,
  roleSuggestions,
  identityEngine,
  jdText,
}) {
  const n = Number(score) || 0;
  const posting = inferPostingRoleFamily(jdText, "TR");
  const primary = identityEngine?.primaryIdentity;
  const roleAlign = Number(decisionSignals?.RoleAlignment) || 0;
  const productPosting = /product|ürün|urun/i.test(`${jdText || ""} ${posting}`);
  const founderProductGap = primary?.id === "FounderBuilder" && productPosting && roleAlign < 72;

  if (verdictHierarchy?.state === "RED" || n < 50) return "Reject";
  if (identityConflict?.hasConflict && roleSuggestions?.length >= 2 && roleAlign < 62) return "Redirect";
  if (verdictHierarchy?.state === "GREEN" && n >= 75 && !founderProductGap && !identityConflict?.hasConflict) {
    return "Shortlist";
  }
  if (founderProductGap || verdictHierarchy?.state === "YELLOW" || (n >= 50 && n < 75)) return "Hold";
  return "Hold";
}

function buildRecruiterDecisionSimulation({
  identityEngine,
  identityConflict,
  cognition,
  verdictHierarchy,
  primaryLimiter,
  decisionSignals,
  score,
  roleSuggestions,
  jdText,
  lang,
}) {
  const tr = isTr(lang);
  const primary = identityEngine?.primaryIdentity;
  const posting = inferPostingRoleFamily(jdText, lang);
  const firstReadCategory = primary?.label || (tr ? "tek bir profil" : "one profile");
  const productPosting = /product|ürün|urun/i.test(`${jdText || ""} ${posting}`);

  const hiringRisk = (() => {
    if (primary?.id === "FounderBuilder" && productPosting) {
      return tr
        ? `${posting} rolüne geçiş CV'de yeterince hızlı görünmüyor.`
        : `The move to ${posting} does not show fast enough on the CV.`;
    }
    if (primaryLimiter.key === "EvidenceStrength" && cognition?.proofGap?.missingProof) {
      return tr
        ? `${cognition.proofGap.missingProof} ilk turda net görünmüyor.`
        : `${cognition.proofGap.missingProof} is not clear on the first pass.`;
    }
    if (identityConflict?.hasConflict && identityConflict.identityConflict) {
      return identityConflict.identityConflict.split(".")[0] + ".";
    }
    return tr
      ? `CV bu ilanın beklediği ${posting} kanıtını ilk okumada yeterince hızlı bağlamıyor.`
      : `The CV does not connect to ${posting} proof fast enough on first read.`;
  })();

  const decisionState = inferRecruiterDecisionState({
    verdictHierarchy,
    identityConflict,
    decisionSignals,
    score,
    roleSuggestions,
    identityEngine,
    jdText,
  });

  const decisionReason = (() => {
    if (primary?.id === "FounderBuilder" && productPosting) {
      return tr
        ? "Ürün sahiplenmesi var ama ürün çıktısı net görünmüyor."
        : "Product ownership is there, but product output is not clear.";
    }
    if (decisionState === "Redirect" && roleSuggestions?.[0]?.role) {
      return tr
        ? `${roleSuggestions[0].role} hattında profil daha doğal okunuyor.`
        : `The profile reads more naturally in the ${roleSuggestions[0].role} lane.`;
    }
    if (decisionState === "Shortlist") {
      return tr
        ? "Kanıt hedef role yeterince hızlı bağlanıyor."
        : "Proof connects to the role fast enough.";
    }
    if (decisionState === "Reject") {
      return tr
        ? "İlk turda savunulabilir kanıt henüz yeterince görünür değil."
        : "Defensible proof is not visible enough on the first screen.";
    }
    return tr
      ? "Geçiş mümkün ama CV bunu ilk okumada yeterince hızlı göstermiyor."
      : "The transition is possible, but the CV does not show it fast enough on first read.";
  })();

  const decisionVisible = buildSimulationDecisionLine({
    decisionState,
    primary,
    productPosting,
    posting,
    alternateRole: roleSuggestions?.[0]?.role,
    lang,
  });

  const visible = {
    firstReadLine: tr
      ? `İlk 5 saniyede recruiter seni ${firstReadCategory} olarak okuyor.`
      : `In the first five seconds, the recruiter reads you as ${firstReadCategory}.`,
    riskLine: tr ? `Risk: ${hiringRisk}` : `Risk: ${hiringRisk}`,
    decisionLine: tr ? `Karar: ${decisionVisible}` : `Decision: ${decisionVisible}`,
    reasonLine: tr ? `Neden: ${decisionReason}` : `Why: ${decisionReason}`,
  };

  const recruiterDecisionLine = (() => {
    if (decisionState === "Hold") {
      if (primary?.id === "FounderBuilder" && productPosting) {
        return tr
          ? "Recruiter ilgilenir; kısa liste için ürün rolü kanıtını net görmek ister."
          : "The recruiter is interested but wants clearer product-role proof before shortlisting.";
      }
      return tr
        ? "Recruiter ilgilenir; kısa liste için rol kanıtını net görmek ister."
        : "The recruiter is interested but wants clearer role proof before shortlisting.";
    }
    if (decisionState === "Shortlist") {
      return tr
        ? "Recruiter kısa listeye alır; son kontrol kanıtın görünürlüğünde."
        : "The recruiter shortlists; the last check is proof visibility.";
    }
    if (decisionState === "Reject") {
      return tr
        ? "Recruiter ilk filtreyi geçirmek için daha sert kanıt bekler."
        : "The recruiter needs harder proof to pass the first filter.";
    }
    if (decisionState === "Redirect") {
      return tr
        ? "Recruiter bu ilandan çok alternatif role daha hızlı güven kurar."
        : "The recruiter builds trust faster in an alternative lane than in this posting.";
    }
    return tr
      ? "Recruiter ilgilenir; kısa liste için rol kanıtını net görmek ister."
      : "The recruiter is interested but wants clearer role proof before shortlisting.";
  })();

  return {
    internal: {
      firstReadCategory,
      hiringRisk,
      decisionState,
      decisionReason,
    },
    visible,
    recruiterDecisionLine,
    mainBlockerLine: `${tr ? "Ana Sınırlayıcı" : "Primary limiter"}: ${humanLimiterSentence({
      limiter: primaryLimiter,
      identityEngine,
      cognition,
      jdText,
      lang,
    })}`,
  };
}

function buildRoleCardLines(roleId, identityEngine, lang) {
  const tr = isTr(lang);
  const isFounder = identityEngine?.primaryIdentity?.id === "FounderBuilder";
  const cards = {
    product_management: {
      strength: isFounder
        ? (tr ? "Founder kimliğin ürün sahiplenmesine doğal dönüşüyor." : "Your founder identity maps naturally into product ownership.")
        : (tr ? "Ürün sahiplenmesi ve problem çözme tarafın okunuyor." : "Product ownership and problem-solving read clearly."),
      gap: tr ? "Eksik: PRD / roadmap / kullanıcı çıktısı." : "Missing: PRD / roadmap / user output.",
    },
    product_strategy: {
      strength: tr ? "Pazar ve önceliklendirme tarafın okunuyor." : "Market and prioritization read clearly.",
      gap: tr ? "Eksik: ürün yönü ve çıktı kanıtı." : "Missing: product direction and output proof.",
    },
    strategy_operations: {
      strength: tr ? "Pazar, GTM ve karar kalitesi tarafın okunuyor." : "Market, GTM, and decision quality read clearly.",
      gap: tr ? "Eksik: ölçülebilir iş etkisi." : "Missing: measurable business impact.",
    },
    business_analysis: {
      strength: tr ? "Süreç ve veriyle düşünme tarafın okunuyor." : "Process and data thinking read clearly.",
      gap: tr ? "Eksik: dashboard / SQL / raporlama çıktısı." : "Missing: dashboard / SQL / reporting output.",
    },
    growth: {
      strength: tr ? "Pazar teması ve sonuç takibi tarafın okunuyor." : "Market contact and outcome tracking read clearly.",
      gap: tr ? "Eksik: ölçülebilir edinim / kampanya çıktısı." : "Missing: measurable acquisition / campaign output.",
    },
    data_analysis: {
      strength: tr ? "Metrik ve analiz tarafın okunuyor." : "Metrics and analysis read clearly.",
      gap: tr ? "Eksik: dashboard / SQL / raporlama çıktısı." : "Missing: dashboard / SQL / reporting output.",
    },
    project_management: {
      strength: tr ? "Teslim ve paydaş takibi tarafın okunuyor." : "Delivery and stakeholder tracking read clearly.",
      gap: tr ? "Eksik: ölçekli proje çıktısı." : "Missing: scaled project output.",
    },
  };
  const t = cards[roleId] || cards.business_analysis;
  return [t.strength, t.gap].filter(Boolean);
}

function roleConfidenceUpgrade(roleId, lang) {
  const tr = isTr(lang);
  const upgrades = {
    product_management: tr ? "PRD/backlog/roadmap çıktısını görünür yaparsan ürün sahipliği daha hızlı ikna yaratır." : "Visible PRD/backlog/roadmap output makes product ownership easier to trust.",
    product_strategy: tr ? "Pazar okumasını ürün kararıyla bağlarsan strateji tarafı daha savunulabilir olur." : "Connecting market read to product decisions makes the strategy lane easier to defend.",
    strategy_operations: tr ? "Karar etkisini sayı, süreç veya GTM çıktısıyla bağlarsan güven artar." : "Trust rises when decision impact connects to a number, process, or GTM output.",
    business_analysis: tr ? "Dashboard, gereksinim veya süreç haritası çıktısı bu hattı güçlendirir." : "Dashboard, requirements, or process-map output strengthens this lane.",
    growth: tr ? "Kampanya, kanal veya dönüşüm öğrenmesini görünür yaparsan recruiter daha hızlı güvenir." : "Visible campaign, channel, or conversion learning builds recruiter trust faster.",
    growth_strategy: tr ? "Deneme sonucunu pazar kararıyla bağlarsan growth tarafı daha net okunur." : "The growth read gets clearer when experiment results connect to market decisions.",
    data_analysis: tr ? "SQL/dashboard/rapor çıktısı görünürse analiz güveni hızlanır." : "SQL/dashboard/reporting output speeds up analytics trust.",
    project_management: tr ? "Teslim takvimi, paydaş kapsamı ve sonuç netleşirse bu hat güçlenir." : "This lane strengthens when timeline, stakeholder scope, and outcome are clear.",
    business_development: tr ? "Pipeline, partner veya gelir etkisi görünürse güven artar." : "Trust rises when pipeline, partner, or revenue impact is visible.",
    customer_success: tr ? "Müşteri teması ve tekrar eden değer kanıtı görünürse güven artar." : "Trust rises when customer contact and repeated value proof are visible.",
    ux_research: tr ? "Kullanıcı görüşmesi, içgörü ve ürün kararına etkisi görünürse güven artar." : "Trust rises when interviews, insight, and product-decision impact are visible.",
    ai_product_operations: tr ? "AI workflow'un kime hizmet ettiği ve nasıl kullanıldığı görünürse güven artar." : "Trust rises when it is clear who the AI workflow served and how it was used.",
  };
  return upgrades[roleId] || (tr ? "Role özel çıktı görünürse recruiter güveni artar." : "Recruiter trust rises when role-specific output is visible.");
}

function finalizeRecruiterDecisionV7(vm, ctx) {
  const sim = buildRecruiterDecisionSimulation({
    identityEngine: ctx.identityEngine,
    identityConflict: ctx.identityConflict,
    cognition: ctx.cognition,
    verdictHierarchy: vm._internal?.verdictHierarchy,
    primaryLimiter: vm._internal?.primaryLimiter || vm.primaryLimiter,
    decisionSignals: vm._internal?.decisionSignals,
    score: vm.score,
    roleSuggestions: vm.roleSuggestions,
    jdText: ctx.jdText,
    lang: ctx.lang,
  });
  const lang = ctx.lang;
  const roleSuggestions = (vm.roleSuggestions || []).map((r) => {
    const lines = (r.lines || []).slice(0, 2).map((line) => applyForbiddenGuard(line, lang));
    return {
      ...r,
      lines,
      reason: applyForbiddenGuard(lines[0] || r.reason, lang),
      whyThisRoleFits: applyForbiddenGuard(r.whyThisRoleFits || lines[0] || r.reason, lang),
      missingProof: applyForbiddenGuard(r.missingProof || lines[1] || "", lang),
      confidenceUpgrade: applyForbiddenGuard(r.confidenceUpgrade || "", lang),
      rankNote: applyForbiddenGuard(r.rankNote || "", lang),
    };
  }).filter((r) => r.role);

  return {
    ...vm,
    roleSuggestions,
    recruiterDecisionSimulation: null,
    mainBlocker: applyForbiddenGuard(vm.eliminatingBlockerSentence || "", lang),
    eliminatingBlockerSentence: applyForbiddenGuard(vm.eliminatingBlockerSentence || "", lang),
    recruiterView: {
      ...vm.recruiterView,
      strength: applyForbiddenGuard(vm.recruiterView?.strength, lang),
      gap: applyForbiddenGuard(vm.recruiterView?.gap, lang),
      decision: applyForbiddenGuard(sim.recruiterDecisionLine, lang),
    },
    _internal: {
      ...vm._internal,
      recruiterDecisionSimulation: sim.internal,
    },
  };
}

function buildMainBlockerLine({
  limiter,
  blockerHeadline,
  blockerReason,
  nextMove,
  progressionPreview,
  lang,
  identityEngine,
  cognition,
  jdText,
}) {
  const tr = isTr(lang);
  const head = tr ? "Ana Sınırlayıcı" : "Primary limiter";
  const sentence = humanLimiterSentence({ limiter, identityEngine, cognition, jdText, lang });
  return `${head}: ${sentence}`;
}

function marketFitFrame(intel, lang) {
  const tr = isTr(lang);
  if (intel.hasBuilder && intel.targetCorporate && intel.targetExecutionHeavy) {
    return tr
      ? "Builder tarafın güçlü; kurumsal ekiplerde daha somut çıktı görmek isterler."
      : "The builder side is strong; corporate teams will want clearer output.";
  }
  if (intel.hasBuilder && (intel.targetAmbiguity || intel.hasProduct)) {
    return tr
      ? "Recruiter seni klasik adaydan çok builder gibi okur; belirsiz işte hareket edebildiğin anlaşılıyor."
      : "A recruiter reads you less like a traditional applicant and more like a builder who can operate in ambiguity.";
  }
  if (intel.hasStrategy && intel.hasData) {
    return tr
      ? "Profilin karar kalitesi tarafında güçleniyor: analiz, pazar okuması ve iş etkisi aynı hikayeye bağlanabilir."
      : "Your profile gets stronger around decision quality: analysis, market read, and business impact can connect into one story.";
  }
  if (intel.hasGrowth) {
    return tr
      ? "Recruiter güveni büyüme/edinim tarafında artar; çünkü profil sonuç odaklı pazar temasına daha yakın duruyor."
      : "Recruiter confidence rises in growth or acquisition contexts because the profile sits closer to market-facing outcomes.";
  }
  return tr
    ? "Profil tamamen kopuk değil; asıl mesele deneyimin hangi kariyer yönüne bağlandığını net göstermek."
    : "The profile is not disconnected; the real issue is making the career direction easier to read.";
}

function trustPsychologyLine(intel, score, lang) {
  const tr = isTr(lang);
  if (intel.hasFounder || intel.hasBuilder) {
    if (intel.hasMetrics) {
      return tr
        ? "Founder/builder geçmişi recruiter'a inisiyatif ve belirsizlikte hareket etme güveni verir."
        : "Founder or builder evidence gives the recruiter confidence that you can move without a perfect brief.";
    }
    return tr
      ? "Builder tarafın güçlü; ama etki ölçeği yazılmadığı için güven tam kapanmıyor."
      : "The builder side is strong, but trust does not fully close because scale of impact is not explicit.";
  }
  if (intel.hasData && intel.hasStrategy) {
    return tr
      ? "Analiz ve strateji birlikte görünürse recruiter seni sadece uygulayıcı değil, karar destek profili olarak okur."
      : "When analysis and strategy show together, a recruiter reads you as decision support, not just execution.";
  }
  if (Number(score) < 55) {
    return tr
      ? "Recruiter ilk bakışta niyeti değil, kanıtı arar; şu an hikaye savunması zor."
      : "On first read, the recruiter looks for proof, not intent; the story is hard to defend as written.";
  }
  return tr
    ? "Recruiter temel potansiyeli görür; duraksadığı yer bu potansiyelin hedef role nasıl taşındığı."
    : "The recruiter can see base potential; the hesitation is how that potential transfers into this role.";
}

function hesitationLine(intel, lang) {
  const tr = isTr(lang);
  if (intel.targetStrictSpecialist && !intel.hasData) {
    return tr
      ? "İlan daha uzman bir araç/analiz izi istiyor; CV bu güveni ilk bakışta kurmuyor."
      : "The posting wants specialist tool or analysis proof; the CV does not build that trust on first read.";
  }
  if (intel.targetCorporate && intel.hasBuilder && !intel.hasMetrics) {
    return tr
      ? "Kurumsal funnel'da soru şu olur: bu ownership daha büyük ölçekte tekrarlandı mı?"
      : "In a corporate funnel, the question becomes: has this ownership repeated at larger scale?";
  }
  if (intel.hasProduct && !intel.hasOps && intel.targetExecutionHeavy) {
    return tr
      ? "Ürün tarafı var; ama operasyonel takip ve teslim ölçeği recruiter için hâlâ açıkta."
      : "The product side is there, but operational follow-through and delivery scale remain open questions.";
  }
  if (!intel.hasMetrics) {
    return tr
      ? "Ölçülebilir sonuç yoksa recruiter başarıyı sezmek zorunda kalır; bu da güveni düşürür."
      : "Without measurable outcomes, the recruiter has to infer impact; that lowers confidence.";
  }
  return tr
    ? "Duraksama tek bir eksikten değil; CV'nin hedef role bağlanan hikayesi yeterince keskin değil."
    : "The hesitation is not one missing item; the CV story is not sharp enough for the target role.";
}

function buildRecruiterCognition(cvText, jdText, score, lang) {
  const tr = isTr(lang);
  const intel = inferCareerIntelligence(cvText, jdText);
  const signals = buildInternalSignalEngine(cvText, jdText, score, lang);
  const signalStack = buildSignalStacking(cvText, jdText, signals, lang);
  const trustCalibration = buildTrustCalibrationEngine(cvText, jdText, signals, signalStack);
  const defensibility = buildCareerDefensibility(signals, trustCalibration, signalStack, lang);
  const narrativeCoherence = buildRoleNarrativeCoherence(cvText, jdText, signals, lang);
  const microPsychology = buildMicroPsychology(signals, trustCalibration, defensibility, narrativeCoherence, lang);
  const signalHierarchy = buildSignalHierarchy(cvText, jdText, signals, signalStack, lang);
  const eliteTrustCalibration = buildEliteTrustCalibration(
    cvText,
    jdText,
    signals,
    signalStack,
    signalHierarchy,
    trustCalibration,
    defensibility,
    lang
  );
  const defensibilityReasoning = buildDefensibilityReasoning(signals, eliteTrustCalibration, signalHierarchy, lang);
  const recruiterMicroPsychology = buildRecruiterMicroPsychology(
    signals,
    eliteTrustCalibration,
    defensibilityReasoning,
    lang
  );
  const adaptiveScoring = buildAdaptiveRoleScoring(
    score,
    signals,
    trustCalibration,
    defensibility,
    signalHierarchy,
    eliteTrustCalibration
  );
  const businessValue = buildBusinessValueEngine(cvText, jdText, lang);
  const roleDNA = buildRoleDNAEngine(cvText, jdText, businessValue, lang);
  const proofGap = buildProofGapEngine(cvText, jdText, signals, businessValue, lang);
  const consequence = buildConsequenceEngine(proofGap, businessValue, lang);
  const hiringManagerLayer = buildHiringManagerLayer(cvText, jdText, signals, businessValue, proofGap, lang);
  const interviewProbability = buildInterviewProbabilityModel(
    score,
    signals,
    eliteTrustCalibration,
    proofGap,
    hiringManagerLayer,
    businessValue
  );
  const objection = buildObjectionEngine(signals, proofGap, hiringManagerLayer, eliteTrustCalibration, lang);
  const productChain = buildEvidenceChain({
    claim: tr ? "Ürün/builder profili görünür." : "Builder/product profile is visible.",
    cvText,
    jdText,
    cvPatterns: [/hirefit/i, /product|ürün|urun|roadmap|prd|backlog|user stor|user feedback|kullanıcı geri|kullanici geri/i],
    jdPatterns: [/ownership|initiative|product|ürün|urun|roadmap|prd|backlog|stakeholder|execution|initiative/i],
    missingKind: "productArtifacts",
    interpretation: tr
      ? "Recruiter inisiyatif görebilir; fakat ürün ritüeli veya teslim kanıtı arar."
      : "The recruiter can see initiative, but still looks for product ritual or delivery proof.",
    impact: tr
      ? "Merak yaratır; ilk tur riskini tamamen kapatmaz."
      : "Creates curiosity; does not fully remove first-round risk.",
    lang,
  });
  const scaleChain = buildEvidenceChain({
    claim: tr ? "Etki ölçeği kanıtlanmalı." : "Scale of impact needs proof.",
    cvText,
    jdText,
    cvPatterns: [/\d+\s?%/, /\d+\s?(k|m|users|clients|projects|hours|days)\b/i, /\bKPI\b/i, /metric|metrik|revenue|gelir/i],
    jdPatterns: [/scale|team|stakeholder|enterprise|corporate|kurumsal|cross-functional|impact|kpi|metric|ölçek|olcek/i],
    missingKind: "scale",
    interpretation: tr
      ? "Recruiter başarıyı sezmek yerine ölçü veya tekrar kanıtı görmek ister."
      : "The recruiter wants measurement or repeatability instead of inferring success.",
    impact: tr
      ? "Güvenin tavanını düşürür; özellikle kurumsal funnel'da."
      : "Caps trust, especially in a corporate funnel.",
    lang,
  });
  const roleBridgeChain = buildEvidenceChain({
    claim: tr ? "Geçmiş deneyim hedef role bağlanmalı." : "Past experience must bridge to the target role.",
    cvText,
    jdText,
    cvPatterns: [/stakeholder|paydaş|paydas|delivery|roadmap|prd|backlog|sql|excel|dashboard|campaign|gtm|operations|operasyon/i],
    jdPatterns: [/required|must|ownership|stakeholder|delivery|roadmap|sql|excel|dashboard|campaign|operations|operasyon|sorumlu/i],
    missingKind: "roleBridge",
    interpretation: tr
      ? "Recruiter transfer potansiyelini görebilir; ama role özel kanıtı hızlı yakalamak ister."
      : "The recruiter can see transfer potential, but wants role-specific proof quickly.",
    impact: tr
      ? "İlk ekran kararını yavaşlatır."
      : "Slows the first-screen decision.",
    lang,
  });
  const firstScreenClarity = Number(score) >= 75
    ? (tr ? "Hedef rol ilk bakışta okunabiliyor." : "The target role reads clearly on first glance.")
    : intel.hasBuilder
      ? (tr ? "İlk bakışta builder kimliği okunuyor; hedef rol daha az net." : "Builder identity reads first; the target role is less clear.")
      : (tr ? "İlk bakışta hedef rol netleşmiyor." : "The target role does not become clear on first read.");
  const trustEvidence = productChain.hasCvEvidence || scaleChain.hasCvEvidence
    ? trustPsychologyLine(intel, score, lang)
    : (tr ? "CV iddia değil, savunulabilir kanıt göstermeli; şu an kanıt zayıf." : "The CV needs defensible proof, not just claims; proof is thin right now.");
  const roleBridge = roleBridgeChain.hasCvEvidence && roleBridgeChain.hasJdEvidence
    ? (tr ? "Transfer köprüsü var; daha görünür yazılırsa recruiter güveni artar." : "The transfer bridge exists; making it more visible raises recruiter confidence.")
    : roleBridgeChain.recruiterInterpretation;
  const scaleProof = scaleChain.hasCvEvidence
    ? (tr ? "Etki ölçeği kısmen savunulabilir." : "Impact scale is partly defensible.")
    : scaleChain.riskOrConfidenceImpact;
  const ambiguityTolerance = intel.hasBuilder || intel.hasFounder
    ? (tr ? "Belirsizlikte iş çıkarma ihtimali güçlü okunuyor." : "Ability to operate in ambiguity reads strong.")
    : (tr ? "Belirsizlikte çalışma kanıtı belirgin değil." : "Ambiguity tolerance proof is not obvious.");
  const fitMode = intel.hasBuilder && intel.targetCorporate
    ? (tr ? "Startup/builder fit daha güçlü; kurumsal fit için ölçek kanıtı gerekir." : "Startup/builder fit is stronger; corporate fit needs scale proof.")
    : intel.hasBuilder
      ? (tr ? "Ownership-heavy ürün/startup ortamlarında daha hızlı güven verir." : "Builds trust faster in ownership-heavy product/startup environments.")
      : (tr ? "Daha yapılandırılmış rollerde hikaye netleştirilmeli." : "The story needs sharpening for structured roles.");
  const hiringHesitation = hesitationLine(intel, lang);
  const careerLeverage = marketFitFrame(intel, lang);
  return {
    intel,
    signals,
    signalStack,
    signalHierarchy,
    trustCalibration,
    eliteTrustCalibration,
    defensibility,
    defensibilityReasoning,
    narrativeCoherence,
    microPsychology,
    recruiterMicroPsychology,
    adaptiveScoring,
    businessValue,
    roleDNA,
    proofGap,
    consequence,
    hiringManagerLayer,
    interviewProbability,
    objection,
    chains: { product: productChain, scale: scaleChain, roleBridge: roleBridgeChain },
    firstScreenClarity,
    trustEvidence,
    roleBridge,
    scaleProof,
    ambiguityTolerance,
    fitMode,
    hiringHesitation,
    careerLeverage,
  };
}

function roleEvidencePatterns(roleId) {
  const sharedBuilder = [/hirefit/i, /launched|shipped|built|founded|created|canlıya|yayına|kurdum|geliştirdim|gelistirdim/i];
  const map = {
    product_management: [/product|ürün|urun|roadmap|prd|backlog|user stor|user feedback|kullanıcı geri|kullanici geri/i, ...sharedBuilder],
    product_strategy: [/strategy|strateji|market|positioning|roadmap|pricing|competitive|önceliklendirme|onceliklendirme/i, ...sharedBuilder],
    growth: [/growth|funnel|activation|retention|acquisition|conversion|seo|campaign|kampanya|linkedin|instagram/i],
    growth_strategy: [/growth|gtm|go[-\s]?to[-\s]?market|market|acquisition|conversion|strategy|strateji/i],
    strategy_operations: [/strategy|strateji|operations|operasyon|process|süreç|surec|delivery|stakeholder|coordination/i],
    gtm_operations: [/gtm|go[-\s]?to[-\s]?market|sales|pipeline|crm|revenue|market|growth/i],
    ai_product_operations: [/\bai\b|llm|prompt|automation|workflow|yapay zeka|hirefit/i, ...sharedBuilder],
    business_analysis: [/business analys|iş analiz|is analiz|requirement|gereksinim|process|raporlama|analysis|analiz/i],
    marketing: [/marketing|pazarlama|campaign|kampanya|landing page|linkedin|instagram|seo|content|içerik|icerik/i],
    data_analysis: [/data|veri|sql|excel|dashboard|power\s?bi|tableau|analytics|analysis|analiz|metric|metrik|kpi/i],
    project_management: [/project|proje|delivery|stakeholder|coordination|paydaş|paydas|takip|timeline|plan/i],
    business_development: [/business development|sales|satış|satis|partnership|lead generation|client|müşteri|musteri/i],
    customer_success: [/customer success|account|onboarding|support|client|müşteri|musteri|user feedback/i],
    ux_research: [/ux|user research|kullanıcı araştır|kullanici arastir|interview|usability|persona|user feedback/i],
  };
  return map[roleId] || map.business_analysis;
}

function roleUpgradeProof(roleId, lang) {
  const tr = isTr(lang);
  const map = {
    product_management: tr ? "Bu hattı güçlendirmek için CV'de PRD/backlog/roadmap çıktısı görünmeli." : "To upgrade this lane, the CV needs visible PRD/backlog/roadmap output.",
    product_strategy: tr ? "Bu hattı güçlendirmek için pazar okuması, önceliklendirme veya ürün karar gerekçesi görünmeli." : "To upgrade this lane, show market read, prioritization, or product decision rationale.",
    growth: tr ? "Bu hattı güçlendirmek için acquisition, funnel veya ölçülebilir büyüme sonucu görünmeli." : "To upgrade this lane, show acquisition, funnel, or measurable growth outcome.",
    growth_strategy: tr ? "Bu hattı güçlendirmek için GTM hipotezi ve sonuç takibi görünmeli." : "To upgrade this lane, show GTM hypotheses and outcome tracking.",
    strategy_operations: tr ? "Bu hattı güçlendirmek için süreç, paydaş ve ölçülebilir teslim kapsamı görünmeli." : "To upgrade this lane, show process, stakeholder, and measurable delivery scope.",
    gtm_operations: tr ? "Bu hattı güçlendirmek için pipeline, CRM, gelir süreci veya GTM operasyon kanıtı görünmeli." : "To upgrade this lane, show pipeline, CRM, revenue process, or GTM operations proof.",
    ai_product_operations: tr ? "Bu hattı güçlendirmek için AI workflow'un kime hizmet ettiği ve nasıl kullanıldığı görünmeli." : "To upgrade this lane, show who the AI workflow served and how it was used.",
    data_analysis: tr ? "Bu hattı güçlendirmek için SQL/Excel/dashboard ve karar etkisi görünmeli." : "To upgrade this lane, show SQL/Excel/dashboard proof and decision impact.",
    business_analysis: tr ? "Bu hattı güçlendirmek için gereksinim, süreç ve karar çıktısı görünmeli." : "To upgrade this lane, show requirements, process, and decision output.",
    project_management: tr ? "Bu hattı güçlendirmek için zaman planı, paydaş ve teslim sonucu görünmeli." : "To upgrade this lane, show timeline, stakeholders, and delivery outcome.",
  };
  return map[roleId] || (tr ? "Bu hattı güçlendirmek için role özel somut çıktı görünmeli." : "To upgrade this lane, show concrete role-specific output.");
}

function profileIdentityLabel(signals, lang) {
  const tr = isTr(lang);
  if (signals.careerLeverage.lane === "product_builder") return tr ? "builder/ürün profili" : "builder/product profile";
  if (signals.careerLeverage.lane === "growth_gtm") return tr ? "growth/GTM profili" : "growth/GTM profile";
  if (signals.careerLeverage.lane === "data_analysis") return tr ? "veri/analiz profili" : "data/analysis profile";
  if (signals.careerLeverage.lane === "strategy_ops") return tr ? "strateji/operasyon profili" : "strategy/operations profile";
  return tr ? "yapılandırılmış genel profil" : "structured generalist profile";
}

function strongestEvidenceLine(signals, lang) {
  const tr = isTr(lang);
  if (signals.ownership.level !== "weak" && !isMissingEvidenceText(signals.ownership.evidence)) {
    const ev = tr
      ? sanitizeVisibleTurkish(evidenceDisplay(signals.ownership.evidence), lang)
      : evidenceDisplay(signals.ownership.evidence);
    return tr ? `En güçlü kanıt: ${ev}.` : `Strongest evidence: ${ev}.`;
  }
  if (signals.executionProof.level !== "weak" && !isMissingEvidenceText(signals.executionProof.evidence)) {
    const ev = tr
      ? sanitizeVisibleTurkish(evidenceDisplay(signals.executionProof.evidence), lang)
      : evidenceDisplay(signals.executionProof.evidence);
    return tr ? `En güçlü kanıt: ${ev}.` : `Strongest evidence: ${ev}.`;
  }
  return tr
    ? "En güçlü kanıt henüz CV'de net görünmüyor."
    : "The strongest proof is not yet clear on the CV.";
}

function formatExecutionProofStrength(evidence, lang) {
  const tr = isTr(lang);
  const ev = evidenceDisplay(evidence);
  if (!ev) return "";
  if (tr) {
    if (/HireFit/i.test(ev)) {
      return "HireFit'i kurup canlıya almış olman gerçek iş çıkarma kanıtı yaratıyor.";
    }
    const sanitized = sanitizeVisibleTurkish(ev, lang);
    if (/gerçek iş çıkarma kanıtı yaratıyor/i.test(sanitized)) return sanitized;
    return `${sanitized} gerçek iş çıkarma kanıtı yaratıyor.`;
  }
  return `${ev} creates real execution proof.`;
}

function evidenceBackedStrongSide(cognition, lang) {
  const tr = isTr(lang);
  const signals = cognition.signals;
  if (signals.executionProof.level !== "weak" && !isMissingEvidenceText(signals.executionProof.evidence)) {
    return formatExecutionProofStrength(signals.executionProof.evidence, lang);
  }
  if (signals.ownership.level !== "weak" && !isMissingEvidenceText(signals.ownership.evidence)) {
    const ev = evidenceDisplay(signals.ownership.evidence);
    return tr
      ? `${sanitizeVisibleTurkish(ev, lang)} sahiplenme kanıtı yaratıyor.`
      : `${ev} creates ownership proof.`;
  }
  return strongestEvidenceLine(signals, lang);
}

function evidenceBackedWeakSide(cognition, limiter, lang) {
  const tr = isTr(lang);
  const proofGap = cognition.proofGap;
  if (limiter.key === "EvidenceStrength") {
    return tr
      ? `${proofGap.missingProof} eksik kaldığı için bu başarı recruiter tarafında tam savunulamıyor.`
      : `${proofGap.missingProof} is missing, so the success is not fully defensible.`;
  }
  if (limiter.key === "RoleAlignment") {
    const evidence = sanitizeVisibleTurkish(evidenceDisplay(cognition.signals.roleBridge.evidence), lang);
    return tr
      ? `${evidence} var; ancak hedef ilanın beklediği role doğrudan bağlanmıyor.`
      : `${evidence} exists, but it does not connect directly enough to the target role.`;
  }
  if (limiter.key === "NarrativeClarity") {
    return tr
      ? "Başlık, özet ve proje kanıtı aynı kariyer yönünü yeterince hızlı anlatmıyor."
      : "Title, summary, and project proof do not tell the same career direction fast enough.";
  }
  if (limiter.key === "ATSMatch") {
    return tr
      ? "İlandaki kritik anahtar kelimeler CV'de yeterince net görünmüyor."
      : "Critical posting keywords are not visible enough on the CV.";
  }
  return tr
    ? "Recruiter ilgilenir; ama karar için daha savunulabilir kanıt ister."
    : "The recruiter may care, but needs more defensible proof to decide.";
}

function evidenceBackedRecruiterDecision(verdictHierarchy, limiter, progressionPreview, lang) {
  const tr = isTr(lang);
  if (verdictHierarchy.state === "GREEN") {
    return tr
      ? "Recruiter kısa listeye yakın; son kontrol kanıtın görünürlüğünde."
      : "The recruiter is close to shortlist; the last check is proof visibility.";
  }
  if (verdictHierarchy.state === "RED") {
    return tr
      ? "Recruiter ilk filtreyi geçirmek için daha sert kanıt bekler."
      : "The recruiter needs harder proof to pass the first filter.";
  }
  return tr
    ? "Recruiter ilgilenir; kısa liste için rol kanıtını net görmek ister."
    : "The recruiter is interested but wants clearer role proof before shortlisting.";
}

function biggestBlockerLine(signals, lang) {
  const tr = isTr(lang);
  if (signals.scaleProof.level === "weak" && signals.corporateReadiness.score < 55) {
    return tr ? "En büyük blokaj: ölçülebilir sonuç kanıtı." : "Biggest blocker: measurable outcome proof.";
  }
  if (signals.roleBridge.level === "weak") {
    return tr ? "En büyük blokaj: hedef role bağlanan somut örnek." : "Biggest blocker: concrete proof tied to the target role.";
  }
  if (signals.narrativeCoherence.level !== "strong") {
    return tr ? "En büyük blokaj: başlık, deneyim ve hedef rol aynı hikayeyi anlatmıyor." : "Biggest blocker: title, experience, and target role do not tell one story.";
  }
  return tr ? "En büyük blokaj: kanıt var ama daha görünür yazılmalı." : "Biggest blocker: proof exists, but it needs to be easier to see.";
}

function nextBestMove(signals, roleSuggestions, lang, eliteTrust = null, signalHierarchy = null) {
  const tr = isTr(lang);
  const topRole = roleSuggestions?.[0]?.role || "";
  const productish = /ürün|urun|product/i.test(topRole) || signals.careerLeverage.lane === "product_builder";
  if (eliteTrust?.founderTitleInflation) {
    return tr
      ? "Sonraki hamle: kurucu unvanının altına canlı çıktı ve etki büyüklüğünü tek satırda yaz."
      : "Next move: put shipped output and impact size under the founder title in one line.";
  }
  if (signalHierarchy?.proofTier === "weak" && signals.executionProof.level === "weak") {
    return tr
      ? "Sonraki hamle: iddia yerine teslim edilmiş tek işi ve sonucunu öne al."
      : "Next move: replace claims with one delivered piece of work and its result.";
  }
  if (productish && signals.scaleProof.level === "weak") {
    return tr
      ? "Sonraki hamle: Ürün hattını özete taşı ve çıktıyı ölçülebilir hale getir."
      : "Next move: move the product lane into the summary and make the output measurable.";
  }
  if (productish && signals.roleBridge.level !== "strong") {
    return tr
      ? "Sonraki hamle: CV'ye PRD/backlog/roadmap çıktısı ekle."
      : "Next move: add PRD/backlog/roadmap output to the CV.";
  }
  if (signals.corporateReadiness.level === "weak" && signals.builderFit.level !== "weak") {
    return tr
      ? "Sonraki hamle: builder hikayesini kurumsal execution diliyle yeniden yaz."
      : "Next move: rewrite the builder story in corporate execution language.";
  }
  if (signals.roleBridge.level === "weak") {
    return tr
      ? "Sonraki hamle: hedef ilanın istediği işi tek somut CV satırına bağla."
      : "Next move: tie the target role to one concrete CV line.";
  }
  return tr
    ? "Sonraki hamle: en güçlü kanıtı özetin ilk satırına taşı."
    : "Next move: move the strongest proof into the first line of the summary.";
}

function compressCareerDirection(signals, lang) {
  const tr = isTr(lang);
  const identity = profileIdentityLabel(signals, lang);
  if (signals.archetypeRead === "builder") {
    return tr
      ? `Bu CV ${identity} gibi okunuyor; kurumsal ekiplerde daha somut çıktı görmek isterler.`
      : `This CV reads like a ${identity}; corporate filters will ask for more scale proof.`;
  }
  if (signals.archetypeRead === "corporate") {
    return tr
      ? `Bu CV yapılandırılmış rollere daha yakın; hedef role köprü net yazılırsa güven artar.`
      : `This CV sits closer to structured roles; trust rises if the bridge to the target role is explicit.`;
  }
  return tr
    ? `Profil tamamen kopuk değil; ${identity} hattında daha hızlı güven yaratıyor.`
    : `The profile is not disconnected; it builds trust faster in the ${identity} lane.`;
}

function roleAdjacencyReason(roleId, item, cvText, jdText, lang, identityEngine = null) {
  const tr = isTr(lang);
  const intel = inferCareerIntelligence(cvText, jdText);
  const cvEvidence = findEvidenceUnit(cvText, roleEvidencePatterns(roleId));
  const compressedEvidence = buildEvidenceCompression(roleId, cvText, jdText, lang);
  const evidencePrefix = cvEvidence
    ? (tr ? `CV'de "${evidenceDisplay(cvEvidence)}" var` : `The CV shows "${evidenceDisplay(cvEvidence)}"`)
    : (tr ? missingEvidenceLabel("roleBridge", lang) : missingEvidenceLabel("roleBridge", lang));
  const roleCopy = {
    product_management: tr
      ? "Ürün tarafında güven, problem sahiplenme ve kullanıcıya yakın iş çıkarma üzerinden kurulur."
      : "Recruiter confidence here comes from problem ownership and work close to the user.",
    product_strategy: tr
      ? "Bu alan, teknik detaydan çok pazar okuması, önceliklendirme ve ürün yönü kurma tarafını büyütür."
      : "This lane compounds around market read, prioritization, and product direction rather than pure execution.",
    growth: tr
      ? "Büyüme tarafında profil daha pratik okunur: pazar teması, deneme-yanılma ve sonuç takibi aynı hikayeye bağlanır."
      : "In growth, the profile reads more practically: market contact, testing, and outcome tracking connect cleanly.",
    growth_strategy: tr
      ? "Growth Strategy, uygulama ile pazar sezgisini birleştirdiğin yerlerde recruiter güvenini artırır."
      : "Growth Strategy raises recruiter confidence when execution and market intuition appear together.",
    strategy_operations: tr
      ? "Strateji & Operasyon, dağınık ownership'i daha kurumsal bir problem çözme hikayesine çevirir."
      : "Strategy & Operations turns scattered ownership into a cleaner business problem-solving story.",
    gtm_operations: tr
      ? "GTM Operasyonları, pazar tarafındaki işi süreç ve gelir hareketine bağladığında daha güçlü okunur."
      : "GTM Operations gets stronger when market-facing work connects to process and revenue motion.",
    ai_product_operations: tr
      ? "AI Product Operations, builder tarafını ürünleşme, workflow ve operasyonel kullanım alanına taşır."
      : "AI Product Operations moves the builder side into productization, workflow, and operational adoption.",
    business_analysis: tr
      ? "İş Analizi, deneyimi daha net gereksinim, süreç ve karar desteği diline çeker."
      : "Business Analysis reframes the experience as requirements, process, and decision support.",
    marketing: tr
      ? "Pazarlama tarafı, pazar mesajı ve kullanıcı edinimi kanıtı varsa daha hızlı anlaşılır."
      : "Marketing reads faster when market message and acquisition proof are visible.",
    data_analysis: tr
      ? "Veri Analizi, recruiter güvenini araç izi, ölçüm disiplini ve karar desteği üzerinden kurar."
      : "Data Analysis builds confidence through tool proof, measurement discipline, and decision support.",
    project_management: tr
      ? "Proje Yönetimi, belirsiz işi takibe, paydaşa ve teslim disiplinine çevirdiğinde güçlenir."
      : "Project Management gets stronger when ambiguous work becomes tracking, stakeholders, and delivery discipline.",
    business_development: tr
      ? "Business Development, pazar teması ve ilişki kurma kanıtı görünür olduğunda daha doğal okunur."
      : "Business Development reads naturally when market contact and relationship-building proof are visible.",
    customer_success: tr
      ? "Müşteri Başarısı, kullanıcı/müşteri temasını sahiplenme ve tekrar eden değer üretimiyle bağlar."
      : "Customer Success connects customer contact with ownership and repeated value creation.",
    ux_research: tr
      ? "UX Araştırma, kullanıcı geri bildirimi ve problem keşfi kanıtı görünürse daha ikna edici olur."
      : "UX Research becomes more convincing when user feedback and problem discovery proof are visible.",
  };
  const base = roleCopy[roleId] || roleCopy.business_analysis;
  const careerFrame = marketFitFrame(intel, lang);
  const upgrade = roleUpgradeProof(roleId, lang);
  const primaryIdentity = identityEngine?.primaryIdentity?.label || "";
  const identityLine = primaryIdentity
    ? (tr
      ? `Recruiter seni önce ${primaryIdentity} olarak okuyor; bu rol o kimliği ${roleId === "product_management" ? "ürün kararına" : roleId === "strategy_operations" ? "pazar ve execution diline" : roleId === "business_analysis" ? "süreç ve veri görünürlüğüne" : "daha net pozisyonlamaya"} çevirir.`
      : `The recruiter first reads you as ${primaryIdentity}; this lane turns that identity into ${roleId === "product_management" ? "product decisions" : roleId === "strategy_operations" ? "market and execution language" : roleId === "business_analysis" ? "process and data visibility" : "clearer positioning"}.`)
    : "";
  if (cvEvidence) {
    const lensWithUpgrade = `${compressedEvidence.lensLine.replace(/[.!?]\s*$/, ";")} ${upgrade.replace(/^[A-ZÇĞİÖŞÜa-zçğıöşü]/, (m) => m.toLowerCase())}`;
    return `${compressedEvidence.evidenceLine} ${identityLine || lensWithUpgrade}`;
  }
  return `${evidencePrefix}; ${identityLine || base} ${compressedEvidence.lensLine} ${careerFrame} ${upgrade}`;
}

function buildEvidenceRecruiterView(engineV2, analysisData, cvText, jdText, score, lang) {
  const tr = isTr(lang);
  const cv = String(cvText || "");
  const jd = String(jdText || "");
  const all = `${cv} ${jd}`;
  const intel = inferCareerIntelligence(cv, jd);
  const cognition = buildRecruiterCognition(cv, jd, score, lang);
  const signals = cognition.signals;
  const eliteTrust = cognition.eliteTrustCalibration;
  const microRead = cognition.recruiterMicroPsychology;
  const productJd = hasAny(jd, [/prd/i, /backlog/i, /user stor/i, /roadmap/i, /user flow/i, /ürün|urun|product/i]);
  const productCv = hasAny(cv, [/prd/i, /backlog/i, /user stor/i, /roadmap/i, /user flow/i, /ürün|urun|product/i]);
  const dataJd = hasAny(jd, [/sql/i, /excel/i, /dashboard/i, /power\s?bi/i, /tableau/i, /trend analysis/i]);
  const dataCv = hasAny(cv, [/sql/i, /excel/i, /dashboard/i, /power\s?bi/i, /tableau/i]);
  const campaignJd = hasAny(jd, [/campaign/i, /landing page/i, /linkedin/i, /instagram/i, /seo/i, /acquisition/i]);
  const campaignCv = hasAny(cv, [/campaign/i, /landing page/i, /linkedin/i, /instagram/i, /seo/i, /acquisition/i]);
  const hasMetrics = hasAny(cv, [/\d+\s?%/, /\d+\s?(k|m|users|clients|projects|hours|days)\b/i, /\bKPI\b/i, /metric|metrik/i]);
  const hasOwnership = hasAny(cv, [/launched|shipped|built|founded|owned|led|canlıya|yayına|kurdum|yönettim|yonettim/i, /HireFit/i]);
  const hasStakeholder = hasAny(cv, [/stakeholder|paydaş|paydas|client|müşteri|musteri|cross-functional/i]);

  let strength = pickStrength(engineV2, analysisData, lang);
  if (eliteTrust?.realBuilder) {
    const ev = evidenceDisplay(signals.executionProof.evidence || signals.ownership.evidence);
    strength = tr
      ? `${ev}: recruiter burada gerçek iş çıkarma görüyor.`
      : `${ev}: the recruiter sees real shipping behavior here.`;
  } else if (eliteTrust?.founderTitleInflation) {
    strength = tr
      ? "Kurucu tarafı dikkat çekiyor; ama recruiter hemen arkasındaki çıktıyı arar."
      : "The founder angle gets attention; the recruiter immediately looks for the output behind it.";
  } else if (signals.ownership.level !== "weak") {
    const ev = evidenceDisplay(signals.ownership.evidence);
    strength = tr
      ? `${ev}: sahiplenme net.`
      : `${ev}: strengthens the ownership read.`;
  } else if (intel.hasFounder) {
    const ev = evidenceDisplay(cognition.chains.product.hasCvEvidence ? cognition.chains.product.evidenceFromCV : "founder/ownership");
    strength = tr
      ? `CV'de "${ev}" izi var; bu recruiter'a belirsizlikte karar alma ve sahiplenme kanıtı verir.`
      : `The CV contains "${ev}"; that gives the recruiter ownership and ambiguity proof.`;
  } else if (hasOwnership) {
    const ev = evidenceDisplay(cognition.chains.product.hasCvEvidence ? cognition.chains.product.evidenceFromCV : "canlıya alınmış iş/proje");
    strength = tr
      ? `CV'de "${ev}" var; recruiter burada niyet değil davranış görür.`
      : `The CV shows "${ev}"; the recruiter sees behavior, not just intent.`;
  } else if (dataCv) {
    const ev = evidenceDisplay(cognition.chains.roleBridge.hasCvEvidence ? cognition.chains.roleBridge.evidenceFromCV : "veri/raporlama izi");
    strength = tr
      ? `CV'de "${ev}" görünüyor; bu karar desteği tarafında güveni artırır.`
      : `The CV shows "${ev}"; this raises confidence on the decision-support side.`;
  } else {
    strength = trustPsychologyLine(intel, score, lang);
  }

  let gap = pickGap(engineV2, analysisData, lang);
  if (eliteTrust?.polishedButWeak) {
    gap = tr
      ? "CV güçlü görünüyor; ama recruiter güzel kelimeden çok sert çıktı arar."
      : "The CV looks polished; the recruiter will look past wording for hard output.";
  } else if (cognition.proofGap?.category) {
    gap = tr
      ? `${cognition.proofGap.missingProof}: ${cognition.proofGap.explanation}`
      : `${cognition.proofGap.missingProof}: ${cognition.proofGap.explanation}`;
  } else if (signals.scaleProof.level === "weak" && (signals.corporateReadiness.level === "weak" || intel.targetCorporate)) {
    gap = biggestBlockerLine(signals, lang);
  } else if (productJd && !productCv) {
    const jdEv = cognition.chains.product.hasJdEvidence ? cognition.chains.product.evidenceFromJD : "ürün/ownership beklentisi";
    gap = tr
      ? `JD "${jdEv}" tarafını bekliyor; CV'de PRD/backlog/kullanıcı akışı kanıtı net olmadığı için güven yarım kalır.`
      : `The JD expects "${jdEv}"; trust stays incomplete because PRD/backlog/user-flow proof is not clear on the CV.`;
  } else if (dataJd && !dataCv) {
    const jdEv = cognition.chains.roleBridge.hasJdEvidence ? cognition.chains.roleBridge.evidenceFromJD : "araç/analiz kanıtı";
    gap = tr
      ? `JD "${jdEv}" bekliyor; SQL/Excel/dashboard görünmeyince recruiter riski sana yükler.`
      : `The JD expects "${jdEv}"; when SQL/Excel/dashboard is missing, the recruiter assigns the risk to you.`;
  } else if (campaignJd && !campaignCv) {
    const jdEv = cognition.chains.roleBridge.hasJdEvidence ? cognition.chains.roleBridge.evidenceFromJD : "pazar tarafı";
    gap = tr
      ? `JD "${jdEv}" tarafına bakıyor; kampanya, landing page veya acquisition kanıtı CV'de net değil.`
      : `The JD points toward "${jdEv}"; campaign, landing-page, or acquisition proof is not clear on the CV.`;
  } else if (!hasMetrics) {
    gap = tr
      ? `${cognition.chains.scale.evidenceFromCV}; bu yüzden recruiter başarıyı tahmin etmek zorunda kalır.`
      : `${cognition.chains.scale.evidenceFromCV}; the recruiter has to infer success.`;
  } else if (!hasStakeholder && hasAny(all, [/stakeholder|paydaş|paydas|coordination|alignment/i])) {
    const jdEv = cognition.chains.roleBridge.hasJdEvidence ? cognition.chains.roleBridge.evidenceFromJD : "stakeholder/coordination";
    gap = tr
      ? `JD "${jdEv}" bekliyor; stakeholder/ownership kapsamı belirsiz kalırsa seniority algısı aşağı çekilir.`
      : `The JD expects "${jdEv}"; if stakeholder and ownership scope stays unclear, the seniority read drops.`;
  } else {
    gap = hesitationLine(intel, lang);
  }

  const firstRead = cleanToken(cognition.firstScreenClarity).replace(/[.!?]\s*$/, "");
  const microHint = cleanToken(microRead?.visibleHint || "").replace(/[.!?]\s*$/, "");
  const decision = Number(score) < 55
    ? (tr
      ? `${firstRead}; ilk turda savunması zor.`
      : `${firstRead}; hard to defend in first screen.`)
    : Number(score) < 75
      ? (tr
        ? `${firstRead}; recruiter ilgilenir ama güven tam oluşmaz.`
        : `${firstRead}; recruiter may care, but trust does not fully close.`)
      : (tr
        ? `${microHint || "İlk tur savunulabilir"}; kanıtı daha görünür yazmak yeterli.`
        : `${microHint || "First screen is defensible"}; the proof just needs to be easier to see.`);

  return {
    strength: applyForbiddenGuard(strength, lang),
    gap: applyForbiddenGuard(gap, lang),
    decision: applyForbiddenGuard(decision, lang),
  };
}

function humanChipLabel(raw, lang) {
  const t = applyForbiddenGuard(cleanToken(raw), lang);
  if (!t || looksPoison(t)) return "";
  const lower = t.toLowerCase();
  if (/ürün|urun|product|pm|pdm/.test(lower)) return isTr(lang) ? "Ürün odaklı profil" : "Product-led profile";
  if (/founder|kurucu/.test(lower)) return isTr(lang) ? "Founder enerjisi" : "Founder energy";
  if (/kpi|metrik|metric|growth|donusum|conversion/.test(lower)) return isTr(lang) ? "Sonuç geçmişi" : "Results track record";
  if (/builder|ship|teslim|delivery|launch/.test(lower)) return isTr(lang) ? "Teslim geçmişi" : "Shipping track";
  if (/data|analyst|sql|bi\b/.test(lower)) return isTr(lang) ? "Veri tarafı" : "Data-side read";
  if (/operasyon|operations/.test(lower)) return isTr(lang) ? "Operasyon tarafı" : "Operations side";
  return t.slice(0, 48);
}

function buildChips(engineV2, lang, signals = null, proofGap = null, verdictHierarchy = null) {
  const tags = Array.isArray(engineV2?.Recruiter?.structured_analysis?.signal_tags)
    ? engineV2.Recruiter.structured_analysis.signal_tags
    : [];
  const chipThemes = [
    { color: "#93c5fd", bg: "rgba(59,130,246,0.16)", border: "rgba(59,130,246,0.35)" },
    { color: "#fbbf24", bg: "rgba(245,158,11,0.16)", border: "rgba(245,158,11,0.35)" },
    { color: "#86efac", bg: "rgba(16,185,129,0.16)", border: "rgba(16,185,129,0.35)" },
    { color: "#fca5a5", bg: "rgba(239,68,68,0.13)", border: "rgba(239,68,68,0.3)" },
  ];
  const tr = isTr(lang);
  const signalLabels = [];
  if (signals?.careerLeverage?.lane === "product_builder") signalLabels.push(tr ? "Builder Profil" : "Builder Profile");
  if (signals?.careerLeverage?.lane === "strategy_ops") signalLabels.push(tr ? "Strateji Yakınlığı" : "Strategy Proximity");
  if (signals?.roleBridge?.level === "weak") signalLabels.push(tr ? "Rol Köprüsü Zayıf" : "Weak Role Bridge");
  if (signals?.scaleProof?.level === "weak" || proofGap?.category === "Scale Proof") signalLabels.push(tr ? "Ölçek Kanıtı Eksik" : "Scale Proof Missing");
  if (signals?.corporateReadiness?.level === "weak" && signals?.builderFit?.level !== "weak") signalLabels.push(tr ? "Kurumsal Uyum Riski" : "Corporate Fit Risk");
  if (signals?.ownership?.level !== "weak") signalLabels.push(tr ? "Girişimci Profil" : "Founder Profile");
  if (verdictHierarchy?.state === "GREEN") signalLabels.push(tr ? "Net Okuma" : "Clear Read");
  const labels = [
    ...new Set([
      ...signalLabels,
      ...tags.map((x) => humanChipLabel(x, lang)).filter(Boolean),
    ]),
  ].slice(0, 4);
  if (!labels.length) {
    return isTr(lang)
      ? [
          { label: "Net teslim", ...chipThemes[0] },
          { label: "Somut örnek", ...chipThemes[1] },
        ]
      : [
          { label: "Clear delivery", ...chipThemes[0] },
          { label: "Concrete proof", ...chipThemes[1] },
        ];
  }
  return labels.map((label, i) => ({ label, ...chipThemes[i % chipThemes.length] }));
}

function buildMetrics(score, lang, verdictHierarchy = null) {
  if (verdictHierarchy?.metrics?.length) return verdictHierarchy.metrics;
  const tr = isTr(lang);
  const n = Math.round(Number(score) || 0);
  return [
    {
      key: "interview",
      label: tr ? "Mülakat ihtimali" : "Interview read",
      value:
        n < 55
          ? (tr ? "İlk filtre zor" : "Hard first screen")
          : n < 75
            ? (tr ? "Shortlist sınırında" : "Shortlist boundary")
            : (tr ? "Mülakat çıkabilir" : "Interview can happen"),
      hint: tr ? "Başvurunca ne olur" : "What happens if you apply",
    },
    {
      key: "conf",
      label: tr ? "Recruiter güveni" : "Recruiter confidence",
      value:
        n < 55
          ? (tr ? "Okuma net değil" : "Read is not clear")
        : n < 75
            ? (tr ? "Güven sorusu açık" : "Trust question is open")
            : (tr ? "CV okunabilir duruyor" : "CV reads clearly"),
      hint: tr ? "İlk bakış hissi" : "First-read confidence",
    },
    {
      key: "rej",
      label: tr ? "Elenme riski" : "Screen-out risk",
      value:
        n < 55
          ? (tr ? "Kanıt boşluğu var" : "Proof gap remains")
          : n < 75
            ? (tr ? "Kırmızı bayrak yok" : "No hard red flag")
            : (tr ? "İlk eleme riski düşük" : "Low first-screen risk"),
      hint: tr ? "Nerede takılır" : "Where it can stall",
    },
    {
      key: "fit",
      label: tr ? "Yakınlık seviyesi" : "Match level",
      value:
        n < 55
          ? (tr ? "Pozisyon izi parçalı" : "Positioning is split")
          : n < 75
            ? (tr ? "Hikaye netleşmeli" : "Story needs sharpening")
            : (tr ? "Rol hikayesi net" : "Role story is clear"),
      hint: tr ? "CV ile ilan bağı" : "CV-to-role link",
    },
  ];
}

const SEMANTIC_STOPWORDS = new Set([
  "bir",
  "bu",
  "ve",
  "ama",
  "icin",
  "ile",
  "daha",
  "role",
  "rol",
  "cv",
  "recruiter",
  "the",
  "and",
  "but",
  "for",
  "your",
  "this",
  "that",
  "with",
  "would",
  "still",
]);

function semanticTokens(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 4 && !SEMANTIC_STOPWORDS.has(x));
}

function similarCopy(a, b) {
  const left = new Set(semanticTokens(a));
  const right = new Set(semanticTokens(b));
  if (!left.size || !right.size) return false;
  let shared = 0;
  for (const token of left) {
    if (right.has(token)) shared += 1;
  }
  const smaller = Math.min(left.size, right.size);
  return shared / smaller >= 0.58;
}

function dedupedCopy(value, seen, fallback, lang, options = {}) {
  const source = options.keepSentences ? cleanToken(value) : oneSentence(value, lang);
  const cleaned = applyForbiddenGuard(source, lang);
  const candidate = cleaned && !looksPoison(cleaned) ? cleaned : fallback;
  const tooClose = seen.some((prior) => similarCopy(candidate, prior));
  const finalValue = tooClose ? fallback : candidate;
  if (finalValue) seen.push(finalValue);
  return finalValue;
}

function semanticFallback(section, score, lang) {
  const tr = isTr(lang);
  const n = Math.round(Number(score) || 0);
  const copy = {
    subheadline: tr
      ? "Deneyim var; ama kariyer yönü recruiter için tek bakışta netleşmiyor."
      : "There is experience, but the career direction is not obvious on first read.",
    strength: tr
      ? "Recruiter güveni, sahiplenilmiş iş ve karar alma kanıtı gördüğünde yükselir."
      : "Recruiter confidence rises when ownership and decision-making proof are visible.",
    gap: tr
      ? "CV hedef role neden şimdi geçiş yaptığını yeterince hızlı anlatmıyor."
      : "The CV does not quickly explain why this role is the right next move.",
    decision: tr
      ? "Recruiter burada biraz daha somut çıktı görmek ister."
      : "The recruiter would want clearer concrete output here.",
    mainBlocker: tr
      ? "Deneyim parçaları var; fakat tek bir kariyer anlatısına kilitlenmiyor."
      : "The experience pieces are there, but they do not lock into one career narrative.",
    nudge: tr
      ? "Bir sonraki hamle role özel kanıtı öne almak olmalı."
      : "The next move is to bring role-specific proof forward.",
    riskyAction: tr
      ? (n < 55 ? "Kanıtı güçlendirip başvur" : "Seçerek başvur")
      : (n < 55 ? "Apply after strengthening proof" : "Apply selectively"),
    betterFitAction: tr
      ? "Daha doğal okunan alanı incele"
      : "Check the lane that reads more naturally",
    wrongRoleSub: tr
      ? "Alternatif roller aynı deneyimi daha net anlatıyor."
      : "Alternative roles explain the same experience more clearly.",
    wrongRoleBody: tr
      ? "Bu öneriler CV’nin daha hızlı anlaşılacağı alanları gösteriyor."
      : "These suggestions show where the CV can be understood faster.",
  };
  return copy[section] || "";
}

function semanticDedupeV3ViewModel(vm, lang) {
  const seen = [vm.headline, vm.verdictLabel].filter(Boolean);
  const nextRecruiterView = {
    strength: dedupedCopy(vm.recruiterView?.strength, seen, semanticFallback("strength", vm.score, lang), lang),
    gap: dedupedCopy(vm.recruiterView?.gap, seen, semanticFallback("gap", vm.score, lang), lang),
    decision: dedupedCopy(vm.recruiterView?.decision, seen, semanticFallback("decision", vm.score, lang), lang),
  };

  const metricsSeen = [...seen];
  const metricFallbacks = {
    interview: isTr(lang) ? "Shortlist sınırında" : "Shortlist boundary",
    conf: isTr(lang) ? "Güven sorusu açık" : "Trust question is open",
    rej: isTr(lang) ? "Kanıt boşluğu var" : "Proof gap remains",
    fit: isTr(lang) ? "Pozisyon izi parçalı" : "Positioning is split",
  };

  return {
    ...vm,
    subheadline: dedupedCopy(vm.subheadline, seen, semanticFallback("subheadline", vm.score, lang), lang),
    recruiterView: nextRecruiterView,
    mainBlocker: applyForbiddenGuard(vm.mainBlocker, lang) || semanticFallback("mainBlocker", vm.score, lang),
    recruiterNudge: dedupedCopy(vm.recruiterNudge, seen, semanticFallback("nudge", vm.score, lang), lang),
    actions: {
      ...vm.actions,
      risky: dedupedCopy(vm.actions?.risky, seen, semanticFallback("riskyAction", vm.score, lang), lang),
      betterFit: dedupedCopy(vm.actions?.betterFit, seen, semanticFallback("betterFitAction", vm.score, lang), lang),
    },
    metrics: (vm.metrics || []).map((metric) => ({
      ...metric,
      value: dedupedCopy(metric.value, metricsSeen, metricFallbacks[metric.key] || metric.value, lang),
    })),
    wrongRoleSub: dedupedCopy(vm.wrongRoleSub, seen, semanticFallback("wrongRoleSub", vm.score, lang), lang),
    wrongRoleBody: dedupedCopy(vm.wrongRoleBody, seen, semanticFallback("wrongRoleBody", vm.score, lang), lang),
  };
}

function applyConsistencyRules(vm, signals, lang) {
  const tr = isTr(lang);
  const n = Number(vm.score) || 0;
  const out = { ...vm };
  const hierarchy = vm._internal?.verdictHierarchy || null;
  const ds = vm._internal?.decisionSignals || {};
  if (hierarchy) {
    out.verdictState = hierarchy.state;
    out.verdictLabel = hierarchy.verdictLabel;
    out.headline = hierarchy.hero;
    out.verdictStyle = verdictStyleFromScore(hierarchy.styleScore);
    out.actions = {
      risky: tr ? "Kanıtı Güçlendirip Başvur" : "Strengthen proof, then apply",
      betterFit: tr ? "Alternatif Role Bak" : "Check alternative role",
    };
    out.recruiterScorecard = buildRecruiterScorecard(ds, out.atsIntelligence, lang);
    if (hierarchy.state === "RED") {
      out.recruiterView = {
        ...out.recruiterView,
        decision: tr
          ? "İlk filtre zor; önce role özel kanıtı görünür yap."
          : "First screen is hard; make role-specific proof visible first.",
      };
    }
    if (hierarchy.state === "GREEN" && Number(ds.RecruiterConfidence) < 66) {
      out.verdictState = "YELLOW";
      out.headline = tr ? "Shortlist sınırında." : "Right on the shortlist line.";
      out.verdictLabel = tr ? "İkna eşiği" : "Persuasion edge";
      out.verdictStyle = verdictStyleFromScore(65);
    }
    if (out.atsIntelligence?.riskBand === "High" && out.atsIntelligence?.matchBand === "Weak" && out.verdictState === "GREEN") {
      out.verdictState = "YELLOW";
      out.headline = tr ? "Shortlist sınırında." : "Right on the shortlist line.";
      out.verdictLabel = tr ? "İlk filtre riski" : "First-filter risk";
      out.verdictStyle = verdictStyleFromScore(65);
    }
    if (Number(ds.RoleAlignment) < 40) {
      out.metrics = (out.metrics || []).map((metric) =>
        metric.key === "roleAlignment" ? { ...metric, value: tr ? "Zayıf" : "Weak" } : metric
      );
    }
    if (Number(ds.EvidenceStrength) < 40 && !/Kanıt|Proof/i.test(out.mainBlocker || "")) {
      out.mainBlocker = tr
        ? `Eksik Kanıt: ${proofGapShortLine(out._internal?.proofGap, lang)}`
        : `Missing Proof: ${proofGapShortLine(out._internal?.proofGap, lang)}`;
    }
    if (signals.builderFit.score > signals.corporateReadiness.score + 12 && hierarchy.state !== "GREEN") {
      out.wrongRoleSub = tr
        ? "Bu CV bu ilandan çok ürün/strateji hattında daha hızlı güven yaratıyor."
        : "This CV builds trust faster in a product/strategy lane than in this exact posting.";
    }
    return out;
  }
  if (n < 55) {
    out.actions = {
      ...out.actions,
      risky: tr ? "Kanıtı güçlendirip başvur" : "Apply after strengthening proof",
    };
    out.recruiterView = {
      ...out.recruiterView,
      decision: tr
        ? "İlk filtre zor; önce role özel kanıtı görünür yap."
        : "First screen is hard; make role-specific proof visible first.",
    };
  } else if (n < 75) {
    out.actions = {
      ...out.actions,
      risky: tr ? "Seçerek başvur" : "Apply selectively",
    };
  }
  const topRole = out.roleSuggestions?.[0]?.role || "";
  if (/ürün|urun|product/i.test(topRole) && signals.roleBridge.level !== "strong" && !out.mainBlocker) {
    out.mainBlocker = tr
      ? `${biggestBlockerLine(signals, lang)} ${nextBestMove(signals, out.roleSuggestions, lang)}`
      : `${biggestBlockerLine(signals, lang)} ${nextBestMove(signals, out.roleSuggestions, lang)}`;
  }
  if (signals.builderFit.score > signals.corporateReadiness.score + 12 && n < 75) {
    out.wrongRoleSub = tr
      ? "Bu CV bu ilandan çok ürün/strateji hattında daha hızlı güven yaratıyor."
      : "This CV builds trust faster in a product/strategy lane than in this exact posting.";
  }
  out.metrics = (out.metrics || []).map((metric) => {
    if (metric.key === "fit" && n < 75) {
      return { ...metric, value: tr ? "Hikaye netleşmeli" : "Story needs sharpening" };
    }
    if (metric.key === "conf" && n < 75) {
      return { ...metric, value: tr ? "Güven sorusu açık" : "Trust question is open" };
    }
    return metric;
  });
  return out;
}

/**
 * @param {object} raw
 * @param {string} raw.lang
 * @param {number|null} raw.score
 * @param {object|null} raw.engineV2
 * @param {object|null} raw.analysisData
 * @param {string} [raw.cvText]
 * @param {string} [raw.jdText]
 * @param {string} [raw.roleType]
 * @param {object|null} [raw.progressBaseline]
 * @param {object|null} [raw.careerProfile]
 * @param {object|null} [raw.careerMemoryComparison]
 * @param {object|null} [raw.careerGrowth]
 * @param {function} [raw.buildRoleSuggestionsFromCv]
 */
export function normalizeAnalysisForUI(raw = {}) {
  const lang = raw.lang || "TR";
  const tr = isTr(lang);
  const engineV2 = raw.engineV2 || null;
  const analysisData = raw.analysisData || null;
  const scoreRaw =
    raw.score ??
    engineV2?.["Final Alignment Score"] ??
    analysisData?.alignment_score ??
    null;
  const score = Number.isFinite(Number(scoreRaw)) ? Math.round(Number(scoreRaw)) : null;

  if (score == null) {
    return null;
  }

  const recruiterViewRaw = buildEvidenceRecruiterView(
    engineV2,
    analysisData,
    raw.cvText || "",
    raw.jdText || "",
    score,
    lang
  );

  let recruiterView = {
    strength: applyForbiddenGuard(recruiterViewRaw.strength, lang),
    gap: applyForbiddenGuard(recruiterViewRaw.gap, lang),
    decision: applyForbiddenGuard(recruiterViewRaw.decision, lang),
  };

  if (
    looksPoison(recruiterView.strength) ||
    looksPoison(recruiterView.gap) ||
    looksPoison(recruiterView.decision)
  ) {
    recruiterView = {
      strength: tr
        ? "HireFit ve ürün geliştirme tarafın dikkat çekiyor."
        : "Your product-building side stands out.",
      gap: tr
        ? "Bu rol operasyon ağırlıklı ilerliyor; CV'nde bu taraf net görünmüyor."
        : "This role is operations-heavy; that side does not read clearly on your CV.",
      decision: tr
        ? "Recruiter burada biraz daha somut çıktı görmek ister."
        : "The recruiter would want clearer concrete output here.",
    };
  }

  const cognition = buildRecruiterCognition(raw.cvText || "", raw.jdText || "", score, lang);
  const identityEngine = buildIdentityEngine(raw.cvText || "", raw.jdText || "", cognition.signals, lang);
  const identityConflict = identityConflictEngine(identityEngine, lang);
  const identityClarity = buildIdentityClarity(identityEngine, identityConflict, lang);
  const careerNarrativeAxis = resolveCareerNarrativeAxis(raw.jdText || "", identityEngine, lang);
  const atsIntelligence = buildAtsIntelligence(
    engineV2,
    analysisData,
    raw.cvText || "",
    raw.jdText || "",
    lang,
    identityEngine
  );
  let roleSuggestions = buildTaxonomyRoleSuggestions(
    engineV2,
    analysisData,
    raw.cvText || "",
    raw.jdText || "",
    lang,
    raw.buildRoleSuggestionsFromCv,
    identityEngine
  );
  const decisionSignals = buildDecisionSignals(cognition, score, identityClarity, atsIntelligence);
  const verdictHierarchy = applyVerdictHierarchy(decisionSignals, cognition.proofGap, lang, atsIntelligence);
  let primaryLimiter = buildPrimaryLimiter(decisionSignals, lang);
  if (atsIntelligence.riskBand === "High" && atsIntelligence.matchBand === "Weak" && Number(decisionSignals.ATSMatch) <= Number(primaryLimiter.value) + 10) {
    primaryLimiter = {
      key: "ATSMatch",
      label: tr ? "ATS anahtar kelime eşleşmesi" : "ATS keyword match",
      value: decisionSignals.ATSMatch,
      band: scoreLabel(decisionSignals.ATSMatch, lang),
    };
  }
  if (identityConflict.hasConflict && Number(decisionSignals.IdentityClarity) <= Number(primaryLimiter.value) + 8) {
    primaryLimiter = {
      key: "IdentityClarity",
      label: tr ? "Kimlik Netliği" : "Identity Clarity",
      value: decisionSignals.IdentityClarity,
      band: scoreLabel(decisionSignals.IdentityClarity, lang),
    };
  }
  const verdictExplanation = buildVerdictExplanation(cognition, decisionSignals, verdictHierarchy, primaryLimiter, lang, identityEngine, identityConflict);
  const identityVerdictLine = buildIdentityVerdictLine(identityEngine, identityConflict, verdictExplanation, lang);
  const progressionPreview = buildProgressionPreview(primaryLimiter, lang);
  const deltaPreview = buildBeforeAfterStatePreview(decisionSignals, primaryLimiter, verdictHierarchy, progressionPreview, identityEngine, identityClarity, atsIntelligence);
  const signals = { ...cognition.signals, ...decisionSignals };
  const trustCalibration = cognition.trustCalibration;
  const eliteTrustCalibration = cognition.eliteTrustCalibration;
  const defensibility = cognition.defensibility;
  const microPsychology = cognition.microPsychology;
  const nextMove = buildOneAction(primaryLimiter, cognition.proofGap, roleSuggestions, signals, lang);
  const expectedImpact = buildExpectedImpactEngine(decisionSignals, primaryLimiter, verdictHierarchy, lang, atsIntelligence);
  expectedImpact.identityImpact = buildExpectedIdentityImpact(identityEngine, identityClarity, expectedImpact, primaryLimiter, lang);
  expectedImpact.atsImpact = buildExpectedAtsImpact(atsIntelligence, primaryLimiter, lang);
  const beforeAfterPreview = buildBeforeAfterPreview(cognition, primaryLimiter, roleSuggestions, lang, identityEngine);
  const progressDelta = buildProgressDelta(raw.progressBaseline, decisionSignals, verdictHierarchy, lang, identityEngine, identityClarity, atsIntelligence);
  const careerDirection = compressCareerDirection(signals, lang);
  const blockerHeadline = limiterBlockerHeadline(verdictHierarchy, primaryLimiter, lang);
  const blockerReason = verdictHierarchy.state === "GREEN" || primaryLimiter.key === "EvidenceStrength"
    ? proofGapShortLine(cognition.proofGap, lang)
    : verdictExplanation;
  const eliminatingBlockerSentence = buildEliminatingBlockerSentence({
    limiter: primaryLimiter,
    identityEngine,
    cognition,
    jdText: raw.jdText || "",
    lang,
  });
  const recruiterWantedBullets = buildRecruiterWantedBullets(
    cognition,
    primaryLimiter,
    roleSuggestions,
    atsIntelligence,
    lang,
    careerNarrativeAxis
  );
  const applicationDecision = buildApplicationDecision({
    verdictHierarchy,
    decisionSignals,
    score,
    atsIntelligence,
    primaryLimiter,
    cognition,
    identityEngine,
    eliminatingBlockerSentence,
    lang,
  });
  const cvStrengthen = buildCvStrengthenSection({
    primaryLimiter,
    cognition,
    atsIntelligence,
    identityEngine,
    roleSuggestions,
    expectedImpact,
    jdText: raw.jdText || "",
    lang,
  });
  const narrativeRoleIntent = careerNarrativeAxis.roleIntent || atsIntelligence.roleIntent;
  const companyIntelligence = buildCompanyIntelligence(
    engineV2,
    analysisData,
    raw.jdText || "",
    narrativeRoleIntent,
    lang
  );
  const marketIntelligence = buildMarketIntelligence(
    engineV2,
    analysisData,
    roleSuggestions,
    atsIntelligence,
    narrativeRoleIntent,
    lang
  );
  const careerImprovementLoop = buildCareerImprovementLoop(progressDelta, lang);
  const fixEngine = buildFixEngine({
    cvStrengthen,
    primaryLimiter,
    expectedImpact,
    cognition,
    atsIntelligence,
    cvText: raw.cvText || "",
    score,
    lang,
  });
  const fixRecommendations = buildFixRecommendations(fixEngine);
  roleSuggestions = roleSuggestions.map((r) => ({
    ...r,
    fastestImprovement: applyForbiddenGuard(
      r.fastestImprovement || roleFastestImprovement(r.role, r.missingProof, atsIntelligence, lang),
      lang
    ),
  }));
  const recruiterScorecard = buildRecruiterScorecard(decisionSignals, atsIntelligence, lang);
  const applyFixArchitecture = buildApplyFixArchitecture(cvStrengthen, careerImprovementLoop, lang);
  const analysisComparison = buildAnalysisComparisonModel({
    score,
    decisionSignals,
    atsIntelligence,
    expectedImpact,
    verdictHierarchy,
    progressDelta,
    lang,
  });
  const applicationStrategy = buildApplicationStrategy(
    applicationDecision,
    eliminatingBlockerSentence,
    expectedImpact,
    roleSuggestions,
    lang
  );
  const decisionHero = buildDecisionHero({
    headline: verdictHierarchy.hero,
    verdictHierarchy,
    applicationDecision,
    atsIntelligence,
    decisionSignals,
    eliminatingBlockerSentence,
    primaryLimiter,
    lang,
  });
  if (decisionHero) {
    decisionHero.primaryCtaGain = fixEngine.topGain ?? 12;
    decisionHero.primaryCtaLabel = isTr(lang)
      ? `CV'yi Güçlendir (+${decisionHero.primaryCtaGain} puan)`
      : `Strengthen CV (+${decisionHero.primaryCtaGain} pts)`;
    decisionHero.eliminationBlock = buildHeroEliminationBlock({
      atsIntelligence,
      decisionSignals,
      primaryLimiter,
      cognition,
      fixEngine,
      eliminatingBlockerSentence,
      lang,
    });
  }
  const outcomeProjection = buildOutcomeProjection(score, fixEngine, lang);
  const roleAlternativesPreview = buildRoleAlternativesPreview(roleSuggestions, score, lang);
  const roleAlternativesDetail = buildRoleAlternativesDetail(roleSuggestions, atsIntelligence, score, lang);
  const recruiterTrust = buildRecruiterTrust(cognition, decisionSignals, raw.cvText || "", identityEngine, lang);
  const fixLoopCenter = buildFixLoopCenter(score, fixEngine, outcomeProjection, recruiterTrust, atsIntelligence, lang);
  const wowMoment = buildWowMoment({
    fixEngine,
    roleAlternativesDetail,
    score,
    decisionSignals,
    atsIntelligence,
    lang,
  });
  const winningPath = buildWinningPath(fixEngine, outcomeProjection, lang);
  if (applicationDecision) {
    applicationDecision.showAltRole =
      roleAlternativesDetail.length > 0 &&
      (Number(score) < 65 || roleAlternativesDetail[0].matchPercent > Number(score) + 5);
    applicationDecision.altRoleLabel = tr ? "ALTERNATİF ROLE GİT" : "SWITCH ROLE";
    applicationDecision.altRoleName = roleAlternativesDetail[0]?.role || "";
  }
  const recruiterReadingCompact = buildRecruiterReadingCompact(recruiterView, lang);
  const recruiterThinking = buildRecruiterThinking(cognition, identityEngine, recruiterView, decisionSignals, lang);
  const recruiterReaction = buildRecruiterReactionPanel(
    cognition,
    identityEngine,
    recruiterView,
    decisionSignals,
    recruiterTrust,
    lang
  );
  const recruiterVerdictMeter = buildRecruiterVerdictMeter(score, outcomeProjection, decisionSignals, lang);
  const shortlistChance = buildShortlistChance(score, outcomeProjection, decisionSignals, lang);
  const careerMomentum = buildCareerMomentum(outcomeProjection, fixEngine, fixLoopCenter, lang);
  const careerMemory = buildCareerMemory(raw.careerMemoryComparison, raw.careerProfile, lang);
  const careerGrowth = raw.careerGrowth || null;
  const personalizedProfile = buildPersonalizedOnboardingInsights({
    profile: raw.careerProfile,
    roleType: raw.roleType,
    jdText: raw.jdText,
    engineV2,
    lang,
  });
  const careerWallet = buildCareerWallet(raw.careerProfile, raw.careerGrowth, score, lang);
  const cvHeatmap = buildCvHeatmap(cognition, decisionSignals, score, lang);
  const eliminationBlock = decisionHero?.eliminationBlock || null;
  const firstScreenPulse = buildFirstScreenPulse({
    eliminationBlock,
    outcomeProjection,
    recruiterReaction,
    applicationDecision,
    decisionHero,
    lang,
  });
  const atsKeywordRemedies = buildAtsKeywordRemedies(atsIntelligence, raw.jdText || "", lang);
  recruiterView = {
    ...recruiterView,
    strength: applyForbiddenGuard(evidenceBackedStrongSide(cognition, lang), lang),
    gap: applyForbiddenGuard(evidenceBackedWeakSide(cognition, primaryLimiter, lang), lang),
    decision: applyForbiddenGuard(evidenceBackedRecruiterDecision(verdictHierarchy, primaryLimiter, progressionPreview, lang), lang),
  };

  const vm = {
    score,
    verdictState: verdictHierarchy.state,
    verdictLabel: verdictHierarchy.verdictLabel,
    matchBand: matchBandFromScore(score, lang),
    rejectionRiskBand: rejectionRiskBandFromScore(score, lang),
    roleFitBand: roleFitBandFromScore(score, lang),
    verdictStyle: verdictStyleFromScore(verdictHierarchy.styleScore),
    headline: verdictHierarchy.hero,
    decisionHero,
    subheadline: identityVerdictLine,
    pills: [outcomeBandFromScore(score, lang), roleFitBandFromScore(score, lang)],
    chips: buildChips(engineV2, lang, signals, cognition.proofGap, verdictHierarchy),
    recruiterView,
    blockerHeadline,
    blockerTitle: tr ? "Seni şu an eleyen şey" : "What is filtering you out right now",
    eliminatingBlockerSentence,
    blockerAction: nextMove.replace(/^Sonraki hamle:\s*/i, "").replace(/^Next move:\s*/i, ""),
    primaryLimiter,
    primaryIdentity: identityEngine.primaryIdentity,
    identityReason: identityEngine.identityReason,
    identityVerdictLine,
    identityConflict: identityConflict.identityConflict,
    identityClarity,
    atsIntelligence,
    verdictExplanation,
    progressionPreview,
    expectedImpact,
    progressDelta,
    mainBlocker: buildMainBlockerLine({
      limiter: primaryLimiter,
      blockerHeadline,
      blockerReason,
      nextMove,
      progressionPreview,
      lang,
      identityEngine,
      cognition,
      jdText: raw.jdText || "",
    }),
    recruiterNudge: nextMove,
    nextMove,
    strengthStepLine: nextMove,
    actions: {
      risky: tr ? "Kanıtı Güçlendirip Başvur" : "Strengthen proof, then apply",
      betterFit: tr ? "Alternatif Role Bak" : "Check alternative role",
    },
    metrics: [],
    recruiterScorecard,
    finalVerdict: applicationDecision,
    roleSuggestions,
    roleAlternativesPreview,
    roleAlternativesDetail,
    outcomeProjection,
    wowMoment,
    fixLoopCenter,
    winningPath,
    eliminationBlock,
    firstScreenPulse,
    recruiterVerdictMeter,
    shortlistChance,
    careerMomentum,
    careerMemory,
    careerGrowth,
    personalizedProfile,
    careerWallet,
    cvHeatmap,
    recruiterReaction,
    recruiterThinking,
    atsKeywordRemedies,
    recruiterTrust,
    recruiterReadingCompact,
    recruiterWantedBullets,
    careerNarrativeAxis: careerNarrativeAxis.narrativeLabel,
    applicationDecision,
    applicationStrategy,
    cvStrengthen,
    fixEngine,
    fixRecommendations,
    applyFixArchitecture,
    analysisComparison,
    companyIntelligence,
    marketIntelligence,
    careerImprovementLoop,
    showWrongRoleSection: roleSuggestions.length > 0,
    wrongRoleTitle: tr ? "Sana daha yakın roller" : "Closer roles for you",
    wrongRoleSub: tr
      ? "Aynı deneyim, bazı rollerde recruiter güvenini daha hızlı kuruyor."
      : "The same experience builds recruiter confidence faster in some adjacent roles.",
    wrongRoleBody: tr
      ? "Bu öneriler sadece alternatif unvan değil; profilinin nerede daha doğal büyüdüğünü gösteriyor."
      : "These are not just alternate titles; they show where your profile compounds more naturally.",
    _internal: {
      deepDive: {
        strengths: [evidenceBackedStrongSide(cognition, lang)],
        gaps: [evidenceBackedWeakSide(cognition, primaryLimiter, lang)],
        notes: [
          strongestEvidenceLine(signals, lang),
          cognition.objection.visible,
          careerDirection,
          nextMove,
        ].filter(Boolean),
      },
      signals,
      decisionSignals,
      verdictHierarchy,
      identityEngine,
      identityConflict,
      identityClarity,
      atsIntelligence,
      primaryLimiter,
      verdictExplanation,
      identityVerdictLine,
      progressionPreview,
      expectedImpact,
      beforeAfterPreview,
      progressDelta,
      beforeState: deltaPreview.beforeState,
      afterStatePreview: deltaPreview.afterStatePreview,
      signalStack: cognition.signalStack,
      signalHierarchy: cognition.signalHierarchy,
      trustCalibration,
      eliteTrustCalibration,
      careerDefensibility: defensibility,
      defensibilityReasoning: cognition.defensibilityReasoning,
      narrativeCoherence: cognition.narrativeCoherence,
      microPsychology,
      recruiterMicroPsychology: cognition.recruiterMicroPsychology,
      adaptiveRoleScoring: cognition.adaptiveScoring,
      businessValue: cognition.businessValue,
      roleDNA: cognition.roleDNA,
      proofGap: cognition.proofGap,
      consequence: cognition.consequence,
      hiringManagerLayer: cognition.hiringManagerLayer,
      interviewProbability: cognition.interviewProbability,
      objection: cognition.objection,
      evidenceChains: cognition.chains,
      cognition: {
        firstScreenClarity: cognition.firstScreenClarity,
        trustEvidence: cognition.trustEvidence,
        roleBridge: cognition.roleBridge,
        scaleProof: cognition.scaleProof,
        ambiguityTolerance: cognition.ambiguityTolerance,
        fitMode: cognition.fitMode,
        hiringHesitation: cognition.hiringHesitation,
        careerLeverage: cognition.careerLeverage,
      },
    },
  };

  return finalizeRecruiterDecisionV7(
    applyConsistencyRules(semanticDedupeV3ViewModel(vm, lang), signals, lang),
    {
      identityEngine,
      identityConflict,
      cognition,
      jdText: raw.jdText || "",
      lang,
    }
  );
}

/** Dev-only: detect forbidden copy leaking into the view model. */
const visibleCopyGuardSeen = new Set();

export function assertNoForbiddenVisibleCopy(viewModel) {
  const guardEnabled =
    import.meta.env.VITE_VISIBLE_COPY_GUARD === "true" ||
    import.meta.env.VITE_DEBUG_VISIBLE_COPY === "true" ||
    import.meta.env.DEBUG_VISIBLE_COPY === "true";
  if (import.meta.env.PROD || !guardEnabled || !viewModel) return;
  const { _internal, ...visibleViewModel } = viewModel;
  void _internal;
  const rawSerialized = JSON.stringify(visibleViewModel);
  const serialized = rawSerialized.toLowerCase();
  const words = [
    "alignment",
    "sinyal",
    "signal",
    "gerçek execution",
    "reason_code",
    "structured_analysis",
    "responsible for",
    "contribute to",
    "management processes",
    "cv'ne şu formatta",
    "cv'ne su formatta",
    "mevcut uyum skoru",
    "düzeltme sonrası",
    "bu adımı uygularsan",
    "role-fit",
    "%",
  ];
  for (const word of words) {
    const key = `${word}:${serialized.length}`;
    if (visibleCopyGuardSeen.has(key)) continue;
    visibleCopyGuardSeen.add(key);
    if (word === "%" && /\d{1,3}\s*%/.test(serialized)) {
      console.groupCollapsed("FORBIDDEN_VISIBLE_COPY_LEAK");
      console.warn(word);
      console.groupEnd();
    } else if (serialized.includes(word)) {
      console.groupCollapsed("FORBIDDEN_VISIBLE_COPY_LEAK");
      console.warn(word);
      console.groupEnd();
    }
  }
  if (/\baTS\b/.test(rawSerialized)) {
    const key = `aTS:${rawSerialized.length}`;
    if (!visibleCopyGuardSeen.has(key)) {
      visibleCopyGuardSeen.add(key);
      console.groupCollapsed("FORBIDDEN_VISIBLE_COPY_LEAK");
      console.warn("aTS");
      console.groupEnd();
    }
  }
}

/** History list row — bands only, no raw score in visible fields. */
function normalizeHistoryRoleTitle(rawRole, lang, cvText = "", jdText = "") {
  const raw = cleanToken(rawRole);
  if (!raw) return "";
  const parts = raw.split(/\s+·\s+|\s+-\s+/).map((x) => x.trim()).filter(Boolean);
  const rolePart = parts.length > 1 ? parts[parts.length - 1] : raw;
  const shouldNormalize =
    isTaskLikeRoleLabel(rolePart) ||
    /user stor|backlog|prd|roadmap|contribute|creation|management processes|cross-functional process support/i.test(rolePart);
  if (!shouldNormalize) return raw.slice(0, 120);
  const cleanRole = normalizeCareerRoleLabel(rolePart, lang, `${cvText || ""} ${jdText || ""}`);
  if (parts.length > 1 && parts[0]) return `${parts[0].slice(0, 60)} · ${cleanRole}`;
  return cleanRole;
}

export function normalizeHistoryRowForUI(item, lang, buildRoleSuggestionsFromCv) {
  const vm = normalizeAnalysisForUI({
    lang,
    score: item?.score,
    engineV2: null,
    analysisData: null,
    cvText: item?.cvText,
    jdText: item?.jdText,
    roleType: item?.role,
    buildRoleSuggestionsFromCv,
  });
  if (!vm) {
    const tr = isTr(lang);
    return {
      role: normalizeHistoryRoleTitle(item?.role || "", lang, item?.cvText, item?.jdText),
      verdictBand: tr ? "Önceki analiz" : "Prior analysis",
      createdAt: item?.createdAt || "",
    };
  }
  return {
    role: normalizeHistoryRoleTitle(item?.role || "", lang, item?.cvText, item?.jdText),
    verdictBand: vm.verdictLabel,
    matchBand: vm.matchBand,
    createdAt: item?.createdAt || "",
  };
}

