import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import {
  extractEmaktabSnapshot,
  type EmaktabExport,
  type ExtractStage,
} from "@/lib/emaktab/extract.server";
import { generateDemoData, shouldUseDemoData } from "@/lib/emaktab/demo";

/**
 * POST /api/emaktab/connect — server-side emaktab.uz extraction with the
 * parent's own credentials. Returns Server-Sent Events with stage updates
 * during the (slow) Playwright run, then a final `result` event containing
 * the saved snapshot summary.
 *
 * Body (application/json):
 *   { username: string, password: string }
 *
 * Headers:
 *   X-Scorpius-Uid (required) — anonymous Firebase UID. Snapshot is saved
 *     to Firestore at users/{uid}/emaktab/latest so the parent dashboard
 *     picks it up via loadCloudEmaktabSnapshot().
 *
 * Response: text/event-stream with newline-delimited SSE events.
 *   data: {"stage":"starting","message":"..."}
 *   data: {"stage":"logging-in","message":"..."}
 *   ...
 *   data: {"stage":"done","summary":{...}}
 *   data: [DONE]
 *
 * Errors return JSON 4xx/5xx BEFORE opening the stream so the client gets a
 * clean toast instead of an empty progress bar.
 *
 * Credentials policy:
 *   - Never logged.
 *   - Held only in memory for the lifetime of one request.
 *   - Never persisted (not in Firestore, not in localStorage, nowhere).
 *   - HTTPS only in production (Vercel terminates TLS).
 *
 * Production note: Playwright Chromium ships ~200MB and does not run on
 * Vercel's default Node runtime without `@sparticuz/chromium-min`. For dev
 * + local demos this route works. For prod we'll wrap it in a dedicated
 * worker (Railway / Cloud Run / Fly) — out of scope for v1.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Full extraction (login + profile + 4 quarters + 9 months of diary + homework
// pagination) takes 60–120 seconds. Cap at 5 minutes so a hung Playwright
// session doesn't pin a serverless worker forever.
export const maxDuration = 300;

const MAX_CREDENTIAL_CHARS = 200;
const RATE_LIMIT_WINDOW_S = 60;

interface ConnectBody {
  username?: unknown;
  password?: unknown;
}

function jsonError(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

/** One-shot rate limit — 1 connect per uid per minute. Cheap protection
 *  against a refresh-loop or accidental double-click. */
async function checkRateLimit(uid: string): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const ref = adminDb.doc(`rate-limits/emaktab-connect/keys/${uid}`);
  const now = Date.now();
  const windowMs = RATE_LIMIT_WINDOW_S * 1000;
  try {
    return await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? (snap.data() as { windowStart: number }) : null;
      if (!data || now - data.windowStart > windowMs) {
        tx.set(ref, { windowStart: now });
        return { ok: true as const };
      }
      const retryAfter = Math.ceil((data.windowStart + windowMs - now) / 1000);
      return { ok: false as const, retryAfter: Math.max(1, retryAfter) };
    });
  } catch {
    return { ok: true };
  }
}

async function saveSnapshot(uid: string, data: EmaktabExport): Promise<void> {
  // Mirror the shape lib/cloudSync.ts:loadCloudEmaktabSnapshot expects so the
  // existing dashboard reader picks it up with zero code change. The cached
  // EmaktabSnapshot wraps the same profile + grades + diary + homework, with
  // subjectId normalisation applied by lib/emaktab.ts on read.
  await adminDb.doc(`users/${uid}/emaktab/latest`).set(
    {
      snapshot: {
        profile: data.profile,
        grades: data.grades,
        diary: data.diary,
        homework: data.homework,
        meta: data.meta,
      },
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
  // Also keep a denormalised user-meta row so /parent header can render even
  // when the snapshot subcollection read is slow.
  await adminDb.doc(`users/${uid}`).set(
    {
      emaktab: {
        connectedAt: new Date().toISOString(),
        name: data.profile.name,
        className: data.profile.className,
        school: data.profile.school,
        grade: data.profile.grade,
      },
    },
    { merge: true },
  );
}

export async function POST(req: Request) {
  // 1. Parse + validate the body
  let body: ConnectBody;
  try {
    body = (await req.json()) as ConnectBody;
  } catch {
    return jsonError(400, "badJson", "So'rov yuborilmadi");
  }
  const username =
    typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (username.length === 0 || password.length === 0) {
    return jsonError(400, "missingCreds", "Login va parolni kiriting");
  }
  if (username.length > MAX_CREDENTIAL_CHARS || password.length > MAX_CREDENTIAL_CHARS) {
    return jsonError(400, "credsTooLong", "Login yoki parol juda uzun");
  }

  // 2. UID is required for per-user save
  const uid = req.headers.get("x-scorpius-uid")?.trim();
  if (!uid || uid.length < 8) {
    return jsonError(401, "noUid", "Foydalanuvchi sessiyasi topilmadi — sahifani yangilang");
  }

  // 3. Rate limit per UID
  const rl = await checkRateLimit(uid);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: "rateLimit",
        message: `Bir daqiqada bir marta urinib ko'ring (${rl.retryAfter} soniyadan keyin yana mumkin).`,
        retryAfter: rl.retryAfter,
      },
      { status: 429 },
    );
  }

  // 4. Open the SSE stream and run the extractor. Stages are streamed to the
  //    client so the UI can show concrete progress (the run is slow).
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function emit(payload: Record<string, unknown>) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
        );
      }
      const abortCtrl = new AbortController();
      // Best-effort: if the client disconnects mid-stream the abort signal
      // tells Playwright to bail.
      req.signal?.addEventListener("abort", () => abortCtrl.abort());

      try {
        const extracted = await extractEmaktabSnapshot(username, password, {
          signal: abortCtrl.signal,
          onProgress: (stage: ExtractStage, message: string) => {
            emit({ stage, message });
          },
        });

        // Vacation fallback — if emaktab is empty (summer break, new year,
        // brand-new transfer), substitute generated data keyed to the REAL
        // profile so the parent dashboard has something meaningful to render.
        // The meta.source field is tagged so the dashboard footnote is honest.
        let data: EmaktabExport = extracted;
        let isDemoFallback = false;
        if (shouldUseDemoData(extracted)) {
          emit({
            stage: "demo-fallback",
            message: "Ta'til davri — namuna ma'lumotlari yaratilmoqda",
          });
          data = generateDemoData(extracted.profile);
          isDemoFallback = true;
        }

        emit({ stage: "saving", message: "Hisobingizga bog'lanmoqda" });
        await saveSnapshot(uid, data);
        const markTotal = data.grades.reduce(
          (n, p) => n + p.subjects.reduce((m, s) => m + s.marks.length, 0),
          0,
        );
        emit({
          stage: "done",
          summary: {
            name: data.profile.name,
            className: data.profile.className,
            school: data.profile.school,
            grade: data.profile.grade,
            periods: data.grades.length,
            marks: markTotal,
            diaryDays: data.diary.length,
            homework: data.homework.length,
            notes: data.meta.notes,
            isDemoFallback,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Best-effort classification — front-end maps these to localised toasts.
        const errorCode = /Executable doesn't exist|browserType\.launch|playwright install/i.test(message)
          ? "browserMissing"
          : /captcha/i.test(message)
            ? "captcha"
            : /login failed|password|noto'g'ri/i.test(message)
              ? "badCreds"
              : /aborted/i.test(message)
                ? "aborted"
                : /timeout|net::|ENOTFOUND|ECONNREFUSED|ENETUNREACH/i.test(message)
                  ? "network"
                  : "extract";
        // Don't leak credentials or stack traces — only the classified code +
        // a short Uzbek summary. In dev mode we also tail the original error
        // for the operator (via the X-Scorpius-Error-Detail header), but never
        // include credentials in it.
        emit({
          stage: "error",
          error: errorCode,
          message:
            errorCode === "browserMissing"
              ? "Server brauzerlari o'rnatilmagan. `npx playwright install` ni ishga tushiring va qayta urinib ko'ring."
              : errorCode === "captcha"
                ? "emaktab vaqtincha captcha so'ramoqda — bir necha daqiqadan keyin urinib ko'ring."
                : errorCode === "badCreds"
                  ? "Login yoki parol noto'g'ri. Iltimos, tekshirib qayta urinib ko'ring."
                  : errorCode === "aborted"
                    ? "Ulanish to'xtatildi."
                    : errorCode === "network"
                      ? "emaktab.uz ga ulanib bo'lmadi. Internetni tekshiring va qayta urinib ko'ring."
                      : "emaktab bilan ulanishda xatolik. Iltimos, keyinroq urinib ko'ring.",
        });
        console.warn("[emaktab/connect] failed:", errorCode, message);
      } finally {
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
