import { OpenAIModel } from "./openai";
import { OpenRouterModel } from "./openrouter";
import { GeminiModel } from "./gemini";
import type { LanguageModel } from "./model";

let cached: LanguageModel | null = null;

/**
 * The configured language model. Prefers OpenAI, then OpenRouter, then the direct
 * Gemini API — whichever key is present in the environment. Created lazily so a
 * missing key fails at call time with a clear message, not on import.
 */
export function getModel(): LanguageModel {
  if (!cached) {
    if (process.env.OPENAI_API_KEY) {
      cached = new OpenAIModel(process.env.OPENAI_API_KEY);
    } else if (process.env.OPENROUTER_API_KEY) {
      cached = new OpenRouterModel(process.env.OPENROUTER_API_KEY);
    } else if (process.env.GEMINI_API_KEY) {
      cached = new GeminiModel(process.env.GEMINI_API_KEY);
    } else {
      throw new Error("No LLM key — set OPENAI_API_KEY in .env.local");
    }
  }
  return cached;
}
