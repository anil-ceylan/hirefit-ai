import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

console.log("OPENROUTER:", process.env.OPENROUTER_API_KEY);

const app = express();
app.use(cors());
app.use(express.json());

app.post("/analyze", async (req, res) => {
  const { cvText, jobDescription } = req.body;

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
        messages: [
          {
            role: "user",
            content: `
Analyze CV vs Job Description.

CV: ${cvText}

Job: ${jobDescription}

Return ONLY valid JSON. No explanation.

Format:
{
  "hireProbability": number,
  "confidence": "Low" | "Medium" | "High",
  "rejectionReasons": {
    "high": string[],
    "medium": string[],
    "low": string[]
  }
}
`
          }
        ]
      })
    });

    const data = await response.json();

    const text = data.choices?.[0]?.message?.content;

    console.log("RAW AI:", text);

    // 🔥 JSON PARSE (CRITICAL)
    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.log("PARSE ERROR:", e);

      return res.json({
        hireProbability: 50,
        confidence: "Medium",
        rejectionReasons: {
          high: ["AI response parsing failed"],
          medium: [],
          low: []
        }
      });
    }

    // ✅ SUCCESS RESPONSE
    return res.json(parsed);

  } catch (err) {
    console.error("SERVER ERROR:", err);

    return res.status(500).json({
      hireProbability: 0,
      confidence: "Low",
      rejectionReasons: {
        high: ["Server error"],
        medium: [],
        low: []
      }
    });
  }
});

app.listen(3000, () => {
  console.log("🚀 Backend running on http://localhost:3000");
});