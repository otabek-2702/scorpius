"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Star, Telescope } from "lucide-react";
import { BottomNav } from "@/components/nav/BottomNav";
import { loadAllMastery, recallNow, type MasteryRecord, type MasteryLevel } from "@/lib/mastery";
import { getSkill } from "@/lib/skills";
import { loadSupernovas, type Supernova } from "@/lib/supernova";

/** Personal Zij — the chronological catalog of every concept the student
 *  has observed, modeled on Ulug'bek's 1437 Samarqand zij (Zīj-i Sulṭānī).
 *
 *  Two sections:
 *    1. Supernovas — the chapter-end ceremonies, ordered by date.
 *    2. Yulduzlar — every skill the user has attempted at least once,
 *       sorted by most-recent first. Each row shows: ordinal · concept ·
 *       chapter · daraja (level) · sana (date).
 *
 *  Pure client-side render — mastery + supernovas live in localStorage.
 *  Empty state nudges the user to start a lesson. */
export function ZijView() {
  const [mastery, setMastery] = useState<MasteryRecord[]>([]);
  const [supernovas, setSupernovas] = useState<Supernova[]>([]);

  useEffect(() => {
    setMastery(loadAllMastery());
    setSupernovas(loadSupernovas());
  }, []);

  // Sort attempts most-recent first, drop ones with no attempts.
  const stars = useMemo(() => {
    return mastery
      .filter((r) => r.total > 0 && r.lastSeen > 0)
      .sort((a, b) => b.lastSeen - a.lastSeen);
  }, [mastery]);

  return (
    <main className="relative flex min-h-dvh flex-col bg-void-950 px-5 pb-[calc(120px+env(safe-area-inset-bottom))] pt-8">
      {/* ============ Header ============ */}
      <header className="mx-auto w-full max-w-[680px]">
        <Link
          href="/learn"
          className="inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-void-300 transition hover:text-void-100"
        >
          <ArrowLeft className="h-3 w-3" />
          Osmonga qaytish
        </Link>
        <div className="mt-4 flex items-center gap-2">
          <Telescope className="h-3.5 w-3.5 text-antares-700" />
          <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-antares-700">
            Shaxsiy zij
          </span>
        </div>
        <h1
          className="mt-2 text-[2rem] font-medium leading-[1.05] tracking-[-0.025em] text-void-100"
          style={{ fontFamily: '"Newsreader", Georgia, serif', fontWeight: 500 }}
        >
          Sizning <em className="italic text-antares-700">yulduz katalogingiz</em>.
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-void-200">
          Ulug&apos;bekning 1437-yil Samarqand zijiga ishora bilan tuzilgan — bunda yulduzlar emas,
          balki siz o&apos;rgangan tushunchalar yoziladi. Har bir yulduz — bir mavzu, bir sana, bir
          daraja.
        </p>
      </header>

      {/* ============ Supernovas section ============ */}
      {supernovas.length > 0 && (
        <section className="mx-auto mt-7 w-full max-w-[680px]">
          <h2 className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-void-300">
            Supernovalar
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {supernovas
              .sort((a, b) => b.ts - a.ts)
              .map((sn) => (
                <li
                  key={sn.id}
                  className="overflow-hidden rounded-[16px] border border-antares-500/35 bg-gradient-to-br from-antares-500/15 to-antares-500/3 p-4"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h3
                      className="text-[1.05rem] font-medium leading-tight text-void-100"
                      style={{ fontFamily: '"Newsreader", Georgia, serif' }}
                    >
                      {sn.name}
                    </h3>
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-antares-700">
                      {sn.whenLabel}
                    </span>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      )}

      {/* ============ Stars catalog ============ */}
      <section className="mx-auto mt-7 w-full max-w-[680px]">
        <div className="flex items-baseline justify-between">
          <h2 className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-void-300">
            Yulduzlar
          </h2>
          <span className="font-mono text-[10.5px] tabular-nums text-void-300">
            {stars.length} ta
          </span>
        </div>

        {stars.length === 0 ? (
          <div className="mt-4 rounded-[18px] border border-void-500 bg-void-800 px-5 py-8 text-center">
            <Star className="mx-auto h-6 w-6 text-void-400" />
            <p className="mt-3 text-[14px] leading-snug text-void-200">
              Sizning zijingiz hali bo&apos;sh. Bir mavzuni o&apos;rganib chiqing — birinchi yulduzni
              bu yerga yozamiz.
            </p>
            <Link
              href="/learn"
              className="mt-4 inline-flex h-[40px] items-center justify-center rounded-full bg-antares-500 px-5 text-[13px] font-semibold text-void-100 transition hover:bg-antares-300 active:scale-[0.97]"
            >
              Boshlash
            </Link>
          </div>
        ) : (
          <ul className="mt-3 overflow-hidden rounded-[16px] border border-void-500 bg-void-800">
            {stars.map((star, i) => (
              <ZijRow key={star.skillId} record={star} ordinal={i + 1} />
            ))}
          </ul>
        )}
      </section>

      {/* ============ Footer note ============ */}
      <p className="mx-auto mt-8 max-w-[560px] text-center text-[12.5px] leading-relaxed text-void-300">
        Beruniy va Ulug&apos;bek uslubida tuzilgan. Har bir yulduzning darajasi vaqt o&apos;tishi
        bilan yangilanadi — qaytib o&apos;rganing va halqada yana qarang.
      </p>

      <BottomNav />
    </main>
  );
}

/** A single row in the zij — ordinal, concept name, chapter, mastery level, date. */
function ZijRow({ record, ordinal }: { record: MasteryRecord; ordinal: number }) {
  const skill = getSkill(record.skillId);
  if (!skill) return null;
  const date = new Date(record.lastSeen);
  const dateLabel = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const recall = recallNow(record);
  const composite = record.pL * recall;
  const level: MasteryLevel = composite >= 0.95 && record.masteryChallengePass
    ? "mastered"
    : composite >= 0.8
      ? "proficient"
      : composite >= 0.5
        ? "familiar"
        : "attempted";
  const levelLabel: Record<MasteryLevel, string> = {
    attempted: "ko'rdi",
    familiar: "tanish",
    proficient: "ishonchli",
    mastered: "o'rganildi",
  };
  const levelColor: Record<MasteryLevel, string> = {
    attempted: "text-void-400",
    familiar: "text-void-200",
    proficient: "text-antares-700",
    mastered: "text-signal-correct",
  };
  return (
    <li className="grid grid-cols-[32px_1fr_auto] items-baseline gap-3 border-b border-void-500 px-4 py-3 last:border-b-0">
      <span className="font-mono text-[11px] tabular-nums text-void-400">
        {String(ordinal).padStart(3, "0")}
      </span>
      <div className="min-w-0">
        <div
          className="truncate text-[14.5px] font-medium leading-snug text-void-100"
          style={{ fontFamily: '"Newsreader", Georgia, serif' }}
        >
          {skill.name}
        </div>
        <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.1em] text-void-300">
          {skill.unit} · {Math.round(composite * 100)}%
        </div>
      </div>
      <div className="text-right">
        <div className={`font-mono text-[11px] font-bold uppercase tracking-[0.1em] ${levelColor[level]}`}>
          {levelLabel[level]}
        </div>
        <div className="mt-0.5 font-mono text-[10px] tabular-nums text-void-400">
          {dateLabel}
        </div>
      </div>
    </li>
  );
}
