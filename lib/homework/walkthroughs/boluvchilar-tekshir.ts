import type { Lesson } from "@/lib/lesson";

/** Bo'luvchilar — bo'linish belgilari (2, 3, 5, 10) bilan tezkor tekshiruv. */
export const boluvchilarTekshirWalkthrough: Lesson = {
  id: "boluvchilar-tekshir",
  subject: "math",
  subjectLabel: "UY VAZIFASI",
  title: "Bo'linish belgilarini ishlatish",
  cards: [
    {
      type: "intro",
      title: "1 248 sonining bo'luvchilarini topamiz",
      hook: "Har bir sonni alohida bo'lib o'tirmaymiz. Bo'linish belgilarini ishlatamiz — tez va aniq.",
      estMinutes: 5,
      cardCount: 5,
    },
    {
      type: "explainer",
      heading: "Asosiy belgilar",
      body: "Quyidagi belgilar yodda tursin:\n\n• 2 ga bo'linadi — agar son juft bo'lsa (oxirgi raqam 0, 2, 4, 6, 8).\n• 3 ga bo'linadi — agar raqamlar yig'indisi 3 ga bo'linsa.\n• 5 ga bo'linadi — agar oxirgi raqam 0 yoki 5 bo'lsa.\n• 10 ga bo'linadi — agar oxirgi raqam 0 bo'lsa.",
    },
    {
      type: "mcq",
      question: "1 248 soni 2 ga bo'linadi mi?",
      options: ["Ha — chunki oxirgi raqam juft (8)", "Yo'q — oxirgi raqam toq"],
      correctIndex: 0,
      explain: "To'g'ri — oxirgi raqami 8, demak juft son. Har qanday juft son 2 ga qoldiqsiz bo'linadi.",
      hint: "Oxirgi raqamga qarang — 0, 2, 4, 6 yoki 8 bo'lsa juft.",
    },
    {
      type: "mcq",
      question: "1 248 ning raqamlari yig'indisi 1+2+4+8 = 15. Bu son 3 ga bo'linadi mi?",
      options: ["Ha, bo'linadi", "Yo'q, bo'linmaydi"],
      correctIndex: 0,
      explain: "Ha — 15 ÷ 3 = 5, demak 15 son 3 ga bo'linadi. Qoidaga ko'ra 1 248 ham 3 ga bo'linadi.",
      hint: "15 ni 3 ga bo'ling — qoldiq qoladimi?",
    },
    {
      type: "mcq",
      question: "1 248 soni 5 ga bo'linadi mi?",
      options: ["Ha", "Yo'q — oxirgi raqam 0 yoki 5 emas"],
      correctIndex: 1,
      explain: "To'g'ri — 5 ga bo'linish uchun oxirgi raqam 0 yoki 5 bo'lishi shart. 8 mos kelmaydi.",
      hint: "5 ga bo'linish belgisi — oxirgi raqamga qarang.",
    },
    {
      type: "done",
      title: "Tezkor xulosa",
      body: "1 248 soni 2 va 3 ga bo'linadi, lekin 5 ga (va 10 ga) bo'linmaydi. Bo'linish belgilari sizga uzun bo'lish ishlarisiz tez javob beradi — har bir vazifada birinchi navbatda shularni ishlating.",
    },
  ],
};
