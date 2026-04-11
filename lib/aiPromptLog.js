/* eslint-env node */
/** Diagnostic: log exact chat messages sent to Groq/OpenAI-style APIs (and Claude-shaped arrays). */
export function logPromptBeingSent(messages) {
  console.log("=== PROMPT BEING SENT ===", JSON.stringify(messages, null, 2));
}
