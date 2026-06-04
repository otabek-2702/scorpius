"use client";

import type { ReactNode } from "react";
import { BookOpen, GraduationCap, Lightbulb, Loader2, Sparkles, Star } from "lucide-react";
import { useParentSnapshot } from "@/lib/parentData";
import { BottomNav } from "@/components/nav/BottomNav";

function Overline({ label }: { label: string }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-void-300">
      {label}
    </span>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-void-500 bg-void-800 p-5">{children}</div>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[18px] border border-void-500 bg-void-800 px-3 py-4 text-center">
      <div className="text-[1.7rem] font-semibold text-void-100">{value}</div>
      <div className="mt-0.5 text-[13px] text-void-300">{label}</div>
    </div>
  );
}

/** Shown while we wait for Firebase auth + Firestore — also for genuinely
 *  empty users (anon UID but no profile + no completions). Stays minimal and
 *  honest, never invents fake activity. */
function EmptyState({ message }: { message: string }) {
  return (
    <main className="min-h-dvh px-5 pb-36 pt-10">
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
      <main className="min-h-dvh px-5 pb-36 pt-10">
        <div className="mx-auto flex w-full max-w-[620px] flex-col items-center justify-center gap-4 rounded-[22px] border border-void-500 bg-void-800 px-6 py-16 text-center">
          <GraduationCap className="h-10 w-10 text-void-300" />
          <h2 className="text-[1.4rem] font-semibold leading-tight text-void-100">
            Farzandingiz hali hech qanday dars yakunlamagan
          </h2>
          <p className="max-w-[28rem] text-[15px] leading-snug text-void-200">
            Birinchi yulduz yonganda — bu yerda ko&apos;rinadi. Farzandingiz
            <code className="mx-1 rounded bg-void-700 px-1.5 py-0.5 text-[12.5px] text-void-100">
              scorpius.uz
            </code>
            ga kirib bitta darsni tugatsin.
          </p>
        </div>
        <BottomNav />
      </main>
    );
  }

  const p = state.data;
  const last = p.lastLesson?.lesson;
  // Until emaktab is connected, the grades panel stays empty — honest, not mocked.
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

  return (
    <main className="min-h-dvh px-5 pb-36 pt-10">
      <div className="mx-auto flex w-full max-w-[620px] flex-col gap-6">
        <header className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-void-700">
            <GraduationCap className="h-6 w-6 text-void-200" />
          </div>
          <div>
            <h1 className="text-[1.55rem] font-semibold leading-tight text-void-100">
              {p.childName}
            </h1>
            <p className="text-sm text-void-300">
              {p.grade ? `${p.grade}-sinf` : "Sinf ko'rsatilmagan"}
            </p>
          </div>
        </header>

        <section>
          <Overline label="Bu hafta" />
          <div className="mt-3 grid grid-cols-3 gap-3">
            <StatTile value={String(p.weekLessonCount)} label="dars" />
            <StatTile value={String(p.completedLessons.length)} label="jami yulduz" />
            <StatTile
              value={p.weekLessonCount > 0 ? `${Math.min(100, p.weekLessonCount * 25)}%` : "—"}
              label="faollik"
            />
          </div>
        </section>

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

        {p.completedLessons.length > 1 && (
          <Panel>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-antares-500" />
              <Overline label="Yakunlangan barcha darslar" />
            </div>
            <div className="mt-2 divide-y divide-void-500">
              {p.completedLessons.map((c) => (
                <div key={c.lesson.id} className="flex items-center justify-between py-2.5">
                  <span className="text-[15px] text-void-100">{c.lesson.title}</span>
                  <span className="text-[12.5px] text-void-300">{c.lesson.subjectLabel}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}

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
      </div>
      <BottomNav />
    </main>
  );
}
