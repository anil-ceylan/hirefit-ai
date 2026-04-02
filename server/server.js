import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

if (!process.env.OPENROUTER_API_KEY) {
  console.error("❌ OPENROUTER_API_KEY missing!");
}

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
- Write like a recruiter reviewing in 10 seconds. Short sentences. Direct. No filler.
- FORBIDDEN WORDS: optimize, enhance, leverage, consider, suggest, could, important to note, in order to, please note
- BAD: "This CV could be improved by adding metrics" 
- GOOD: "No metrics. Add numbers to every bullet."

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
  "missing_skills": ["<skill>"],
  "top_keywords": ["<keyword>"],
  "score_breakdown": {
    "skills_match": <0-100>,
    "keyword_match": <0-100>,
    "experience_depth": <0-100>,
    "formatting": <0-100>,
    "skills_explanation": "<direct 1 sentence>",
    "experience_explanation": "<direct 1 sentence>"
  },
  "fit_summary": "<2-3 direct sentences, no filler>",
  "strengths": ["<specific strength>"],
  "improvements": ["<specific action, not suggestion>"],
  "rejection_reasons": {
    "high": ["<critical reason, specific>"],
    "medium": ["<moderate concern>"],
    "low": ["<minor issue>"]
  },
  "recruiter_simulation": {
    "sector": "<sector>",
    "first_impression": "<what recruiter sees in 7 seconds>",
    "internal_monologue": "<2-3 sentences, honest, direct, no corporate tone>",
    "would_interview": <true|false>,
    "decision": "<shortlist | reject | follow-up | strong yes>",
    "red_flags": ["<specific red flag>"],
    "standout_moments": ["<specific strength>"]
  },
  "blind_spots": [
    { "issue": "<specific issue>", "why_it_hurts": "<direct reason>", "fix": "<exact action>" }
  ],
  "benchmark": {
    "gap_percentage": <0-60>,
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
  const { cvText, jobDescription } = req.body;
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
        temperature: 0.3,
        messages: [
          {
            role: "user",
            content: `You are an expert CV writer. Rewrite the following CV to be fully optimized for the job description below. Keep all real experience and facts — only improve wording, structure, and keyword alignment. Return ONLY the rewritten CV text, no explanations.

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
            content: `You are a senior recruiter. Review this CV against the job description. Be direct. No corporate language. Write like you're talking to a colleague.

FORBIDDEN WORDS: optimize, enhance, leverage, consider, suggest, could, important to note, in order to

STYLE: Short sentences. Max 12 words each. Direct. Real.

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
  "summary": "<1 strong sentence, max 15 words, no filler>",
  "biggestMistake": "<single biggest issue, max 12 words, direct>",
  "topFixes": [
    { "problem": "<specific problem, max 10 words>", "fix": "<exact action, max 12 words>", "impact": "High" | "Medium" },
    { "problem": "<specific problem>", "fix": "<exact action>", "impact": "High" | "Medium" },
    { "problem": "<specific problem>", "fix": "<exact action>", "impact": "High" | "Medium" }
  ],
  "missingSkills": ["<skill>", "<skill>", "<skill>"],
  "recruiterInsight": [
    "<direct recruiter thought, 1 sentence, honest>",
    "<direct recruiter thought>",
    "<direct recruiter thought>"
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
          content: `You are a recruiter reviewing a CV. You have 10 seconds. Say what matters.

RULES:
- Short sentences. Max 8-10 words each.
- No filler words. No AI tone. No corporate language.
- FORBIDDEN: optimize, enhance, leverage, improve, consider, suggest, could, would
- Be direct. Slightly harsh but fair.

EXAMPLES:
❌ "Good experience, but lacks project management skills."
✅ "Experience exists. Wrong skills for this role."

❌ "Highlight specific data analysis tools used."
✅ "List exact tools. SQL, Python, Excel."

❌ "This CV contains generic phrases."
✅ "Feels generic. Anyone could write this."

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

app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const secret = process.env.LEMON_WEBHOOK_SECRET;
  const signature = req.headers["x-signature"];

  const crypto = await import("crypto");
  const hmac = crypto.default.createHmac("sha256", secret);
  const digest = hmac.update(req.body).digest("hex");

  if (digest !== signature) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const payload = JSON.parse(req.body.toString());
  const eventName = payload.meta?.event_name;
  const userEmail = payload.data?.attributes?.user_email;

  if (eventName === "order_created" || eventName === "subscription_created") {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users?.users?.find(u => u.email === userEmail);
    if (user) {
      await supabase.from("user_plans").upsert({ user_id: user.id, plan: "pro" }, { onConflict: "user_id" });
    }
  }

  res.json({ received: true });
});

app.listen(3000, () => {
  console.log("🚀 Backend running on http://localhost:3000");
});
