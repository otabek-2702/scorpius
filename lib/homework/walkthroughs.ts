import type { Lesson } from "@/lib/lesson";
import { ekubWalkthrough } from "./walkthroughs/ekub";
import { kasrAmallariWalkthrough } from "./walkthroughs/kasr-amallari";
import { boluvchilarTekshirWalkthrough } from "./walkthroughs/boluvchilar-tekshir";
import { arximedKuchiSavolWalkthrough } from "./walkthroughs/arximed-kuchi-savol";

/** All cached Socratic walkthroughs the /homework surface can offer. Keyed by
 *  human-readable slug so the /api/homework/extract endpoint can return the
 *  match id verbatim. Add to this map as the catalog grows. */
export const HOMEWORK_WALKTHROUGHS: Record<string, Lesson> = {
  ekub: ekubWalkthrough,
  "kasr-amallari": kasrAmallariWalkthrough,
  "boluvchilar-tekshir": boluvchilarTekshirWalkthrough,
  "arximed-kuchi-savol": arximedKuchiSavolWalkthrough,
};

/** Short, human-curated keyword lists per walkthrough — used by the matcher
 *  to map a vision-extracted topic to a walkthrough id. Order matters; the
 *  first hit wins. Keep keywords short and high-signal. */
const KEYWORDS: Record<string, string[]> = {
  ekub: ["ekub", "eng katta umumiy bo'luvchi", "gcd"],
  "kasr-amallari": [
    "kasr",
    "kasrlarni qo'shish",
    "kasrlarni ayirish",
    "kasr amallari",
    "fraction",
  ],
  "boluvchilar-tekshir": [
    "bo'luvchi",
    "bo'linish belgilari",
    "bo'linish",
    "divisor",
    "divisibility",
  ],
  "arximed-kuchi-savol": [
    "arximed",
    "ko'tarish kuchi",
    "suzish",
    "cho'kish",
    "buoyancy",
    "zichlik",
  ],
};

/** Returns the walkthrough id whose keywords best match the extracted topic,
 *  or null if no walkthrough is a reasonable match. Case-insensitive
 *  substring match — simple and predictable; can be replaced with embeddings
 *  later without breaking the call sites. */
export function findWalkthroughForTopic(topicUz: string | null | undefined): string | null {
  if (!topicUz) return null;
  const topic = topicUz.toLowerCase().trim();
  if (topic.length === 0) return null;
  for (const [id, keywords] of Object.entries(KEYWORDS)) {
    for (const keyword of keywords) {
      if (topic.includes(keyword)) return id;
    }
  }
  return null;
}

/** Convenience accessor for the UI: render a small picker grid. */
export function listWalkthroughs(): { id: string; lesson: Lesson }[] {
  return Object.entries(HOMEWORK_WALKTHROUGHS).map(([id, lesson]) => ({ id, lesson }));
}
