"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Sparkles, X, Zap } from "lucide-react";
import { BottomNav } from "@/components/nav/BottomNav";
import { SUBJECT_SKIES, type SkyStar, type SubjectSky } from "@/lib/sky";
import { LESSONS_BY_ID } from "@/lib/lesson";
import { loadProfile } from "@/lib/profile";

type SubjectId = "math" | "physics";

function StarTile({
  star,
  ignited,
  locked,
  isCurrent,
  isTodayTask,
  fresh,
  onTap,
}: {
  star: SkyStar;
  ignited: boolean;
  /** A star with a lesson that's gated behind an earlier, not-yet-completed star.
   *  Renders dim like a dormant star, no HOZIRGI badge, not tappable. */
  locked: boolean;
  /** The next un-done lesson — gets the HOZIRGI badge regardless of its build-time
   *  state, since the build only knows about the first hardcoded lesson. */
  isCurrent: boolean;
  /** Emaktab live snapshot identified this lesson as the student's weakest — show a pulsing badge. */
  isTodayTask?: boolean;
  fresh: boolean;
  onTap?: (s: SkyStar) => void;
}) {
  // Resolution order: locked overrides everything (dim), then current (HOZIRGI),
  // then completed (ignited), else fall back to the build-time state.
  const state = locked
    ? "dormant"
    : isCurrent
      ? "available"
      : ignited
        ? "ignited"
        : star.state;
  const isAvailable = state === "available";

  // Bigger, more tappable tile. Brilliant tiles read at ~96px on phone.
  const dotSize =
    state === "dormant"
      ? "h-3 w-3"
      : state === "available"
        ? "h-5 w-5"
        : "h-4 w-4";
  const dotColor =
    state === "dormant"
      ? "bg-star-dormant"
      : state === "available"
        ? "bg-star-bright"
        : "bg-antares-500";
  const glow =
    state === "dormant"
      ? undefined
      : isAvailable
        ? { boxShadow: "0 0 36px 10px rgba(232,162,26,0.45)" }
        : { boxShadow: "0 0 24px 6px rgba(232,162,26,0.45)" };

  const tile = (
    <div className="flex flex-col items-center">
      {/* The HOZIRGI marker — only on the available star, mimics Brilliant's green diamond. */}
      {isAvailable && (
        <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-antares-500 px-2 py-[3px] text-[9px] font-bold uppercase tracking-[0.12em] text-void-100 shadow-[0_4px_18px_-2px_rgba(232,162,26,0.45)]">
          <Sparkles className="h-2.5 w-2.5" /> Hozirgi
        </span>
      )}

      <span className="relative grid h-12 w-12 place-items-center">
        {isAvailable && (
          <span className="pulse-ring col-start-1 row-start-1 h-9 w-9 rounded-full bg-star-bright/35" />
        )}
        {fresh && (
          <span className="ignite-burst col-start-1 row-start-1 h-10 w-10 rounded-full border-2 border-antares-500" />
        )}
        {isTodayTask && (
          <span className="absolute -top-1 -right-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
            🆘 Bugungi
          </span>
        )}
        {/* the star halo ring (Brilliant-style concentric circle) */}
        {state !== "dormant" && (
          <span
            className={
              "col-start-1 row-start-1 rounded-full border " +
              (isAvailable
                ? "h-12 w-12 border-antares-500/55 bg-antares-50"
                : "h-11 w-11 border-antares-500/35 bg-antares-50/60")
            }
          />
        )}
        <span
          className={`col-start-1 row-start-1 rounded-full transition-all duration-700 ${dotSize} ${dotColor} ${fresh ? "ignite-pop" : ""}`}
          style={glow}
        />
      </span>

      <span
        className={
          "mt-2.5 max-w-[108px] text-center text-[12px] leading-tight " +
          (state === "dormant"
            ? "text-void-400"
            : "font-semibold text-void-100")
        }
      >
        {star.topic}
      </span>
    </div>
  );

  const posStyle = { left: `${star.x}%`, top: `${star.y}%` };

  if (star.href && onTap) {
    return (
      <button
        type="button"
        style={posStyle}
        onClick={() => onTap(star)}
        className="absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-transform active:scale-95"
      >
        {tile}
      </button>
    );
  }
  return (
    <div style={posStyle} className="absolute -translate-x-1/2 -translate-y-1/2">
      {tile}
    </div>
  );
}

/** Bottom sheet — opens when a tappable star is tapped. Brilliant pattern. */
function StarSheet({
  star,
  subjectLabel,
  onClose,
}: {
  star: SkyStar;
  subjectLabel: string;
  onClose: () => void;
}) {
  const router = useRouter();
  // Close on Escape, lock scroll while open
  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = orig;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Pull blurb + length straight from the lesson (intro card's hook + count) so
  // the sheet stays in lockstep with the lesson content. Falls back to a
  // generic line if the lesson isn't registered yet.
  const lesson = star.lessonId ? LESSONS_BY_ID[star.lessonId] : undefined;
  const intro = lesson?.cards.find((c) => c.type === "intro");
  const blurb = intro?.type === "intro"
    ? intro.hook
    : "Bu mavzu darslik bo'yicha keladi — yaqin orada interaktiv dars qo'shamiz.";
  const minutes = intro?.type === "intro" ? intro.estMinutes : null;

  return (
    <div className="fixed inset-0 z-50">
      {/* scrim */}
      <button
        type="button"
        aria-label="Yopish"
        onClick={onClose}
        className="absolute inset-0 bg-void-100/35 backdrop-blur-[2px]"
      />
      {/* sheet */}
      <div className="rise-in absolute inset-x-0 bottom-0 mx-auto w-full max-w-[480px] rounded-t-[28px] border border-void-500 bg-void-950 p-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-[0_-12px_48px_-12px_rgba(20,18,14,0.18)]">
        <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-void-500" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-void-300 transition hover:bg-void-700 hover:text-void-100"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-antares-700">
            {subjectLabel}
          </span>
          {minutes && (
            <span className="text-[10.5px] text-void-300">· dars {minutes} daqiqa</span>
          )}
        </div>

        <h2 className="mt-2 font-serif text-[1.75rem] font-medium leading-[1.12] tracking-[-0.018em] text-void-100">
          {star.topic}
        </h2>

        <p className="mt-3 text-[15px] leading-[1.55] text-void-200">{blurb}</p>

        <button
          type="button"
          onClick={() =>
            router.push(
              star.lessonId
                ? `/learn/lesson?topic=${star.lessonId}`
                : star.href ?? "/learn"
            )
          }
          disabled={!star.lessonId}
          className="mt-7 inline-flex h-[58px] w-full items-center justify-center rounded-full bg-antares-500 text-[1.1rem] font-semibold text-void-100 transition hover:bg-antares-300 active:scale-[0.98] disabled:opacity-40"
        >
          {star.lessonId ? "Boshlash" : "Tez orada"}
        </button>

        <p className="mt-4 text-center text-[11.5px] text-void-300">
          Yulduz yonadi — har bir dars yakunida.
        </p>
      </div>
    </div>
  );
}

/** Top-of-page pill that toggles between Matematika and Fizika constellations. */
function SubjectToggle({
  current,
  onPick,
}: {
  current: SubjectId;
  onPick: (s: SubjectId) => void;
}) {
  const subjects: SubjectId[] = ["math", "physics"];
  return (
    <div className="inline-flex rounded-full border border-void-500 bg-void-800 p-1">
      {subjects.map((s) => {
        const active = s === current;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className={
              "rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition " +
              (active
                ? "bg-antares-500 text-void-100 shadow-[0_2px_10px_-4px_rgba(232,162,26,0.5)]"
                : "text-void-300 hover:text-void-100")
            }
          >
            {SUBJECT_SKIES[s].label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The Learn home — the student's sky, in Brilliant-style tiles.
 * Subject toggle on top + unit pill + constellation + bonus card + bottom nav.
 * `?subject=physics` switches to the physics constellation.
 */
export function SkyView() {
  const router = useRouter();
  const params = useSearchParams();
  const subjectParam = params?.get("subject");
  const subjectId: SubjectId = subjectParam === "physics" ? "physics" : "math";
  const sky: SubjectSky = SUBJECT_SKIES[subjectId];

  const [done, setDone] = useState<Record<string, boolean>>({});
  const [fresh, setFresh] = useState<Record<string, boolean>>({});
  const [name, setName] = useState("");
  const [openStar, setOpenStar] = useState<SkyStar | null>(null);
  const [weakestLessonId, setWeakestLessonId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    import("@/lib/auth")
      .then(({ ensureAnonymousUser }) => ensureAnonymousUser())
      .then((uid) =>
        import("@/lib/emaktab/live").then(({ getLiveEmaktab }) =>
          getLiveEmaktab(uid ?? null)
        )
      )
      .then((live) => {
        if (alive) setWeakestLessonId(live.weakest?.lessonId ?? null);
      })
      .catch(() => { /* offline = no push */ });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const profile = loadProfile();
    const next: Record<string, boolean> = {};
    const burst: Record<string, boolean> = {};
    for (const star of sky.stars) {
      if (!star.lessonId) continue;
      try {
        if (localStorage.getItem("scorpius:done:" + star.lessonId)) next[star.id] = true;
        if (localStorage.getItem("scorpius:fresh:" + star.lessonId)) {
          burst[star.id] = true;
          localStorage.removeItem("scorpius:fresh:" + star.lessonId);
        }
      } catch {
        /* localStorage unavailable */
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is not available during SSR, so this read must run in an effect
    setName(profile?.name ?? "");
    setDone(next);
    setFresh(burst);
  }, [sky.stars]);

  const litCount = useMemo(
    () => sky.stars.filter((s) => s.state === "ignited" || done[s.id]).length,
    [sky.stars, done]
  );
  /** The current HOZIRGI lesson: the first star (in sky order) that has a
   *  lesson and isn't done yet. Everything after it is locked until it's done. */
  const currentLessonId = useMemo(() => {
    for (const s of sky.stars) {
      if (s.lessonId && !done[s.id]) return s.lessonId;
    }
    return null;
  }, [sky.stars, done]);
  const linePoints = sky.stars.map((s) => `${s.x},${s.y}`).join(" ");
  const streak = 1;

  function switchSubject(next: SubjectId) {
    if (next === subjectId) return;
    // Close any open sheet — the next constellation has different stars.
    setOpenStar(null);
    router.push(next === "math" ? "/learn" : `/learn?subject=${next}`);
  }

  return (
    <main className="relative flex min-h-dvh flex-col px-5 pb-32 pt-6">
      {/* Top row — greeting on the left · streak chip on the right */}
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-void-300">
          {name ? `Salom, ${name.split(" ")[0]}` : "Salom"}
        </span>

        <div className="inline-flex items-center gap-1.5 rounded-full border border-antares-500/30 bg-antares-50 px-3 py-1.5 text-[12px] font-semibold text-antares-700 shadow-[0_2px_10px_-4px_rgba(232,162,26,0.35)]">
          <Zap className="h-3.5 w-3.5" fill="currentColor" />
          <span className="tabular-nums">{streak}</span>
        </div>
      </div>

      {/* Subject toggle — Brilliant-style segmented pill */}
      <div className="mt-4 flex justify-center">
        <SubjectToggle current={subjectId} onPick={switchSubject} />
      </div>

      {/* The unit pill — Brilliant's "LEVEL 1 / Taking the First Steps" anchor */}
      <div className="mt-3 self-center rounded-[18px] border-[1.5px] border-antares-500/45 bg-void-800 px-5 py-3 text-center shadow-[0_2px_14px_-6px_rgba(20,18,14,0.06)]">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-antares-700">
          {sky.unitPill}
        </div>
        <div className="mt-1 font-serif text-[1.1rem] font-medium leading-tight text-void-100">
          {sky.unitTitle}
        </div>
      </div>

      <p className="mt-3 text-center text-[13px] text-void-300">
        {litCount} ta yulduz yondi · {sky.stars.length - litCount} ta kutmoqda
      </p>

      {/* The constellation — bigger tiles, clearer halos. pt gives the HOZIRGI badge room. */}
      <div className="flex flex-1 items-center justify-center pt-6">
        <div className="relative aspect-[4/5] w-full max-w-[380px]">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <polyline
              points={linePoints}
              fill="none"
              stroke="var(--color-void-400)"
              strokeWidth="0.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="1.4 2.2"
            />
          </svg>
          {sky.stars.map((star) => {
            const isDone = Boolean(done[star.id]);
            const isCurrent = star.lessonId !== undefined && star.lessonId === currentLessonId;
            // Locked: has a lesson, not done, and not the current HOZIRGI star.
            const isLocked = Boolean(star.lessonId) && !isDone && !isCurrent;
            const isTodayTask =
              star.lessonId !== undefined && star.lessonId === weakestLessonId;
            return (
              <StarTile
                key={star.id}
                star={star}
                ignited={isDone}
                locked={isLocked}
                isCurrent={isCurrent}
                isTodayTask={isTodayTask}
                fresh={Boolean(fresh[star.id])}
                onTap={isLocked ? undefined : (s) => setOpenStar(s)}
              />
            );
          })}
        </div>
      </div>

      {/* Bonus topic — off-syllabus, the "what school doesn't teach" lane */}
      <Link
        href="/learn/lesson?topic=brachistochrone"
        className="group mx-auto mt-4 block w-full max-w-[380px] rounded-[22px] border border-antares-500/40 bg-gradient-to-br from-antares-500/12 to-antares-500/5 p-4 transition-colors hover:border-antares-500/70 active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-antares-500/15 text-antares-700">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2 L13.5 9 L20 10 L13.5 11 L12 18 L10.5 11 L4 10 L10.5 9 Z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-antares-700">
                Maxsus
              </span>
              <span className="text-[10.5px] text-void-300">· dars 5 daqiqa</span>
            </div>
            <div className="mt-0.5 font-serif text-[16px] font-medium leading-tight text-void-100">
              Eng tez yo&apos;l qaysi?
            </div>
            <div className="mt-0.5 text-[12px] text-void-300">
              Maktabda o&apos;qitilmaydigan mavzu — Nyuton bir kechada hal qilgan.
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-void-300 transition-transform group-hover:translate-x-0.5" />
        </div>
      </Link>

      <BottomNav />

      {openStar && (
        <StarSheet
          star={openStar}
          subjectLabel={sky.label}
          onClose={() => setOpenStar(null)}
        />
      )}
    </main>
  );
}
