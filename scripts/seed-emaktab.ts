import { adminDb } from "../lib/firebase/admin";

/**
 * Seeds Firestore with one consented emaktab student's real data — a snapshot read
 * from the live account on 2026-05-22 (Vasliddin Shahobiddinov, class 6-a, school 64).
 * The hackathon demo runs on this cached data — never live scraping on stage (CLAUDE.md §1).
 * A headless re-scraper (`scripts/ingest-emaktab.ts`) is a Phase-1 item.
 *
 *   npx tsx --env-file=.env.local scripts/seed-emaktab.ts
 */

const STUDENT_ID = "demo-student-1";

const profile = {
  name: "Vasliddin Shahobiddinov",
  className: "6-a",
  school: "64-son umumiy o'rta ta'lim maktabi",
  grade: 6,
  emaktab: {
    schoolId: "1000004672539",
    personId: "1000005506825",
    groupId: "2362942520810758875",
  },
};

// Recent grades, as shown on the emaktab userfeed (receivedDate · subject · mark · label).
const grades = [
  { receivedDate: "2026-05-22", subject: "Texnologiya", mark: 5, label: "Natija" },
  { receivedDate: "2026-05-22", subject: "Texnologiya", mark: 5, label: "Yillik" },
  { receivedDate: "2026-05-22", subject: "Texnologiya", mark: 5, label: "4-chorak uchun" },
  { receivedDate: "2026-05-22", subject: "Texnologiya", mark: 5, label: "DJ 22-may uchun" },
  { receivedDate: "2026-05-22", subject: "Texnologiya", mark: 5, label: "UV 22-may uchun" },
  { receivedDate: "2026-05-22", subject: "Texnologiya", mark: 5, label: "DJ 8-may uchun" },
  { receivedDate: "2026-05-21", subject: "Adabiyot", mark: 5, label: "UV 21-may uchun" },
  { receivedDate: "2026-05-21", subject: "Adabiyot", mark: 5, label: "NI 21-may uchun" },
  { receivedDate: "2026-05-21", subject: "Rus tili", mark: 5, label: "DJ 20-may uchun" },
  { receivedDate: "2026-05-21", subject: "Rus tili", mark: 5, label: "DJ 21-may uchun" },
  { receivedDate: "2026-05-21", subject: "Matematika", mark: 5, label: "UV 20-may uchun" },
  { receivedDate: "2026-05-21", subject: "Matematika", mark: 5, label: "DJ 20-may uchun" },
  { receivedDate: "2026-05-20", subject: "Tasviriy san'at", mark: 5, label: "Yillik" },
  { receivedDate: "2026-05-20", subject: "Tasviriy san'at", mark: 5, label: "4-chorak uchun" },
  { receivedDate: "2026-05-20", subject: "Informatika", mark: 5, label: "DJ 20-may uchun" },
];

// Timetable for 2026-05-22 (Friday), with the homework assigned per lesson.
const timetable = [
  { date: "2026-05-22", period: 1, time: "13:10-13:55", subject: "Adabiyot", topic: "Nazorat ishi tahlili / Takrorlash", homework: "214-bet, takrorlash" },
  { date: "2026-05-22", period: 2, time: "14:00-14:45", subject: "Ona tili", topic: "Takrorlash", homework: "Test yechish" },
  { date: "2026-05-22", period: 3, time: "14:50-15:35", subject: "Matematika", topic: "Umumiy takrorlash", homework: "2-mashq daftari, 127-128-betlar" },
  { date: "2026-05-22", period: 4, time: "15:40-16:25", subject: "Tabiiy fan", topic: "Oyning fazalari", homework: "Mashq daftari 134-bet, takrorlash" },
  { date: "2026-05-22", period: 5, time: "16:30-17:15", subject: "Texnologiya", topic: "21-amaliy mashg'ulot. Sifon turlari, ularni almashtirish va ta'mirlash ishlari", homework: "Takrorlash; devorga qotirishni o'rganish" },
  { date: "2026-05-22", period: 6, time: "17:20-18:05", subject: "Texnologiya", topic: "21-amaliy mashg'ulot. Sifon turlari, ularni almashtirish va ta'mirlash ishlari", homework: null },
];

async function main() {
  await adminDb
    .doc(`students/${STUDENT_ID}`)
    .set({ ...profile, updatedAt: new Date().toISOString() }, { merge: true });

  await adminDb.doc(`students/${STUDENT_ID}/emaktab/snapshot`).set({
    grades,
    timetable,
    source: "emaktab.uz userfeed",
    pulledAt: "2026-05-22T12:04:00.000Z",
  });

  console.log(
    `Seeded ${STUDENT_ID}: profile + ${grades.length} grades + ${timetable.length} timetable rows.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
