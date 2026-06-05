import { NextResponse } from "next/server";
import { getModel } from "@/lib/ai";
import { PERSONAS, isPersonaId } from "@/lib/personas";
import { SIM_CATALOG, SIM_CATALOG_KEYS } from "@/lib/sims/catalog";

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
    const { question, topic, profile, personaId } = (await request.json()) as {
      question?: string;
      topic?: string;
      profile?: ProfileHints | null;
      /** Optional persona voice (Newton, Al-Xorazmiy, …). Falls back to Scorpius. */
      personaId?: string;
    };
    if (!question || question.trim().length < 2) {
      return NextResponse.json({ error: "empty" }, { status: 400 });
    }

    const grade = profile?.grade ?? 6;
    // When a persona is chosen (e.g. inside a Lab), answer in that persona's
    // voice; otherwise stay the neutral Scorpius tutor (the lesson AskCard path).
    const persona = personaId && isPersonaId(personaId) ? PERSONAS[personaId] : null;
    const lines = persona
      ? [
          `Siz ${persona.displayName} — Scorpius laboratoriyasidagi AI o'qituvchisiz.`,
          persona.systemPrompt,
          `O'quvchi (${grade}-sinf) hozir shu virtual laboratoriyada jonli tajriba qilmoqda: ${topic ?? "fan laboratoriyasi"}. U animatsiya/simulyatsiya bilan ishlayapti.`,
          "Savolga o'zbek tilida, qisqa (2-4 jumla), qiziqarli javob bering. Tushunchani tushuntiring; tayyor uy-vazifa javobini bermang.",
        ]
      : [
          `Siz Scorpius — ${grade}-sinf o'quvchisi uchun do'stona, sabrli o'qituvchisiz.`,
          `O'quvchi hozir shu mavzuni o'rganmoqda: ${topic ?? "matematika"}.`,
          "O'quvchining savoliga o'zbek tilida, sodda va qisqa (2-4 jumla) javob bering.",
          "Tayyor uy-vazifa javobini bermang — tushunchani tushuntiring.",
        ];
    // In a Lab, let the mentor SHOW a relevant animation by picking one key from
    // a fixed catalog (so it can never invent a sim that doesn't exist).
    if (persona) {
      lines.push(
        "",
        "Agar quyidagi jonli animatsiyalardan BIRI savolni koʻrsatib bera olsa, javobing OXIRIDA alohida qatorda `SIM: <kalit>` deb yoz (faqat bitta kalit, faqat roʻyxatdan). Mos animatsiya boʻlmasa `SIM: none` yoz.",
        ...SIM_CATALOG.map((c) => `- ${c.key}: ${c.summaryUz}`)
      );
    }

    const pl = profileLine(profile);
    if (pl) lines.push(pl);
    lines.push("", `Savol: ${question.trim()}`);

    const raw = (await getModel().ask(lines.join("\n"))).trim();

    // Pull out the optional inline-animation suggestion (a `SIM: <key>` line),
    // validate it against the catalog, and strip it from the visible answer.
    let simKey: string | null = null;
    let answer = raw;
    const match = raw.match(/^\s*SIM:\s*([a-z0-9-]+)\s*$/im);
    if (match) {
      const key = match[1].toLowerCase();
      if (key !== "none" && SIM_CATALOG_KEYS.includes(key)) simKey = key;
      answer = raw.replace(/^\s*SIM:\s*[a-z0-9-]+\s*$/im, "").trim();
    }
    return NextResponse.json({ answer, personaId: persona?.id ?? null, simKey });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
