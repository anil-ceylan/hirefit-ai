export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
    const key = process.env.GROQ_API_KEY;

    if (key && visible.length > 120) {
      try {
        const aiRes = await fetchWithTimeout(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              max_tokens: 800,
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
        const parsed = (() => {
          try {
            return JSON.parse(raw);
          } catch {
            const match = String(raw).match(/\{[\s\S]*\}/);
            if (!match) return null;
            try {
              return JSON.parse(match[0]);
            } catch {
              return null;
            }
          }
        })();

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
        // AI cleanup is best-effort; return usable fallback.
      }
    }

    return res.status(200).json({ title, jobText });
  } catch (error) {
    return res.status(500).json({
      error: "Server error while extracting job page",
      details: error.message,
    });
  }
}