import { openrouterChat } from "./client.js";
import { parseModelJson } from "./json.js";
import { getSectorPromptBlock } from "./sectorContext.js";
import { systemPromptWithLang, userPromptLangFooter } from "./lang.js";

const MODEL = "openai/gpt-4o-mini";

export async function runRoleFitEngine(cvText, jobDescription, sector, langNorm = "en") {
  const lens = getSectorPromptBlock(sector);
  const user = `${lens}

Based ONLY on evidence in the CV (not wishful thinking), estimate fit to these FUNCTIONAL buckets — scores 0-100. Interpret what "strong" means using the sector lens above (e.g. Strategy weight in consulting, shipping signals in tech).
For each role row, include a short evidence string that ties role fit to concrete CV details (project, experience, certification, measurable outcome).
Use format: "Your X project is relevant for Y in this role."

CV:
${cvText}

Target job context:
${jobDescription}

Return ONLY valid JSON:
{
  "role_fit": [
    { "role": "Product", "score": <number>, "evidence": "<specific CV reference>" },
    { "role": "Marketing", "score": <number>, "evidence": "<specific CV reference>" },
    { "role": "Data", "score": <number>, "evidence": "<specific CV reference>" },
    { "role": "Strategy", "score": <number>, "evidence": "<specific CV reference>" }
  ],
  "best_role": "<one of the four OR a tighter label if clearly different, e.g. Engineering>"
}

If CV is clearly engineering, you may set low scores across all four and set best_role to the real lane (still one short label).${userPromptLangFooter(langNorm)}`;

  const content = await openrouterChat({
    model: MODEL,
    temperature: 0.22,
    responseFormat: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: systemPromptWithLang(
          "You map CV evidence to role families. No encouragement. JSON only. Be specific to THIS candidate's CV. Reference actual experiences, projects, certifications mentioned in the CV. Never give generic advice that could apply to anyone.",
          langNorm
        ),
      },
      { role: "user", content: user },
    ],
  });

  const p = parseModelJson(content) || {};
  const defaults = [
    { role: "Product", score: 40 },
    { role: "Marketing", score: 40 },
    { role: "Data", score: 40 },
    { role: "Strategy", score: 40 },
  ];
  let role_fit = defaults;
  if (Array.isArray(p.role_fit)) {
    role_fit = p.role_fit
      .map((x) => ({
        role: String(x?.role || "").trim() || "Role",
        score: clamp(x?.score, 0, 100),
        evidence: String(x?.evidence || "").trim(),
      }))
      .filter((x) => x.role)
      .slice(0, 6);
    if (role_fit.length < 4) {
      role_fit = defaults.map((d, i) => role_fit[i] || d);
    }
  }

  return {
    role_fit: role_fit.slice(0, 4),
    best_role: String(p.best_role || role_fit[0]?.role || "Product").trim(),
  };
}

function clamp(n, lo, hi) {
  const x = Number(n);
  if (Number.isNaN(x)) return 45;
  return Math.max(lo, Math.min(hi, Math.round(x)));
}
