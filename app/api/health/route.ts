import { NextResponse } from "next/server";
import { getModel } from "@/lib/ai";

// Always run live — never cache a health check.
export const dynamic = "force-dynamic";

/** Health check — proves the Gemini adapter is wired and reachable. */
export async function GET() {
  try {
    const reply = await getModel().ask("Reply with exactly the word: OK");
    return NextResponse.json({ ok: true, gemini: reply.trim() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
