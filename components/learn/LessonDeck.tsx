"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Lesson } from "@/lib/lesson";
import { LessonCardView, cardRequiresCompletion } from "./cards";
import { MentorOverlay } from "./MentorOverlay";
import { useLessonImagePrefetch } from "./useLessonImagePrefetch";
import { LessonBusProvider } from "./useLessonBus";
import { BottomNav } from "@/components/nav/BottomNav";
import { ensureAnonymousUser } from "@/lib/auth";
import { syncCompletion } from "@/lib/cloudSync";

/**
 * The Learn-mode card deck — TikTok-style vertical paging with a Brilliant-style
 * lock: cards that require an answer (mcq, discover, sequence, sort, numberline)
 * must be completed before the next card unlocks. Locked cards are removed from
 * the DOM, so CSS scroll-snap genuinely can't reach them — the gesture stops at
 * the current card. When you answer, the next card fades in and the deck
 * auto-snaps to it after a short pause so you see the success state first.
 */
export function LessonDeck({ lesson }: { lesson: Lesson }) {
  const [active, setActive] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const refs = useRef<(HTMLElement | null)[]>([]);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  /** The highest index we've already auto-scrolled into view. */
  const lastScrolledRef = useRef<number>(0);
  const imageStates = useLessonImagePrefetch(lesson);

  /** Frontier: the highest index the user is allowed to see/reach. We walk the
   *  cards in order; the first required-but-unanswered card is the wall. */
  const unlockedThrough = useMemo(() => {
    for (let i = 0; i < lesson.cards.length; i++) {
      if (cardRequiresCompletion(lesson.cards[i].type) && !completed.has(i)) {
        return i; // include this card; everything after stays hidden
      }
    }
    return lesson.cards.length - 1;
  }, [lesson.cards, completed]);

  /** Whether the currently active card is the locked wall. */
  const activeIsLocked =
    cardRequiresCompletion(lesson.cards[active]?.type) && !completed.has(active);

  /** The current card's narration text, if this card kind carries one. */
  const activeCard = lesson.cards[active];
  const activeVoice =
    activeCard && "voice" in activeCard ? activeCard.voice : undefined;

  const markComplete = useCallback((index: number) => {
    setCompleted((prev) => {
      if (prev.has(index)) return prev;
      const next = new Set(prev);
      next.add(index);
      return next;
    });

    // Record mastery attempts for the lesson's skills. We log a `correct`
    // attempt per skill (the card is locked until correct, so any completion
    // is by definition a successful retrieval). FIRe fractional credits to
    // prereqs are handled inside recordAttempt itself.
    if (lesson.id) {
      void Promise.all([
        import("@/lib/skills"),
        import("@/lib/mastery"),
      ]).then(([{ getLessonSkills }, { recordAttempt }]) => {
        const cardType = lesson.cards[index]?.type;
        // Only graded-card completions feed mastery — explainer/intro/diagram
        // don't measure anything.
        const graded = cardType === "mcq" || cardType === "discover"
          || cardType === "sequence" || cardType === "sort"
          || cardType === "numberline" || cardType === "predict"
          || cardType === "challenge" || cardType === "pattern-discover"
          || cardType === "compare-and-decide";
        if (!graded) return;
        for (const skillId of getLessonSkills(lesson.id!)) {
          recordAttempt({ skillId, correct: true });
        }
      });
    }

    // Auto-scroll one card forward so the user advances naturally — but never
    // skip past a card they haven't seen. The new card may take a tick to
    // render (its existence depends on the frontier), so we wait.
    if (index + 1 <= lastScrolledRef.current) return;
    window.setTimeout(() => {
      const target = refs.current[index + 1];
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        lastScrolledRef.current = index + 1;
      }
    }, 750);
  }, [lesson.id, lesson.cards]);

  // Track which card is in view via IntersectionObserver — re-bind whenever the
  // rendered card set changes (newly unlocked cards need observers too).
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(Number((entry.target as HTMLElement).dataset.index));
          }
        }
      },
      { threshold: 0.6 },
    );
    for (let i = 0; i <= unlockedThrough; i++) {
      const el = refs.current[i];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [unlockedThrough]);

  // Reaching the last card completes the lesson — ignite its star in the sky.
  useEffect(() => {
    if (lesson.id && active === lesson.cards.length - 1) {
      try {
        localStorage.setItem("scorpius:done:" + lesson.id, "1");
        localStorage.setItem("scorpius:fresh:" + lesson.id, "1");
      } catch {
        // localStorage unavailable — the star simply won't persist
      }
      // Best-effort cloud mirror — same lesson id keyed under users/{uid}/completions.
      void ensureAnonymousUser().then((uid) => {
        if (uid && lesson.id) void syncCompletion(uid, lesson.id);
      });
      // Tick the streak engine — idempotent within a single local day, so
      // finishing a 2nd lesson today doesn't double-count.
      void import("@/lib/streak").then(({ recordCompletion }) => {
        recordCompletion();
      });

      // Supernova check — if this lesson completes a full constellation, queue
      // the ceremony to play on the next SkyView visit. We do this lazily
      // because LessonDeck doesn't import the sky module statically.
      void Promise.all([
        import("@/lib/sky"),
        import("@/lib/supernova"),
      ]).then(([{ SUBJECT_SKIES }, { hasSupernova, queueSupernova }]) => {
        for (const subjectId of Object.keys(SUBJECT_SKIES) as Array<keyof typeof SUBJECT_SKIES>) {
          const sky = SUBJECT_SKIES[subjectId];
          const stars = sky.stars.filter((s) => s.lessonId);
          if (stars.length === 0) continue;
          const allLit = stars.every((s) => {
            if (!s.lessonId) return false;
            try {
              return Boolean(localStorage.getItem("scorpius:done:" + s.lessonId));
            } catch {
              return false;
            }
          });
          if (!allLit) continue;
          const supernovaId = `${subjectId}-${sky.unitTitle.replace(/\s+/g, "-").toLowerCase()}`;
          if (!hasSupernova(supernovaId)) {
            queueSupernova(supernovaId);
          }
        }
      });
    }
  }, [active, lesson]);

  return (
    <LessonBusProvider>
    <div className="relative h-dvh w-full bg-void-950">
      {/* progress rail — the lesson as a small constellation (UX-DESIGN.md §3.4) */}
      <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2">
        {lesson.cards.map((_, i) => {
          const isLocked = i > unlockedThrough;
          let bg = "var(--color-void-500)";
          if (i === active) bg = "var(--color-antares-500)";
          else if (i < active) bg = "var(--color-star-bright)";
          return (
            <span
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === active ? 9 : 6,
                height: i === active ? 9 : 6,
                backgroundColor: bg,
                opacity: isLocked ? 0.25 : 1,
              }}
            />
          );
        })}
      </div>

      <div
        ref={scrollerRef}
        className="scrollbar-none h-dvh w-full snap-y snap-mandatory overflow-y-scroll overscroll-y-contain"
      >
        {lesson.cards.map((card, i) => {
          if (i > unlockedThrough) return null;
          const isActive = i === active;
          return (
            <section
              key={i}
              data-index={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              className="card-slot flex h-dvh snap-start snap-always items-center justify-center px-5 pb-28"
              style={{
                opacity: isActive ? 1 : 0.55,
                transition: "opacity 320ms ease",
              }}
            >
              <LessonCardView
                card={card}
                subjectLabel={lesson.subjectLabel}
                lessonId={lesson.id}
                onComplete={() => markComplete(i)}
                imageState={
                  card.type === "diagram" && card.prompt
                    ? imageStates.get(card.prompt)
                    : undefined
                }
              />
            </section>
          );
        })}
      </div>

      {/* Locked-state hint — sits above the bottom nav, fades in when the
          current card requires an answer and hasn't been solved yet. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex justify-center transition-opacity duration-300"
        style={{ opacity: activeIsLocked ? 1 : 0 }}
        aria-hidden={!activeIsLocked}
      >
        <div className="flex items-center gap-2 rounded-full border border-void-500 bg-void-800/85 px-4 py-2 text-[13px] font-medium text-void-200 backdrop-blur-sm">
          <span>Davom etish uchun javob bering</span>
        </div>
      </div>

      <MentorOverlay personaId={lesson.mentorId ?? "scorpius"} voiceText={activeVoice} />

      <BottomNav />
    </div>
    </LessonBusProvider>
  );
}
