"use client";

import { useEffect, useState } from "react";
import type { Lesson } from "@/lib/lesson";

export type ImageStatus = "idle" | "loading" | "ready" | "error";
export interface ImageState {
  status: ImageStatus;
  src?: string;
}

const CONCURRENCY = 3;

/**
 * Prefetches every `diagram` card's image for a lesson in parallel (cap 3).
 * Returns a Map keyed by the card's prompt string. Cards that already have
 * `src` (pre-baked path) are seeded as ready with no fetch. Cards without
 * `src` go to the network — POST /api/generate-image, Firestore-cached.
 *
 * Mounted at the deck level, BEFORE the lock-gate logic decides which cards
 * to render — so prefetch starts the moment the lesson page mounts, even for
 * cards the student hasn't unlocked yet. Unmounting aborts in-flight fetches.
 *
 * Spec: docs/superpowers/specs/2026-05-24-lesson-image-prefetch-and-quality-design.md §5
 */
export function useLessonImagePrefetch(lesson: Lesson): Map<string, ImageState> {
  const [states, setStates] = useState<Map<string, ImageState>>(() => {
    const initial = new Map<string, ImageState>();
    for (const card of lesson.cards) {
      if (card.type !== "diagram" || !card.prompt) continue;
      initial.set(
        card.prompt,
        card.src ? { status: "ready", src: card.src } : { status: "loading" },
      );
    }
    return initial;
  });

  useEffect(() => {
    const ac = new AbortController();
    const promptsToFetch: string[] = [];
    let prebakedCount = 0;

    for (const card of lesson.cards) {
      if (card.type !== "diagram" || !card.prompt) continue;
      if (card.src) {
        prebakedCount++;
        continue;
      }
      promptsToFetch.push(card.prompt);
    }

    if (promptsToFetch.length === 0) {
      console.info(
        `[scorpius] image prefetch: ${prebakedCount} cards, all pre-baked, nothing to fetch`,
      );
      return () => ac.abort();
    }

    console.info(
      `[scorpius] image prefetch: ${prebakedCount + promptsToFetch.length} cards, ${prebakedCount} pre-baked, ${promptsToFetch.length} fetching`,
    );
    const t0 = Date.now();
    let okCount = 0;
    let failCount = 0;

    async function fetchOne(prompt: string): Promise<void> {
      try {
        const r = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
          signal: ac.signal,
        });
        const data = (await r.json().catch(() => ({}))) as { src?: string; error?: string };
        if (ac.signal.aborted) return;
        if (r.ok && data.src) {
          setStates((prev) => {
            const next = new Map(prev);
            next.set(prompt, { status: "ready", src: data.src });
            return next;
          });
          okCount++;
        } else {
          setStates((prev) => {
            const next = new Map(prev);
            next.set(prompt, { status: "error" });
            return next;
          });
          failCount++;
        }
      } catch (err) {
        if (ac.signal.aborted) return;
        setStates((prev) => {
          const next = new Map(prev);
          next.set(prompt, { status: "error" });
          return next;
        });
        failCount++;
      }
    }

    (async () => {
      const queue = [...promptsToFetch];
      const running = new Set<Promise<void>>();
      while (queue.length || running.size) {
        while (running.size < CONCURRENCY && queue.length) {
          const prompt = queue.shift()!;
          const p = fetchOne(prompt);
          const tracked = p.finally(() => running.delete(tracked));
          running.add(tracked);
        }
        if (running.size) await Promise.race(running);
      }
      if (!ac.signal.aborted) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        console.info(
          `[scorpius] image prefetch: complete · ${elapsed}s · ${okCount}/${okCount + failCount} ok`,
        );
      }
    })();

    return () => ac.abort();
  }, [lesson]);

  return states;
}
