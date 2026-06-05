"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { StudentProfile } from "@/lib/profile";
import type { EmaktabSnapshot } from "@/lib/emaktab";

/**
 * Firestore mirror of the localStorage state. Everything here is best-effort —
 * Firestore is a durable upgrade on top of localStorage, not a replacement.
 * If a write fails (offline, rules block, project misconfigured), we log and
 * move on. The student experience never breaks.
 *
 * Document layout (per signed-in anonymous user):
 *   users/{uid}                                       — profile + last-active timestamp
 *   users/{uid}/completions/{lessonId}                — one doc per finished lesson
 *   users/{uid}/humos/{personaId}                     — chat metadata per persona
 *   users/{uid}/humos/{personaId}/messages/{auto-id}  — one doc per chat message
 */

export async function syncProfile(
  uid: string,
  profile: StudentProfile,
): Promise<void> {
  try {
    await setDoc(
      doc(db, "users", uid),
      { profile, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (err) {
    console.warn("[cloudSync] syncProfile failed:", (err as { code?: string })?.code ?? err);
  }
}

export async function loadCloudProfile(
  uid: string,
): Promise<StudentProfile | null> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return (data?.profile as StudentProfile | undefined) ?? null;
  } catch (err) {
    console.warn("[cloudSync] loadCloudProfile failed:", (err as { code?: string })?.code ?? err);
    return null;
  }
}

export async function syncCompletion(
  uid: string,
  lessonId: string,
): Promise<void> {
  try {
    await setDoc(
      doc(db, "users", uid, "completions", lessonId),
      { completedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (err) {
    console.warn("[cloudSync] syncCompletion failed:", (err as { code?: string })?.code ?? err);
  }
}

export async function loadCloudCompletions(
  uid: string,
): Promise<Record<string, boolean>> {
  try {
    const snap = await getDocs(collection(db, "users", uid, "completions"));
    const out: Record<string, boolean> = {};
    snap.forEach((d) => {
      out[d.id] = true;
    });
    return out;
  } catch (err) {
    console.warn("[cloudSync] loadCloudCompletions failed:", (err as { code?: string })?.code ?? err);
    return {};
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Humo AI chat sync — best-effort mirror so a returning visitor sees their
// prior conversations land instantly (still served from localStorage; cloud
// is the catch-up if localStorage was nuked or the student switched device).
// ───────────────────────────────────────────────────────────────────────────

export interface HumoChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Append one chat message to users/{uid}/humos/{personaId}/messages and
 *  bump the parent doc's lastActive timestamp. Fire-and-forget. */
export async function syncHumoMessage(
  uid: string,
  personaId: string,
  message: HumoChatMessage,
): Promise<void> {
  try {
    const parent = doc(db, "users", uid, "humos", personaId);
    // Auto-id doc inside messages subcollection
    const msgRef = doc(collection(parent, "messages"));
    await setDoc(msgRef, {
      role: message.role,
      content: message.content,
      ts: serverTimestamp(),
    });
    await setDoc(parent, { lastActive: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.warn("[cloudSync] syncHumoMessage failed:", (err as { code?: string })?.code ?? err);
  }
}

/** Load the last N messages for a persona, oldest-first.
 *  Used on chat-mount to hydrate when localStorage is empty. */
export async function loadHumoChat(
  uid: string,
  personaId: string,
  limit = 40,
): Promise<HumoChatMessage[]> {
  try {
    const ref = collection(db, "users", uid, "humos", personaId, "messages");
    const snap = await getDocs(query(ref, orderBy("ts", "asc")));
    const out: HumoChatMessage[] = [];
    snap.forEach((d) => {
      const data = d.data() as { role?: "user" | "assistant"; content?: string; ts?: Timestamp };
      if (data.role && typeof data.content === "string") {
        out.push({ role: data.role, content: data.content });
      }
    });
    return out.slice(-limit);
  } catch (err) {
    console.warn("[cloudSync] loadHumoChat failed:", (err as { code?: string })?.code ?? err);
    return [];
  }
}

// ============================================================
// emaktab snapshot mirror (Plan #1 Task 5)
// ============================================================

export async function syncEmaktabSnapshot(
  uid: string,
  snapshot: EmaktabSnapshot,
): Promise<void> {
  try {
    await setDoc(
      doc(db, "users", uid, "emaktab", "latest"),
      { snapshot, updatedAt: serverTimestamp() },
      { merge: false },
    );
  } catch (err) {
    console.warn("[cloudSync] syncEmaktabSnapshot failed:", (err as { code?: string })?.code ?? err);
  }
}

export async function loadCloudEmaktabSnapshot(
  uid: string,
): Promise<EmaktabSnapshot | null> {
  try {
    const snap = await getDoc(doc(db, "users", uid, "emaktab", "latest"));
    if (!snap.exists()) return null;
    return (snap.data()?.snapshot as EmaktabSnapshot | undefined) ?? null;
  } catch (err) {
    console.warn("[cloudSync] loadCloudEmaktabSnapshot failed:", (err as { code?: string })?.code ?? err);
    return null;
  }
}
