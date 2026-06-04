"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { ensureAnonymousUser } from "@/lib/auth";
import type { StudentProfile } from "@/lib/profile";
import { LESSONS_BY_ID, type Lesson } from "@/lib/lesson";

/** A live snapshot of the parent's view of their child — pulled from Firestore
 *  on the client. Fields the cloud doesn't know about yet (emaktab grades,
 *  mastery percentage) are intentionally absent here; the dashboard renders
 *  honest empty states for them rather than mock numbers. */
export interface LiveParentSnapshot {
  childName: string;
  grade?: number;
  painPoint?: string;
  subInterests?: Record<string, string>;
  weekLessonCount: number;
  completedLessons: { lesson: Lesson; completedAt?: Date }[];
  lastLesson?: { lesson: Lesson; completedAt?: Date };
}

interface CompletionDoc {
  completedAt?: Timestamp;
}

export type ParentDataState =
  | { status: "loading" }
  | { status: "anonymous-only" } // signed in but no profile saved yet
  | { status: "ready"; data: LiveParentSnapshot };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function useParentSnapshot(): ParentDataState {
  const [state, setState] = useState<ParentDataState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    (async () => {
      const uid = await ensureAnonymousUser();
      if (!alive) return;
      if (!uid || !db) {
        // No signed-in user, or Firebase isn't configured (db === null) —
        // there's no cloud data to read. Degrade to the honest empty state.
        setState({ status: "anonymous-only" });
        return;
      }
      try {
        const [profileSnap, completionsSnap] = await Promise.all([
          getDoc(doc(db, "users", uid)),
          getDocs(collection(db, "users", uid, "completions")),
        ]);
        if (!alive) return;

        const profile: StudentProfile | null =
          (profileSnap.exists() && (profileSnap.data().profile as StudentProfile | undefined)) ||
          null;

        const now = Date.now();
        const items: { lesson: Lesson; completedAt?: Date }[] = [];
        completionsSnap.forEach((d) => {
          const lesson = LESSONS_BY_ID[d.id];
          if (!lesson) return; // unknown lesson id — skip
          const completion = d.data() as CompletionDoc;
          const completedAt = completion.completedAt?.toDate();
          items.push({ lesson, completedAt });
        });

        // Most recent first
        items.sort((a, b) => {
          const at = a.completedAt?.getTime() ?? 0;
          const bt = b.completedAt?.getTime() ?? 0;
          return bt - at;
        });

        const weekLessonCount = items.filter(
          (i) => i.completedAt && now - i.completedAt.getTime() < WEEK_MS,
        ).length;

        if (!profile && items.length === 0) {
          setState({ status: "anonymous-only" });
          return;
        }

        setState({
          status: "ready",
          data: {
            childName: profile?.name ?? "Mehmon",
            grade: profile?.grade,
            painPoint: profile?.painPoint,
            subInterests: profile?.subInterests,
            weekLessonCount,
            completedLessons: items,
            lastLesson: items[0],
          },
        });
      } catch (err) {
        console.warn("[parentData] fetch failed:", (err as { code?: string })?.code ?? err);
        setState({ status: "anonymous-only" });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
