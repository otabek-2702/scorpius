import type { Lesson } from "@/lib/lesson";

/** Kasr amallari — Socratic walkthrough on adding two unlike-denominator
 *  fractions. Six cards: intro → explainer → mcq (LCM) → mcq (convert) → mcq
 *  (sum) → done. */
export const kasrAmallariWalkthrough: Lesson = {
  id: "kasr-amallari",
  subject: "math",
  subjectLabel: "UY VAZIFASI",
  title: "Har xil maxrajli kasrlarni qo'shish",
  cards: [
    {
      type: "intro",
      title: "1/4 + 1/6 ni hisoblaymiz",
      hook: "Maxrajlar har xil bo'lganda kasrlarni birdaniga qo'shib bo'lmaydi. Birga — bosqichma-bosqich.",
      estMinutes: 6,
      cardCount: 6,
    },
    {
      type: "explainer",
      heading: "Tartib oddiy",
      body: "Ikki kasrni qo'shish uchun maxrajlar bir xil bo'lishi kerak.\n\nQadamlar: (1) ikkala maxrajning eng kichik umumiy karralisini (EKUK) toping, (2) har bir kasrni shu yangi maxrajga keltiring, (3) suratlarni qo'shing.",
    },
    {
      type: "mcq",
      question: "4 va 6 ning EKUKi (eng kichik umumiy karralisi) qaysi son?",
      options: ["10", "12", "24", "8"],
      correctIndex: 1,
      explain: "12 — ham 4 ga (12 = 4×3), ham 6 ga (12 = 6×2) bo'linadigan eng kichik son.",
      hint: "Ikkala songa ham bo'linadigan eng kichik sonni qidiring: 4 ning karralilari — 4, 8, 12; 6 ning karralilari — 6, 12, 18.",
    },
    {
      type: "mcq",
      question: "1/4 kasrini 12-maxrajli qilib yozing — surat nima bo'ladi?",
      options: ["2", "3", "4", "6"],
      correctIndex: 1,
      explain: "1/4 = 3/12 chunki ham surat ham maxraj 3 ga ko'paytirildi: 1×3 = 3, 4×3 = 12.",
      hint: "4 ni 12 ga aylantirish uchun 3 ga ko'paytirdik — suratni ham 3 ga ko'paytiring.",
    },
    {
      type: "mcq",
      question: "Endi 1/6 = ?/12. Surat nima?",
      options: ["2", "3", "4", "1"],
      correctIndex: 0,
      explain: "1/6 = 2/12 chunki 6×2 = 12, demak 1×2 = 2.",
      hint: "6 ni 12 ga aylantirish uchun 2 ga ko'paytirdik — suratga ham xuddi shuni qiling.",
    },
    {
      type: "mcq",
      question: "3/12 + 2/12 ning yig'indisi qaysi?",
      options: ["5/24", "5/12", "6/12", "1/4"],
      correctIndex: 1,
      explain: "Maxrajlar bir xil bo'lsa, suratlarni qo'shamiz: 3 + 2 = 5. Demak 5/12.",
      hint: "Bir xil maxrajli kasrlarda faqat suratlar qo'shiladi.",
    },
    {
      type: "done",
      title: "Javob: 5/12",
      body: "1/4 + 1/6 = 3/12 + 2/12 = 5/12. Har safar maxrajlar har xil bo'lsa: avval EKUKni toping, kasrlarni unga keltiring, keyin suratlarni qo'shing.",
    },
  ],
};
