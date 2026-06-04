"use client";

import { useEffect } from "react";
import { ensureAnonymousUser } from "@/lib/auth";
import { loadCloudCompletions, loadCloudProfile } from "@/lib/cloudSync";

/**
 * Runs once on app boot in the root layout. Establishes the anonymous UID,
 * then hydrates localStorage from Firestore so the rest of the app (which
 * reads synchronously from localStorage) transparently sees cloud state.
 *
 * If anonymous auth or the cloud read fails, nothing happens — localStorage
 * keeps whatever was already there. Silent, no UI.
 */
export function AuthBootstrap() {
  useEffect(() => {
    let alive = true;
    (async () => {
      const uid = await ensureAnonymousUser();
      if (!alive || !uid) return;

      // Hydrate profile from cloud only when there's no local profile yet —
      // never overwrite the canonical localStorage source while the user is
      // mid-session.
      try {
        if (!localStorage.getItem("scorpius:profile")) {
          const cloud = await loadCloudProfile(uid);
          if (alive && cloud) {
            localStorage.setItem("scorpius:profile", JSON.stringify(cloud));
          }
        }
      } catch {
        /* localStorage unavailable */
      }

      // Hydrate completions — additive merge, never clear existing local flags.
      const completions = await loadCloudCompletions(uid);
      if (!alive) return;
      try {
        for (const lessonId of Object.keys(completions)) {
          localStorage.setItem("scorpius:done:" + lessonId, "1");
        }
      } catch {
        /* localStorage unavailable */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return null;
}
