import type { LanguageModel } from "./model";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

/**
 * OpenAI implementation of the Scorpius language engine.
 * Default is a fast, budget mini; pass a stronger non-reasoning model for harder tasks.
 */
export class OpenAIModel implements LanguageModel {
  constructor(
    private apiKey: string,
    private model: string = "gpt-5-mini",
  ) {}

  async ask(prompt: string): Promise<string> {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? "";
  }
}
