import { callClaude, CLAUDE_MODEL_OPUS } from "../claudeClient.js";
import { parseModelJson } from "./json.js";
import { getSectorPromptBlock } from "./sectorContext.js";
import { systemPromptWithLang, MANDATORY_TURKISH_AI_OUTPUT, userPromptLangFooter } from "./lang.js";
import { normalizeCareerRoleLabel } from "./roleTaxonomy.js";

const MODEL = CLAUDE_MODEL_OPUS;

export async function runRoleFitEngine(cvText, jobDescription, sector, langNorm = "en", careerContext = null) {
  const lens = getSectorPromptBlock(sector, careerContext);
  const langInstruction = langNorm === "tr" ? MANDATORY_TURKISH_AI_OUTPUT : "Respond in English.";
  const uiLang = langNorm === "tr" ? "TR" : "EN";
  const basePrompt = `${lens}

Allowed role labels only:
EN: Product Management, Product Strategy, Growth, Growth Strategy, Business Analysis, Strategy & Operations, GTM Operations, AI Product Operations, Marketing, Data Analysis, Business Development, Project Management, Customer Success, UX Research.
TR: Ürün Yönetimi, Ürün Stratejisi, Growth / Büyüme, Growth Strategy, İş Analizi, Strateji & Operasyon, GTM Operasyonları, AI Product Operations, Pazarlama, Veri Analizi, Business Development, Proje Yönetimi, Müşteri Başarısı, UX Araştırma.
Never output task phrases as role names. If you think "user story / backlog / roadmap / PRD", use Product Management.

Based ONLY on evidence in the CV (not wishful thinking), estimate fit to these real career lanes. Scores 0-100.
For each role row, explain career adjacency: recruiter reasoning, transferable evidence, positioning explanation, and proximity confidence.
Quote CV wording directly where possible; never use generic filler.
If the evidence is absent, state "CV'de belirtilmemiş" or "Not stated on the CV" and do not invent.
Focus ONLY on career strategy and role-fit transferability. Explain where the profile compounds and where recruiter perception gets stronger.
Maximum output: exactly 4 role_fit items, each with short, specific fields.
Turkish mode rule: Yanıtını Türkçe ver, İngilizce kelime karıştırma.
Do not repeat recruiter emotional commentary, gap diagnostics, or action-plan recommendations from other sections.

CV:
${cvText}

Target job context:
${jobDescription}

Return ONLY valid JSON:
{
  "role_fit": [
    { "role": "<allowed role label>", "score": <number>, "evidence": "<specific CV reference>", "recruiter_reasoning": "<why recruiter confidence rises here>", "positioning": "<why this lane reads more naturally>", "proximity_confidence": "high|medium|low" },
    { "role": "<allowed role label>", "score": <number>, "evidence": "<specific CV reference>", "recruiter_reasoning": "<why recruiter confidence rises here>", "positioning": "<why this lane reads more naturally>", "proximity_confidence": "high|medium|low" },
    { "role": "<allowed role label>", "score": <number>, "evidence": "<specific CV reference>", "recruiter_reasoning": "<why recruiter confidence rises here>", "positioning": "<why this lane reads more naturally>", "proximity_confidence": "high|medium|low" },
    { "role": "<allowed role label>", "score": <number>, "evidence": "<specific CV reference>", "recruiter_reasoning": "<why recruiter confidence rises here>", "positioning": "<why this lane reads more naturally>", "proximity_confidence": "high|medium|low" }
  ],
  "best_role": "<one allowed role label>"
}

If CV is clearly outside the taxonomy, choose the closest allowed lane; do not invent a new role label.${userPromptLangFooter(langNorm)}`;
  const user = `${langInstruction}\n\n${basePrompt}`;

  const system = systemPromptWithLang(
    "You map CV evidence to real career lanes. Return valid JSON only. Be specific and direct.",
    langNorm
  );
  const content = await callClaude(user, system, 1200, { langNorm, model: MODEL });

  const p = parseModelJson(content) || {};
  const defaults = [
    { role: normalizeCareerRoleLabel("Product Management", uiLang), score: 40 },
    { role: normalizeCareerRoleLabel("Product Strategy", uiLang), score: 40 },
    { role: normalizeCareerRoleLabel("Marketing", uiLang), score: 40 },
    { role: normalizeCareerRoleLabel("Data Analysis", uiLang), score: 40 },
    { role: normalizeCareerRoleLabel("Strategy & Operations", uiLang), score: 40 },
  ];
  let role_fit = defaults;
  if (Array.isArray(p.role_fit)) {
    role_fit = p.role_fit
      .map((x) => ({
        role: normalizeCareerRoleLabel(
          String(x?.role || "").trim(),
          uiLang,
          `${x?.evidence || ""} ${cvText} ${jobDescription}`
        ),
        score: clamp(x?.score, 0, 100),
        evidence: String(x?.evidence || "").trim(),
        recruiter_reasoning: String(x?.recruiter_reasoning || "").trim(),
        positioning: String(x?.positioning || "").trim(),
        proximity_confidence: String(x?.proximity_confidence || "").trim(),
      }))
      .filter((x) => x.role)
      .slice(0, 6);
    if (role_fit.length < 4) {
      role_fit = defaults.map((d, i) => role_fit[i] || d);
    }
  }

  return {
    role_fit: role_fit.slice(0, 4),
    best_role: normalizeCareerRoleLabel(
      String(p.best_role || role_fit[0]?.role || "Product Management").trim(),
      uiLang,
      `${cvText} ${jobDescription}`
    ),
  };
}

function clamp(n, lo, hi) {
  const x = Number(n);
  if (Number.isNaN(x)) return 45;
  return Math.max(lo, Math.min(hi, Math.round(x)));
}
