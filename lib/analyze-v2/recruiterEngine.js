import { callClaude, CLAUDE_MODEL_OPUS } from "../claudeClient.js";
import { parseModelJson } from "./json.js";
import { buildRecruiterSystemPrompt } from "../recruiterSystemPrompt.js";
import { getSectorPromptBlock } from "./sectorContext.js";
import { RECRUITER_SECTOR_PERSONAS } from "./recruiterPersonas.js";
import { fallbackNoReasoning, MANDATORY_TURKISH_AI_OUTPUT, userPromptLangFooter } from "./lang.js";

const FIRST_PERSON_RULE = `ABSOLUTE RULE:
Speak directly to the candidate.
Use "I" and "you".
NEVER write "The candidate" or
"This applicant".
WRONG: "The candidate has experience..."
RIGHT: "I see your McKinsey Forward —
strong signal. But I'm looking for
pricing experience and it's just not here."
`;

const FORBIDDEN_NARRATIVE_PATTERNS = [
  /güçlü\s*sinyal/gi,
  /gerilim\s*noktası/gi,
  /strongest\s*signal/gi,
  /decision\s*tension/gi,
  /\balignment\b/gi,
  /signal\s*density|sinyal\s*yoğunluğu|sinyal\s*yogunlugu/gi,
  /output\s*intensity|çıktı\s*yoğunluğu|cikti\s*yogunlugu/gi,
  /role[-\s]*specific\s*output|role\s*özgü\s*çıktı|role\s*ozgu\s*cikti/gi,
  /kapsam\s*sinyali/gi,
  /ats/gi,
  /debug/gi,
  /placeholder/gi,
  /optimize/gi,
  /enhance/gi,
  /leverage/gi,
  /strong\s*candidate/gi,
  /solid\s*profile/gi,
  /great\s*potential/gi,
];

export async function runRecruiterEngine(
  cvText,
  jobDescription,
  sector,
  langNorm = "en",
  careerContext = null
) {
  const lens = getSectorPromptBlock(sector, careerContext);
  const langInstruction = langNorm === "tr" ? MANDATORY_TURKISH_AI_OUTPUT : "Respond in English.";
  const basePrompt = `${lens}

You have ~30 seconds per CV. Think reject/shortlist — not coaching. Real screening pressure: who gets cut and why. No motivational framing, no cheerleading, no "great candidate" padding.
If the user-selected sector lens above conflicts with what you infer from the job description, prioritize the job description and the sector personas (tone, priorities) from your system instructions.

Reference concrete CV details everywhere (experience, project names, certifications, school, company names). Quote CV lines directly where possible; do not write generic praise.
If a detail is missing, explicitly say "CV'de belirtilmemiş" (TR) or "Not stated on the CV" (EN) and do not invent.
Infer recruiter psychology, not just resume facts:
- why I gain or lose trust
- where the career narrative compounds
- where the profile creates hesitation
- whether the candidate reads like builder, operator, analyst, strategist, or specialist
- whether this role direction increases or weakens market fit
Do not summarize the CV. Explain the hiring reaction behind the facts.
FORBIDDEN in strengths: standalone fluff such as "strong communicator", "passionate", "team player", "detail-oriented", "fast learner", "great attitude", "impressive background" without naming a CV anchor (company, tool, metric, project title, scope).
Every strength must cite one concrete CV anchor; if you cannot, omit that strength.
Weaknesses must name the exact JD vs CV mismatch (tool, domain, seniority, proof type). At least two weaknesses should read like a real screen-out reason, not soft coaching.
If verdict is maybe or strong_yes, still include at least one harsh line about what would make you hesitate vs other applicants.
Focus ONLY on human/recruiter perspective (credibility, narrative, trust signals, hiring instinct).
Maximum list sizes: strengths max 4, weaknesses max 4, red_flags max 3. Each list item should be first-person where natural (e.g. "I'm not seeing quantified impact on X").
Turkish mode rule: Yanıtını Türkçe ver, İngilizce kelime karıştırma.
Do not repeat technical gap tables, keyword matrices, or step-by-step action plans from other sections.
Forbidden tone: "candidate demonstrates", "overall good profile", "optimization needed", "alignment severity", "no issue detected", "analysis complete", "Tek bir boşluk izole edilemedi", "sinyal yoğunluğu".

CV:
${cvText}

Job description:
${jobDescription}

Return ONLY valid JSON:
{
  "recruiter_verdict": "strong_yes" | "maybe" | "no",
  "reasoning": "<max 3 short sentences, recruiter-like internal thought after 15-second scan>",
  "first_perception": "<single short sentence>",
  "internal_monologue": "<max 3 short sentences, subjective and human>",
  "core_concern": "<single concise line: the main blocker>",
  "persuasion_tip": "<1-2 short bullet lines only>",
  "signal_tags": ["<short tag>", "<short tag>", "<short tag>"],
  "strengths": [<string>, max 4],
  "weaknesses": [<string>, max 4],
  "red_flags": [<string>, max 3]
}${userPromptLangFooter(langNorm)}`;
  const user = `${langInstruction}\n\n${basePrompt}`;

  let systemPrompt = `${buildRecruiterSystemPrompt(langNorm, { includeFirstPersonLead: false })}

${RECRUITER_SECTOR_PERSONAS}

Output: Return ONLY valid JSON exactly as in the user message — no markdown fences, no text outside JSON. recruiter_verdict must be exactly "strong_yes", "maybe", or "no". Every natural-language string must be in the selected language only (no mixed TR/EN). Keep first_perception/core_concern/persuasion_tip concise. signal_tags max 4.
STRICT STYLE:
- no repeated signals across fields
- no long paragraph walls
- no corporate language
- no ATS/debug wording
- no placeholder text
- do NOT include labels like "Güçlü sinyal", "Gerilim noktası", "Strongest Signal", "Decision Tension" inside narrative values`;
  systemPrompt = `${FIRST_PERSON_RULE}\n\n${systemPrompt}`;

  try {
    const content = await callClaude(user, systemPrompt, 1400, {
      langNorm,
      recruiterVoice: true,
      model: CLAUDE_MODEL_OPUS,
    });

    // eslint-disable-next-line no-console -- production crash triage
    console.log("[Recruiter RAW]", String(content || "").slice(0, 2000));
    let parsedRecruiter = null;
    try {
      parsedRecruiter = parseModelJson(content);
    } catch (parseErr) {
      // eslint-disable-next-line no-console -- production crash triage
      console.log("[Recruiter PARSE ERROR]", parseErr?.message || parseErr);
      parsedRecruiter = null;
    }
    // eslint-disable-next-line no-console -- production crash triage
    console.log("[Recruiter PARSED]", parsedRecruiter);

    return normalizeRecruiterOutput(parsedRecruiter, {
      cvText,
      jobDescription,
      langNorm,
    });
  } catch (err) {
    // eslint-disable-next-line no-console -- production crash triage
    console.log("[Recruiter ERROR]", err?.message || err);
    return buildFallbackRecruiterOutput(langNorm);
  }
}

export function normalizeRecruiterOutput(parsedRecruiter, { cvText = "", jobDescription = "", langNorm = "en" } = {}) {
  const p = (parsedRecruiter && typeof parsedRecruiter === "object") ? parsedRecruiter : {};
  const v = String(p.recruiter_verdict || "")
    .toLowerCase()
    .replace(/\s+/g, "_");
  let verdict = "maybe";
  if (v === "strong_yes" || v === "yes" || v === "strongyes") verdict = "strong_yes";
  else if (v === "no" || v === "reject") verdict = "no";

  const structured = normalizeStructuredRecruiter({
    parsed: p,
    cvText,
    jobDescription,
    langNorm,
    modelVerdict: verdict,
  });
  const reasoningFinal = ensureRecruiterParagraph(p.reasoning, structured, langNorm);

  return {
    recruiter_verdict: verdict,
    reasoning: reasoningFinal,
    strengths: takeStrings(p.strengths).slice(0, 6),
    weaknesses: takeStrings(p.weaknesses).slice(0, 6),
    red_flags: takeStrings(p.red_flags).slice(0, 5),
    structured_analysis: structured,
  };
}

export function buildFallbackRecruiterOutput(langNorm = "en") {
  const structured = normalizeStructuredRecruiter({
    parsed: {},
    cvText: "",
    jobDescription: "",
    langNorm,
    modelVerdict: "maybe",
  });
  return {
    recruiter_verdict: "maybe",
    reasoning: ensureRecruiterParagraph("", structured, langNorm),
    strengths: [],
    weaknesses: [],
    red_flags: [],
    structured_analysis: structured,
  };
}

function takeStrings(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => String(s).trim()).filter(Boolean);
}

function normalizeStructuredRecruiter({ parsed, cvText, jobDescription, langNorm, modelVerdict }) {
  const strengths = takeStrings(parsed?.strengths).slice(0, 3);
  const weaknesses = takeStrings(parsed?.weaknesses).slice(0, 3);
  const strongestSignal = strengths[0] || pickCvAnchor(cvText) || (langNorm === "tr" ? "Profilinde bu role yakin tecrube izi var." : "There is at least one role-relevant thread in your profile.");
  const rolePerception = inferRolePerception(cvText, jobDescription, langNorm);
  const uncertainty = weaknesses[0] || (langNorm === "tr"
    ? "Ilanin aradigi teknik gecmis CV'de net gorunmuyor."
    : "The technical background required by the role is not clearly visible in the CV.");
  const firstPerceptionRaw = pickNonEmpty(
    String(parsed?.first_perception || "").trim(),
    langNorm === "tr"
      ? shortPerceptionFromRole(rolePerception)
      : shortPerceptionFromRole(rolePerception)
  );
  const internalMonologueRaw = pickNonEmpty(
    String(parsed?.internal_monologue || "").trim(),
    buildInternalMonologue({ strongestSignal, rolePerception, uncertainty, langNorm })
  );
  const coreConcernRaw = pickNonEmpty(
    String(parsed?.core_concern || "").trim(),
    langNorm === "tr"
      ? `Seni durduran sey: ${uncertainty}`
      : `What stops me: ${uncertainty}`
  );
  const persuasionTipRaw = normalizePersuasionTip(
    parsed?.persuasion_tip,
    langNorm === "tr"
      ? "Bu role baglanan somut bir is satirini CV'de daha gorunur yaz."
      : "Make one concrete delivery line for this role easier to spot on your CV.",
    langNorm
  );
  const signalTags = normalizeSignalTags(parsed?.signal_tags, langNorm, strongestSignal, uncertainty, rolePerception).slice(0, 4);
  const compact = compactStructuredRecruiter({
    firstPerception: firstPerceptionRaw,
    internalMonologue: internalMonologueRaw,
    coreConcern: coreConcernRaw,
    persuasionTip: persuasionTipRaw,
    langNorm,
  });

  return {
    first_perception: compact.first_perception,
    internal_monologue: compact.internal_monologue,
    core_concern: compact.core_concern,
    persuasion_tip: compact.persuasion_tip,
    signal_tags: signalTags,
    strengths,
    weaknesses,
    role_perception: rolePerception,
    uncertainty,
    recruiter_leaning: normalizeLeaning(modelVerdict, langNorm),
    strongest_signal: strongestSignal,
  };
}

function inferRolePerception(cvText, jobDescription, langNorm) {
  const cv = String(cvText || "").toLowerCase();
  const jd = String(jobDescription || "").toLowerCase();
  const productSignal = /(product|growth|ux|deney|funnel|activation)/i.test(cv);
  const opsJd = /(operations|operasyon|seo|content|içerik|execution|yürütme)/i.test(jd);
  if (langNorm === "tr") {
    if (productSignal && opsJd) {
      return "Seni daha cok urun ve buyume tarafinda goruyorum; ilan ise operasyonel yurutme agirlikli.";
    }
    return "Seni role yakin goruyorum ama ilanin netlestirdigi beklentiyle tam oturmuyor.";
  }
  if (productSignal && opsJd) {
    return "I currently read you closer to product/growth, while this role leans more toward operational execution.";
  }
    return "I see overlap, but I still cannot connect your story tightly enough to this posting.";
}

function ensureRecruiterParagraph(rawReasoning, structured, langNorm) {
  const direct = String(rawReasoning || "").trim();
  if (direct.length >= 40) return direct;
  const mono = String(structured?.internal_monologue || "").trim();
  if (mono.length >= 40) return mono;
  return fallbackNoReasoning(langNorm);
}

function shortPerceptionFromRole(rolePerception) {
  const r = String(rolePerception || "").trim();
  if (!r) return "";
  const cut = r.split(/(?<=[.!?])\s+/).filter(Boolean)[0];
  return String(cut || r).trim();
}

function isLikelyEnglishFragment(text) {
  const s = String(text || "").trim();
  if (!s) return true;
  if (/[ığüşöçİĞÜŞÖÇ]/.test(s)) return false;
  return /\b(I|my|owned|every|with|the|and|but|built|led|launched|product|growth|hirefit|resume|shortlist)\b/i.test(s);
}

function buildInternalMonologue({ strongestSignal, rolePerception, uncertainty, langNorm }) {
  if (langNorm === "tr") {
    const ss = String(strongestSignal || "").trim();
    const safeSs = ss && !isLikelyEnglishFragment(ss) ? ss : "";
    const rp = String(rolePerception || "").trim();
    const un = String(uncertainty || "").trim();
    if (safeSs) {
      return `${safeSs} okunuyor ama ${un.toLowerCase()} tam oturmuyor.`.replace(/\s+/g, " ").trim();
    }
    const merged = `${rp} ${un}`.replace(/\s+/g, " ").trim();
    return merged || "Ilk turda net bir evet cikmiyor; kararda temkinliyim.";
  }
  return `${strongestSignal} helps, but ${rolePerception.toLowerCase()} and ${uncertainty.toLowerCase()} still slow me down; I might move you forward, but I am in maybe mode for now.`;
}

function compactStructuredRecruiter({ firstPerception, internalMonologue, coreConcern, persuasionTip, langNorm }) {
  const tr = langNorm === "tr";
  const first = enforceShortRecruiterField(firstPerception, {
    langNorm,
    maxSentences: 1,
    maxChars: 78,
    fallback: tr
      ? "Profil tamamen disarida degil; ilk bakista bazi soru isaretleri var."
      : "You are not fully out, but I still have a few question marks on first read.",
  });
  const monologue = enforceShortRecruiterField(internalMonologue, {
    langNorm,
    maxSentences: 1,
    maxChars: 78,
    fallback: tr
      ? "Guclu yanlarin var; bu rolun istedigi kopru CV'de tam net degil, temkinliyim."
      : "There is real strength here, but the bridge to this role is not sharp enough yet—I stay cautious.",
  });
  let concern = enforceShortRecruiterField(coreConcern, {
    langNorm,
    maxSentences: 1,
    maxChars: 78,
    fallback: tr
      ? "Bu rol teknik gecmis istiyor; CV'de bunu net goremiyorum."
      : "This role wants technical depth I cannot clearly see on your CV.",
  });
  let tip = normalizePersuasionTip(
    enforceShortRecruiterField(persuasionTip, {
      langNorm,
      maxSentences: 1,
      maxChars: 84,
      fallback: tr
        ? "Bu role baglanan somut bir is satirini CV'de daha gorunur yaz."
        : "Make one concrete delivery line for this role easier to spot on your CV.",
    }),
    tr
      ? "Bu role baglanan somut bir is satirini CV'de daha gorunur yaz."
      : "Make one concrete delivery line for this role easier to spot on your CV.",
    langNorm
  );
  if (areNearDuplicate(first, concern)) {
    concern = tr
      ? "Asil mesele: bu role baglanan net bir teslim satiri eksik."
      : "The real gap is a clear delivery line tied to this role.";
  }
  if (areNearDuplicate(concern, tip)) {
    tip = tr
      ? "CV'de bu role baglayan tek bir somut sonucu daha net yaz."
      : "State one concrete outcome tied to this role more plainly on your CV.";
  }
  return {
    first_perception: first,
    internal_monologue: monologue,
    core_concern: concern,
    persuasion_tip: tip,
  };
}

function enforceShortRecruiterField(text, { langNorm, maxSentences = 1, maxChars = 180, fallback = "" }) {
  const clean = cleanRecruiterText(text);
  if (!clean) return fallback;
  const dedupedSentences = dedupeSentences(clean)
    .slice(0, Math.max(1, maxSentences))
    .map((s) => truncateSentence(s, 118));
  let joined = dedupedSentences.join(" ").trim();
  if (joined.length > maxChars) joined = `${joined.slice(0, maxChars - 3).trim()}...`;
  if (isMixedLanguageHeavy(joined, langNorm) || !joined) return fallback;
  return joined;
}

function normalizePersuasionTip(raw, fallback, langNorm) {
  const tr = langNorm === "tr";
  const source = Array.isArray(raw)
    ? raw.map((x) => String(x || "").trim()).filter(Boolean)
    : String(raw || "").split(/\n|•|-/).map((x) => x.trim()).filter(Boolean);
  const lines = dedupeSentences(source.join(". "))
    .map((s) => truncateSentence(s, 100))
    .slice(0, 1);
  const picked = lines.length ? lines : [fallback];
  return picked.map((line) => `- ${cleanRecruiterText(line)}`).join("\n") || (tr ? "- CV'de bu role baglayan tek bir somut satir yaz." : "- Add one concrete CV line tied to this role.");
}

function cleanRecruiterText(text) {
  let s = String(text || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  for (const re of FORBIDDEN_NARRATIVE_PATTERNS) s = s.replace(re, "");
  s = s.replace(/(?:•|-)\s*(güçlü sinyal|gerilim noktası|strongest signal|decision tension)\s*:?/gi, "");
  s = s.replace(/^[\s:;,-]+/, "");
  s = s.replace(/\.\.+/g, ".");
  s = s.replace(/\s{2,}/g, " ").trim();
  return s;
}

function dedupeSentences(text) {
  const sentences = String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const out = [];
  for (const s of sentences) {
    if (out.some((prev) => areNearDuplicate(prev, s))) continue;
    out.push(s);
  }
  return out;
}

function areNearDuplicate(a, b) {
  const ta = similarityTokens(a);
  const tb = similarityTokens(b);
  if (!ta.length || !tb.length) return false;
  const sa = new Set(ta);
  const sb = new Set(tb);
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  return inter / Math.min(sa.size, sb.size) >= 0.6;
}

function similarityTokens(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/["'.,:;!?()[\]{}]/g, " ")
    .split(/\s+/)
    .filter((t) => t && t.length > 2);
}

function truncateSentence(text, maxLen) {
  const s = String(text || "").trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 3).trim()}...`;
}

function isMixedLanguageHeavy(text, langNorm) {
  const s = String(text || "").trim();
  if (!s) return true;
  if (langNorm === "tr") {
    const hasTr = /[ığüşöçİĞÜŞÖÇ]|\b(ve|ama|bu|için|ilan|yazdiriyor|goremiyorum|degil|taraf|kafamda)\b/i.test(s);
    const hasBadEn = /\b(I\s|my\s|owned|every|with\s|the\s|and\s|but\s|shortlist|alignment|signal\s+density|output\s+intensity)\b/i.test(s);
    if (hasBadEn && hasTr) return true;
    if (hasBadEn && /\b(bunu|su|sana|seni|icin|yazdiriyor)\b/i.test(s)) return true;
  } else {
    const hasEn = /\b(the|and|with|your|this|role|recruiter|posting)\b/i.test(s);
    const hasTr = /[ığüşöçİĞÜŞÖÇ]|\b(ve|ama|bu|için|ilan|degil|yok)\b/i.test(s);
    if (hasEn && hasTr) return true;
  }
  const words = s.toLowerCase().split(/\s+/).filter(Boolean);
  const trWords = ["ve", "ama", "rol", "icin", "ile", "daha", "bir", "bu", "sinyal", "recruiter", "cv"];
  const enWords = ["and", "but", "role", "with", "more", "this", "signal", "recruiter", "cv"];
  const trCount = words.filter((w) => trWords.includes(w)).length;
  const enCount = words.filter((w) => enWords.includes(w)).length;
  if (langNorm === "tr") return enCount > trCount + 2;
  return trCount > enCount + 2;
}

function cleanSignalTagUi(s, langNorm) {
  const tr = langNorm === "tr";
  let t = String(s || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (tr) {
    t = t.replace(/\bsinyal(ler|i|ini|ine|inde)?\b/gi, "").replace(/\s{2,}/g, " ").trim();
  } else {
    t = t.replace(/\bsignals?\b/gi, "").replace(/\s{2,}/g, " ").trim();
  }
  return t.replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, "").trim();
}

function normalizeSignalTags(raw, langNorm, strongestSignal, uncertainty, rolePerception) {
  const tr = langNorm === "tr";
  const fromModel = Array.isArray(raw)
    ? raw.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  if (fromModel.length) {
    const cleaned = [...new Set(fromModel.map((x) => cleanSignalTagUi(String(x || "").trim(), langNorm)).filter(Boolean))].slice(0, 4);
    if (cleaned.length) return cleaned;
  }
  const tags = [];
  const all = `${strongestSignal} ${uncertainty} ${rolePerception}`.toLowerCase();
  if (/product|growth|urun/.test(all)) tags.push(tr ? "Urun tarafi" : "Product side");
  if (/seo|content|icerik/.test(all)) tags.push(tr ? "SEO tarafi" : "SEO angle");
  if (/kpi|metric|metrik|conversion|donusum/.test(all)) tags.push(tr ? "Olculen sonuc" : "Measured outcome");
  if (/uncertain|tereddut|soru/.test(all)) tags.push(tr ? "Soru isareti" : "Question mark");
  if (!tags.length) tags.push(tr ? "Rol yakınlığı" : "Role match");
  return [...new Set(tags)].slice(0, 4);
}

function pickNonEmpty(...vals) {
  for (const v of vals) {
    const s = String(v || "").trim();
    if (s) return s;
  }
  return "";
}

function normalizeLeaning(modelVerdict, langNorm) {
  if (modelVerdict === "strong_yes") return langNorm === "tr" ? "liste adayi" : "shortlist";
  if (modelVerdict === "no") return langNorm === "tr" ? "eleme egilimi" : "reject-leaning";
  return langNorm === "tr" ? "temkinli olumlu" : "cautiously positive";
}

function pickCvAnchor(cvText) {
  const lines = String(cvText || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.find((l) => /(built|launched|led|founded|managed|improved|kur|gelistir|yonet|optimiz|uygul)/i.test(l)) || lines[0] || "";
}
