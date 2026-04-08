/* eslint-env node */
import { openaiChat } from "./openaiClient.js";

const DEFAULT_MAX_TOKENS = 1000;

/**
 * Routes to Groq (OpenAI-compatible) with the same models as openaiClient.
 * Callers may pass a legacy `model` argument; it is ignored in favor of Groq Llama IDs.
 */
export async function anthropicChat({
  messages,
  temperature = 0.2,
  responseFormat,
  max_tokens = DEFAULT_MAX_TOKENS,
}) {
  return openaiChat({
    messages,
    temperature,
    responseFormat,
    max_tokens,
  });
}
