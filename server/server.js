import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { runMultiAnalyze } from "../lib/analyze/index.js";
import { runAnalyzeV2ForClient } from "../lib/analyze-v2/index.js";

dotenv.config();

const app = express();
app.use(cors());
const jsonParser = express.json();
app.use((req, res, next) => {
  // Webhook must keep raw bytes for HMAC validation.
  if (req.path === "/api/webhook" || req.path === "/webhook") return next();
  return jsonParser(req, res, next);
});

if (!process.env.OPENROUTER_API_KEY) {
  console.error("❌ OPENROUTER_API_KEY missing!");
}

app.post("/api/analyze", async (req, res) => {
  try {
    const { cvText, jobDescription, cv, jd } = req.body || {};
    const c = String(cvText ?? cv ?? "").trim();
    const j = String(jobDescription ?? jd ?? "").trim();
    if (!c || !j) {
      return res
        .status(400)
        .json({ error: "Missing cvText or jobDescription" });
    }
    const result = await runMultiAnalyze({
      cvText: c,
      jobDescription: j,
    });
    return res.status(200).json(result);
  } catch (e) {
    console.error("/api/analyze", e);
    return res.status(500).json({
      error: e?.message || "Analysis failed",
    });
  }
});

app.post("/api/analyze-v2", async (req, res) => {
  try {
    const { cvText, jobDescription, cv, jd, isPro, sector, lang } = req.body || {};
    const c = String(cvText ?? cv ?? "").trim();
    const j = String(jobDescription ?? jd ?? "").trim();
    if (!c || !j) {
      return res
        .status(400)
        .json({ error: "Missing cvText or jobDescription" });
    }
    const payload = await runAnalyzeV2ForClient({
      cvText: c,
      jobDescription: j,
      isPro: Boolean(isPro),
      sector,
      lang,
    });
    return res.status(200).json(payload);
  } catch (e) {
    console.error("/api/analyze-v2", e);
    return res.status(500).json({
      error: e?.message || "Analyze v2 failed",
    });
  }
});

app.post("/api/extract-job", async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: "Invalid URL" });
    }

    const fetchWithTimeout = async (target, opts = {}, timeoutMs = 5000) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(target, { ...opts, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    };

    const stripHtmlToVisibleText = (html) =>
      String(html || "")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
        .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
        .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/\s+/g, " ")
        .trim();

    const getTitleFromHtml = (html, fallback = "Job Description") => {
      const h1 = String(html || "").match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
      const titleTag = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
      const candidate = (h1 || titleTag || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return candidate || fallback;
    };

    const response = await fetchWithTimeout(
      parsedUrl.toString(),
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      },
      5000
    );

    if (!response.ok) {
      return res
        .status(400)
        .json({ error: `Failed to fetch page: ${response.status}` });
    }

    const html = await response.text();
    const visible = stripHtmlToVisibleText(html).slice(0, 4000);
    const fallbackTitle = getTitleFromHtml(html);

    let title = fallbackTitle;
    let jobText = visible;

    if (process.env.OPENROUTER_API_KEY && visible.length > 120) {
      try {
        const aiRes = await fetchWithTimeout(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "openai/gpt-4o-mini",
              temperature: 0.1,
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "user",
                  content: `Clean and extract a structured job description from this messy HTML text.

Return valid JSON only:
{
  "title": "<role title>",
  "responsibilities": ["<bullet>", "<bullet>"],
  "requirements": ["<bullet>", "<bullet>"]
}

Rules:
- Be concise and readable.
- Remove boilerplate, legal text, navigation noise.
- Keep only role-relevant content.
- Max combined output length: 4000 chars.

Text:
${visible}`,
                },
              ],
            }),
          },
          5000
        );
        const aiData = await aiRes.json();
        const raw = aiData?.choices?.[0]?.message?.content || "";
        const parsed = extractJSON(raw);

        if (parsed) {
          title = String(parsed.title || fallbackTitle).trim() || fallbackTitle;
          const responsibilities = Array.isArray(parsed.responsibilities)
            ? parsed.responsibilities.map((x) => String(x).trim()).filter(Boolean).slice(0, 10)
            : [];
          const requirements = Array.isArray(parsed.requirements)
            ? parsed.requirements.map((x) => String(x).trim()).filter(Boolean).slice(0, 10)
            : [];
          const composed = [
            responsibilities.length ? "Responsibilities:\n- " + responsibilities.join("\n- ") : "",
            requirements.length ? "Requirements:\n- " + requirements.join("\n- ") : "",
          ]
            .filter(Boolean)
            .join("\n\n")
            .trim();
          if (composed) {
            jobText = composed.slice(0, 4000);
          }
        }
      } catch {
        // best-effort AI cleaning; fallback remains usable
      }
    }

    return res.status(200).json({ title, jobText });
  } catch (error) {
    return res.status(500).json({
      error: "Server error while extracting job page",
      details: error?.message || "Unknown error",
    });
  }
});

function extractJSON(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

// Post-processing cleaner — removes AI-like language from string fields
function cleanAITone(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const forbidden = [
    /\boptimize\b/gi, /\benhance\b/gi, /\bleverage\b/gi,
    /\bconsider\b/gi, /\bsuggests?\b/gi, /\bcould be\b/gi,
    /\bit is (important|recommended|worth)\b/gi,
    /\bplease note\b/gi, /\bfeel free\b/gi,
    /\bin order to\b/gi, /\bsubstantially\b/gi,
  ];
  const replacements = {
    "optimize": "fix", "enhance": "strengthen", "leverage": "use",
    "consider": "do this:", "could be improved": "is weak",
    "it is important": "critical:", "it is recommended": "",
    "in order to": "to",
  };

  function cleanString(str) {
    if (typeof str !== "string") return str;
    let result = str;
    forbidden.forEach(rx => {
      result = result.replace(rx, match => {
        const lower = match.toLowerCase();
        return replacements[lower] || match;
      });
    });
    return result;
  }

  function walk(node) {
    if (typeof node === "string") return cleanString(node);
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      const cleaned = {};
      for (const key of Object.keys(node)) {
        cleaned[key] = walk(node[key]);
      }
      return cleaned;
    }
    return node;
  }

  return walk(obj);
}

app.post("/analyze", async (req, res) => {
  const { cvText, jobDescription, sector, lang } = req.body;
  console.log("SECTOR RECEIVED:", sector);

  if (!cvText || !jobDescription) {
    return res.status(400).json({ error: "Missing CV or Job Description" });
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: `You are an expert career analyst and senior recruiter with 15+ years of experience.
            ${sector && sector !== "Auto-detect" ? `You are specifically evaluating this CV as a ${sector} sector recruiter. ${
  sector === "Tech / Startup" ? "Focus on: technical skills, GitHub/portfolio, startup experience, problem-solving ability, specific tech stack match, side projects. Red flags: no technical projects, vague descriptions, no measurable impact." :
  sector === "Consulting" ? "Focus on: structured thinking, quantified impact, prestigious education, leadership, case experience, communication skills. Red flags: no numbers/metrics, weak academic background, poor formatting." :
  sector === "Finance" ? "Focus on: Excel/financial modeling, CFA/internships, quantitative skills, attention to detail, regulatory knowledge. Red flags: no finance certifications, gaps in employment, lack of quantitative evidence." :
  sector === "FMCG / Retail" ? "Focus on: commercial acumen, sales numbers, brand management, market analysis, cross-functional work. Red flags: no commercial results, lack of consumer insight experience." :
  sector === "Healthcare" ? "Focus on: certifications/licenses, clinical experience, compliance knowledge, patient outcomes. Red flags: missing certifications, gaps in clinical experience." :
  sector === "Government" ? "Focus on: public sector experience, policy knowledge, compliance, formal writing, citizenship requirements. Red flags: only private sector background, lack of formal qualifications." :
  `Apply the exact standards, expectations, and red flags that ${sector} recruiters care about most.`
}` : "You have deep expertise across tech, consulting, finance, and FMCG sectors. Auto-detect the most relevant sector from the job description and apply appropriate standards."}

TONE RULES — CRITICAL:
- Write like a recruiter who is tired and honest. Short sentences. Direct. Slightly uncomfortable truths — why this CV gets passed over, not gentle homework.
- Frame gaps as rejection mechanics: "You are being filtered because…" / "Recruiters will assume…" — not "consider improving".
- FORBIDDEN WORDS: optimize, enhance, leverage, consider, suggest, could, important to note, in order to, please note
- BAD: "This CV could be improved by adding metrics" 
- GOOD: "No metrics on the page — you look like noise next to candidates who proved impact."

CV:
${cvText}

Job Description:
${jobDescription}
${lang === "TR" ? "IMPORTANT: Return ALL text fields in Turkish language. Tüm metin alanlarını Türkçe yaz." : "Return all text fields in English."}
Return ONLY valid JSON. No markdown, no explanation, no extra text.

{
  "alignment_score": <number 40-91, be realistic>,
  "role_type": "<exact job title from JD>",
  "seniority": "<Intern|Junior|Mid|Senior>",
  "confidence_score": <number 60-95>,
  "confidence_level": "<Low|Medium|High>",
  "confidence_basis": "<1 sentence, direct>",
  "matched_skills": ["<skill>"],
  "missing_skills": ["<concrete skill/tool from JD — e.g. Python, SQL, VBA — not vague labels>"],
  "top_keywords": ["<keyword>"],
  "score_breakdown": {
    "skills_match": <0-100>,
    "keyword_match": <0-100>,
    "experience_depth": <0-100>,
    "formatting": <0-100>,
    "skills_explanation": "<direct 1 sentence>",
    "experience_explanation": "<direct 1 sentence>"
  },
  "fit_summary": "<2-3 direct sentences: verdict-style, no filler — what happens if they apply today>",
  "strengths": ["<specific strength, only if real>"],
  "improvements": ["<specific imperative fix — what to do, not 'you might'>"],
  "rejection_reasons": {
    "high": ["<critical reason — why they get rejected, harsh but fair>"],
    "medium": ["<moderate concern — real screen risk>"],
    "low": ["<minor issue>"]
  },
  "recruiter_simulation": {
    "sector": "<sector>",
    "first_impression": "<7-second screen: blunt — pass, bin, or skeptical and why>",
    "internal_monologue": "<2-3 sentences: real recruiter self-talk under pressure — selection not coaching; name the filter>",
    "would_interview": <true|false>,
    "decision": "<shortlist | reject | follow-up | strong yes>",
    "red_flags": ["<credibility or fit killer, sharp phrasing>"],
    "standout_moments": ["<only if genuinely rare proof — no hollow praise>"]
  },
  "blind_spots": [
    { "issue": "<specific issue>", "why_it_hurts": "<direct reason>", "fix": "<exact action>" }
  ],
  "benchmark": {
    "gap_percentage": <0-60, internal only — do not phrase user-facing copy as "gap %" — use missing_skills instead>,
    "before_after_estimate": <number>,
    "dimensions": [
      { "name": "<dimension>", "candidate_level": "<Basic|Some|Good|Strong|Missing>", "ideal_level": "<target>", "closeable": <true|false> }
    ]
  },
  "interview_prep": [
    { "question": "<question>", "why_asked": "<reason>", "personal_angle": "<tip using CV content>" }
  ],
  "role_matches": [
    { "role": "<role>", "match_score": <60-95>, "reason": "<1 sentence>" }
  ],
  "salary_insight": {
    "range_min": <number>, "range_max": <number>, "currency": "<TRY|USD|EUR|GBP>",
    "mid_point": <number>, "confidence": "<Low|Medium|High>", "context": "<brief>"
  },
  "ats_compatibility": [
    { "system": "<Workday|Greenhouse|Lever|SAP|Taleo>", "status": "<Passes|Review|At Risk>", "note": "<reason>" }
  ],
  "culture_fit": {
    "overall_score": <40-95>,
    "dimensions": [{ "name": "<dimension>", "score": <40-95>, "signal": "<CV signal>" }]
  },
  "language_analysis": {
    "passive_voice_count": <number>,
    "weak_phrases": ["<exact phrase from CV>"],
    "missing_impact_metrics": <true|false>,
    "tone": "<Professional|Too casual|Too formal|Appropriate>"
  }
}`
          }
        ]
      })
    });

    const data = await response.json();
    const rawText = data?.choices?.[0]?.message?.content;
    const parsed = extractJSON(rawText);

    if (!parsed) {
      return res.json({ alignment_score: 50, confidence_level: "Medium", rejection_reasons: { high: ["Parsing failed"], medium: [], low: [] } });
    }

    return res.json(cleanAITone(parsed));

  } catch (err) {
    console.error("💥 SERVER ERROR:", err);
    return res.status(500).json({ alignment_score: 0, confidence_level: "Low", rejection_reasons: { high: ["Server error"], medium: [], low: [] } });
  }
});

app.post("/optimize", async (req, res) => {
  const { cvText, jobDescription, lang } = req.body;
  if (!cvText || !jobDescription) return res.status(400).json({ error: "Missing CV or JD" });

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0.35,
        messages: [
          {
            role: "user",
            content: `You are a senior recruiter-turned-CV writer doing a "Fix My CV" pass for one specific job.

TASK — rewrite the ENTIRE CV for this job description:
1) Every bullet: strong action verb + outcome + metric (use plausible estimates like "~20%", "~15k users", "~$XM" only where reasonable from context; if unknown, still quantify scope: "across 3 teams", "weekly reports for leadership").
2) Remove generic filler ("responsible for", "worked on", "helped with", "team player", "detail-oriented") — replace with concrete achievements tied to the JD keywords.
3) Mirror critical language from the job description naturally (skills, tools, domains) without lying.
4) Keep structure readable (headers, bullets). Preserve truthful employment/education facts — improve phrasing and emphasis only.
5) Return ONLY the rewritten CV body text. No preamble, no markdown fences.

${lang === "TR" ? "Write the CV in Turkish." : "Write the CV in English."}

CV:
${cvText}

Job Description:
${jobDescription}`
          }
        ]
      })
    });

    const data = await response.json();
    const optimizedCv = data?.choices?.[0]?.message?.content || "";
    return res.json({ optimizedCv });

  } catch (err) {
    console.error("💥 OPTIMIZE ERROR:", err);
    return res.status(500).json({ error: "Optimization failed" });
  }
});

app.post("/roadmap", async (req, res) => {
  const { missingSkills, roleType, seniority } = req.body;
  if (!missingSkills?.length) return res.status(400).json({ error: "No missing skills provided" });

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0.4,
        messages: [
          {
            role: "user",
            content: `Create a concise 30-day learning roadmap for someone targeting a ${seniority || "Junior"} ${roleType || "role"} who is missing these skills: ${missingSkills.join(", ")}.

For each skill provide: week number, specific resource (course/book/project), and estimated hours. Be practical and specific. Return as plain text, no JSON.`
          }
        ]
      })
    });

    const data = await response.json();
    const roadmap = data?.choices?.[0]?.message?.content || "";
    return res.json({ roadmap });

  } catch (err) {
    console.error("💥 ROADMAP ERROR:", err);
    return res.status(500).json({ error: "Roadmap generation failed" });
  }
});

app.post("/apply-fix", async (req, res) => {
  const { cvText, problem, fix, lang } = req.body;
  if (!cvText || !problem) return res.status(400).json({ error: "Missing data" });

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: `You are an expert CV writer.

Problem in this CV: "${problem}"
Fix to apply: "${fix}"

Full CV:
${cvText}

Find the specific section with this problem. Rewrite ONLY that part. Keep everything else the same.
${lang === "TR" ? "Return in Turkish." : "Return in English."}

Return ONLY this JSON:
{
  "original_section": "exact original text from CV",
  "rewritten_section": "improved version",
  "explanation": "1 sentence: what changed"
}`
          }
        ]
      })
    });

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsed = extractJSON(content);
    res.json(parsed || { error: "Could not parse response" });
  } catch (err) {
    console.error("💥 APPLY-FIX ERROR:", err);
    res.status(500).json({ error: "Apply fix failed" });
  }
});

app.post("/decision", async (req, res) => {
  const { cvText, jobDescription, sector, lang, deadline, targetRole } = req.body;

  if (!cvText || !jobDescription) {
    return res.status(400).json({ error: "Missing CV or Job Description" });
  }

  const deadlineType = deadline || "1_week";

  try {
    // STEP 1: GPT — Core decision (source of truth)
    const gptResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: `You are a senior recruiter under time pressure. Review this CV against the job description. Your job is to simulate who gets cut in screening — not to encourage the candidate.

FORBIDDEN WORDS: optimize, enhance, leverage, consider, suggest, could, important to note, in order to
FORBIDDEN TONE: motivational, gentle, "you have potential", hedging with "might"

STYLE: Short sentences. Max 12 words each. Sharp. Uncomfortable but professional.
SCREENING LOGIC: Say what fails the bar — e.g. missing must-have tools, weak proof, wrong seniority signal, generic bullets that die in ATS.
EXAMPLES OF GOOD PHRASING:
- "Would likely fail first screen — no automation proof."
- "Profile is not competitive for this level yet."
- BAD: "Could be improved with more technical skills."

CV:
${cvText}

JOB DESCRIPTION:
${jobDescription}

${targetRole ? `TARGET ROLE: ${targetRole}` : ""}
DEADLINE: ${deadlineType}
SECTOR: ${sector || "Auto-detect"}
${lang === "TR" ? "Return ALL text in Turkish. No English words except JSON keys." : "Return in English."}

Return ONLY this JSON (no markdown):
{
  "decision": ${lang === "TR" ? '"Yüksek ihtimal" | "Orta ihtimal" | "Düşük ihtimal"' : '"High chance" | "Medium chance" | "Low chance"'},
  "confidence": <number 0-100>,
  "fitScore": <number 0-100>,
  "improvedScore": <number 0-100>,
  "summary": "<1 sentence: blunt screening outcome — not encouragement, max 15 words>",
  "biggestMistake": "<single main rejection driver, max 12 words — why they lose to other applicants>",
  "topFixes": [
    { "problem": "<specific problem, max 10 words>", "fix": "<exact action, max 12 words>", "impact": "High" | "Medium" },
    { "problem": "<specific problem>", "fix": "<exact action>", "impact": "High" | "Medium" },
    { "problem": "<specific problem>", "fix": "<exact action>", "impact": "High" | "Medium" }
  ],
  "missingSkills": ["<skill>", "<skill>", "<skill>"],
  "recruiterInsight": [
    "<1 sentence: harsh realistic screen thought — selection pressure, not advice>",
    "<1 sentence: what makes them a no or a maybe>",
    "<1 sentence: credibility or fit killer if any>"
  ],
  "oneAction": "<single most important action, max 12 words>",
  "aiSuspicion": {
    "level": "Low" | "Medium" | "High",
    "reasons": ["<specific generic phrase found in CV>"],
    "fix": "<how to make it sound more human, max 15 words>"
  },
  "deadlinePlan": {
    "type": "${deadlineType}",
    "steps": [
      { "day": "<timeframe>", "action": "<specific action, max 12 words>" },
      { "day": "<timeframe>", "action": "<specific action>" },
      { "day": "<timeframe>", "action": "<specific action>" }
    ]
  }
}`
          }
        ]
      })
    });

    const gptData = await gptResponse.json();
    const gptContent = gptData?.choices?.[0]?.message?.content;
    const gptParsed = extractJSON(gptContent);

    if (!gptParsed) {
      return res.status(500).json({ error: "GPT parsing failed" });
    }

    // Clean AI tone from output
    const cleaned = cleanAITone(gptParsed);

    // =========================
// STEP 2: AI DETECTION + GUT FEELING
// =========================

try {
  const [aiRes, gutRes] = await Promise.all([
    fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: `You are a recruiter detecting AI-written CVs.

Return STRICT JSON:
{
  "aiScore": number (0-100),
  "aiLevel": "Low" | "Medium" | "High",
  "reasons": string[],
  "fix": string[]
}

Rules:
- High score if generic phrases exist
- High score if no metrics
- High score if too polished
- Be harsh

CV:
${cvText}`
          }
        ]
      })
    }),

    fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0.3,
        messages: [
          {
            role: "user",
            content: `You are a recruiter.

Say your gut feeling about this CV in ONE short sentence.

Rules:
- Max 10 words
- Direct
- Slightly harsh

CV:
${cvText}`
          }
        ]
      })
    })
  ]);

  const aiData = await aiRes.json();
  const gutData = await gutRes.json();

  const aiParsed = extractJSON(aiData?.choices?.[0]?.message?.content);

  cleaned.aiScore = aiParsed?.aiScore || 0;
  cleaned.aiLevel = aiParsed?.aiLevel || "Low";
  cleaned.aiReasons = aiParsed?.reasons || [];
  cleaned.aiFix = aiParsed?.fix || [];

  cleaned.gutFeeling =
    gutData?.choices?.[0]?.message?.content || "Feels average.";

} catch (err) {
  console.error("AI detection/gut failed:", err.message);
}

    // STEP 3: Tone rewriter — make output sound human
try {
  const toneResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: `You are a recruiter reviewing a CV. You have 10 seconds. Say what matters for WHO GETS CUT.

RULES:
- Short sentences. Max 8-10 words each.
- No filler. No AI tone. No corporate language. No motivation.
- FORBIDDEN: optimize, enhance, leverage, improve, consider, suggest, could, would
- Direct. Screening pressure. Professional but sharp.

EXAMPLES:
❌ "Good experience, but lacks project management skills."
✅ "Wrong skill stack for this JD. Next."

❌ "Highlight specific data analysis tools used."
✅ "List exact tools. SQL, Python, Excel."

❌ "This CV contains generic phrases."
✅ "Generic CV. Fails noisy shortlist."

❌ "Could be improved with more technical skills."
✅ "Would likely fail screen — missing must-have tools."

Rewrite ONLY these text fields. Keep all numbers, arrays structure, and non-text fields EXACTLY the same.
DO NOT change logic. DO NOT add insights. ONLY rewrite tone.
${lang === "TR" ? "Keep all text in Turkish." : "Keep all text in English."}

Input JSON:
${JSON.stringify({
  summary: cleaned.summary,
  biggestMistake: cleaned.biggestMistake,
  topFixes: cleaned.topFixes,
  oneAction: cleaned.oneAction,
  recruiterInsight: cleaned.recruiterInsight,
  aiSuspicion: cleaned.aiSuspicion,
  deadlinePlan: cleaned.deadlinePlan,
  aiScore: cleaned.aiScore,
  aiLevel: cleaned.aiLevel,
  aiReasons: cleaned.aiReasons,
  aiFix: cleaned.aiFix,
  gutFeeling: cleaned.gutFeeling
})}

Return ONLY a JSON object with the same keys and rewritten values. No markdown.`
        }
      ]
    })
  });

  const toneData = await toneResponse.json();
  const toneContent = toneData?.choices?.[0]?.message?.content;
  console.log("Tone raw:", toneContent);
  const toneParsed = extractJSON(toneContent);

  if (toneParsed) {
    const final = {
      ...cleaned,
      summary: toneParsed.summary || cleaned.summary,
      aiScore: toneParsed.aiScore || cleaned.aiScore,
      aiLevel: toneParsed.aiLevel || cleaned.aiLevel,
      aiReasons: toneParsed.aiReasons || cleaned.aiReasons,
      aiFix: toneParsed.aiFix || cleaned.aiFix,
      gutFeeling: toneParsed.gutFeeling || cleaned.gutFeeling,
      biggestMistake: toneParsed.biggestMistake || cleaned.biggestMistake,
      topFixes: toneParsed.topFixes || cleaned.topFixes,
      oneAction: toneParsed.oneAction || cleaned.oneAction,
      recruiterInsight: toneParsed.recruiterInsight || cleaned.recruiterInsight,
      aiSuspicion: toneParsed.aiSuspicion || cleaned.aiSuspicion,
      deadlinePlan: toneParsed.deadlinePlan || cleaned.deadlinePlan,
    }
    return res.json(final);
  }
} catch (toneErr) {
  console.error("Tone rewriter failed, using original:", toneErr.message);
}

return res.json(cleaned);





    // When Claude API is connected:
    // const claudeEnriched = await enrichWithClaude(cleaned, cvText, lang);
    // return res.json(mergeOutputs(cleaned, claudeEnriched));

    

  } catch (err) {
    console.error("💥 DECISION ERROR:", err);
    res.status(500).json({ error: "Decision analysis failed" });
  }
});

const lemonWebhookHandler = async (req, res) => {
  const secret = process.env.LEMON_WEBHOOK_SECRET;
  const signature = String(req.get("x-signature") || req.headers["x-signature"] || "")
    .trim()
    .toLowerCase();

  // Be defensive: in some deployments express.json() may run first and req.body becomes an object.
  // Signature must be computed from bytes, so we normalize body into a Buffer.
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : typeof req.body === "string"
      ? Buffer.from(req.body)
      : Buffer.from(JSON.stringify(req.body || {}));

  let payload = null;
  try {
    payload = JSON.parse(rawBody.toString());
  } catch {}
  const eventName = payload?.meta?.event_name || req.headers["x-event-name"] || "unknown";
  console.log("[lemon-webhook] Webhook received:", eventName);

  const crypto = await import("crypto");
  const bodyString = rawBody.toString("utf8");
  const computedSignature = crypto.default
    .createHmac("sha256", secret)
    .update(bodyString, "utf8")
    .digest("hex")
    .toLowerCase();

  if (computedSignature !== signature) {
    console.log("[lemon-webhook] Signature verification: FAIL", {
      receivedSigLength: signature.length,
      computedSigLength: computedSignature.length,
    });
    return res.status(401).json({ error: "Invalid signature" });
  }
  console.log("[lemon-webhook] Signature verification: PASS");

  const userEmail = payload?.data?.attributes?.user_email;
  console.log("[lemon-webhook] Event payload user:", userEmail || "no user_email");

  const proEvents = new Set(["order_created", "subscription_created", "subscription_payment_success"]);
  const freeEvents = new Set(["subscription_cancelled", "subscription_expired"]);
  const targetPlan = proEvents.has(eventName) ? "pro" : freeEvents.has(eventName) ? "free" : null;

  if (!targetPlan) {
    console.log("[lemon-webhook] No plan change action for event:", eventName);
    return res.json({ received: true, event: eventName, action: "ignored" });
  }

  if (!userEmail) {
    console.warn("[lemon-webhook] Missing user_email for event:", eventName);
    return res.json({ received: true, event: eventName, action: "no_user_email" });
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users?.users?.find(u => u.email === userEmail);
    if (user) {
      const { error } = await supabase.from("user_plans").upsert({ user_id: user.id, plan: targetPlan }, { onConflict: "user_id" });
      if (error) {
        console.error(`[lemon-webhook] Supabase update error (${targetPlan}):`, error.message);
        return res.status(500).json({ error: "Supabase update failed", event: eventName, plan: targetPlan });
      } else {
        console.log(`[lemon-webhook] Supabase update success (${targetPlan}):`, userEmail);
        return res.json({ received: true, event: eventName, action: "updated", plan: targetPlan });
      }
    } else {
      console.warn("[lemon-webhook] Supabase user not found for:", userEmail);
      return res.json({ received: true, event: eventName, action: "user_not_found" });
    }
  } catch (e) {
    console.error("[lemon-webhook] Unexpected processing error:", e?.message || e);
    return res.status(500).json({ error: "Webhook processing failed", event: eventName });
  }
};

app.post("/api/webhook", express.raw({ type: "application/json" }), lemonWebhookHandler);
app.post("/webhook", express.raw({ type: "application/json" }), lemonWebhookHandler);

app.listen(3000, () => {
  console.log("🚀 Backend running on http://localhost:3000");
});
