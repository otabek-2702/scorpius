/**
 * The language engine behind every Scorpius agent.
 * Gemini today, swappable tomorrow — agents depend on this interface, never on a vendor SDK.
 */
export interface LanguageModel {
  /** One prompt in, plain text out. */
  ask(prompt: string): Promise<string>;
}
