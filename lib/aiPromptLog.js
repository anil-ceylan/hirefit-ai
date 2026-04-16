/* eslint-env node */
/** Diagnostic: log only high-level metadata about prompts, never raw CV/JD text content. */
export function logPromptBeingSent(messages, extra = {}) {
  try {
    const safeMessages = Array.isArray(messages) ? messages : [];
    const totalChars = safeMessages.reduce((sum, m) => {
      const content = typeof m?.content === "string" ? m.content : "";
      return sum + content.length;
    }, 0);

    const roles = Array.from(
      new Set(
        safeMessages
          .map((m) => (typeof m?.role === "string" ? m.role : "unknown"))
          .filter(Boolean)
      )
    );

    const meta = {
      type: "PROMPT_METADATA",
      messageCount: safeMessages.length,
      totalChars,
      roles,
      model: extra.model || null,
      estimatedTokens: extra.estimatedTokens || null,
      timestamp: new Date().toISOString(),
    };

    console.log(JSON.stringify(meta));
  } catch {
    // Swallow logging errors; never break main request flow.
  }
}

