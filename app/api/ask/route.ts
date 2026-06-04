import { NextResponse } from "next/server";
import { getModel } from "@/lib/ai";

export const dynamic = "force-dynamic";

interface ProfileHints {
  grade?: number;
  interests?: string[];
  subInterests?: Record<string, string>;
  painPoint?: string;
}

/** Inline a one-paragraph hint about the student's profile so the LLM can
 *  ground examples in things this specific student cares about — Batman,
 *  Mercedes, Real Madrid — instead of generic stock examples. */
function profileLine(profile?: ProfileHints | null): string {
  if (!profile) return "";
  const parts: string[] = [];
  if (profile.interests && profile.interests.length > 0) {
    parts.push(`qiziqishlari: ${profile.interests.join(", ")}`);
  }
  if (profile.subInterests) {
    const subs = Object.entries(profile.subInterests)
      .map(([cat, fav]) => `${cat} — ${fav}`)
      .join("; ");
    if (subs) parts.push(`sevimlilari: ${subs}`);
  }
  if (profile.painPoint) parts.push(`o'qishda qiyini: ${profile.painPoint}`);
  if (parts.length === 0) return "";
  return `O'quvchi haqida ma'lumot — ${parts.join(" · ")}. Iloji bo'lsa misol shu yo'nalishda quring.`;
}

/**
 * The live tutor endpoint — a student's free-text question about the current
 * topic, answered by the LLM as Scorpius (Socratic, Uzbek, age-appropriate).
 * Now accepts an optional `profile` so the model can frame examples around
 * the student's captured interests (Batman, Mercedes, Real Madrid, …).
 */
export async function POST(request: Request) {
  try {
    const { question, topic, profile } = (await request.json()) as {
      question?: string;
      topic?: string;
      profile?: ProfileHints | null;
    };
    if (!question || question.trim().length < 2) {
      return NextResponse.json({ error: "empty" }, { status: 400 });
    }

    const grade = profile?.grade ?? 6;
    const lines = [
      `Siz Scorpius — ${grade}-sinf o'quvchisi uchun do'stona, sabrli o'qituvchisiz.`,
      `O'quvchi hozir shu mavzuni o'rganmoqda: ${topic ?? "matematika"}.`,
      "O'quvchining savoliga o'zbek tilida, sodda va qisqa (2-4 jumla) javob bering.",
      "Tayyor uy-vazifa javobini bermang — tushunchani tushuntiring.",
    ];
    const pl = profileLine(profile);
    if (pl) lines.push(pl);
    lines.push("", `Savol: ${question.trim()}`);

    const answer = await getModel().ask(lines.join("\n"));
    return NextResponse.json({ answer: answer.trim() });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
