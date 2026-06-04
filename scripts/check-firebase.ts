import { adminDb } from "../lib/firebase/admin";

/** Verifies the Firebase Admin SDK can reach Firestore: write a doc, read it back. */
async function main() {
  const ref = adminDb.doc("_healthcheck/scorpius");
  await ref.set({ ok: true, at: new Date().toISOString() });
  const snap = await ref.get();
  console.log("Firestore admin OK —", JSON.stringify(snap.data()));
}

main().catch((err) => {
  console.error("Firestore admin FAILED:", err);
  process.exit(1);
});
