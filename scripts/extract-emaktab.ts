/**
 * CLI wrapper around lib/emaktab/extract.server.ts.
 *
 * Reads EMAKTAB_USERNAME + EMAKTAB_PASSWORD from .env.local, runs the
 * extractor, writes JSON to data/emaktab-export.json, and caches to Firestore
 * at students/demo-student-1 for the bundled demo path.
 *
 *   npx tsx --env-file=.env.local scripts/extract-emaktab.ts
 *
 * The same extractor is used by /api/emaktab/connect for the in-app parent
 * connect flow — both share lib/emaktab/extract.server.ts, so behaviour stays
 * in lockstep.
 */

import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { adminDb } from "../lib/firebase/admin";
import {
  extractEmaktabSnapshot,
  type EmaktabExport,
} from "../lib/emaktab/extract.server";

const STUDENT_ID = "demo-student-1";
const EXPORT_PATH = "data/emaktab-export.json";

function log(msg: string) {
  console.log(`[extract-emaktab] ${msg}`);
}

async function cacheToFirestore(data: EmaktabExport): Promise<void> {
  const p = data.profile;
  await adminDb.doc(`students/${STUDENT_ID}`).set(
    {
      name: p.name,
      className: p.className,
      school: p.school,
      grade: p.grade,
      academicYear: p.academicYear,
      emaktab: p.emaktab,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
  await adminDb.doc(`students/${STUDENT_ID}/emaktab/snapshot`).set({
    grades: data.grades,
    diary: data.diary,
    homework: data.homework,
    source: data.meta.source,
    pulledAt: data.meta.pulledAt,
  });
  log(`cached to Firestore: students/${STUDENT_ID} + /emaktab/snapshot`);
}

async function main() {
  const username = process.env.EMAKTAB_USERNAME;
  const password = process.env.EMAKTAB_PASSWORD;
  if (!username || !password) {
    throw new Error("EMAKTAB_USERNAME / EMAKTAB_PASSWORD missing — set them in .env.local");
  }

  const data = await extractEmaktabSnapshot(username, password, {
    onProgress: (_, message) => log(message),
  });

  mkdirSync(dirname(EXPORT_PATH), { recursive: true });
  writeFileSync(EXPORT_PATH, JSON.stringify(data, null, 2), "utf8");
  log(`wrote ${EXPORT_PATH}`);

  try {
    await cacheToFirestore(data);
  } catch (err) {
    log(`WARNING — Firestore cache failed: ${err instanceof Error ? err.message : err}`);
  }

  const markTotal = data.grades.reduce(
    (n, p) => n + p.subjects.reduce((m, s) => m + s.marks.length, 0),
    0,
  );
  log("---- summary ----");
  log(`profile:  ${data.profile.name} (${data.profile.className}, ${data.profile.academicYear})`);
  log(`grades:   ${data.grades.length} periods, ${markTotal} marks total`);
  log(`diary:    ${data.diary.length} days`);
  log(`homework: ${data.homework.length} items`);
  if (data.meta.notes.length) {
    log(`notes (${data.meta.notes.length}):`);
    for (const n of data.meta.notes) log(`  - ${n}`);
  }
}

main().catch((err) => {
  console.error(`[extract-emaktab] FATAL: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
