"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Snowflake, Sparkles, X, Zap } from "lucide-react";
import { BottomNav } from "@/components/nav/BottomNav";
import { SUBJECT_SKIES, type SkyStar, type SubjectSky } from "@/lib/sky";
import { LESSONS_BY_ID } from "@/lib/lesson";
import { loadProfile } from "@/lib/profile";
import { hadRecentFreeze, refreshStreak, type StreakState } from "@/lib/streak";
import {
  consumePendingSupernova,
  recordSupernova,
  type Supernova,
} from "@/lib/supernova";
import { SupernovaCeremony } from "./SupernovaCeremony";
import { aggregateMastery } from "@/lib/mastery";
import { getLessonSkills } from "@/lib/skills";
import { pickNextLesson } from "@/lib/scheduler";

type SubjectId = "math" | "physics";

function StarTile({
  star,
  ignited,
  mastery,
  locked,
  isCurrent,
  isTodayTask,
  fresh,
  onTap,
}: {
  star: SkyStar;
  ignited: boolean;
  /** 0..1 composite mastery over this lesson's skills. Renders as "%" below
   *  the topic label when > 0. */
  mastery: number;
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
      {mastery > 0.02 && state !== "dormant" && (
        <span
          className={
            "mt-1 font-mono text-[10px] font-bold tabular-nums tracking-[0.06em] " +
            (mastery >= 0.95
              ? "text-signal-correct"
              : mastery >= 0.8
                ? "text-antares-700"
                : "text-void-300")
          }
        >
          {Math.round(mastery * 100)}% o&apos;rganildi
        </span>
      )}
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

/** Streak popover — the freeze/repair surface.
 *  Compact card under the streak chip; shows current/best, free freezes left
 *  this week, and recently auto-bridged days. v1 repair is a stub button. */
function StreakPopover({
  state,
  onClose,
}: {
  state: StreakState;
  onClose: () => void;
}) {
  const lastFreeze = state.recentFreezes[state.recentFreezes.length - 1];
  return (
    <>
      {/* invisible backdrop so an outside tap closes */}
      <div
        className="fixed inset-0 z-20"
        onClick={onClose}
        aria-hidden
      />
      <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-[260px] rounded-[18px] border border-void-500 bg-void-800 p-4 shadow-[0_8px_32px_-12px_rgba(20,18,14,0.18)]">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-antares-700">
            Streak holati
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-void-300 transition hover:text-void-100"
            aria-label="yopish"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <div className="font-serif text-[1.8rem] font-medium leading-none tabular-nums text-void-100">
              {state.current}
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-void-300">
              hozir
            </div>
          </div>
          <div>
            <div className="font-serif text-[1.8rem] font-medium leading-none tabular-nums text-void-100">
              {state.best}
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-void-300">
              eng yaxshi
            </div>
          </div>
        </div>
        <div className="mt-3 border-t border-void-500 pt-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-void-200">
              <Snowflake className="h-3.5 w-3.5 text-signal-info" />
              Muzlatish
            </span>
            <span className="font-mono text-[12px] tabular-nums text-void-100">
              {state.freezesAvailable} / 1 hafta
            </span>
          </div>
          {lastFreeze && (
            <p className="mt-1.5 text-[11px] leading-snug text-void-300">
              {lastFreeze} kuni avtomatik muzlatildi — streak saqlandi.
            </p>
          )}
        </div>
        <p className="mt-3 text-[11px] leading-snug text-void-300">
          Har dars yakuni kunni belgilaydi. Bir kun o&apos;tkazib yuborsangiz —
          muzlatish o&apos;z-o&apos;zidan ishga tushadi.
        </p>
      </div>
    </>
  );
}

/** Personalization receipt — the "Bugungi yulduz" card.
 *
 *  Renders the *named reason* the system picked today's lesson:
 *   - If the emaktab snapshot found a low diary mark → show that reason
 *     ("Kecha maktabda 3 olding — Paskal qonunini birga ko'rib chiqaylik.")
 *   - Else if the profile carries an interest → show that flavor hint
 *     ("Sen Real Madrid'ni yoqtirasan — bu darsda misol Real misolida.")
 *   - Else a neutral progress nudge that still feels named.
 *
 *  The point is that the user sees, in plain Uzbek, *why this lesson, why
 *  now*. Personalization stops being a backend belief and becomes a UI
 *  receipt with a sentence the user can falsify. */
function BugungiYulduzCard({
  lessonId,
  weakestLessonId,
  weakestReason,
  schedulerReason,
}: {
  lessonId: string;
  weakestLessonId: string | null;
  weakestReason: string | null;
  /** Scheduler-derived reason — used when no emaktab signal applies. */
  schedulerReason: string | null;
}) {
  const lesson = LESSONS_BY_ID[lessonId];
  // localStorage-derived flavor lives in state populated after mount to keep
  // SSR markup and first-client-paint identical (otherwise React warns about a
  // hydration mismatch when the captured-interest line appears only on client).
  const [flavor, setFlavor] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("scorpius:profile");
      if (!raw) return;
      const profile = JSON.parse(raw) as {
        subInterests?: Record<string, string>;
        interests?: string[];
      };
      const sub = Object.values(profile.subInterests ?? {})[0];
      const top = profile.interests?.[0];
      const tag = sub ?? top;
      if (!tag) return;
      setFlavor(`Sen ${tag}'ni yoqtirasan — bugungi darsda misollar shu yo'nalishda.`);
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  if (!lesson) return null;

  // Prefer the real emaktab-driven reason when it matches today's HOZIRGI.
  // If they disagree (emaktab pick is different from the constellation's next
  // un-done star), still show the emaktab reason — but reroute the CTA.
  const useEmaktab = !!weakestReason && weakestLessonId === lessonId;

  // Priority: emaktab diary signal > scheduler bucket > captured-interest flavor > generic.
  const reason =
    (useEmaktab ? weakestReason : null) ??
    schedulerReason ??
    flavor ??
    `Avvalgi darsing yakunlandi — ${lesson.title.toLowerCase()} keyingi bosqich.`;

  return (
    <Link
      href={`/learn/lesson?topic=${lessonId}`}
      className="group mx-auto mt-4 block w-full max-w-[380px] rounded-[22px] border border-antares-500/45 bg-gradient-to-br from-antares-500/12 to-antares-500/4 p-4 transition-all hover:border-antares-500/75 active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-antares-700">
          Bugungi yulduz
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-void-300">
          {lesson.subjectLabel}
        </span>
      </div>
      <h3
        className="mt-2 text-[1.05rem] font-medium leading-tight text-void-100"
        style={{ fontFamily: '"Newsreader", Georgia, serif' }}
      >
        {lesson.title}
      </h3>
      <p className="mt-1.5 text-[13px] leading-snug text-void-200">{reason}</p>
      <div className="mt-2.5 flex items-center justify-end gap-1 text-[12px] font-semibold text-antares-700">
        <span>Boshlash</span>
        <ChevronRight className="h-3.5 w-3.5" />
      </div>
    </Link>
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
  const [weakestReason, setWeakestReason] = useState<string | null>(null);
  const [streakState, setStreakState] = useState<StreakState | null>(null);
  const [showStreakPopover, setShowStreakPopover] = useState(false);
  const [recentFreeze, setRecentFreeze] = useState(false);
  const [supernova, setSupernova] = useState<Supernova | null>(null);
  /** Per-star aggregate mastery (0..1). Rehydrates on mount + any time the
   *  `done` map changes (a lesson completion updates mastery). */
  const [masteryByStar, setMasteryByStar] = useState<Record<string, number>>({});

  // Refresh the streak engine on mount — applies any due auto-freezes and
  // returns the count to render. Runs client-only (localStorage gate).
  useEffect(() => {
    setStreakState(refreshStreak());
    setRecentFreeze(hadRecentFreeze());
  }, []);

  // Compute mastery per star whenever the visible constellation or the
  // `done` map changes (the done map ticks on every lesson completion).
  useEffect(() => {
    const next: Record<string, number> = {};
    for (const star of sky.stars) {
      if (!star.lessonId) continue;
      const skills = getLessonSkills(star.lessonId);
      if (skills.length === 0) continue;
      next[star.id] = aggregateMastery(skills);
    }
    setMasteryByStar(next);
  }, [sky.stars, done]);

  // On mount, check if a Supernova ceremony was queued by the lesson that
  // just completed. If so, persist the supernova and fire the cinematic.
  // Also supports a `?supernova=demo` query for testing + on-stage demos.
  useEffect(() => {
    const pending =
      params?.get("supernova") === "demo" ? "demo-preview" : consumePendingSupernova();
    if (!pending) return;
    const profile = loadProfile();
    const firstName = (profile?.name ?? "").split(" ")[0] || "Sizning";
    // Parse the supernova's own subject (math/physics) out of its id —
    // separate variable from the page-level `subjectId` so the math/physics
    // constellation toggle doesn't accidentally relabel an in-flight ceremony.
    const [supernovaSubject] = pending.split("-");
    if (pending === "demo-preview") {
      setSupernova({
        id: pending,
        subjectId: "physics",
        name: `${firstName}'ning supernovasi`,
        whenLabel: `2026-yil iyun`,
        ts: Date.now(),
      });
      return;
    }
    const sn = recordSupernova({ id: pending, subjectId: supernovaSubject, firstName });
    if (sn) setSupernova(sn);
  }, [params]);

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
        if (!alive) return;
        setWeakestLessonId(live.weakest?.lessonId ?? null);
        setWeakestReason(live.weakest?.reasonUz ?? null);
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

  /** Scheduler-picked "best next lesson" — used by the Bugungi yulduz card
   *  for its reason line. Independent from currentLessonId (which gates the
   *  constellation): the scheduler may say "review broun" even when the next
   *  un-done star is paskal. We only override the BugungiYulduzCard target
   *  when the scheduler returns a non-fallback bucket. */
  const schedulerPick = useMemo(() => {
    // Recompute when the done map changes (a completion ticks mastery).
    void done;
    const unlocked = sky.stars
      .filter((s) => s.lessonId)
      .map((s) => s.lessonId as string);
    return pickNextLesson(unlocked);
  }, [sky.stars, done]);
  const linePoints = sky.stars.map((s) => `${s.x},${s.y}`).join(" ");
  /** Constellation-wide average mastery — recomputed when masteryByStar changes. */
  const constellationMastery = useMemo(() => {
    const vals = Object.values(masteryByStar);
    if (vals.length === 0) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [masteryByStar]);
  const streak = streakState?.current ?? 0;

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

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowStreakPopover((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-antares-500/30 bg-antares-50 px-3 py-1.5 text-[12px] font-semibold text-antares-700 shadow-[0_2px_10px_-4px_rgba(232,162,26,0.35)] transition active:scale-[0.96]"
            aria-label="Streak holatini ko'rish"
          >
            <Zap className="h-3.5 w-3.5" fill="currentColor" />
            <span className="tabular-nums">{streak}</span>
            {recentFreeze && (
              <Snowflake
                className="ml-0.5 h-3 w-3 text-signal-info"
                aria-label="muzlatildi"
              />
            )}
          </button>
          {showStreakPopover && streakState && (
            <StreakPopover state={streakState} onClose={() => setShowStreakPopover(false)} />
          )}
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
        {constellationMastery > 0.02 && (
          <>
            {" "}
            ·{" "}
            <span className="font-mono font-semibold tabular-nums text-antares-700">
              {Math.round(constellationMastery * 100)}%
            </span>{" "}
            o&apos;rganildi
          </>
        )}
      </p>

      {/* Personal Zij link — appears once the student has any mastery to show. */}
      {constellationMastery > 0.02 && (
        <Link
          href="/osmonim/zij"
          className="mx-auto mt-2 inline-flex items-center gap-1.5 self-center rounded-full border border-void-500 bg-void-800 px-3.5 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-antares-700 transition hover:border-antares-500/55 active:scale-[0.97]"
        >
          Shaxsiy zij <ChevronRight className="h-3 w-3" />
        </Link>
      )}

      {/* Bugungi yulduz — personalization receipt. Renders the real reason
       *  from the emaktab live snapshot (Phase 0.1 weakest.ts). If no diary
       *  mark triggered a pick, falls back to the captured interest if any. */}
      {currentLessonId && (
        <BugungiYulduzCard
          lessonId={currentLessonId}
          schedulerReason={schedulerPick?.reasonUz ?? null}
          weakestLessonId={weakestLessonId}
          weakestReason={weakestReason}
        />
      )}

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
            const mastery = masteryByStar[star.id] ?? 0;
            return (
              <StarTile
                key={star.id}
                star={star}
                ignited={isDone}
                mastery={mastery}
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

      {/* Supernova ceremony — fires once per constellation, queued by LessonDeck
       *  when the last star was lit on the previous page. Tap-anywhere dismisses
       *  after the name beat. */}
      {supernova && (
        <SupernovaCeremony
          supernova={supernova}
          onDismiss={() => setSupernova(null)}
        />
      )}
    </main>
  );
}
