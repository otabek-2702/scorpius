import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Lazy init: env vars only exist at runtime, not at Next.js build time. Initializing
// at module load made `next build` fail when it statically analyzed API routes that
// transitively imported this module.

let _app: App | null = null;
let _db: Firestore | null = null;

/** Strip BOM, CR, LF, and surrounding whitespace — Vercel env vars pushed via Windows
 *  shells can carry these and Firebase Admin rejects projectId/clientEmail with
 *  "Metadata string value ... contains illegal characters". */
function clean(v: string | undefined): string | undefined {
  if (!v) return v;
  return v.replace(/^﻿/, "").replace(/[\r\n]+/g, "").trim();
}

function getDb(): Firestore {
  if (_db) return _db;
  _app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          credential: cert({
            projectId: clean(process.env.FIREBASE_PROJECT_ID),
            clientEmail: clean(process.env.FIREBASE_CLIENT_EMAIL),
            // Private key needs \n preserved as newlines but BOM/leading-whitespace stripped.
            privateKey: process.env.FIREBASE_PRIVATE_KEY
              ?.replace(/^﻿/, "")
              .trim()
              .replace(/\\n/g, "\n"),
          }),
        });
  _db = getFirestore(_app);
  return _db;
}

// Proxy preserves the `adminDb.doc(...)` call shape used across the codebase.
export const adminDb = new Proxy({} as Firestore, {
  get(_target, prop) {
    const db = getDb();
    const value = (db as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? (value as Function).bind(db) : value;
  },
});
