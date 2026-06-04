import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * NEXT_PUBLIC_* vars are inlined at BUILD time. When they're missing (e.g. the
 * env vars aren't configured in the deploy target), calling getAuth() /
 * getFirestore() throws `auth/invalid-api-key` synchronously at module load —
 * which crashes `next build` while it prerenders pages like /_not-found.
 *
 * So we only spin up Firebase when it's actually configured and degrade to
 * null otherwise. This matches the best-effort, never-throw philosophy already
 * used in lib/auth.ts and lib/cloudSync.ts — every consumer treats the cloud
 * as an optional upgrade on top of localStorage.
 */
const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

if (!isConfigured && typeof window !== "undefined") {
  console.warn(
    "[firebase] NEXT_PUBLIC_FIREBASE_* env vars are missing — cloud features are disabled. " +
      "Set them in Vercel → Settings → Environment Variables, then redeploy.",
  );
}

const app: FirebaseApp | null = isConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const db: Firestore | null = app ? getFirestore(app) : null;
export const auth: Auth | null = app ? getAuth(app) : null;
