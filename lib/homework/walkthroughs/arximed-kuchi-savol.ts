import type { Lesson } from "@/lib/lesson";

/** Arximed kuchi — masala: temir parchasi suvga botadimi? Suzadimi? */
export const arximedKuchiSavolWalkthrough: Lesson = {
  id: "arximed-kuchi-savol",
  subject: "physics",
  subjectLabel: "UY VAZIFASI",
  title: "Arximed kuchini hisoblash",
  cards: [
    {
      type: "intro",
      title: "Yog'och bo'lagi suvga botadimi?",
      hook: "Arximed qonuni javobni 3 qadamda beradi. Birga yuramiz.",
      estMinutes: 6,
      cardCount: 6,
    },
    {
      type: "explainer",
      heading: "Arximed qonuni",
      body: "Suyuqlikka cho'kkan jismga, suyuqlik tomonidan ko'tarish kuchi ta'sir qiladi. Bu kuch jism siqib chiqargan suyuqlikning og'irligiga teng.\n\nF_A = ρ × g × V,  bunda:\n• ρ — suyuqlikning zichligi (suv uchun 1000 kg/m³),\n• g — erkin tushish tezlanishi (≈ 10 N/kg),\n• V — jismning suvga botgan qismi hajmi.",
    },
    {
      type: "mcq",
      question: "Jism suzishi uchun qaysi shart bajarilishi kerak?",
      options: [
        "Arximed kuchi og'irlik kuchidan katta yoki teng bo'lsa",
        "Og'irlik kuchi Arximed kuchidan katta bo'lsa",
        "Jism temirdan yasalgan bo'lsa",
      ],
      correctIndex: 0,
      explain: "Suzish uchun yuqoriga itaruvchi Arximed kuchi yo bag'rga teng yo undan kattaroq bo'lishi shart. Aks holda jism cho'kadi.",
      hint: "Suzayotgan jism balansda turibdi — qaysi kuch qaysi kuchni muvozanatlaydi?",
    },
    {
      type: "mcq",
      question: "Yog'ochning zichligi 700 kg/m³. Suvning zichligi 1000 kg/m³. Yog'och suzadimi?",
      options: ["Ha — yog'och suvdan yengilroq", "Yo'q — cho'kadi"],
      correctIndex: 0,
      explain: "Yog'och zichligi suvdan kichik, shuning uchun u suzadi — qisman suvga botadi, qolgan qismi yuqorida turadi.",
      hint: "Qaysi zichlik kichik? Engilroq narsa og'irroq suyuqlikda suzadi.",
    },
    {
      type: "mcq",
      question: "1 dm³ (= 0,001 m³) hajmli butunlay suvga botgan yog'ochga ta'sir qiluvchi Arximed kuchi:",
      options: ["10 N", "1 N", "100 N", "1000 N"],
      correctIndex: 0,
      explain: "F_A = 1000 × 10 × 0,001 = 10 N. Suvga to'liq botgan 1 dm³ hajmli jismga 10 N kuch ta'sir qiladi.",
      hint: "Formulaga raqamlarni qo'ying: ρ = 1000, g = 10, V = 0,001.",
    },
    {
      type: "explainer",
      heading: "Demak nimani topdik",
      body: "Yog'och bo'lagi suvga to'liq botganida unga 10 N ko'taruvchi kuch ta'sir qilardi. Lekin yog'och yengilroq ekan — u to'liq botmaydi. U faqat o'z og'irligini muvozanatlash uchun yetarli hajmgacha botadi va shu joyda suzadi.",
    },
    {
      type: "done",
      title: "Qisqacha",
      body: "Suzish/cho'kishni topish uchun: (1) jism va suyuqlik zichliklarini taqqoslang — jism zichligi kichik bo'lsa suzadi. (2) Aniq kuch kerak bo'lsa F_A = ρ × g × V formulasini qo'llang. Sizning vazifangizdagi raqamlarni shu yerga qo'ying — javob chiqadi.",
    },
  ],
};
