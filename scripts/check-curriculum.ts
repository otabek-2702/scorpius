import { adminDb } from "../lib/firebase/admin";

/**
 * Inspects what curriculum content actually exists in Firestore.
 * Walks curriculum/{grade}/{subject}/{lessonId} and prints the tree.
 *
 *   npx tsx --env-file=.env.local scripts/check-curriculum.ts
 */
async function main() {
  const gradeDocs = await adminDb.collection("curriculum").listDocuments();
  if (gradeDocs.length === 0) {
    console.log("curriculum/ is empty.");
    return;
  }
  for (const gradeRef of gradeDocs) {
    console.log(`curriculum/${gradeRef.id}`);
    const subjectCols = await gradeRef.listCollections();
    for (const subjectCol of subjectCols) {
      const lessons = await subjectCol.listDocuments();
      console.log(`  ${subjectCol.id}/  (${lessons.length} docs)`);
      for (const lessonRef of lessons) {
        const snap = await lessonRef.get();
        const d = snap.data() ?? {};
        console.log(
          `    ${lessonRef.id}: "${d.title ?? "(no title)"}" ` +
            `examples=${d.examples?.length ?? 0} problems=${d.problems?.length ?? 0}`
        );
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
