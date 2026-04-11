import { openaiChat } from "./openaiClient.js";
import { parseModelJson } from "./json.js";
import { getSectorPromptBlock } from "./sectorContext.js";
import { systemPromptWithLang, MANDATORY_TURKISH_AI_OUTPUT, userPromptLangFooter } from "./lang.js";

const MODEL = "llama-3.3-70b-versatile";

export async function runAtsEngine(cvText, jobDescription, sector, langNorm = "en") {
  const lens = getSectorPromptBlock(sector);
  const langInstruction =
    langNorm === "tr"
      ? `${MANDATORY_TURKISH_AI_OUTPUT}\nmatched_skills, missing_keywords*, top_keywords ve parsing_issues değerlerini Türkçe doğal dilde yaz (ör. "veri analizi", "proje yönetimi"); yalnızca evrensel ürün/kısaltma sembolleri (SQL, AWS, API) İngilizce kalabilir.`
      : "Respond in English only. All skill names, missing_keywords, top_keywords, and parsing_issues must be written in English — use English labels even if the CV or JD is in another language.";
  const skillListRule =
    langNorm === "tr"
      ? "missing_keywords ve top_keywords: YALNIZCA öğrenilebilir/demonstrasyonu olan teknik beceriler, araçlar, metodolojiler, çerçeveler, mesleki sertifikalar. Şirket politikaları, HR/yan haklar, eğitim şartları (fakülte, diploma, bölüm adları, mezuniyet), zorunlu staj koşulu, uygunluk/öğrenci sınıfı, sigorta, vize — bunlar KESİNLİKLE skill değildir ve listelenmez. Üniversite bölüm adları (ör. Elektrik Mühendisliği, Bilgisayar Mühendisliği) ASLA eksik skill olarak yazılmaz."
      : "missing_keywords and top_keywords: ONLY actionable skills — tools, methodologies, frameworks, domain techniques, and professional certifications a candidate can learn or demonstrate. NEVER list: university department names, degree types (Bachelor's, Master's), academic program names (e.g. Electrical Engineering, Computer Engineering, Software Engineering), enrollment/eligibility/class-year requirements, company policies, benefits, or visas as skills.";
  const genericBaselineMissingRule =
    langNorm === "tr"
      ? `GENEL SOFT SKILL YASAK (missing_keywords*, missing_keywords_hard, missing_keywords_soft): Şunları ve benzeri her ilanda geçen "baseline" ifadeleri ASLA eksik skill olarak yazma: güçlü iletişim becerileri, analitik düşünme, MS Office programları, takım çalışması, öğrenmeye açıklık vb. Bunlar ayırt edici teknik yetkinlik değildir — sadece JD dolgu cümleleridir.`
      : `NEVER list these (or similar universal JD filler) as missing skills — they are baseline expectations, not differentiating skills: "strong communication skills", "analytical thinking skills", "MS Office programs", "teamwork", "open to learning", and any soft skill that appears in almost every job posting.`;
  const parsingIssuesLangRule =
    langNorm === "tr"
      ? `parsing_issues: Dizideki her satır TAMAMEN Türkçe olmalı (UI dili); İngilizce cümle kullanma.`
      : `parsing_issues: Every entry must be in English only (UI language) — same language rule as matched_skills, missing_keywords, and top_keywords.`;
  const basePrompt = `${lens}

Simulate ATS parsing and keyword screening for THIS sector lens. Be harsh and specific — no generic advice.
Use concrete evidence from THIS CV text only.
Quote CV phrases directly where relevant; do not write generic statements.
If a required detail does not exist in CV, explicitly say "CV'de belirtilmemiş".
For every missing keyword, mention what closest signal exists in CV and why it is still insufficient for this JD context.
Extract matched skills directly from CV phrasing (tools, methods, certifications, project terms) — do not invent generic matches.
You MUST find at least 3-5 matching skills from the CV. Look harder. If candidate has project management experience and JD mentions it, that's a match. Never return empty matched_skills.
${skillListRule}

${genericBaselineMissingRule}

${parsingIssuesLangRule}

REQUIREMENT WEIGHTING (mandatory — affects keyword_match):
- Read each JD requirement in context. Classify every gap as HARD or SOFT:
  HARD (must satisfy for keyword screen): JD uses terms like "required", "must", "essential", "mandatory", "is a must", "zorunlu", "şart", "mutlaka" (and similar strong obligation).
  SOFT (nice-to-have): JD uses "is a plus", "preferred", "good to have", "beneficial", "advantage", "desirable", "tercih", "artı olur", "iyi olur", "öncelik" (when clearly non-mandatory).
- keyword_match scoring rule: Missing HARD requirements may lower keyword_match by a meaningful amount (roughly up to ~15–20 points total across hard gaps when severe). Missing SOFT requirements together may lower keyword_match by at most ~5 points total — never treat "preferred" items like "must-have" for the score.
- Put skill/keyword gaps in missing_keywords_hard vs missing_keywords_soft accordingly. If unsure, prefer SOFT when the JD line clearly reads as optional.

EDUCATION / DEGREE special case:
- If the JD says the candidate is "pursuing a degree in X" / "current student" / "currently enrolled" (öğrenci, devam eden eğitim) and the CV shows enrollment or study in a related field, do NOT list that degree expectation as a missing keyword.
- If the JD requires a *completed* degree ("graduated", "completed degree", "bachelor's required", "mezun", "diploma şartı") and the CV does not show completion, you may list it under HARD missing (as education signal), not as a fake "skill" name — prefer parsing_issues or a clear hard gap description, not a tool keyword.

Maximum list lengths: matched_skills max 5, top_keywords max 12, missing_keywords_hard max 8, missing_keywords_soft max 8, parsing_issues max 8.
Also include combined "missing_keywords" = all items from hard + soft (deduplicated, max 12) for compatibility.
Turkish mode: Tüm liste metinleri Türkçe; yalnızca gerekli yerlerde sembol düzeyinde kısaltma (SQL, AWS) kullanılabilir.
Do not repeat information from other sections.

CV:
${cvText}

Job description:
${jobDescription}

Return ONLY valid JSON:
{
  "ats_score": <number 0-100>,
  "keyword_match": <number 0-100>,
  "formatting_score": <number 0-100>,
  "matched_skills": [<string, exact phrases inferred from CV evidence>],
  "top_keywords": [<string, most critical JD keywords in response language>],
  "missing_keywords_hard": [<string, must-have skill/tool gaps only>],
  "missing_keywords_soft": [<string, nice-to-have / preferred gaps only>],
  "missing_keywords": [<string, combined deduplicated, max 12>],
  "parsing_issues": [<string>]
}${userPromptLangFooter(langNorm)}`;
  const user = `${langInstruction}\n\n${basePrompt}`;

  const content = await openaiChat({
    model: MODEL,
    temperature: 0.0,
    responseFormat: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: systemPromptWithLang(
          "You are an ATS parser simulator. Focus ONLY on skills and keyword matching evidence. Recruiters rely on keyword filters. Call out parsing and keyword failures bluntly — this CV either clears the bot or it does not. For missing_keywords and top_keywords, output ONLY actionable skills (tools, languages, methods, certs). NEVER list university departments, degree names, major titles, class year, or eligibility lines as missing skills. Exclude education requirements, benefits, policies, internships-as-condition, insurance, or non-skill JD boilerplate. Do NOT list generic baseline soft skills (communication, analytical thinking, MS Office, teamwork, open to learning, etc.) as missing skills. parsing_issues must use the same UI output language as all other natural-language list fields (English vs Turkish per CRITICAL instruction). JSON only. Be specific to THIS candidate's CV. Reference actual experiences, projects, certifications mentioned in the CV. Never give generic advice that could apply to anyone. Do not repeat information from other sections.",
          langNorm
        ),
      },
      { role: "user", content: user },
    ],
  });

  const p = parseModelJson(content) || {};
  const modelMatched = takeStrings(p.matched_skills).slice(0, 30);
  const fallbackMatched = deriveMatchedSkillsFromCv(cvText, jobDescription, modelMatched, langNorm);
  const cleanMissingHard = takeStrings(p.missing_keywords_hard)
    .map(cleanAtsTag)
    .filter(Boolean)
    .filter((x) => !isLikelyNonSkillKeyword(x))
    .filter((x) => !isPursuingDegreeFalsePositive(cvText, jobDescription, x));
  const cleanMissingSoft = takeStrings(p.missing_keywords_soft)
    .map(cleanAtsTag)
    .filter(Boolean)
    .filter((x) => !isLikelyNonSkillKeyword(x))
    .filter((x) => !isPursuingDegreeFalsePositive(cvText, jobDescription, x));
  let cleanMissing = takeStrings(p.missing_keywords)
    .map(cleanAtsTag)
    .filter(Boolean)
    .filter((x) => !isLikelyNonSkillKeyword(x));
  if (!cleanMissing.length && (cleanMissingHard.length || cleanMissingSoft.length)) {
    cleanMissing = [...new Set([...cleanMissingHard, ...cleanMissingSoft])];
  }
  cleanMissing = cleanMissing
    .filter((x) => !isPursuingDegreeFalsePositive(cvText, jobDescription, x))
    .slice(0, 30);
  const cleanTopFromModel = takeStrings(p.top_keywords)
    .map(cleanAtsTag)
    .filter(Boolean)
    .filter((x) => !isLikelyNonSkillKeyword(x))
    .slice(0, 20);
  const cleanParsing = takeStrings(p.parsing_issues)
    .map(cleanAtsTag)
    .filter(Boolean)
    .slice(0, 15);
  const kmRaw = clamp(p.keyword_match, 0, 100);
  const keyword_match = refineKeywordMatch(kmRaw, cleanMissingHard, cleanMissingSoft);
  return {
    ats_score: clamp(p.ats_score, 0, 100),
    keyword_match,
    formatting_score: clamp(p.formatting_score, 0, 100),
    matched_skills: fallbackMatched,
    top_keywords: deriveTopKeywordsFromJd(jobDescription, langNorm, cleanTopFromModel),
    missing_keywords: cleanMissing,
    missing_keywords_hard: cleanMissingHard.slice(0, 12),
    missing_keywords_soft: cleanMissingSoft.slice(0, 12),
    parsing_issues: cleanParsing,
  };
}

/**
 * Soft JD requirements may reduce keyword_match by at most ~5 points combined vs ignoring soft lines.
 * When only soft gaps remain, avoid Groq over-penalizing "preferred" like "must-have".
 */
function refineKeywordMatch(km, hard, soft) {
  let k = clamp(km, 0, 100);
  const nh = hard.length;
  const ns = soft.length;
  if (nh > 0 || ns === 0) return k;
  // Only soft gaps: lift overly harsh scores (models often deduct 15–20 for "nice to have")
  if (k < 95) {
    const targetFloor = 95;
    if (k >= 72) {
      k = Math.min(100, Math.max(k, targetFloor - Math.min(5, ns * 1.5)));
    } else if (k >= 55) {
      k = Math.min(100, k + Math.min(12, targetFloor - k));
    }
  }
  return clamp(k, 0, 100);
}

/** JD asks for student / pursuing degree; CV shows related enrollment → drop that "missing" line */
function isPursuingDegreeFalsePositive(cvText, jdText, missingLine) {
  const jd = String(jdText || "").toLowerCase();
  const cv = String(cvText || "").toLowerCase();
  const line = String(missingLine || "").toLowerCase();
  const jdStudentContext =
    /\b(pursuing|currently\s+studying|current\s+student|student\s+in|enrolled\s+in|working\s+towards|seeking\s+.*\s+degree|öğrencisi|öğrenci|devam\s+eden|yüksek\s+öğrenim|lisans\s+öğrencisi)\b/i.test(
      jd
    );
  const jdCompletionRequired =
    /\b(completed\s+degree|graduated|bachelor'?s\s+required|master'?s\s+required|diploma\s+required|degree\s+required|mezun\s+olmak|mezuniyet\s+şartı|tamamlanmış\s+lisans)\b/i.test(
      jd
    );
  if (!jdStudentContext || jdCompletionRequired) return false;
  if (!/\b(degree|diploma|bachelor|master|phd|lisans|yüksek\s+lisans|üniversite|university|faculty|bölüm)\b/i.test(line)) {
    return false;
  }
  const cvEduSignal =
    /\b(universit|üniversit|faculty|bölümü|department\s+of|student|öğrenci|class\s+of|gpa|dean|campus)\b/i.test(cv);
  return cvEduSignal;
}

function clamp(n, lo, hi) {
  const x = Number(n);
  if (Number.isNaN(x)) return 50;
  return Math.max(lo, Math.min(hi, Math.round(x)));
}

function takeStrings(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => String(s).trim()).filter(Boolean);
}

function deriveMatchedSkillsFromCv(cvText, jdText, existing, langNorm = "en") {
  if (Array.isArray(existing) && existing.length >= 3) return existing;
  const cv = String(cvText || "");
  const jd = String(jdText || "");
  const pool = [
    "project management", "stakeholder management", "agile", "scrum", "jira", "confluence",
    "sql", "python", "excel", "power bi", "tableau", "google analytics", "aws", "azure",
    "leadership", "communication", "data analysis", "product management", "market research",
  ];
  const semanticPairs = [
    { jd: ["client impact", "business impact", "customer impact"], cv: ["stakeholder management", "stakeholder collaboration", "cross-functional", "project management"] },
    { jd: ["stakeholder"], cv: ["stakeholder management", "stakeholder collaboration", "client communication"] },
    { jd: ["data-driven", "data driven", "analytics"], cv: ["data analysis", "data-driven decision making", "analysis"] },
    { jd: ["delivery", "execution"], cv: ["project management", "program management", "coordination"] },
    { jd: ["roadmap"], cv: ["product management", "planning", "prioritization"] },
  ];
  const trMap = {
    "project management": "proje yönetimi",
    "stakeholder management": "paydaş yönetimi",
    "stakeholder collaboration": "paydaş iş birliği",
    agile: "çevik çalışma",
    scrum: "scrum",
    jira: "jira",
    confluence: "confluence",
    sql: "sql",
    python: "python",
    excel: "excel",
    "power bi": "power bi",
    tableau: "tableau",
    "google analytics": "google analytics",
    aws: "aws",
    azure: "azure",
    leadership: "liderlik",
    communication: "iletişim",
    "data analysis": "veri analizi",
    "product management": "ürün yönetimi",
    "market research": "pazar araştırması",
    "client impact": "müşteri etkisi",
    "data-driven decision making": "veri odaklı karar verme",
  };
  const seen = new Set((existing || []).map((s) => s.toLowerCase()));
  const out = [...(existing || [])];
  const hayCv = cv.toLowerCase();
  const hayJd = jd.toLowerCase();
  for (const skill of pool) {
    if (out.length >= 5) break;
    if (seen.has(skill)) continue;
    if (hayCv.includes(skill) && (hayJd.includes(skill) || out.length < 3)) {
      out.push(skill);
      seen.add(skill);
    }
  }
  for (const pair of semanticPairs) {
    if (out.length >= 5) break;
    const jdHit = pair.jd.some((x) => hayJd.includes(x));
    if (!jdHit) continue;
    const cvHit = pair.cv.find((x) => hayCv.includes(x));
    if (!cvHit) continue;
    const key = cvHit.toLowerCase();
    if (seen.has(key)) continue;
    out.push(cvHit);
    seen.add(key);
  }
  if (out.length < 3) {
    const tokens = cv
      .split(/[\n,;|/()]/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 3 && s.length <= 32)
      .slice(0, 200);
    for (const t of tokens) {
      if (out.length >= 5) break;
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      if (/[a-z]/i.test(t)) {
        out.push(t);
        seen.add(k);
      }
    }
  }
  const localized = out.map((s) => {
    const key = String(s).toLowerCase();
    return langNorm === "tr" ? trMap[key] || s : s;
  });
  return localized
    .filter((s) => !/^(key duties|duties|responsibilities|requirements?)\b/i.test(String(s)))
    .slice(0, 30);
}

function deriveTopKeywordsFromJd(jdText, langNorm, existing = []) {
  if (Array.isArray(existing) && existing.length >= 3) return existing.slice(0, 20);
  const jd = String(jdText || "").toLowerCase();
  const keywords = [
    "project management", "stakeholder management", "client impact", "data-driven decision making",
    "sql", "python", "excel", "power bi", "tableau", "agile", "scrum", "communication", "leadership",
  ];
  const trMap = {
    "project management": "proje yönetimi",
    "stakeholder management": "paydaş yönetimi",
    "client impact": "müşteri etkisi",
    "data-driven decision making": "veri odaklı karar verme",
    sql: "sql", python: "python", excel: "excel", "power bi": "power bi", tableau: "tableau",
    agile: "çevik çalışma", scrum: "scrum", communication: "iletişim", leadership: "liderlik",
  };
  const out = [];
  for (const k of keywords) {
    if (out.length >= 12) break;
    if (jd.includes(k)) out.push(langNorm === "tr" ? trMap[k] || k : k);
  }
  const cleanedExisting = (existing || [])
    .map(cleanAtsTag)
    .filter(Boolean)
    .filter((x) => !isLikelyNonSkillKeyword(x))
    .slice(0, 20);
  const outFiltered = out.filter((x) => !isLikelyNonSkillKeyword(x));
  return outFiltered.length ? outFiltered : cleanedExisting;
}

function cleanAtsTag(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  if (/^(key duties|duties|responsibilities|requirements?)\s*[ivxlcdm0-9-]*$/i.test(s)) return "";
  return s.replace(/^(key duties|duties|responsibilities|requirements?)\s*[ivxlcdm0-9-]*[:\-]?\s*/i, "").trim();
}

/** JD education / policy / benefits lines — not ATS skills */
function isLikelyNonSkillKeyword(s) {
  const t = String(s || "").trim();
  if (!t || t.length > 100) return true;
  const low = t.toLowerCase();
  if (
    /\b(computer|electrical|electronics|software|mechanical|civil|chemical|industrial|aerospace|biomedical)\s+(engineering|science)\b/i.test(low) ||
    /\b(elektrik|elektronik|bilgisayar|yazılım|makine|kimya|inşaat)\s+mühendisliği?\b/i.test(low)
  ) {
    return true;
  }
  if (/\b(mis|bba|mba|b\.?s\.?c|m\.?s\.?c)\s*(degree|diploma)?\b/i.test(low)) return true;
  const patterns = [
    /\b(insurance|university|college|faculty|bachelor|master|phd|degree|diploma|gpa)\b/i,
    /\b(internship|intern\s|staj)\b/i,
    /\b(benefit|benefits|pto|paid\s+leave|vacation|parental|401k|pension|stock\s+option|perk)\b/i,
    /\b(policy|policies|compliance|eligible|authorization|work\s+permit|visa|sponsor)\b/i,
    /\b(salary|compensation|bonus|remote\s+work\s+policy)\b/i,
    /\b(mühendislik\s+fakültesi|fakülte|üniversite|mezuniyet|lisans|yüksek\s+lisans|doktora)\b/i,
    /\b(zorunlu\s+staj|staj\s+zorunl|sigorta|üniversite\s+tarafından|yan\s+hak|izin\s+hakkı)\b/i,
    /\b(eğitim\s+seviyesi|öğrenim\s+şartı|mezun\s+olmak)\b/i,
    /\b(karşılanması|koşulu|şartıdır|adayda\s+aranan)\b.*\b(eğitim|sigorta|staj)\b/i,
  ];
  return patterns.some((re) => re.test(t) || re.test(low));
}
