"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

/**
 * Anonymous-auth bootstrap. The goal: every visitor gets a stable Firebase UID
 * that survives reloads (Firebase persists the anonymous session in IndexedDB)
 * so we can key Firestore docs to them without ever asking for login.
 *
 * Defensive on purpose — if Anonymous sign-in is not enabled in the Firebase
 * Console, or the network blocks it, this resolves to null and the app keeps
 * working off localStorage. We never throw.
 */

let cached: Promise<string | null> | null = null;

export function ensureAnonymousUser(): Promise<string | null> {
  if (cached) return cached;
  cached = new Promise((resolve) => {
    // If the user is already signed in (Firebase restored the session from
    // IndexedDB), resolve immediately and skip the signIn round-trip.
    const unsub = onAuthStateChanged(
      auth,
      (user) => {
        unsub();
        if (user) {
          resolve(user.uid);
          return;
        }
        signInAnonymously(auth)
          .then((cred) => resolve(cred.user.uid))
          .catch((err) => {
            console.warn("[auth] anonymous sign-in failed:", err?.code ?? err);
            // Clear the cache so a later retry can try again — once we've
            // failed, future calls in this session resolve to null instantly.
            resolve(null);
          });
      },
      (err) => {
        unsub();
        console.warn("[auth] onAuthStateChanged error:", err);
        resolve(null);
      },
    );
  });
  return cached;
}

/** React hook: returns the current anonymous UID, or null while resolving / on failure. */
export function useUid(): string | null {
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    ensureAnonymousUser().then((u) => {
      if (alive) setUid(u);
    });
    return () => {
      alive = false;
    };
  }, []);
  return uid;
}
