import { GoogleGenAI } from "@google/genai";
import type { LanguageModel } from "./model";

/** Gemini 2.5 implementation of the Scorpius language engine. */
export class GeminiModel implements LanguageModel {
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async ask(prompt: string): Promise<string> {
    const res = await this.client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return res.text ?? "";
  }
}
