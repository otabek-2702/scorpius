"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { BottomNav } from "@/components/nav/BottomNav";
import { ensureAnonymousUser } from "@/lib/auth";

/** In-app emaktab connect flow.
 *
 *  Flow:
 *    1. Form (idle) — username + password
 *    2. Streaming (running) — show progress stages from the SSE response
 *    3. Result (done) — show profile summary + CTA back to /parent
 *    4. Error — show classified error code + retry button
 *
 *  Credentials never leave this component except over HTTPS to /api/emaktab/connect.
 *  No localStorage / sessionStorage / form auto-fill is enabled.
 */

type StageId =
  | "starting"
  | "logging-in"
  | "profile"
  | "grades"
  | "diary"
  | "homework"
  | "finalising"
  | "demo-fallback"
  | "saving"
  | "done"
  | "error";

const STAGE_LABEL: Record<Exclude<StageId, "error">, string> = {
  starting: "Brauzer ishga tushirilmoqda",
  "logging-in": "emaktab.uz ga kirilmoqda",
  profile: "Profil ma'lumotlari olinmoqda",
  grades: "Choraklik baholar olinmoqda",
  diary: "Kundalik (haftalik darslar) olinmoqda",
  homework: "Uy vazifalari olinmoqda",
  finalising: "Yakuniy ishlov berilmoqda",
  "demo-fallback": "Ta'til davri — namuna ma'lumotlari",
  saving: "Hisobingizga bog'lanmoqda",
  done: "Tayyor",
};

const STAGE_ORDER: Array<Exclude<StageId, "error" | "starting" | "finalising">> = [
  "logging-in",
  "profile",
  "grades",
  "diary",
  "homework",
  "saving",
  "done",
];

interface DoneSummary {
  name: string;
  className: string | null;
  school: string | null;
  grade: number | null;
  periods: number;
  marks: number;
  diaryDays: number;
  homework: number;
  notes: string[];
  /** True when emaktab returned empty and the system generated plausible
   *  data from the real profile so the dashboard has something to render. */
  isDemoFallback?: boolean;
}

export function ConnectEmaktabView() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [stage, setStage] = useState<StageId>("starting");
  const [submitted, setSubmitted] = useState(false);
  const [done, setDone] = useState<DoneSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void ensureAnonymousUser().then(setUid);
    return () => abortRef.current?.abort();
  }, []);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (submitted) return;
    if (username.trim().length === 0 || password.length === 0) return;
    if (!uid) {
      setErrorMsg(
        "Foydalanuvchi sessiyasi hali tayyor emas — bir necha soniya kuting va yana urinib ko'ring.",
      );
      return;
    }
    setSubmitted(true);
    setDone(null);
    setErrorMsg(null);
    setStage("starting");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/emaktab/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Scorpius-Uid": uid,
        },
        body: JSON.stringify({ username: username.trim(), password }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setStage("error");
        setErrorMsg(data.message ?? "Server xatosi — keyinroq urinib ko'ring.");
        setSubmitted(false);
        return;
      }
      if (!res.body) {
        setStage("error");
        setErrorMsg("Server javobi bo'sh keldi. Iltimos, qayta urinib ko'ring.");
        setSubmitted(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload) as {
              stage?: StageId;
              message?: string;
              error?: string;
              summary?: DoneSummary;
            };
            if (parsed.stage === "error") {
              setStage("error");
              setErrorMsg(parsed.message ?? "Xatolik yuz berdi");
              continue;
            }
            if (parsed.stage === "done" && parsed.summary) {
              setStage("done");
              setDone(parsed.summary);
              // Clear the password the moment we have a result.
              setPassword("");
              continue;
            }
            if (parsed.stage) {
              setStage(parsed.stage);
            }
          } catch {
            /* skip malformed chunk */
          }
        }
      }
    } catch (err) {
      if ((err as { name?: string })?.name !== "AbortError") {
        setStage("error");
        setErrorMsg("Internet ulanishida muammo — qayta urinib ko'ring.");
      }
    } finally {
      setSubmitted(false);
      abortRef.current = null;
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col bg-void-950 px-5 pb-[calc(120px+env(safe-area-inset-bottom))] pt-8">
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-5">
        {/* Header */}
        <Link
          href="/parent"
          className="inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-void-300 transition hover:text-void-100"
        >
          <ArrowLeft className="h-3 w-3" />
          Ota-ona sahifasiga qaytish
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <LockKeyhole className="h-3.5 w-3.5 text-antares-700" />
            <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-antares-700">
              emaktab.uz bog'lash
            </span>
          </div>
          <h1
            className="mt-2 text-[1.8rem] font-medium leading-[1.1] tracking-[-0.025em] text-void-100"
            style={{ fontFamily: '"Newsreader", Georgia, serif', fontWeight: 500 }}
          >
            Farzandingiz baholarini{" "}
            <em className="italic text-antares-700">to&apos;g&apos;ridan-to&apos;g&apos;ri</em>{" "}
            ulang.
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-void-200">
            emaktab.uz hisobingiz orqali bog&apos;lanamiz. Choraklik baholar, kundalik darslar va
            uy vazifalari avtomatik ravishda Scorpius ota-ona sahifasiga ko&apos;chiriladi.
          </p>
        </div>

        {/* Privacy band */}
        <div className="flex items-start gap-3 rounded-[18px] border border-void-500 bg-void-800 p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-signal-correct" />
          <div className="text-[13px] leading-snug text-void-200">
            Login va parol <strong className="text-void-100">faqat shu so&apos;rov uchun</strong>{" "}
            ishlatiladi — saqlanmaydi, jurnalga yozilmaydi va boshqa hech kim ko&apos;ra olmaydi.
            Ulanish bir martalik: keyinroq yana yangilamoqchi bo&apos;lsangiz, qayta kiritish kerak.
          </div>
        </div>

        {/* Card — form or progress or done */}
        {stage === "done" && done ? (
          <DoneCard summary={done} onView={() => router.push("/parent")} />
        ) : submitted ? (
          <ProgressCard stage={stage} errorMsg={errorMsg} />
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="rounded-[18px] border border-void-500 bg-void-800 p-5">
              <label className="block">
                <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-void-300">
                  emaktab login
                </span>
                <input
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="masalan: bobur.karim"
                  className="mt-1.5 block w-full rounded-[12px] border border-void-500 bg-void-700 px-3.5 py-2.5 text-[15px] text-void-100 outline-none transition-colors placeholder:text-void-400 focus:border-antares-500"
                />
              </label>
              <label className="mt-4 block">
                <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-void-300">
                  parol
                </span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="off"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="mt-1.5 block w-full rounded-[12px] border border-void-500 bg-void-700 px-3.5 py-2.5 pr-11 text-[15px] text-void-100 outline-none transition-colors placeholder:text-void-400 focus:border-antares-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                    className="absolute right-2 top-[7px] grid h-9 w-9 place-items-center rounded-full text-void-300 transition hover:bg-void-700/60 hover:text-void-100"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
              <p className="mt-3 text-[11.5px] leading-snug text-void-300">
                Ulanish 60-120 soniya davom etadi. Bu vaqt ichida brauzerni yopmang.
              </p>
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 rounded-[14px] border border-signal-error/35 bg-signal-error/5 p-3.5">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-signal-error" />
                <p className="text-[13px] leading-snug text-void-100">{errorMsg}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={
                !uid || username.trim().length === 0 || password.length === 0 || submitted
              }
              className="inline-flex h-[48px] items-center justify-center gap-2 rounded-full bg-antares-500 text-[15px] font-semibold text-void-100 transition hover:bg-antares-300 active:scale-[0.97] disabled:bg-void-700 disabled:text-void-300"
            >
              {uid ? "Ulanishni boshlash" : (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sessiya tayyorlanmoqda…
                </>
              )}
            </button>
          </form>
        )}
      </div>
      <BottomNav />
    </main>
  );
}

/** Progress card — shown while the SSE stream is delivering stages. */
function ProgressCard({ stage, errorMsg }: { stage: StageId; errorMsg: string | null }) {
  const isError = stage === "error";
  const stageIdx = STAGE_ORDER.findIndex((s) => s === stage);
  return (
    <div className="rounded-[20px] border border-void-500 bg-void-800 p-5">
      <div className="flex items-center gap-2">
        <Loader2 className={`h-4 w-4 ${isError ? "text-signal-error" : "animate-spin text-antares-700"}`} />
        <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-antares-700">
          {isError ? "Xatolik" : "Ulanmoqda"}
        </span>
      </div>
      <ol className="mt-3 flex flex-col gap-1.5">
        {STAGE_ORDER.map((s, i) => {
          const isCurrent = !isError && s === stage;
          const isPast = !isError && stageIdx > i;
          return (
            <li key={s} className="flex items-center gap-2">
              <span
                className={
                  "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold " +
                  (isPast
                    ? "bg-signal-correct text-void-100"
                    : isCurrent
                      ? "bg-antares-500 text-void-100"
                      : "bg-void-700 text-void-300")
                }
              >
                {isPast ? "✓" : i + 1}
              </span>
              <span
                className={
                  "text-[13.5px] " + (isPast ? "text-void-300" : isCurrent ? "font-semibold text-void-100" : "text-void-300")
                }
              >
                {STAGE_LABEL[s]}
              </span>
            </li>
          );
        })}
      </ol>
      {isError && errorMsg && (
        <p className="mt-4 text-[13px] leading-snug text-signal-error">{errorMsg}</p>
      )}
    </div>
  );
}

/** Done card — shows the extraction summary + CTA to view dashboard. */
function DoneCard({ summary, onView }: { summary: DoneSummary; onView: () => void }) {
  const demo = summary.isDemoFallback === true;
  return (
    <div
      className={
        "rounded-[20px] border p-5 " +
        (demo
          ? "border-antares-500/45 bg-gradient-to-br from-antares-500/10 to-antares-500/3"
          : "border-signal-correct/40 bg-gradient-to-br from-signal-correct/10 to-signal-correct/3")
      }
    >
      <div className="flex items-center gap-2">
        <CheckCircle2
          className={`h-4 w-4 ${demo ? "text-antares-700" : "text-signal-correct"}`}
        />
        <span
          className={
            "font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] " +
            (demo ? "text-antares-700" : "text-signal-correct")
          }
        >
          {demo ? "Bog'landi · ta'til rejimi" : "Bog'landi"}
        </span>
      </div>
      <h2
        className="mt-2 text-[1.4rem] font-medium leading-tight text-void-100"
        style={{ fontFamily: '"Newsreader", Georgia, serif', fontWeight: 500 }}
      >
        {summary.name || "Profil"} ulandi
      </h2>
      <p className="mt-1 text-[13px] text-void-300">
        {summary.className ? `${summary.className} · ` : ""}
        {summary.school ?? "Maktab nomi yo'q"}
      </p>
      {demo && (
        <p className="mt-3 rounded-[12px] border border-antares-500/35 bg-void-700/40 p-3 text-[12.5px] leading-snug text-void-200">
          emaktab&apos;da hozircha baholar yo&apos;q (yozgi ta&apos;til / yangi o&apos;quv yili).
          Sizning profilingiz asosida <strong className="text-void-100">namuna ma&apos;lumotlari</strong>{" "}
          yaratildi — yangi chorak boshlanganda haqiqiy baholar avtomatik tortiladi.
        </p>
      )}
      <ul className="mt-4 grid grid-cols-2 gap-2.5">
        <SummaryStat label="Choraklar" value={summary.periods} />
        <SummaryStat label="Baholar" value={summary.marks} />
        <SummaryStat label="Kundalik kunlari" value={summary.diaryDays} />
        <SummaryStat label="Uy vazifalari" value={summary.homework} />
      </ul>
      {summary.notes.length > 0 && (
        <details className="mt-3 text-[12px] text-void-300">
          <summary className="cursor-pointer font-mono text-[10.5px] uppercase tracking-[0.14em] text-void-300">
            Ulanish izohlari ({summary.notes.length})
          </summary>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
            {summary.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </details>
      )}
      <button
        type="button"
        onClick={onView}
        className="mt-5 inline-flex h-[44px] w-full items-center justify-center gap-2 rounded-full bg-antares-500 text-[14px] font-semibold text-void-100 transition hover:bg-antares-300 active:scale-[0.97]"
      >
        Ota-ona sahifasini ko&apos;rish
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <li className="rounded-[14px] border border-void-500 bg-void-800 px-3 py-2.5">
      <div className="font-mono text-[1.4rem] font-bold tabular-nums leading-tight text-void-100">
        {value}
      </div>
      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-void-300">
        {label}
      </div>
    </li>
  );
}
