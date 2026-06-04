import type { LanguageModel } from "./model";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * OpenRouter implementation of the Scorpius language engine.
 * Routes to Gemini 2.5 (and any other model) through one endpoint — used because
 * Google's direct API billing is not available in Uzbekistan.
 */
export class OpenRouterModel implements LanguageModel {
  constructor(
    private apiKey: string,
    private model: string = "google/gemini-2.5-flash",
  ) {}

  async ask(prompt: string): Promise<string> {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "Scorpius",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? "";
  }
}
