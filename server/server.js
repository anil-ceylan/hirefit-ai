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
            



CV:
${cvText}

Job Description:
${jobDescription}
${lang === "TR" ? "IMPORTANT: Return ALL text fields in Turkish language. fit_summary, strengths, improvements, rejection_reasons, recruiter_simulation, blind_spots, interview_prep dahil tüm metin alanlarını Türkçe yaz." : "Return all text fields in English."}
Return ONLY valid JSON. No markdown, no explanation, no extra text.

{
  "alignment_score": <number 40-91, be realistic>,
  "role_type": "<exact job title from JD>",
  "seniority": "<Intern|Junior|Mid|Senior>",
  "confidence_score": <number 60-95>,
  "confidence_level": "<Low|Medium|High>",
  "confidence_basis": "<1 sentence: what made you confident or uncertain>",

  "matched_skills": ["<specific skill from CV that matches JD>"],
  "missing_skills": ["<specific skill in JD not found in CV>"],
  "top_keywords": ["<most important keyword from JD>"],

  "score_breakdown": {
    "skills_match": <number 0-100>,
    "keyword_match": <number 0-100>,
    "experience_depth": <number 0-100>,
    "formatting": <number 0-100>,
    "skills_explanation": "<1 sentence why this score>",
    "experience_explanation": "<1 sentence why this score>"
  },

  "fit_summary": "<2-3 sentences, reference specific CV content>",

  "strengths": ["<specific strength with CV reference>"],
  "improvements": ["<specific actionable improvement>"],

  "rejection_reasons": {
    "high": ["<critical reason — specific, not generic>"],
    "medium": ["<moderate concern>"],
    "low": ["<minor issue>"]
  },

  "recruiter_simulation": {
    "sector": "<sector of the role>",
    "first_impression": "<what recruiter notices in first 7 seconds — specific>",
    "internal_monologue": "<2-3 sentences: what recruiter actually thinks, conversational, honest — reference CV specifics>",
    "would_interview": <true|false>,
    "decision": "<one line: shortlist / reject / follow-up / strong yes>",
    "red_flags": ["<specific red flag from CV>"],
    "standout_moments": ["<specific thing that impressed>"]
  },

  "blind_spots": [
    {
      "issue": "<what candidate thinks is fine but isn't — be specific>",
      "why_it_hurts": "<why recruiters see this negatively>",
      "fix": "<exact rewrite or action — concrete>"
    }
  ],

  "benchmark": {
    "gap_percentage": <number 0-60>,
    "before_after_estimate": <number, predicted score after fixes>,
    "dimensions": [
      {
        "name": "<dimension name>",
        "candidate_level": "<Basic|Some|Good|Strong|Missing>",
        "ideal_level": "<what ideal candidate has>",
        "closeable": <true|false>
      }
    ]
  },

  "interview_prep": [
    {
      "question": "<likely interview question>",
      "why_asked": "<why they ask this for this specific role>",
      "personal_angle": "<specific tip using candidate's actual CV content>"
    }
  ],

  "role_matches": [
    {
      "role": "<role title>",
      "match_score": <number 60-95>,
      "reason": "<1 sentence why CV fits this role>"
    }
  ],

  "salary_insight": {
    "range_min": <number>,
    "range_max": <number>,
    "currency": "<TRY|USD|EUR|GBP>",
    "mid_point": <number>,
    "confidence": "<Low|Medium|High>",
    "context": "<brief market context>"
  },

  "ats_compatibility": [
    {
      "system": "<Workday|Greenhouse|Lever|SAP|Taleo>",
      "status": "<Passes|Review|At Risk>",
      "note": "<specific reason>"
    }
  ],

  "culture_fit": {
    "overall_score": <number 40-95>,
    "dimensions": [
      {
        "name": "<dimension like Innovation|Fast pace|Ambiguity|Collaboration>",
        "score": <number 40-95>,
        "signal": "<what in CV signals this>"
      }
    ]
  },

  "language_analysis": {
    "passive_voice_count": <number>,
    "weak_phrases": ["<exact phrase from CV that is weak>"],
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
    console.log("🧠 RAW AI:", rawText);

    const parsed = extractJSON(rawText);

    if (!parsed) {
      console.log("⚠️ PARSE FAILED");
      return res.json({
        alignment_score: 50,
        confidence_level: "Medium",
        rejection_reasons: { high: ["Parsing failed"], medium: [], low: [] }
      });
    }

    return res.json(parsed);

  } catch (err) {
    console.error("💥 SERVER ERROR:", err);
    return res.status(500).json({
      alignment_score: 0,
      confidence_level: "Low",
      rejection_reasons: { high: ["Server error"], medium: [], low: [] }
    });
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
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users?.users?.find(u => u.email === userEmail);

    if (user) {
      await supabase.from("user_plans").upsert({
        user_id: user.id,
        plan: "pro"
      }, { onConflict: "user_id" });
    }
  }

  res.json({ received: true });
});

app.listen(3000, () => {
  console.log("🚀 Backend running on http://localhost:3000");
});