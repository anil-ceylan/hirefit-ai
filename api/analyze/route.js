import { callAI, safeJSON } from "@/lib/ai";
import {
  MASTER_SYSTEM,
  ATS_PROMPT,
  RECRUITER_PROMPT,
  FIX_PROMPT,
} from "@/lib/prompts";
import { calculateDecision } from "@/lib/decision";

export async function POST(req) {
  try {
    const { cv, jd } = await req.json();

    if (!cv || !jd) {
      return new Response(JSON.stringify({ error: "Missing CV or JD" }), {
        status: 400,
      });
    }

    // Paralel çağrılar (hız için)
    const [atsRaw, recruiterRaw, fixRaw] = await Promise.all([
      callAI({
        model: "openai/gpt-4o-mini",
        system: MASTER_SYSTEM,
        user: ATS_PROMPT(cv, jd),
      }),
      callAI({
        model: "anthropic/claude-3-haiku",
        system: MASTER_SYSTEM,
        user: RECRUITER_PROMPT(cv, jd),
      }),
      callAI({
        model: "openai/gpt-4o-mini",
        system: MASTER_SYSTEM,
        user: FIX_PROMPT(cv, jd),
      }),
    ]);

    const ats = safeJSON(atsRaw) || {};
    const recruiter = safeJSON(recruiterRaw) || {};
    const fix = safeJSON(fixRaw) || {};

    const decision = calculateDecision(ats, recruiter);

    const response = {
      decision,
      confidence: recruiter?.confidence ?? 60,
      score: ats?.score ?? 50,
      biggest_mistake: recruiter?.biggest_mistake ?? "Unclear impact",
      reason: recruiter?.reason ?? "",
      insight: recruiter?.insight ?? "",
      top_fixes: fix?.top_fixes ?? [],
      quick_action: fix?.quick_action ?? "",
    };

    return new Response(JSON.stringify(response), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
    });
  }
}