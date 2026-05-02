import "./loadEnv.js";
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import rateLimit from "express-rate-limit";
import { runAnalyzeV2WithCompanyIntel } from "../lib/analyze-v2/withCompanyIntel.js";
import { requireAuthExpress } from "../lib/auth/verifySupabaseJwt.js";
import {
  EXTRACT_JOB_SYSTEM,
  buildExtractJobUserMessage,
  normalizeVerbatimExtract,
  parseTitleFromVerbatimExtract,
  stripHtmlToJobVisibleText,
} from "../lib/extractJobCompose.js";
import {
  enforcePromptLanguageRules,
  normalizeAnalyzeLang,
  requiredResponseLanguageDirective,
} from "../lib/analyze-v2/lang.js";
import { callClaudeHaiku } from "../lib/analyze-v2/openaiClient.js";

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err.message, err.stack);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
  process.exit(1);
});

/** Groq output budget — must be ≥2000 so long postings are not cut off mid-generation */
const EXTRACT_JOB_MAX_TOKENS = 8192;

const app = express();
app.set("trust proxy", 1);
const ALLOWED_ORIGIN = "https://hirefit-ai.vercel.app";

// CORS MUST be first global middleware (before all routes)
app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 204,
  })
);

// Manual fallback headers to guarantee CORS behavior
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

const jsonParser = express.json();
app.use((req, res, next) => {
  // Webhook must keep raw bytes for HMAC validation.
  if (req.path === "/api/webhook" || req.path === "/webhook") return next();
  return jsonParser(req, res, next);
});

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY missing!");
}

function responseLanguageLabel(langNorm) {
  return langNorm === "tr" ? "Turkish" : "English";
}

function constrainedMessages(messages, lang) {
  return enforcePromptLanguageRules(messages, normalizeAnalyzeLang(lang));
}

const analysisRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
  validate: false,
  skip: (req) => req.path === "/health",
});

/** Railway (and similar) set PORT; health checks often need a simple 200. */
app.get("/health", (_req, res) => {
  res.status(200).type("text/plain").send("ok");
});

app.get("/test", (_req, res) => {
  return res.status(200).json({ status: "ok" });
});

app.post("/api/analyze-v2", requireAuthExpress, analysisRateLimiter, async (req, res) => {
  try {
    const { cvText, jobDescription, cv, jd, isPro, sector, careerArea, lang } = req.body || {};
    const c = String(cvText ?? cv ?? "").trim();
    const j = String(jobDescription ?? jd ?? "").trim();
    if (!c || !j) {
      return res
        .status(400)
        .json({ error: "Missing cvText or jobDescription" });
    }
    const payload = await runAnalyzeV2WithCompanyIntel({
      cvText: c,
      jobDescription: j,
      isPro: Boolean(isPro),
      sector,
      careerArea,
      lang,
    });
    return res.status(200).json(payload);
  } catch (e) {
    console.error("[/api/analyze-v2]", e?.message || e);
    return res.status(500).json({
      error: "analysis_failed",
    });
  }
});

app.post("/api/extract-job", requireAuthExpress, async (req, res) => {
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
    const visible = stripHtmlToJobVisibleText(html).slice(0, 50000);
    const fallbackTitle = getTitleFromHtml(html);

    let title = fallbackTitle;
    let jobText = visible;

    if (process.env.ANTHROPIC_API_KEY && visible.length > 120) {
      try {
        const raw = await callClaudeHaiku({
          langNorm: "en",
          max_tokens: EXTRACT_JOB_MAX_TOKENS,
          messages: constrainedMessages(
            [
              { role: "system", content: EXTRACT_JOB_SYSTEM },
              {
                role: "user",
                content: buildExtractJobUserMessage(visible),
              },
            ],
            "en"
          ),
        });
        const normalized = normalizeVerbatimExtract(raw);
        if (normalized.length > 80) {
          jobText = normalized;
          const fromRole = parseTitleFromVerbatimExtract(jobText);
          if (fromRole) title = fromRole;
        }
      } catch {
        // best-effort AI cleaning; fallback remains usable
      }
    }

    return res.status(200).json({ title, jobText });
  } catch (error) {
    console.error("[/api/extract-job]", error?.message || error);
    return res.status(500).json({
      error: "extract_failed",
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

app.post("/optimize", requireAuthExpress, analysisRateLimiter, async (req, res) => {
  const { cvText, jobDescription, lang } = req.body;
  if (!cvText || !jobDescription) return res.status(400).json({ error: "Missing CV or JD" });

  try {
    const langNorm = normalizeAnalyzeLang(lang);
    const languageDirective = requiredResponseLanguageDirective(langNorm);
    const optimizedCv =
      (await callClaudeHaiku({
        langNorm,
        max_tokens: 800,
        messages: constrainedMessages(
          [
            {
              role: "system",
              content: languageDirective,
            },
            {
              role: "user",
              content: `You are a senior recruiter-turned-CV writer doing a "Fix My CV" pass for one specific job.

TASK — rewrite the ENTIRE CV for this job description:
1) Every bullet: strong action verb + outcome + metric (use plausible estimates like "~20%", "~15k users", "~$XM" only where reasonable from context; if unknown, still quantify scope: "across 3 teams", "weekly reports for leadership").
2) Remove generic filler ("responsible for", "worked on", "helped with", "team player", "detail-oriented") — replace with concrete achievements tied to the JD keywords.
3) Mirror critical language from the job description naturally (skills, tools, domains) without lying.
4) Keep structure readable (headers, bullets). Preserve truthful employment/education facts — improve phrasing and emphasis only.
5) Return ONLY the rewritten CV body text. No preamble, no markdown fences.

${langNorm === "tr" ? "Write the CV in Turkish." : "Write the CV in English."}
Respond entirely in ${responseLanguageLabel(langNorm)}.

CV:
${cvText}

Job Description:
${jobDescription}`,
            },
          ],
          langNorm
        ),
      })) || "";
    return res.json({ optimizedCv });

  } catch (err) {
    console.error("💥 OPTIMIZE ERROR:", err);
    return res.status(500).json({
      error: "optimization_failed",
      message: "CV optimization did not complete. Check your connection and try again.",
      recovery: ["Retry Fix My CV", "Confirm CV and JD are both filled in"],
    });
  }
});

app.post("/api/optimize", requireAuthExpress, analysisRateLimiter, (_req, res) => {
  return res.redirect(307, "/optimize");
});

app.post("/roadmap", requireAuthExpress, async (req, res) => {
  const { missingSkills, roleType, seniority, lang } = req.body;
  if (!missingSkills?.length) return res.status(400).json({ error: "No missing skills provided" });

  try {
    const langNorm = normalizeAnalyzeLang(lang);
    const languageDirective = requiredResponseLanguageDirective(langNorm);
    const roadmap =
      (await callClaudeHaiku({
        langNorm,
        max_tokens: 800,
        messages: constrainedMessages(
          [
            {
              role: "system",
              content: languageDirective,
            },
            {
              role: "user",
              content: `Create a concise 30-day learning roadmap for someone targeting a ${seniority || "Junior"} ${roleType || "role"} who is missing these skills: ${missingSkills.join(", ")}.

For each skill provide: week number, specific resource (course/book/project), and estimated hours. Be practical and specific. Return as plain text, no JSON.
Respond entirely in ${responseLanguageLabel(langNorm)}.`,
            },
          ],
          langNorm
        ),
      })) || "";
    return res.json({ roadmap });

  } catch (err) {
    console.error("💥 ROADMAP ERROR:", err);
    return res.status(500).json({ error: "Roadmap generation failed" });
  }
});

app.post("/apply-fix", requireAuthExpress, async (req, res) => {
  const {
    cvText,
    problem,
    fix,
    lang,
    weak_bullet,
    career_area,
    careerArea,
    job_description,
    jobDescription,
    sector,
  } = req.body || {};
  const weakBullet = String(weak_bullet || problem || "").trim();
  const careerAreaValue = String(career_area || careerArea || sector || "İş / Operasyon").trim();
  const jobDescriptionValue = String(job_description || jobDescription || "").trim();
  if (!weakBullet) return res.status(400).json({ error: "Missing weak bullet data" });

  try {
    const langNorm = normalizeAnalyzeLang(lang);
    const languageDirective = requiredResponseLanguageDirective(langNorm);
    const content = await callClaudeHaiku({
      langNorm,
      max_tokens: 420,
      messages: constrainedMessages(
        [
          {
            role: "system",
            content: languageDirective,
          },
          {
            role: "user",
            content: `Görevin:

Adayın CV’sindeki zayıf noktayı al ve bunu güçlü, ölçülebilir ve profesyonel bir şekilde yeniden yaz.

Kurallar:
- Sadece TEK çıktıyı düzelt
- İnsan gibi yaz, yapay dil kullanma
- Genel konuşma yok
- Ölçülebilir etki ekle (mümkünse)
- Güçlü fiiller kullan (artırdı, geliştirdi, optimize etti gibi)
- Kopyalanabilir olsun

Girdi:

Zayıf ifade:
${weakBullet}

Alan:
${careerAreaValue}

İş ilanı:
${jobDescriptionValue || "N/A"}

Ek bağlam (yalnızca gerektiğinde):
${cvText ? cvText.slice(0, 2000) : ""}
${fix ? `\nÖnerilen düzeltme yönü: ${fix}` : ""}

Çıktı formatı:

Eski:
${weakBullet}

Yeni:
[tek cümle, güçlü ve ölçülebilir]

${langNorm === "tr" ? "Türkçe yaz." : "Write in English."}

Return ONLY valid JSON:
{
  "old": "${weakBullet.replace(/"/g, '\\"')}",
  "new": "<single strong measurable sentence>"
}`,
          },
        ],
        langNorm
      ),
    });
    const parsed = extractJSON(content);
    if (!parsed || !parsed.new) {
      return res.json({ error: "Could not parse response" });
    }
    const oldText = String(parsed.old || weakBullet).trim() || weakBullet;
    const newText = String(parsed.new || "").trim();
    return res.json({
      old: oldText,
      new: newText,
      original_section: oldText,
      rewritten_section: newText,
      explanation:
        langNorm === "tr"
          ? "Zayıf ifade ölçülebilir ve güçlü bir cümleye dönüştürüldü."
          : "The weak bullet was rewritten into a stronger measurable line.",
    });
  } catch (err) {
    console.error("💥 APPLY-FIX ERROR:", err);
    res.status(500).json({ error: "Apply fix failed" });
  }
});

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const isAdminEmail = (email) => {
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  return Boolean(adminEmail) && normalizeEmail(email) === adminEmail;
};

app.post("/api/admin/pro-access", async (req, res) => {
  try {
    const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
    if (!adminEmail) {
      return res.status(500).json({ error: "ADMIN_EMAIL is not configured" });
    }

    const authHeader = String(req.get("authorization") || req.headers.authorization || "");
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const accessToken = tokenMatch?.[1]?.trim();
    if (!accessToken) {
      return res.status(401).json({ error: "Missing bearer token" });
    }

    const targetEmail = normalizeEmail(req.body?.targetEmail);
    const grantPro = Boolean(req.body?.grantPro);
    if (!targetEmail) {
      return res.status(400).json({ error: "targetEmail is required" });
    }

    if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Supabase environment variables are missing" });
    }

    const { createClient } = await import("@supabase/supabase-js");
    const authClient = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
    const {
      data: { user: requester },
      error: requesterError,
    } = await authClient.auth.getUser(accessToken);
    if (requesterError || !requester) {
      return res.status(401).json({ error: "Invalid session token" });
    }
    if (!isAdminEmail(requester.email)) {
      return res.status(403).json({ error: "Only admin can update user access" });
    }

    const adminClient = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: usersPage, error: usersError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) {
      return res.status(500).json({ error: "Failed to load users" });
    }
    const targetUser = usersPage?.users?.find((u) => normalizeEmail(u.email) === targetEmail);
    if (!targetUser) {
      return res.status(404).json({ error: "Target user not found" });
    }

    const plan = grantPro ? "pro" : "free";
    const { error: upsertError } = await adminClient
      .from("user_plans")
      .upsert({ user_id: targetUser.id, plan }, { onConflict: "user_id" });
    if (upsertError) {
      return res.status(500).json({
        error: "An error occurred. Please try again.",
      });
    }

    return res.json({
      ok: true,
      targetEmail,
      plan,
      adminGranted: grantPro,
    });
  } catch {
    return res.status(500).json({
      error: "An error occurred. Please try again.",
    });
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
  } catch {
    /* webhook body parse — invalid JSON yields null payload handled below */
  }
  const eventName = payload?.meta?.event_name || req.headers["x-event-name"] || "unknown";

  const crypto = await import("crypto");
  const bodyString = rawBody.toString("utf8");
  const computedSignature = crypto.default
    .createHmac("sha256", secret)
    .update(bodyString, "utf8")
    .digest("hex")
    .toLowerCase();

  if (computedSignature !== signature) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const userEmail = payload?.data?.attributes?.user_email;

  const proEvents = new Set(["order_created", "subscription_created", "subscription_payment_success"]);
  const freeEvents = new Set(["subscription_cancelled", "subscription_expired"]);
  const targetPlan = proEvents.has(eventName) ? "pro" : freeEvents.has(eventName) ? "free" : null;

  if (!targetPlan) {
    return res.json({ received: true, event: eventName, action: "ignored" });
  }

  if (!userEmail) {
    console.error("[lemon-webhook] Missing user_email for event:", eventName);
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
        return res.status(500).json({
          error: "An error occurred. Please try again.",
        });
      }
      return res.json({ received: true, event: eventName, action: "updated", plan: targetPlan });
    }
    console.error("[lemon-webhook] Supabase user not found for:", userEmail);
    return res.json({ received: true, event: eventName, action: "user_not_found" });
  } catch (e) {
    console.error("[lemon-webhook] Unexpected processing error:", e?.message || e);
    return res.status(500).json({
      error: "An error occurred. Please try again.",
    });
  }
};

app.post("/api/webhook", express.raw({ type: "application/json" }), lemonWebhookHandler);
app.post("/webhook", express.raw({ type: "application/json" }), lemonWebhookHandler);

const PORT = 3000;

try {
  const server = app.listen(PORT, "0.0.0.0", () => {
    process.stdout.write(`[server] Listening on 0.0.0.0:${PORT} (health: /health)\n`);
  });
  server.on("error", (err) => {
    console.error("SERVER LISTEN ERROR:", err.message, err.stack);
    process.exit(1);
  });
} catch (err) {
  console.error("LISTEN ERROR:", err.message);
  process.exit(1);
}
