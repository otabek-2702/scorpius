import { ensureAnonymousUser } from "@/lib/auth";
import { syncProfile } from "@/lib/cloudSync";

/** The student profile captured at onboarding — see UX-DESIGN.md §9.3. */
export interface StudentProfile {
  name: string;
  grade: number;
  interests: string[];
  favouriteSubject: string;
  goal: string;
  /** Free-text or preset answer to "what's hardest about studying right now" —
   *  drives the pain-validation moment on the personalising screen. */
  painPoint?: string;
  /** Sub-category picks: e.g. {"Super-qahramonlar": "Batman", "Futbol": "Real"}.
   *  Used to deepen example flavour in lesson copy. */
  subInterests?: Record<string, string>;
}

const STORAGE_KEY = "scorpius:profile";

/** Persist the profile so the app can greet and personalize after onboarding.
 *  Always writes localStorage synchronously (source of truth for sync readers).
 *  Also fires a best-effort Firestore mirror so the parent surface and any
 *  second-device session can read it back. */
export function saveProfile(profile: StudentProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // localStorage unavailable — the profile simply won't persist
  }
  // Fire-and-forget cloud mirror. Failures are swallowed inside syncProfile.
  void ensureAnonymousUser().then((uid) => {
    if (uid) void syncProfile(uid, profile);
  });
}

export function loadProfile(): StudentProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StudentProfile) : null;
  } catch {
    return null;
  }
}
