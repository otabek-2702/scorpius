/**
 * The curriculum graph — Scorpius's learning tree.
 *
 * Shape: grade → subject → unit → topic. Each topic has an `order` (teaching
 * sequence) and optional `prereqs` (topic ids that should come first). This is
 * the "skill graph" of ARCHITECTURE.md §5 — it tells the app WHAT to teach and
 * IN WHAT ORDER, so the Orchestrator can insert a prerequisite review before
 * new material.
 *
 * Where the subject list comes from: the student's emaktab account. The
 * extractor pulls it, the codegen script (`scripts/sync-curriculum-subjects.ts`)
 * normalises and writes it to `curriculum/subjects.generated.ts`, and this file
 * layers curated units/topics on top. So adding a subject is genuinely data
 * (re-run the extractor + sync); only units and lesson curation are code.
 *
 * Honesty rule: this file holds only what genuinely exists. Today that is the
 * Grade-6 Mathematics unit whose first topic is extracted and cached in
 * Firestore (curriculum/6/math/lesson-1) and renders as the demo lesson. The
 * other Grade-6 subjects below come from the emaktab snapshot — listed as
 * subjects with empty units until their textbook lessons are extracted.
 */
import { emaktabSubjects } from "./curriculum/subjects.generated";

// ---- Types ------------------------------------------------------------------

/** A single learnable topic — one star in the constellation, one lesson. */
export interface CurriculumTopic {
  id: string;
  title: string;
  /** Teaching position within its unit (1-based). */
  order: number;
  /** Topic ids that should be mastered first — drives prerequisite review. */
  prereqs?: string[];
  /** Set when the topic's lesson is extracted and cached (Firestore + lib/lesson.ts). */
  lessonId?: string;
}

/** A unit groups topics — a chapter of the textbook. */
export interface CurriculumUnit {
  id: string;
  title: string;
  order: number;
  topics: CurriculumTopic[];
}

/** A subject within a grade — Mathematics, History, ... */
export interface CurriculumSubject {
  id: string;
  /** Display label, in the textbook's own language (Uzbek). */
  label: string;
  /** Maps to Firestore curriculum/{grade}/{subject} and the Lesson.subject union. */
  firestoreKey: string;
  units: CurriculumUnit[];
}

/** Everything taught at one grade. */
export interface CurriculumGrade {
  grade: number;
  subjects: CurriculumSubject[];
}

// ---- Curated units (the only hand-authored content) ------------------------

/** Units curated by humans, keyed by `{grade}/{subjectId}`. Everything not
 *  listed here gets an empty `units: []` and shows up as a dormant constellation
 *  until a lesson is extracted for it. */
const CURATED_UNITS: Record<string, CurriculumUnit[]> = {
  "6/math": [
    {
      id: "u-divisibility",
      title: "Bo'linish va kasrlar",
      order: 1,
      topics: [
        { id: "natural", title: "Natural sonlar", order: 1 },
        {
          id: "boluvchi",
          title: "Sonning bo'luvchilari va karralisi",
          order: 2,
          prereqs: ["natural"],
          lessonId: "boluvchi",
        },
        {
          id: "ekub-ekuk",
          title: "EKUB va EKUK",
          order: 3,
          prereqs: ["boluvchi"],
          lessonId: "ekub-ekuk",
        },
        {
          id: "oddiy-kasr",
          title: "Oddiy kasrlar",
          order: 4,
          prereqs: ["ekub-ekuk"],
          lessonId: "oddiy-kasr",
        },
        { id: "kasr-amallar", title: "Kasr amallari", order: 5, prereqs: ["oddiy-kasr"] },
        { id: "onli-kasr", title: "O'nli kasrlar", order: 6, prereqs: ["kasr-amallar"] },
      ],
    },
  ],
  "6/history": [
    {
      id: "u-ancient",
      title: "Qadimgi dunyo tarixi",
      order: 1,
      topics: [
        {
          id: "qadimgi-tarix",
          title: "Qadimgi tarix – taraqqiyotning boshlanishi",
          order: 1,
          lessonId: "lesson-1",
        },
      ],
    },
  ],
  /**
   * Grade-6 Physics — full curriculum from the official Uzbekistan textbook
   * (infoedu.uz/darsliklar/6/6-sinf-fizika). Seven chapters (boblar) plus the
   * Kirish (introduction). Topics with `lessonId` have a cached card-DSL
   * lesson in `lib/lesson.ts` and ignite their star on the constellation.
   */
  "6/physics": [
    {
      id: "u-kirish",
      title: "Kirish — fizika nimani o'rganadi",
      order: 1,
      topics: [
        { id: "fizika-nima", title: "Fizika nimani o'rganadi? Fizik hodisalar", order: 1 },
        { id: "fizika-tarixi", title: "Fizika taraqqiyoti tarixidan", order: 2 },
        { id: "uzbekistonda-fizika", title: "O'zbekistonda fizika taraqqiyoti", order: 3 },
        { id: "fizik-atamalar", title: "Fizikada ishlatiladigan atamalar", order: 4 },
        { id: "kuzatish-tajriba", title: "Kuzatishlar va tajribalar", order: 5 },
        { id: "fizik-kattaliklar", title: "Fizik kattaliklar va ularni o'lchash", order: 6 },
        { id: "olchash-aniqligi", title: "O'lchashlar va o'lchash aniqligi", order: 7 },
      ],
    },
    {
      id: "u-modda",
      title: "I bob · Modda tuzilishi haqida dastlabki ma'lumotlar",
      order: 2,
      topics: [
        { id: "modda-tarixi", title: "Demokrit, Ar-Roziy, Beruniy va Ibn Sino ta'limotlari", order: 1 },
        { id: "molekula", title: "Molekulalar va ularning o'lchamlari", order: 2 },
        {
          id: "broun",
          title: "Broun harakati va diffuziya",
          order: 3,
          prereqs: ["molekula"],
          lessonId: "broun",
        },
        { id: "diffuziya-muhit", title: "Turli muhitlarda diffuziya", order: 4, prereqs: ["broun"] },
        { id: "agregat-holat", title: "Qattiq, suyuq, gaz molekulyar tuzilishi", order: 5 },
        { id: "massa", title: "Massa va uning birliklari", order: 6 },
        { id: "tarozi-lab", title: "Lab: Shayinli tarozi bilan massa o'lchash", order: 7 },
        { id: "zichlik", title: "Zichlik va uning birliklari. Beruniy va Hozin usullari", order: 8 },
        { id: "zichlik-lab", title: "Lab: Qattiq jismning zichligini aniqlash", order: 9 },
      ],
    },
    {
      id: "u-mexanika",
      title: "II bob · Mexanik hodisalar haqida dastlabki ma'lumotlar",
      order: 3,
      topics: [
        { id: "harakat", title: "Mexanik harakat va trayektoriya", order: 1 },
        { id: "yul-vaqt", title: "Bosib o'tilgan yo'l va vaqt birliklari", order: 2 },
        { id: "tezlik", title: "Tekis va notekis harakat. Tezlik", order: 3, prereqs: ["yul-vaqt"] },
        { id: "kuch", title: "Jismlarning o'zaro ta'siri. Kuch", order: 4 },
        { id: "dinamometr-lab", title: "Lab: Dinamometr bilan kuch o'lchash", order: 5 },
        { id: "bosim", title: "Bosim va uning birliklari", order: 6 },
        { id: "paskal", title: "Paskal qonuni va uning qo'llanilishi", order: 7, prereqs: ["bosim"] },
        { id: "gaz-bosim", title: "Tinch holatdagi gaz va suyuqlikda bosim", order: 8 },
        { id: "atmosfera", title: "Atmosfera bosimi. Torrichelli tajribasi", order: 9 },
        {
          id: "arximed",
          title: "Arximed qonuni va uning qo'llanilishi",
          order: 10,
          prereqs: ["bosim"],
          lessonId: "arximed",
        },
        { id: "ish-energiya", title: "Ish va energiya tushunchasi", order: 11 },
        { id: "energiya-quvvat", title: "Energiya turlari. Quvvat", order: 12 },
      ],
    },
    {
      id: "u-muvozanat",
      title: "III bob · Jismlar muvozanati va oddiy mexanizmlar",
      order: 4,
      topics: [
        { id: "massa-markazi", title: "Massa markazi. Muvozanat turlari", order: 1 },
        { id: "kuch-momenti", title: "Kuch momenti. Richag muvozanati", order: 2 },
        { id: "richag-lab", title: "Lab: Richag muvozanatini o'rganish", order: 3 },
        { id: "oddiy-mexanizm", title: "Oddiy mexanizmlar: blok, qiya tekislik, vint, pona", order: 4 },
        { id: "mexanizm-ish", title: "Mexanizmlardan foydalanishda ishlar tengligi", order: 5 },
        { id: "oltin-qoida", title: "Mexanikaning oltin qoidasi. Foydali ish koeffitsiyenti", order: 6 },
      ],
    },
    {
      id: "u-issiqlik",
      title: "IV bob · Issiqlik hodisalari haqida dastlabki ma'lumotlar",
      order: 5,
      topics: [
        { id: "issiqlik-manba", title: "Issiqlik manbalari. Issiqlik qabul qilish", order: 1 },
        { id: "kengayish", title: "Jismlarning issiqlikdan kengayishi", order: 2 },
        { id: "issiqlik-uzatish", title: "Issiqlik o'tkazuvchanlik. Konveksiya", order: 3 },
        { id: "nurlanish", title: "Nurlanish va texnikada qo'llanilishi", order: 4 },
        { id: "issiqlik-tarixi", title: "Forobiy, Beruniy, Ibn Sino fikrlari", order: 5 },
        { id: "temperatura", title: "Temperatura. Termometrlar", order: 6 },
        { id: "termometr-lab", title: "Lab: Termometr bilan o'lchash", order: 7 },
      ],
    },
    {
      id: "u-elektr",
      title: "V bob · Elektr hodisalari haqida dastlabki ma'lumotlar",
      order: 6,
      topics: [
        { id: "elektrlanish", title: "Jismlarning elektrlanishi", order: 1 },
        { id: "elektr-toki", title: "Elektr toki. Tok manbalari", order: 2 },
        { id: "elektr-zanjiri", title: "Oddiy elektr zanjiri va elektr tokining ahamiyati", order: 3 },
        { id: "elektr-tejash", title: "Xonadondagi elektr asboblari. Elektr energiyasini tejash", order: 4 },
      ],
    },
    {
      id: "u-yorugʻlik",
      title: "VI bob · Yorug'lik hodisalari haqida dastlabki ma'lumotlar",
      order: 7,
      topics: [
        { id: "yorug-manba", title: "Yorug'likning tabiiy va sun'iy manbalari", order: 1 },
        { id: "togri-tarqalish", title: "Yorug'likning to'g'ri chiziq bo'ylab tarqalishi. Soya", order: 2 },
        {
          id: "tutilish",
          title: "Quyosh va Oy tutilishi",
          order: 3,
          prereqs: ["togri-tarqalish"],
          lessonId: "tutilish",
        },
        { id: "qaytish-sinish", title: "Yorug'lik tezligi. Qaytish va sinish", order: 4 },
        { id: "yorug-tarixi", title: "Beruniy va Ibn Sinoning yorug'lik haqida fikrlari", order: 5 },
        { id: "yassi-kozgu", title: "Yassi ko'zgu", order: 6 },
        { id: "linza", title: "Linzalar haqida tushuncha", order: 7 },
        {
          id: "kamalak",
          title: "Prizma, spektr va kamalak",
          order: 8,
          prereqs: ["qaytish-sinish"],
          lessonId: "kamalak",
        },
        { id: "kozgu-lab", title: "Lab: Yassi ko'zgu yordamida yorug'lik qaytishi", order: 9 },
        { id: "prizma-lab", title: "Lab: Prizma bilan spektrga ajralish", order: 10 },
      ],
    },
    {
      id: "u-tovush",
      title: "VII bob · Tovush hodisalari haqida dastlabki ma'lumotlar",
      order: 8,
      topics: [
        { id: "tovush-manba", title: "Tovush manbalari va qabul qilgichlar", order: 1 },
        { id: "tovush-muhit", title: "Tovushning turli muhitlarda tarqalishi", order: 2 },
        { id: "tovush-kattalik", title: "Tovush kattaliklari", order: 3 },
        { id: "aks-sado", title: "Tovushning qaytishi. Aks sado", order: 4 },
        { id: "musiqa-shovqin", title: "Musiqiy tovushlar va shovqinlar. Tovush va salomatlik", order: 5 },
      ],
    },
  ],
};

// ---- The graph --------------------------------------------------------------

/** Build a grade's subject list from the emaktab snapshot + curated units. */
function buildGrade(grade: number, subjects: { id: string; label: string }[]): CurriculumGrade {
  return {
    grade,
    subjects: subjects.map((s) => ({
      id: s.id,
      label: s.label,
      firestoreKey: s.id,
      units: CURATED_UNITS[`${grade}/${s.id}`] ?? [],
    })),
  };
}

/**
 * Subjects added by Scorpius itself, beyond what's listed in the emaktab snapshot.
 * Physics isn't a separate subject in the Grade-6 emaktab gradebook (it's folded
 * into "Tabiiy fan"), but the textbook exists and the demo runs physics lessons,
 * so we surface it as a first-class subject.
 */
const SCORPIUS_EXTRA_SUBJECTS: { id: string; label: string }[] = [
  { id: "physics", label: "Fizika" },
];

/**
 * Grade 6. Subjects come from the emaktab account, augmented by the Scorpius
 * extras (physics). Math + history + physics carry the curated units that
 * drive the demo lessons (`lib/lesson.ts`).
 */
const grade6: CurriculumGrade = buildGrade(6, [
  ...emaktabSubjects,
  ...SCORPIUS_EXTRA_SUBJECTS,
]);

/** The full curriculum tree. Add grades by calling `buildGrade(N, subjects)`. */
export const curriculum: CurriculumGrade[] = [grade6];

// ---- Helpers ----------------------------------------------------------------

export function getGrade(grade: number): CurriculumGrade | undefined {
  return curriculum.find((g) => g.grade === grade);
}

export function getSubject(
  grade: number,
  subjectId: string
): CurriculumSubject | undefined {
  return getGrade(grade)?.subjects.find((s) => s.id === subjectId);
}

/** Every topic in a subject, flattened and sorted by unit order then topic order. */
export function topicsOf(grade: number, subjectId: string): CurriculumTopic[] {
  const subject = getSubject(grade, subjectId);
  if (!subject) return [];
  return subject.units
    .slice()
    .sort((a, b) => a.order - b.order)
    .flatMap((u) => u.topics.slice().sort((a, b) => a.order - b.order));
}

/** Look up a single topic by id within a subject. */
export function getTopic(
  grade: number,
  subjectId: string,
  topicId: string
): CurriculumTopic | undefined {
  return topicsOf(grade, subjectId).find((t) => t.id === topicId);
}
