// lib/emaktab/live.ts
/**
 * "Live" emaktab adapter for the lesson player. Strategy:
 *   1. If uid present, try Firestore mirror (most-recent snapshot)
 *   2. If that fails or is empty, fall back to the bundled snapshot
 *
 * The cached fallback exists so the demo cannot break on stage. The pitch
 * claim is true live integration — and it IS live, the cron writes Firestore
 * every 6 hours. The bundled JSON is the bootstrap state for first-load + tests.
 */
import { getEmaktabSnapshot, type EmaktabSnapshot } from "@/lib/emaktab";
import { loadCloudEmaktabSnapshot } from "@/lib/cloudSync";
import { pickWeakestLesson, type WeakestPick } from "./weakest";

export interface LiveEmaktab {
  snapshot: EmaktabSnapshot;
  weakest: WeakestPick | null;
  source: "firestore-live" | "bundled-fallback";
}

export async function getLiveEmaktab(uid: string | null): Promise<LiveEmaktab> {
  if (uid) {
    const cloud = await loadCloudEmaktabSnapshot(uid);
    if (cloud) {
      return { snapshot: cloud, weakest: pickWeakestLesson(cloud), source: "firestore-live" };
    }
  }
  const snapshot = getEmaktabSnapshot();
  return { snapshot, weakest: pickWeakestLesson(snapshot), source: "bundled-fallback" };
}
