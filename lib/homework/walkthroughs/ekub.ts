import type { Lesson } from "@/lib/lesson";

/** EKUB (greatest common divisor) Socratic walkthrough — the original homework
 *  example. Five cards: intro → explainer → two MCQs → done. */
export const ekubWalkthrough: Lesson = {
  id: "ekub",
  subject: "math",
  subjectLabel: "UY VAZIFASI",
  title: "EKUBni topish",
  cards: [
    {
      type: "intro",
      title: "24 va 36 ning EKUBini topamiz",
      hook: "Tayyor javobni bermaymiz — qadam-baqadam birga yechamiz va javobni oxirida o'zingiz topasiz.",
      estMinutes: 5,
      cardCount: 5,
    },
    {
      type: "explainer",
      heading: "EKUB nima?",
      body: "EKUB — eng katta umumiy bo'luvchi: ikkala songa ham qoldiqsiz bo'linadigan eng katta son.\n\nUni topish uchun har bir sonning bo'luvchilarini ko'rib, umumiylarini taqqoslaymiz.",
    },
    {
      type: "mcq",
      question: "24 quyidagilardan qaysi biriga qoldiqsiz bo'linadi?",
      options: ["5", "12", "7", "9"],
      correctIndex: 1,
      explain: "To'g'ri — 24 = 12 × 2, demak 12 son 24 ning bo'luvchisi.",
      hint: "24 ni har bir variantga bo'lib ko'ring — qaysi biri qoldiq qoldirmaydi?",
    },
    {
      type: "mcq",
      question: "36 soni ham 12 ga qoldiqsiz bo'linadimi?",
      options: ["Ha, bo'linadi", "Yo'q, bo'linmaydi"],
      correctIndex: 0,
      explain: "To'g'ri — 36 = 12 × 3. Demak 12 ikkala songa ham bo'linadi.",
      hint: "36 ni 12 ga bo'ling: 36 ÷ 12 qanchaga teng?",
    },
    {
      type: "done",
      title: "Javobni o'zingiz topdingiz",
      body: "12 — 24 va 36 ning ikkalasiga ham bo'linadigan eng katta son. Demak EKUB(24, 36) = 12. Usul oddiy: umumiy bo'luvchilarning eng kattasini toping.",
    },
  ],
};
