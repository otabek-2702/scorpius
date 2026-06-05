"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  Lightbulb,
  Link2,
  Loader2,
  RefreshCw,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useParentSnapshot } from "@/lib/parentData";
import { BottomNav } from "@/components/nav/BottomNav";
import {
  HomeworkDonut,
  SubjectGradeRow,
  WeeklyTrendChart,
} from "./GradeChart";

function Overline({ label }: { label: string }) {
  return (
    <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-antares-700">
      {label}
    </span>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-void-500 bg-void-800 p-5">{children}</div>
  );
}

/** Shown while we wait for Firebase auth + Firestore — also for genuinely
 *  empty users (anon UID but no profile + no completions). Stays minimal and
 *  honest, never invents fake activity. */
function EmptyState({ message }: { message: string }) {
  return (
    <main className="min-h-dvh px-5 pb-[calc(120px+env(safe-area-inset-bottom))] pt-10">
      <div className="mx-auto flex w-full max-w-[620px] flex-col items-center justify-center gap-4 rounded-[22px] border border-void-500 bg-void-800 px-6 py-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-void-300" />
        <p className="max-w-[28rem] text-[15px] leading-snug text-void-200">{message}</p>
      </div>
      <BottomNav />
    </main>
  );
}

export function ParentDashboard() {
  const state = useParentSnapshot();

  if (state.status === "loading") {
    return <EmptyState message="Farzandingiz ma'lumotlari yuklanmoqda…" />;
  }

  if (state.status === "anonymous-only") {
    return (
      <main className="min-h-dvh px-5 pb-[calc(120px+env(safe-area-inset-bottom))] pt-10">
        <div className="mx-auto flex w-full max-w-[620px] flex-col gap-4">
          {/* Primary CTA — connect emaktab. This is the headline action for a
           *  brand-new parent who has nothing in the dashboard yet. */}
          <Link
            href="/sozlamalar/emaktab"
            className="group flex items-center gap-3 rounded-[22px] border border-antares-500/55 bg-gradient-to-br from-antares-500/14 to-antares-500/3 p-5 transition-all hover:border-antares-500/85 active:scale-[0.99]"
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-antares-500/15 text-antares-700">
              <Link2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-antares-700">
                emaktab.uz ulang
              </div>
              <div className="mt-1 text-[15px] leading-snug text-void-100">
                Farzandingiz baholarini Scorpius&apos;ga to&apos;g&apos;ridan-to&apos;g&apos;ri olib
                kelish. Bir martalik, 1-2 daqiqada.
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-antares-700" />
          </Link>

          {/* Secondary message — Scorpius lessons */}
          <div className="flex flex-col items-center justify-center gap-3 rounded-[22px] border border-void-500 bg-void-800 px-6 py-10 text-center">
            <GraduationCap className="h-8 w-8 text-void-300" />
            <h2 className="text-[1.2rem] font-semibold leading-tight text-void-100">
              Yoki: birinchi Scorpius darsi
            </h2>
            <p className="max-w-[28rem] text-[14px] leading-snug text-void-200">
              Farzandingiz{" "}
              <code className="mx-1 rounded bg-void-700 px-1.5 py-0.5 text-[12px] text-void-100">
                scorpius.uz
              </code>
              ga kirib bitta darsni tugatsa — bu yerda yulduzlar paydo bo&apos;ladi.
            </p>
          </div>
        </div>
        <BottomNav />
      </main>
    );
  }

  const p = state.data;
  const last = p.lastLesson?.lesson;
  const lastLessonSummary = last
    ? `${p.childName.split(" ")[0]} ${last.title.toLowerCase()} mavzusini yakunladi.`
    : null;
  const askThem = last
    ? [
        `${last.title} — asosiy fikr nima edi?`,
        "Bugun nimaning tushuntirilishi yoqdi?",
        "Yana qaysi misol bilan tushuntirib bera olasiz?",
      ]
    : null;

  // Pre-format the headline number — emaktab grade aggregates land here.
  const overall = p.emaktab?.overallAverage ?? null;
  const overallLabel = overall === null ? "—" : overall.toFixed(2);
  const overallTone =
    overall === null
      ? "text-void-300"
      : overall >= 4.5
        ? "text-signal-correct"
        : overall >= 3.5
          ? "text-antares-700"
          : "text-signal-error";

  return (
    <main className="min-h-dvh bg-void-950 px-5 pb-[calc(120px+env(safe-area-inset-bottom))] pt-10">
      <div className="mx-auto flex w-full max-w-[620px] flex-col gap-5">
        {/* ============ Header ============ */}
        <header className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-void-700">
            <GraduationCap className="h-6 w-6 text-void-200" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[1.55rem] font-semibold leading-tight text-void-100">
              {p.childName}
            </h1>
            <p className="text-sm text-void-300">
              {p.className ?? (p.grade ? `${p.grade}-sinf` : "Sinf ko'rsatilmagan")}
              {p.school ? ` · ${p.school}` : ""}
            </p>
          </div>
        </header>

        {/* ============ Connect emaktab CTA — shown only when no live data ============ */}
        {(!p.emaktab || p.emaktabSource !== "firestore-live") && (
          <Link
            href="/sozlamalar/emaktab"
            className="group flex items-center gap-3 rounded-[22px] border border-antares-500/50 bg-gradient-to-br from-antares-500/12 to-antares-500/3 p-4 transition-all hover:border-antares-500/80 active:scale-[0.99]"
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-antares-500/15 text-antares-700">
              <Link2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-antares-700">
                emaktab.uz ulang
              </div>
              <div className="mt-0.5 text-[14px] leading-snug text-void-100">
                {p.emaktab
                  ? "Hozir namuna ma'lumotlari ko'rsatilmoqda — o'z hisobingizni ulang."
                  : "Farzandingiz baholarini Scorpius'ga to'g'ridan-to'g'ri olib kelish."}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-antares-700" />
          </Link>
        )}

        {/* ============ Hero stats — overall avg + week activity ============ */}
        <section className="grid grid-cols-3 gap-3">
          <div className="col-span-3 rounded-[22px] border border-antares-500/35 bg-gradient-to-br from-antares-500/12 to-antares-500/3 p-5">
            <Overline label="Bu chorakdagi o'rtacha baho" />
            <div className="mt-2 flex items-baseline gap-3">
              <span
                className={`font-mono text-[2.6rem] font-bold tabular-nums leading-none ${overallTone}`}
              >
                {overallLabel}
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-void-300">
                {p.emaktab ? `${p.emaktab.overallSampleSize} ta baho` : "ma'lumot yo'q"}
              </span>
            </div>
            <p className="mt-3 text-[13.5px] leading-snug text-void-200">
              {p.emaktab && overall !== null
                ? overall >= 4.5
                  ? `${p.childName.split(" ")[0]} hozir kuchli — barcha asosiy fanlarda yuqori ko'rsatkich.`
                  : overall >= 3.5
                    ? `Umumiy holat barqaror. Quyidagi 1-2 fanga qo'shimcha e'tibor foyda beradi.`
                    : `Hozir bir nechta fan e'tibor talab qiladi. Quyida qaysilarini ko'rasiz.`
                : `emaktab.uz ulanmagan yoki ma'lumot hali yangilanmagan — joriy chorak baholari paydo bo'lishi uchun farzandingiz emaktabga kirib qarasin.`}
            </p>
          </div>
        </section>

        {/* ============ Weekly trend chart ============ */}
        {p.emaktab && p.emaktab.weeklyTrend.some((w) => w.avg !== null) && (
          <Panel>
            <div className="flex items-baseline justify-between">
              <Overline label="8 hafta — o'rtacha baho" />
              <span className="font-mono text-[10.5px] text-void-300">
                {p.emaktab.weeklyTrend.filter((w) => w.avg !== null).length} ta hafta
              </span>
            </div>
            <div className="mt-3">
              <WeeklyTrendChart data={p.emaktab.weeklyTrend} />
            </div>
            <p className="mt-1 text-[12px] leading-snug text-void-300">
              Har bir nuqta — o&apos;sha haftaning barcha baholaridan olingan o&apos;rtacha. Bo&apos;sh
              haftalar — baho qo&apos;yilmagan.
            </p>
          </Panel>
        )}

        {/* ============ Per-subject grade table ============ */}
        {p.emaktab && p.emaktab.subjects.length > 0 && (
          <Panel>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-antares-700" />
              <Overline label="Fanlar bo'yicha" />
            </div>
            <div className="mt-3 divide-y divide-void-500">
              {p.emaktab.subjects.map((s, i) => (
                <SubjectGradeRow key={`${s.subjectId || "subj"}-${i}`} row={s} />
              ))}
            </div>
          </Panel>
        )}

        {/* ============ Strong / weak split ============ */}
        {p.emaktab &&
          (p.emaktab.weakest.length > 0 || p.emaktab.strongest.length > 0) && (
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {p.emaktab.weakest.length > 0 && (
              <Panel>
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-signal-error" />
                  <Overline label="E'tibor talab qiladi" />
                </div>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {p.emaktab.weakest.map((s, i) => (
                    <li
                      key={`weak-${s.subjectId || "subj"}-${i}`}
                      className="flex items-center justify-between gap-2 text-[14px]"
                    >
                      <span className="truncate text-void-100">{s.subject}</span>
                      <span className="font-mono text-[13px] font-bold tabular-nums text-signal-error">
                        {s.computedAverage?.toFixed(1) ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[12px] leading-snug text-void-300">
                  Scorpius shu fanlarga moslangan qisqa darslarni avtomatik tavsiya qiladi.
                </p>
              </Panel>
            )}
            {p.emaktab.strongest.length > 0 && (
              <Panel>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-signal-correct" />
                  <Overline label="Kuchli tomonlari" />
                </div>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {p.emaktab.strongest.map((s, i) => (
                    <li
                      key={`strong-${s.subjectId || "subj"}-${i}`}
                      className="flex items-center justify-between gap-2 text-[14px]"
                    >
                      <span className="truncate text-void-100">{s.subject}</span>
                      <span className="font-mono text-[13px] font-bold tabular-nums text-signal-correct">
                        {s.computedAverage?.toFixed(1) ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[12px] leading-snug text-void-300">
                  Bu fanlarda darajani saqlash uchun haftada 1-2 mashq yetarli.
                </p>
              </Panel>
            )}
          </section>
        )}

        {/* ============ Homework + recent marks split ============ */}
        {p.emaktab && (
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Panel>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-signal-correct" />
                <Overline label="Uy vazifasi · 7 kun" />
              </div>
              <div className="mt-3">
                <HomeworkDonut
                  done={p.emaktab.homework.done}
                  notDone={p.emaktab.homework.notDone}
                />
              </div>
            </Panel>

            {p.emaktab.recentMarks.length > 0 && (
              <Panel>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-antares-700" />
                  <Overline label="So'nggi baholar" />
                </div>
                <ul className="mt-3 flex flex-col divide-y divide-void-500">
                  {p.emaktab.recentMarks.slice(0, 6).map((m, i) => (
                    <li
                      key={`${m.subjectId}-${m.iso}-${i}`}
                      className="flex items-center justify-between gap-2 py-1.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] text-void-100">{m.subject}</div>
                        {m.date && (
                          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-void-300">
                            {m.date}
                          </div>
                        )}
                      </div>
                      <span
                        className={
                          "font-mono text-[16px] font-bold tabular-nums " +
                          (m.value >= 4
                            ? "text-signal-correct"
                            : m.value === 3
                              ? "text-antares-700"
                              : "text-signal-error")
                        }
                      >
                        {m.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </section>
        )}

        {/* ============ Scorpius activity — week count + lessons ============ */}
        <section>
          <Overline label="Scorpius · bu hafta" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-[18px] border border-void-500 bg-void-800 px-3 py-4 text-center">
              <div className="text-[1.7rem] font-semibold text-void-100">
                {p.weekLessonCount}
              </div>
              <div className="mt-0.5 text-[13px] text-void-300">dars yakunlandi</div>
            </div>
            <div className="rounded-[18px] border border-void-500 bg-void-800 px-3 py-4 text-center">
              <div className="text-[1.7rem] font-semibold text-void-100">
                {p.completedLessons.length}
              </div>
              <div className="mt-0.5 text-[13px] text-void-300">jami yulduz</div>
            </div>
          </div>
        </section>

        {/* ============ Last Scorpius lesson ============ */}
        {last && (
          <Panel>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-subject-math" />
              <Overline label="Eng so'nggi dars" />
            </div>
            <h2 className="mt-2 text-xl font-semibold text-void-100">{last.title}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-void-200">{lastLessonSummary}</p>
          </Panel>
        )}

        {/* ============ Ask-them prompts ============ */}
        {askThem && (
          <Panel>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-antares-500" />
              <Overline label="Farzandingizdan so'rang" />
            </div>
            <ol className="mt-3 flex flex-col gap-2.5">
              {askThem.map((q, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-void-700 text-[13px] font-semibold text-void-200">
                    {i + 1}
                  </span>
                  <span className="text-[15px] leading-snug text-void-100">{q}</span>
                </li>
              ))}
            </ol>
          </Panel>
        )}

        {/* ============ All completed lessons ============ */}
        {p.completedLessons.length > 1 && (
          <Panel>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-antares-500" />
              <Overline label="Yakunlangan barcha darslar" />
            </div>
            <div className="mt-2 divide-y divide-void-500">
              {p.completedLessons.map((c, i) => (
                <div
                  key={`${c.lesson.id || "lesson"}-${i}`}
                  className="flex items-center justify-between py-2.5"
                >
                  <span className="text-[15px] text-void-100">{c.lesson.title}</span>
                  <span className="text-[12.5px] text-void-300">{c.lesson.subjectLabel}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* ============ Pain-point reminder ============ */}
        {p.painPoint && (
          <div className="flex items-start gap-3 rounded-[22px] border border-antares-500/30 bg-antares-50 p-5">
            <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-antares-700" />
            <p className="text-[15px] leading-relaxed text-void-100">
              <span className="font-semibold">{p.childName.split(" ")[0]}</span>{" "}
              o&apos;qishda hozir eng qiyini deb shuni aytdi:{" "}
              <em className="italic">&laquo;{p.painPoint}&raquo;</em>. Scorpius shu yo&apos;nalishda
              ko&apos;proq misol va sabr bilan tushuntirish beradi.
            </p>
          </div>
        )}

        {/* ============ Data source footnote + re-sync link ============ */}
        {p.emaktabSource && (
          <div className="flex flex-col items-center gap-2 pt-2 text-center">
            <p className="text-[11.5px] leading-snug text-void-300">
              Baho ma&apos;lumoti:{" "}
              <span className="font-mono">
                {p.emaktabIsDemo
                  ? "namuna ma'lumotlari (yozgi ta'til — sizning profilingiz uchun yaratilgan)"
                  : p.emaktabSource === "firestore-live"
                    ? "jonli emaktab sinxronizatsiyasi"
                    : "namuna ma'lumotlari (emaktab ulanmagan)"}
              </span>
            </p>
            <Link
              href="/sozlamalar/emaktab"
              className="inline-flex items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-antares-700 transition hover:text-antares-300"
            >
              <RefreshCw className="h-3 w-3" />
              {p.emaktabSource === "firestore-live"
                ? "Qaytadan sinxronlash"
                : "emaktab.uz ni ulash"}
            </Link>
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
