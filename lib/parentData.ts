"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { ensureAnonymousUser } from "@/lib/auth";
import type { StudentProfile } from "@/lib/profile";
import { LESSONS_BY_ID, type Lesson } from "@/lib/lesson";
import { getLiveEmaktab } from "@/lib/emaktab/live";
import type { EmaktabSnapshot } from "@/lib/emaktab";

/** A live snapshot of the parent's view of their child — pulled from
 *  Firestore (Scorpius completions + emaktab grade mirror) on the client.
 *  Numbers here are computed once on load; the dashboard is read-only. */
export interface LiveParentSnapshot {
  childName: string;
  grade?: number;
  className?: string | null;
  school?: string | null;
  painPoint?: string;
  subInterests?: Record<string, string>;
  weekLessonCount: number;
  completedLessons: { lesson: Lesson; completedAt?: Date }[];
  lastLesson?: { lesson: Lesson; completedAt?: Date };
  /** Live emaktab aggregates — null when no snapshot is available. */
  emaktab: EmaktabAggregates | null;
  /** Where the emaktab snapshot came from — surfaced as a footnote so the
   *  parent knows whether they're looking at this-week's data or the bundled
   *  fallback. */
  emaktabSource: "firestore-live" | "bundled-fallback" | null;
  /** True when the emaktab snapshot's meta.source begins with "demo" —
   *  the connect flow filled in generated data when emaktab returned empty
   *  (summer break / new year). Dashboard surfaces this honestly. */
  emaktabIsDemo: boolean;
}

/** Pre-computed numbers the dashboard needs. Computed once when the snapshot
 *  loads — the components never run aggregations of their own. */
export interface EmaktabAggregates {
  /** Average across every numeric mark in the whole snapshot. */
  overallAverage: number | null;
  /** How many numeric marks went into `overallAverage`. */
  overallSampleSize: number;
  /** Per-subject summary — sorted by average ASC so the weakest comes first. */
  subjects: SubjectSummary[];
  /** Up to 8 most-recent marks, newest first. */
  recentMarks: RecentMark[];
  /** Weekly average over the last 8 ISO weeks (oldest → newest). null = no
   *  marks that week. Used by the area chart. */
  weeklyTrend: WeeklyPoint[];
  /** Homework counts for the rolling 7 days. */
  homework: { done: number; notDone: number };
  /** Up to 3 weakest subjects (lowest average) — the "needs attention" callout. */
  weakest: SubjectSummary[];
  /** Up to 3 strongest subjects (highest average) — the "doing well" callout. */
  strongest: SubjectSummary[];
}

export interface SubjectSummary {
  subjectId: string;
  /** Display name shown in tables — pre-normalized by lib/emaktab. */
  subject: string;
  /** Last reported quarter or final average — string from emaktab; e.g. "4.3". */
  reportedAverage: string | null;
  /** Computed average across every numeric mark we have for this subject. */
  computedAverage: number | null;
  /** Count of numeric marks. */
  count: number;
  /** Final mark for the subject if emaktab has annotated one. */
  finalMark: string | null;
  /** Up to last 6 numeric marks for the mini sparkline. Newest last. */
  recentMarks: number[];
  /** Trend — positive if recent marks beat older marks. */
  trend: "up" | "flat" | "down" | "unknown";
}

export interface RecentMark {
  subject: string;
  subjectId: string;
  value: number;
  /** Raw label (e.g. "JUM, 22 may") or empty. */
  date: string | null;
  /** ISO date if available. */
  iso: string | null;
}

export interface WeeklyPoint {
  /** Inclusive week label "26 may–01 iyun" — short, Uzbek-Latin. */
  label: string;
  /** Average mark this week or null if no marks. */
  avg: number | null;
  /** Total marks counted this week. */
  count: number;
}

interface CompletionDoc {
  completedAt?: Timestamp;
}

export type ParentDataState =
  | { status: "loading" }
  | { status: "anonymous-only" }
  | { status: "ready"; data: LiveParentSnapshot };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// ---- Aggregators ----------------------------------------------------------

const UZ_MONTHS = [
  "yan", "fev", "mar", "apr", "may", "iyun",
  "iyul", "avg", "sent", "okt", "noy", "dek",
];

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${UZ_MONTHS[d.getMonth()]}`;
}

function weekLabel(weekStartIso: string, weekEndIso: string): string {
  return `${shortDate(weekStartIso)}–${shortDate(weekEndIso)}`;
}

function parseMark(value: string): number | null {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 5) return null; // Scorpius assumes a 1-5 scale
  return n;
}

/** Build aggregates from a fresh emaktab snapshot. Pure function; safe to memo. */
function aggregate(snap: EmaktabSnapshot): EmaktabAggregates {
  // Walk every mark in (a) the grades panel and (b) the diary so we capture
  // marks that aren't yet rolled up into the quarter view. Dedupe by
  // (subjectId, value, iso, lessonNo).
  type CollectedMark = {
    subjectId: string;
    subject: string;
    value: number;
    iso: string | null;
    rawDate: string | null;
  };
  const seen = new Set<string>();
  const collected: CollectedMark[] = [];

  for (const period of snap.grades) {
    for (const subj of period.subjects) {
      for (const m of subj.marks) {
        const v = parseMark(m.value);
        if (v === null) continue;
        const key = `${subj.subjectId}|${m.value}|${m.date ?? ""}|${m.lessonNo ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push({
          subjectId: subj.subjectId,
          subject: subj.subject,
          value: v,
          iso: null,
          rawDate: m.date,
        });
      }
    }
  }
  for (const day of snap.diary) {
    for (const lesson of day.lessons) {
      for (const m of lesson.marks) {
        const v = parseMark(m.value);
        if (v === null) continue;
        const key = `${lesson.subjectId}|${m.value}|${day.iso}|${lesson.lessonNo ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push({
          subjectId: lesson.subjectId,
          subject: lesson.subject,
          value: v,
          iso: day.iso,
          rawDate: day.date,
        });
      }
    }
  }

  // Overall average across every numeric mark.
  const all = collected.map((c) => c.value);
  const overallAverage = all.length === 0 ? null : avg(all);

  // Per-subject summaries.
  const bySubject = new Map<string, CollectedMark[]>();
  for (const c of collected) {
    const list = bySubject.get(c.subjectId);
    if (list) list.push(c);
    else bySubject.set(c.subjectId, [c]);
  }
  // Latest per-subject metadata (final mark, reported average) — pulled from
  // the most recent period block that mentions the subject.
  const subjectMeta = new Map<string, { subject: string; reportedAverage: string | null; finalMark: string | null }>();
  for (const period of snap.grades) {
    for (const subj of period.subjects) {
      // Prefer the year-summary period ("xulosa") if present; otherwise keep first seen.
      if (!subjectMeta.has(subj.subjectId) || period.period.toLowerCase() === "xulosa") {
        subjectMeta.set(subj.subjectId, {
          subject: subj.subject,
          reportedAverage: subj.average,
          finalMark: subj.finalMark,
        });
      }
    }
  }

  const subjects: SubjectSummary[] = Array.from(bySubject.entries()).map(
    ([subjectId, marks]) => {
      // Sort marks by iso ascending; if no iso, keep insertion order at the
      // top (likely grade-panel marks without date metadata).
      const sorted = [...marks].sort((a, b) => (a.iso ?? "").localeCompare(b.iso ?? ""));
      const values = sorted.map((m) => m.value);
      const recent = values.slice(-6);
      // Trend — compare the average of the last 3 vs the previous 3.
      let trend: SubjectSummary["trend"] = "unknown";
      if (recent.length >= 4) {
        const half = Math.floor(recent.length / 2);
        const older = avg(recent.slice(0, half));
        const newer = avg(recent.slice(half));
        const delta = newer - older;
        if (Math.abs(delta) < 0.15) trend = "flat";
        else trend = delta > 0 ? "up" : "down";
      }
      const meta = subjectMeta.get(subjectId);
      return {
        subjectId,
        subject: meta?.subject ?? marks[0]?.subject ?? subjectId,
        reportedAverage: meta?.reportedAverage ?? null,
        computedAverage: values.length > 0 ? avg(values) : null,
        count: values.length,
        finalMark: meta?.finalMark ?? null,
        recentMarks: recent,
        trend,
      };
    },
  );
  // Sort: ASC by computed average so the weakest comes first.
  subjects.sort((a, b) => (a.computedAverage ?? 99) - (b.computedAverage ?? 99));

  // Recent marks list — global, newest first. Only marks that carry an iso
  // get sorted reliably; the rest go to the back.
  const recentMarks: RecentMark[] = collected
    .filter((c) => c.iso)
    .sort((a, b) => (b.iso ?? "").localeCompare(a.iso ?? ""))
    .slice(0, 8)
    .map((c) => ({
      subject: c.subject,
      subjectId: c.subjectId,
      value: c.value,
      date: c.rawDate,
      iso: c.iso,
    }));

  // Weekly trend — last 8 weeks bucketed by ISO date.
  const weeklyTrend = buildWeeklyTrend(collected);

  // Homework: rolling 7 days from the latest diary date.
  const homework = countHomework(snap);

  return {
    overallAverage,
    overallSampleSize: all.length,
    subjects,
    recentMarks,
    weeklyTrend,
    homework,
    weakest: subjects.filter((s) => s.computedAverage !== null).slice(0, 3),
    strongest: [...subjects].reverse().filter((s) => s.computedAverage !== null).slice(0, 3),
  };
}

function avg(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function buildWeeklyTrend(
  collected: { value: number; iso: string | null }[],
): WeeklyPoint[] {
  // Pivot anchor — the most recent ISO date we have, or today.
  const isoDates = collected
    .map((c) => c.iso)
    .filter((s): s is string => Boolean(s))
    .sort();
  const latest = isoDates.length > 0 ? new Date(`${isoDates[isoDates.length - 1]}T00:00:00`) : new Date();
  // Snap to that week's Monday.
  const anchor = startOfIsoWeek(latest);

  // Build 8 weeks ending at anchor.
  const weeks: { start: Date; end: Date }[] = [];
  for (let i = 7; i >= 0; i--) {
    const start = new Date(anchor);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    weeks.push({ start, end });
  }

  // Bucket each mark into the right week.
  const buckets = weeks.map(() => [] as number[]);
  for (const c of collected) {
    if (!c.iso) continue;
    const d = new Date(`${c.iso}T00:00:00`);
    if (isNaN(d.getTime())) continue;
    for (let i = 0; i < weeks.length; i++) {
      const w = weeks[i];
      if (d >= w.start && d <= w.end) {
        buckets[i].push(c.value);
        break;
      }
    }
  }

  return weeks.map((w, i) => ({
    label: weekLabel(localIso(w.start), localIso(w.end)),
    avg: buckets[i].length === 0 ? null : avg(buckets[i]),
    count: buckets[i].length,
  }));
}

function localIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function startOfIsoWeek(d: Date): Date {
  const out = new Date(d);
  const day = out.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  // ISO week starts Monday; if Sunday (0), go back 6; else go back day-1.
  const back = day === 0 ? 6 : day - 1;
  out.setDate(out.getDate() - back);
  out.setHours(0, 0, 0, 0);
  return out;
}

function countHomework(snap: EmaktabSnapshot): { done: number; notDone: number } {
  let done = 0;
  let notDone = 0;
  const isoDates = snap.diary
    .map((d) => d.iso)
    .filter((s): s is string => Boolean(s))
    .sort();
  if (isoDates.length === 0) return { done: 0, notDone: 0 };
  const latest = new Date(`${isoDates[isoDates.length - 1]}T00:00:00`);
  const cutoff = new Date(latest);
  cutoff.setDate(cutoff.getDate() - 7);
  for (const day of snap.diary) {
    if (!day.iso) continue;
    const d = new Date(`${day.iso}T00:00:00`);
    if (d < cutoff) continue;
    for (const lesson of day.lessons) {
      if (!lesson.homework) continue;
      if (lesson.homeworkDone) done++;
      else notDone++;
    }
  }
  return { done, notDone };
}

// ---- Hook ----------------------------------------------------------------

export function useParentSnapshot(): ParentDataState {
  const [state, setState] = useState<ParentDataState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    // GUARANTEED-EXIT WATCHDOG: under no circumstance let the dashboard stay
    // on "loading" past 8 seconds. If anything below — Firebase init, anon
    // sign-in, Firestore read, the bundled-snapshot import — hangs or throws
    // in a way the inner code doesn't catch, this fires and forces the
    // anonymous-only state. The parent then sees the connect CTA instead of
    // an infinite spinner.
    const hardCutover = window.setTimeout(() => {
      if (!alive) return;
      console.warn("[parentData] watchdog fired — forcing anonymous-only after 8s");
      setState({ status: "anonymous-only" });
    }, 8000);

    (async () => {
      // Auth is best-effort. If Firebase isn't configured (local headless
      // testing, no NEXT_PUBLIC_FIREBASE_* env vars) we still want the bundled
      // emaktab snapshot to render so the parent sees something real. Race
      // against a 3s timeout so a stalled Firebase Auth doesn't pin the page
      // on the loading spinner forever.
      const uid = await Promise.race<string | null>([
        ensureAnonymousUser().catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
      ]);
      if (!alive) return;
      try {
        // When uid is missing we skip Firestore and load the bundled-fallback
        // snapshot only. getLiveEmaktab(null) is safe — it returns the local
        // JSON without touching Firestore.
        //
        // Every async read is wrapped in its OWN timeout so a single slow
        // Firestore request can't pin the page on the loading spinner. The
        // bundled emaktab snapshot is the safe fallback in all three slots.
        const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
          Promise.race<T>([
            p,
            new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
          ]);

        const profilePromise = uid
          ? withTimeout(getDoc(doc(db, "users", uid)).catch(() => null), 4500, null)
          : Promise.resolve(null);
        const completionsPromise = uid
          ? withTimeout(
              getDocs(collection(db, "users", uid, "completions")).catch(() => null),
              4500,
              null,
            )
          : Promise.resolve(null);
        const livePromise = withTimeout(
          getLiveEmaktab(uid).catch(() => null),
          5500,
          null,
        );

        const [profileSnap, completionsSnap, liveOrNull] = await Promise.all([
          profilePromise,
          completionsPromise,
          livePromise,
        ]);
        if (!alive) return;
        // Always have a snapshot to render — if the cloud + bundled paths both
        // failed, fall back to the empty stub so the dashboard at least mounts
        // and surfaces the connect CTA.
        const live = liveOrNull ?? {
          snapshot: {
            profile: {
              name: "",
              className: null,
              school: null,
              grade: null,
              academicYear: null,
              emaktab: { schoolId: null, personId: null, groupId: null },
            },
            grades: [],
            diary: [],
            homework: [],
            meta: { source: "unavailable", pulledAt: new Date().toISOString(), notes: [] },
          } as unknown as Awaited<ReturnType<typeof getLiveEmaktab>>["snapshot"],
          weakest: null,
          source: "bundled-fallback" as const,
        };

        const profile: StudentProfile | null =
          (profileSnap?.exists() && (profileSnap.data().profile as StudentProfile | undefined)) ||
          null;

        const now = Date.now();
        const items: { lesson: Lesson; completedAt?: Date }[] = [];
        completionsSnap?.forEach((d) => {
          const lesson = LESSONS_BY_ID[d.id];
          if (!lesson) return;
          const completion = d.data() as CompletionDoc;
          const completedAt = completion.completedAt?.toDate();
          items.push({ lesson, completedAt });
        });
        items.sort((a, b) => {
          const at = a.completedAt?.getTime() ?? 0;
          const bt = b.completedAt?.getTime() ?? 0;
          return bt - at;
        });
        const weekLessonCount = items.filter(
          (i) => i.completedAt && now - i.completedAt.getTime() < WEEK_MS,
        ).length;

        const emaktabAggregates = aggregate(live.snapshot);
        // If the bundled-fallback snapshot is the stub `data/emaktab-export.json`
        // (no profile name, no marks), don't show grades — that means no live data.
        const hasRealEmaktab =
          live.snapshot.profile.name?.length > 0 || emaktabAggregates.overallSampleSize > 0;
        const emaktabIsDemo =
          hasRealEmaktab && typeof live.snapshot.meta?.source === "string"
            ? live.snapshot.meta.source.toLowerCase().startsWith("demo")
            : false;

        if (!profile && items.length === 0 && !hasRealEmaktab) {
          setState({ status: "anonymous-only" });
          return;
        }

        setState({
          status: "ready",
          data: {
            childName: profile?.name ?? live.snapshot.profile.name ?? "Mehmon",
            grade: profile?.grade ?? live.snapshot.profile.grade ?? undefined,
            className: live.snapshot.profile.className,
            school: live.snapshot.profile.school,
            painPoint: profile?.painPoint,
            subInterests: profile?.subInterests,
            weekLessonCount,
            completedLessons: items,
            lastLesson: items[0],
            emaktab: hasRealEmaktab ? emaktabAggregates : null,
            emaktabSource: hasRealEmaktab ? live.source : null,
            emaktabIsDemo,
          },
        });
      } catch (err) {
        console.warn("[parentData] fetch failed:", (err as { code?: string })?.code ?? err);
        setState({ status: "anonymous-only" });
      } finally {
        // Whether we resolved successfully, hit the catch, or returned early,
        // the watchdog is no longer needed.
        window.clearTimeout(hardCutover);
      }
    })();
    return () => {
      alive = false;
      window.clearTimeout(hardCutover);
    };
  }, []);

  return state;
}
