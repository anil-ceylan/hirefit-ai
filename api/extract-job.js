import {
  EXTRACT_JOB_SYSTEM,
  buildExtractJobUserMessage,
  normalizeVerbatimExtract,
  parseTitleFromVerbatimExtract,
  stripHtmlToJobVisibleText,
} from "../lib/extractJobCompose.js";
import { callClaudeHaiku } from "../lib/analyze-v2/openaiClient.js";
import { getUserFromRequest } from "../lib/auth/verifySupabaseJwt.js";

/** Claude output budget — long postings must not be truncated mid-generation */
const EXTRACT_MAX_TOKENS = 8192;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await getUserFromRequest(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

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
          max_tokens: EXTRACT_MAX_TOKENS,
          messages: [
            { role: "system", content: EXTRACT_JOB_SYSTEM },
            {
              role: "user",
              content: buildExtractJobUserMessage(visible),
            },
          ],
        });
        const normalized = normalizeVerbatimExtract(raw);
        if (normalized.length > 80) {
          jobText = normalized;
          const fromRole = parseTitleFromVerbatimExtract(jobText);
          if (fromRole) title = fromRole;
        }
      } catch {
        // AI cleanup is best-effort; return usable fallback.
      }
    }

    return res.status(200).json({ title, jobText });
  } catch {
    return res.status(500).json({
      error: "An error occurred. Please try again.",
    });
  }
}
