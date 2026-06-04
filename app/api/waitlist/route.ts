import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

/**
 * POST /api/waitlist
 * Body: { phone: string, grade?: number, role: 'student'|'parent', name?: string,
 *         referrer?: string }
 * Returns: { ok: true, count: number }
 *
 * Stores at `waitlist/{sanitizedPhone}` so the same phone can't inflate the count.
 * Resubmits update the existing doc (last grade/role/name win).
 *
 * GET /api/waitlist returns { count: number } — used by the live counter so judges
 * watch the number tick up in real time during the pitch.
 */

interface Body {
  phone?: string;
  grade?: number;
  role?: "student" | "parent";
  name?: string;
  referrer?: string;
}

function sanitizePhone(input: string): string {
  // Keep digits only; keep leading + if present.
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const phone = sanitizePhone(body.phone ?? "");
  if (phone.replace(/\D/g, "").length < 7) {
    return NextResponse.json({ error: "phone too short" }, { status: 400 });
  }
  const role = body.role === "parent" ? "parent" : "student";
  const grade =
    typeof body.grade === "number" && body.grade >= 1 && body.grade <= 11
      ? body.grade
      : null;
  const name = (body.name ?? "").trim().slice(0, 80) || null;
  const referrer = (body.referrer ?? "gdg").trim().slice(0, 40);

  const docId = phone.replace(/[^\d+]/g, "");
  const ref = adminDb.doc(`waitlist/${docId}`);

  try {
    await ref.set(
      {
        phone,
        role,
        grade,
        name,
        referrer,
        createdAt: new Date().toISOString(),
        ua: req.headers.get("user-agent")?.slice(0, 200) ?? null,
      },
      { merge: true }
    );

    const snap = await adminDb.collection("waitlist").count().get();
    const count = snap.data().count ?? 0;
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "save failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const snap = await adminDb.collection("waitlist").count().get();
    const count = snap.data().count ?? 0;
    return NextResponse.json({ count });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "count failed", count: 0 },
      { status: 500 }
    );
  }
}
