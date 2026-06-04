/**
 * One-shot: seed an emaktab snapshot to Firestore so the live adapter has a
 * real student to read. Run after the demo UID has been minted by visiting
 * scorpius.uz/learn once (the AuthBootstrap creates the anon UID).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed-emaktab-demo.ts <uid> [path/to/snapshot.json]
 *
 * Defaults to data/emaktab-export.json (the bundled snapshot used in v0.1+).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { adminDb } from "../lib/firebase/admin";

const uid = process.argv[2];
const snapshotPath = process.argv[3] ?? "data/emaktab-export.json";

if (!uid) {
  console.error(
    "Usage: npx tsx --env-file=.env.local scripts/seed-emaktab-demo.ts <uid> [path-to-snapshot.json]"
  );
  process.exit(1);
}

const path = resolve(process.cwd(), snapshotPath);
const snapshot = JSON.parse(readFileSync(path, "utf8"));

async function main() {
  await adminDb
    .doc(`users/${uid}/emaktab/latest`)
    .set({ snapshot, updatedAt: new Date() });
  console.log(`Seeded emaktab snapshot for uid=${uid} from ${path}`);
}

main().catch((err) => {
  console.error(`[seed-emaktab-demo] FATAL: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
