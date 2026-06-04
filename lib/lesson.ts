import type { PersonaId } from "@/lib/personas";

/** A real photograph attached to a card (downloaded asset under /public).
 *  `credit` is a short author + license line shown beneath the image; full
 *  provenance lives in the lesson's CREDITS.md. */
export interface CardImage {
  src: string;
  alt: string;
  credit?: string;
}

/** Lesson card DSL — see ARCHITECTURE.md §6 and UX-DESIGN.md §3.3. */
export type Card =
  | {
      type: "intro";
      title: string;
      hook: string;
      estMinutes: number;
      cardCount: number;
      /** Optional hero photograph. */
      image?: CardImage;
      /** Optional narration text fed to ElevenLabs (Uzbek). */
      voice?: string;
    }
  | {
      type: "explainer";
      heading: string;
      body: string;
      /** Optional supporting photograph. */
      image?: CardImage;
      /** Optional narration text. */
      voice?: string;
    }
  | {
      /** Interactive lab — a named simulation component renders here. The
       *  simulation owns its own UI, physics, and completion signal. */
      type: "simulation";
      heading: string;
      /** Registry key — see components/learn/sims/index.tsx. */
      sim: "brachistochrone" | string;
      instruction: string;
      /** Shown after the student has interacted (e.g. raced the balls). */
      reveal?: string;
      /** Optional sim-specific config payload (the renderer decides the shape). */
      config?: Record<string, unknown>;
    }
  | {
      /** AI-generated or pre-cached diagram. `src` is preferred; `prompt` is
       *  used at generation time and may be persisted to Firestore later. */
      type: "diagram";
      heading: string;
      src?: string;
      prompt?: string;
      caption: string;
      voice?: string;
    }
  | {
      /** A short narrative beat — used for "Newton solved this in one night"
       *  moments. Renders with a serif accent + optional narration. */
      type: "story";
      heading: string;
      body: string;
      /** Optional supporting photograph. */
      image?: CardImage;
      voice?: string;
    }
  | {
      type: "mcq";
      question: string;
      options: string[];
      correctIndex: number;
      explain: string;
      hint: string;
    }
  | {
      type: "discover";
      prompt: string;
      pool: number[];
      correct: number[];
      reveal: string;
    }
  | {
      type: "sequence";
      prompt: string;
      pool: number[];
      order: number[];
      reveal: string;
    }
  | {
      type: "sort";
      prompt: string;
      bucketA: string;
      bucketB: string;
      items: { value: number; bucket: "A" | "B" }[];
      reveal: string;
    }
  | {
      type: "numberline";
      prompt: string;
      max: number;
      correct: number[];
      reveal: string;
    }
  | {
      type: "ask";
      heading: string;
      topic: string;
    }
  | {
      /** Manifesto kind: learner states a hypothesis BEFORE the sim runs.
       *  Options OR numeric input. Hypothesis is stored, then compared to sim outcome. */
      type: "predict";
      heading: string;
      prompt: string;
      mode: "choice" | "number";
      options?: string[];
      correctIndex?: number;
      numericAnswer?: number;
      tolerancePct?: number;
      reveal: string;
      voice?: string;
    }
  | {
      /** Manifesto kind: free-play with a sim. No goal. AI watches what learner does. */
      type: "explore-sandbox";
      heading: string;
      sim: string;
      config?: Record<string, unknown>;
      promptUz: string;
      /** Minimum interactions before card unlocks. */
      minInteractions: number;
      voice?: string;
    }
  | {
      /** Manifesto kind: sim with a goal + win condition + try counter. */
      type: "challenge";
      heading: string;
      sim: string;
      config?: Record<string, unknown>;
      goalUz: string;
      /** Win check is sim-specific; sim emits onWin via SimProps.onComplete. */
      voice?: string;
    }
  | {
      /** Manifesto kind: 3-5 sim runs varying one param; learner picks the pattern. */
      type: "pattern-discover";
      heading: string;
      sim: string;
      paramName: string;
      paramValues: number[];
      patternOptions: string[];
      correctIndex: number;
      revealFormulaUz: string;
      voice?: string;
    }
  | {
      /** Manifesto kind: two side-by-side scenarios; learner picks + justifies. */
      type: "compare-and-decide";
      heading: string;
      scenarioA: { titleUz: string; simConfig: Record<string, unknown> };
      scenarioB: { titleUz: string; simConfig: Record<string, unknown> };
      sim: string;
      questionUz: string;
      correctScenario: "A" | "B";
      reveal: string;
      voice?: string;
    }
  | {
      /** Manifesto kind: assemble components to achieve an outcome. */
      type: "build";
      heading: string;
      sim: string;
      paletteUz: string;
      goalUz: string;
      voice?: string;
    }
  | {
      type: "done";
      title: string;
      body: string;
    };

export interface Lesson {
  id?: string;
  subject: "math" | "history" | "physics" | "chemistry" | "biology" | "maxsus";
  subjectLabel: string;
  title: string;
  cards: Card[];
  mentorId?: PersonaId;
}

/**
 * Cached demo lesson — Grade 6 mathematics, built from the extracted curriculum
 * (LEARN-MODE.md §3: the demo runs on pre-built cached cards, never live generation).
 */
export const demoLesson: Lesson = {
  id: "boluvchi",
  subject: "math",
  subjectLabel: "MATEMATIKA",
  title: "Sonning bo'luvchilari va karralisi",
  cards: [
    {
      type: "intro",
      title: "Sonning bo'luvchilari va karralisi",
      hook: "Bugun bo'luvchi va karralini o'rganamiz — bu kasrlar, EKUB va EKUK uchun kalit. 8 daqiqada birga yoritamiz.",
      estMinutes: 8,
      cardCount: 8,
    },
    {
      type: "simulation",
      heading: "12 ta kvadrat — to'rtburchakka tizing",
      sim: "divisor-grid",
      instruction:
        "Slayderni harakatlantiring. Qaysi qator soni 12 ta kvadratdan mukammal to'rtburchak yasaydi?",
      config: { n: 12 },
      reveal:
        "12 ning bo'luvchilari aniq 6 ta: 1, 2, 3, 4, 6, 12. Bular — to'rtburchakka tizilgan qatorlar. Boshqalar qoldiq qoldiradi.",
    },
    {
      type: "discover",
      prompt: "Endi, qaysi sonlar 12 ning bo'luvchisi? Hammasini tanlang.",
      pool: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      correct: [1, 2, 3, 4, 6, 12],
      reveal:
        "Mana — 12 ning bo'luvchilari: 1, 2, 3, 4, 6 va 12. Bo'luvchi — boshqa sonni qoldiqsiz bo'ladigan son.",
    },
    {
      type: "sequence",
      prompt: "5 ning karralilarini kichikdan kattaga qarab tartib bilan tanlang.",
      pool: [10, 25, 7, 5, 20, 12, 15, 9],
      order: [5, 10, 15, 20, 25],
      reveal:
        "5 ning karralilari: 5, 10, 15, 20, 25 ... Karrali — sonni 1, 2, 3 ... ga ko'paytirib hosil qilinadi.",
    },
    {
      type: "sort",
      prompt: "Har bir son 12 ning bo'luvchisimi yoki karralisimi?",
      bucketA: "Bo'luvchisi",
      bucketB: "Karralisi",
      items: [
        { value: 3, bucket: "A" },
        { value: 24, bucket: "B" },
        { value: 4, bucket: "A" },
        { value: 36, bucket: "B" },
        { value: 6, bucket: "A" },
        { value: 48, bucket: "B" },
      ],
      reveal:
        "Bo'luvchi sonni qoldiqsiz bo'ladi va undan katta bo'lmaydi. Karrali esa sondan katta — uni ko'paytirishdan chiqadi.",
    },
    {
      type: "numberline",
      prompt: "Sonlar o'qida 3 ning karralilarini belgilang.",
      max: 12,
      correct: [3, 6, 9, 12],
      reveal:
        "3 ning karralilari o'q bo'ylab teng oraliqda turadi: 3, 6, 9, 12 ... Har bir qadam — 3 taga.",
    },
    {
      type: "ask",
      heading: "Yana savolingiz bormi?",
      topic: "sonning bo'luvchilari va karralisi",
    },
    {
      type: "done",
      title: "Bir yulduz yondi",
      body: "Bo'luvchi sonni bo'ladi, karrali esa sondan ko'payadi. Keyingi darsda shu bilim ustiga EKUB va EKUKni quramiz.",
    },
  ],
};

/**
 * Maxsus bonus lesson — the Brachistochrone. The "fastest path is not a
 * straight line" — a topic that's almost never in school curricula globally
 * (including Uzbekistan), but is one of the most beautiful results in physics.
 * Includes the simulation as the centerpiece + the Newton overnight story.
 */
export const brachistochroneLesson: Lesson = {
  id: "brachistochrone",
  subject: "physics",
  subjectLabel: "MAXSUS · FIZIKA",
  title: "Eng tez yo'l qaysi?",
  cards: [
    {
      type: "intro",
      title: "Eng tez yo'l qaysi?",
      hook: "A nuqtadan B nuqtaga to'p qanday yo'l bilan eng tez yetib boradi? To'g'ri chiziqmi? Yoki boshqacha? Bir taxmin qiling — keyin sinab ko'ramiz.",
      estMinutes: 6,
      cardCount: 9,
      voice:
        "Sizdan bir savol. To'pni A nuqtadan B nuqtaga eng tez qaysi yo'l bilan tushiramiz? To'g'ri chiziq deysizmi? Bu eng oson taxmin. Lekin Nyuton ham bunda xato qilgan edi.",
    },
    {
      type: "mcq",
      question: "Sizning fikringizcha, eng tez yo'l qaysi?",
      options: [
        "To'g'ri chiziq (eng qisqa yo'l)",
        "Yumshoq yoy (egilgan)",
        "Pastga keskin tushish, keyin tekis",
        "Maxsus egri chiziq — sikloid",
      ],
      correctIndex: 3,
      explain:
        "Eng tez yo'l — to'g'ri chiziq emas. U sikloid deb ataladi: maxsus egri chiziq. Pastda u boshlanishida tez tushiriladi, keyin tezroq yuguradi. Endi sinab ko'ring.",
      hint: "Eng qisqa yo'l har doim ham eng tez yo'l emas — siz qanchalik tez pastga tushsangiz, shunchalik tez yugurasiz.",
    },
    {
      type: "simulation",
      heading: "Uchta yo'l. Uchta to'p. Qaysi g'olib?",
      sim: "brachistochrone",
      instruction:
        "\"Yugurtirish\" tugmasini bosing. Har bir to'pning vaqti pastda ko'rsatiladi.",
      reveal:
        "Sikloid g'olib! Egri chiziq to'pni boshlanishida tezroq tushiriladi — shu tezlik bilan u qolgan yo'lda yugurib boradi. To'g'ri chiziq — qisqa, lekin sekin.",
    },
    {
      type: "diagram",
      heading: "Sikloid qanday hosil bo'ladi",
      prompt:
        "Clean minimal educational physics diagram, side view, warm cream background. A wheel rolls along a horizontal line from left to right. A single highlighted point on the rim of the wheel traces a beautiful arched curve above the line as the wheel rolls. Show the wheel in three positions along the line with the traced cycloid curve drawn in a single elegant warm gold stroke. Soft pencil-line shading, no text labels, no watermarks, vector illustration style, textbook physics aesthetic, generous whitespace.",
        src: "/lesson-images/2222660cc89e8226.png",
        caption:
        "Sikloid — bu doirani chiziq bo'ylab dumalatsangiz, uning ustidagi nuqta chizadigan iz. Doim aynan shu shaklda.",
    },
    {
      type: "story",
      heading: "Nyuton bir kechada hal qilgan",
      body:
        "1696-yilda Yogann Bernulli butun dunyo matematiklariga shu savolni tashladi: \"Aql egalari, qaysi yo'l eng tez?\"\n\nOlti oy ichida besh nafar yechim keldi — Leybnitsdan, Bernulli akasidan, L'Opitaldan, fon Chirnxauzdan. Beshinchi yechim Angliyadan anonim ravishda yuborilgan edi.\n\nBernulli xatni ochib, qo'l yozuvini ko'rib turib aytdi: \"Sherni panjasidan taniyman.\" Bu Isaak Nyuton edi. U muammoni soat 4da olib, ertasi tongga qadar — bir kecha ichida — yechgan.",
      voice:
        "Bin olti yuz to'qson oltinchi yilda Yogann Bernulli butun dunyo matematiklariga savol tashladi. Besh oydan keyin beshinchi yechim Angliyadan anonim keldi. Bernulli xatni ochib aytdi: sherni panjasidan taniyman. Bu Isaak Nyuton edi. U masalani bir kechada yechgan.",
    },
    {
      type: "explainer",
      heading: "Sikloid bizning hayotimizda",
      body:
        "Sikloid — doirani chiziq bo'ylab dumalatganda uning ustidagi nuqta chizadigan iz. Bu egri chiziq go'zal va kuchli:\n\n• Eng tez tushadigan amerikalik gorka aynan shu shaklda quriladi.\n• Gyuygens (1659) sikloid yo'lda osilgan mayatnik bilan mukammal vaqt o'lchaydigan soat yasagan — uning tebranish vaqti amplitudaga bog'liq emas.\n• Optimallashtirish algoritmlari, jumladan, mashinaviy o'rganishdagi gradient tushuvi shu printsipga asoslanadi: \"eng tez yo'l\" ni topish.\n\nBir egri chiziq — yuzlab kashfiyotlar boshlanishi.",
    },
    {
      type: "mcq",
      question: "Sikloid haqida qaysi javob to'g'ri?",
      options: [
        "Doirani chiziq bo'ylab dumalatganda uning ustidagi nuqta chizadi",
        "U har doim eng qisqa yo'l",
        "U faqat matematik o'yin, amalda ishlatilmaydi",
        "Uni faqat 17-asrda Nyuton kashf qilgan",
      ],
      correctIndex: 0,
      explain:
        "Sikloid — doira chiziq bo'ylab dumalatilganda uning ustidagi nuqta chizadigan iz. Bugun ham fizika, dizayn va injenerlikda ishlatiladi.",
      hint: "Doirani stol ustida dumalating va uning ustidagi nuqta qanday yo'l chizishini tasavvur qiling.",
    },
    {
      type: "ask",
      heading: "Yana savolingiz bormi?",
      topic: "brakhistoxron va sikloid — Nyutonning bir kechalik yechimi",
    },
    {
      type: "done",
      title: "Bir yulduz yondi",
      body:
        "Siz hozir Nyuton bir kechada yechgan masala bilan tanishdingiz — bu masala dunyodagi maktablarning hech birida o'qitilmaydi. To'g'ri chiziq har doim ham eng tez yo'l emas. Keyingi safar tanlov qilganingizda, eslang.",
    },
  ],
};

/**
 * Grade-6 Physics lessons — authored from the official Uzbekistan textbook
 * curriculum (infoedu.uz/darsliklar/6/6-sinf-fizika). Each lesson mirrors the
 * Card DSL shape of the math demo: intro + interactive beats + story/diagram +
 * ask + done. Subject label is "FIZIKA" and they ignite the physics
 * constellation built in `lib/sky.ts`.
 */

// ---- Bob I · Modda tuzilishi · Broun harakati va diffuziya ----------------
export const brounLesson: Lesson = {
  id: "broun",
  subject: "physics",
  subjectLabel: "FIZIKA",
  title: "Broun harakati va diffuziya",
  cards: [
    {
      type: "intro",
      title: "Hech kim itarmaydi — lekin harakatlanadi",
      hook:
        "Bir piyola issiq suvga bir tomchi sut tomizing. Aralashtirmasangiz ham, sut o'zi yoyila boshlaydi. Nima uni harakatga keltiradi? Bugun shu sirni ochamiz — 7 daqiqada.",
      estMinutes: 7,
      cardCount: 8,
    },
    {
      type: "mcq",
      question:
        "Issiq suvga bir tomchi sut tomizdingiz va aralashtirmadingiz. Bir necha daqiqadan keyin nima bo'ladi?",
      options: [
        "Hech narsa — sut bir joyda turaveradi",
        "Sut pastga cho'kadi, suv tepada qoladi",
        "Sut sekin butun suv bo'ylab yoyiladi",
        "Sut bug'lanib ketadi",
      ],
      correctIndex: 2,
      explain:
        "To'g'ri — sut molekulalari suv molekulalari bilan to'qnashib, butun idish bo'ylab yoyiladi. Bu — diffuziya.",
      hint:
        "Molekulalar bir-biri bilan to'xtovsiz to'qnashadi. Bu to'qnashuvlar sut zarralarini hamma tomonga itaradi.",
    },
    {
      type: "explainer",
      heading: "Molekulalar tinmaydi",
      body:
        "Har qanday modda — suv, havo, hatto qattiq tosh — kichik zarralardan, molekulalardan tashkil topgan. Bu molekulalar har doim harakatlanadi, sekundiga millionlab marta bir-biri bilan to'qnashadi.\n\nIssiqlik qanchalik baland bo'lsa, harakat shunchalik kuchli. Shuning uchun issiq choyga qand tezroq eriydi, sovuq suvga sekinroq.\n\nDiffuziya — bir moddaning ikkinchi modda ichiga shu molekulyar harakat hisobiga o'z-o'zidan yoyilishi.",
    },
    {
      type: "simulation",
      heading: "Mikroskop ostida — bir gulchang zarrasi",
      sim: "brownian",
      instruction:
        "Suvni qizdiring. Oltin gulchangning izini kuzating. Keyin \"Molekulalarni ko'rsatish\" tugmasini bosing — kim uni itarayotganini ko'ring.",
      reveal:
        "Gulchang zig-zag yuradi — uni million molekula har tomondan uradi. Harorat oshganda urishlar kuchayadi, harakat kengayadi. Bu — Broun harakati.",
    },
    {
      type: "story",
      heading: "Robert Broun va bir gulchang",
      body:
        "1827-yilda shotlandiyalik botanik Robert Broun mikroskop ostida suvdagi gulchang zarralarini kuzatdi. Zarralar to'xtamasdan, hech kim itarmasdan, zig-zag yo'l bilan harakatlanardi.\n\nBroun sababini topa olmadi. Faqat 78 yildan keyin, 1905-yilda yosh xizmatchi Albert Eynshteyn bu harakatni tushuntirdi: ko'rinmas suv molekulalari gulchangni har tomondan urib turibdi.\n\nShu bir nazariya bilan Eynshteyn molekulalarning haqiqatda mavjudligini isbotladi.",
    },
    {
      type: "mcq",
      question: "Diffuziya qaysi muhitda eng tez yuz beradi?",
      options: [
        "Qattiq jismda (masalan, temirda)",
        "Suyuqlikda (suvda)",
        "Gazda (havoda)",
        "Hamma joyda bir xil tezlikda",
      ],
      correctIndex: 2,
      explain:
        "To'g'ri — gazda molekulalar bir-biridan uzoq turadi va eng tez harakat qiladi, shuning uchun atir hidi xonaga eng tez tarqaladi.",
      hint:
        "Molekulalar qaerda erkin va tez harakat qiladi? Qaerda zich joylashgan va sekin?",
    },
    {
      type: "ask",
      heading: "Yana savolingiz bormi?",
      topic: "broun harakati va diffuziya",
    },
    {
      type: "done",
      title: "Bir yulduz yondi",
      body:
        "Endi sutning suvda yoyilishidan ortida nima borligini bilasiz: million molekula, bir soniyada million to'qnashuv. Keyingi safar atir hidi xonani to'ldirsa — eslang.",
    },
  ],
};

// ---- Bob II · Arximed qonuni ----------------------------------------------
export const arximedLesson: Lesson = {
  id: "arximed",
  subject: "physics",
  subjectLabel: "FIZIKA",
  title: "Arximed qonuni — nega kema cho'kmaydi?",
  cards: [
    {
      type: "intro",
      title: "Nega kema cho'kmaydi?",
      hook:
        "Yog'och suvda suzadi, tosh cho'kadi. Lekin po'latdan yasalgan kema — tosh emas, og'irroq — suvda suzadi. Bu qanday mumkin? Bir yechim bor: u 2200 yil avval kashf etilgan.",
      estMinutes: 8,
      cardCount: 10,
    },
    {
      type: "mcq",
      question:
        "Bir piyola to'la suvga toshni tushirdingiz. Suv qaynab to'kildi. Nima uchun?",
      options: [
        "Tosh issiq edi",
        "Tosh suvni o'zining hajmiga teng siqib chiqardi",
        "Suv tosh og'irligidan to'kildi",
        "Tosh suvni qaynatdi",
      ],
      correctIndex: 1,
      explain:
        "To'g'ri — har qanday jism suvga tushirilganda, o'zining hajmiga teng suvni siqib chiqaradi. Aynan shu kashfiyot Arximed qonunining asosi.",
      hint:
        "Toshning hajmiga e'tibor bering. U joy egallaganda, suvga nima bo'lishi kerak?",
    },
    {
      type: "story",
      heading: "Yevreka! — Arximed vannada",
      body:
        "Mil. avv. 250-yil. Sirakuza shohi Hieron oltindan toj yasattirdi, lekin zargar uni kumush bilan aldagan deb shubhalandi. Toj sof oltinmi yoki yo'qmi?\n\nShoh muammoni Arximedga berdi. Olim kunlar davomida o'yladi, javob topa olmadi. Bir kuni vannaga kirib, suv to'kilganini ko'rdi va birdaniga tushundi: jismning hajmini siqib chiqargan suv bilan o'lchash mumkin.\n\nU vannadan yalang'och chiqib, ko'cha bo'ylab \"Yevreka! Yevreka!\" — \"Topdim! Topdim!\" deb yugurdi. Tojni o'lchadi: u sof oltindan kichik hajm chiqargandi. Zargar haqiqatan aldagan edi.",
    },
    {
      type: "explainer",
      heading: "Arximed qonuni",
      body:
        "Suvga (yoki har qanday suyuqlikka) botirilgan jismga, yuqoriga ko'tariluvchi kuch ta'sir qiladi. Bu kuch — jism siqib chiqargan suyuqlik og'irligiga teng.\n\nQisqacha: F = ρ · g · V\n\nQayerda ρ — suyuqlik zichligi, g — erkin tushish tezlanishi (≈10 m/s²), V — jism suvga botgan qism hajmi.\n\nAgar bu ko'taruvchi kuch jism og'irligidan katta bo'lsa — jism suzadi. Kichikroq bo'lsa — cho'kadi. Aynan teng bo'lsa — suv ostida muvozanat saqlaydi.",
    },
    {
      type: "simulation",
      heading: "O'zingiz tashlang, o'zingiz ko'ring",
      sim: "buoyancy",
      instruction:
        "Tepadagi jismlarni idishga torting. Suv ko'tariladi, ikki o'q paydo bo'ladi. Suyuqlikni almashtirib ko'ring — temir simobda suzadi.",
      reveal:
        "Har bir jismga ikki kuch ta'sir qiladi: og'irlik — pastga, Arximed kuchi — yuqoriga. Arximed = siqib chiqargan suyuqlik og'irligi. Jismning o'rtacha zichligi suyuqlikdan kichik bo'lsa — suzadi.",
    },
    {
      type: "mcq",
      question:
        "Po'lat zichligi suvdan 8 marta katta. Unday bo'lsa, nega po'lat kema suzadi?",
      options: [
        "Kemada havo bor, va kema + havoning umumiy zichligi suvdan kichik",
        "Po'lat suvda zichligini yo'qotadi",
        "Kema motori uni yuqorida ushlab turadi",
        "Suv kemani magnit kabi tortadi",
      ],
      correctIndex: 0,
      explain:
        "To'g'ri — kemaning bo'sh ichi havo bilan to'la. Kema + havo birgalikda juda katta hajmni egallaydi, lekin og'irligi nisbatan kichik. Shuning uchun o'rtacha zichlik suvdan past — suzadi.",
      hint:
        "Kemaning ichi bo'shmi yoki to'lami? Bo'sh joy nima bilan to'lgan?",
    },
    {
      type: "sort",
      prompt:
        "Quyidagi zichliklar (g/sm³ × 10). Suvning zichligi 10. Qaysisi suvda suzadi, qaysisi cho'kadi?",
      bucketA: "Suzadi (zichlik < 10)",
      bucketB: "Cho'kadi (zichlik > 10)",
      items: [
        { value: 2, bucket: "A" }, // probka
        { value: 9, bucket: "A" }, // muz
        { value: 8, bucket: "A" }, // yog'och
        { value: 27, bucket: "B" }, // alyuminiy
        { value: 78, bucket: "B" }, // temir
        { value: 193, bucket: "B" }, // oltin
      ],
      reveal:
        "Probka (2), muz (9), yog'och (8) — suvdan yengilroq, suzadi. Alyuminiy (27), temir (78), oltin (193) — suvdan zichroq, cho'kadi. Sof Arximed qoidasi.",
    },
    {
      type: "explainer",
      heading: "Beruniy va Hozin — bizning olimlarimiz",
      body:
        "Arximed qonunini biz O'zbekiston tarixida ham uchratamiz. XI asrda buyuk olim Abu Rayhon Beruniy va uning shogirdi Hozin moddalar zichligini juda aniq o'lchaydigan asboblar yaratdilar.\n\nBeruniy 18 ta turli moddaning — oltin, kumush, qo'rg'oshin, mis, qalay — zichligini o'lchadi. Uning natijalari bugungi qiymatlarga ajoyib darajada yaqin chiqdi, 800 yildan oldin yozilganiga qaramay.\n\nFizika faqat Yevropada emas, bizning yurtimizda ham qadimdan o'rganilgan.",
    },
    {
      type: "ask",
      heading: "Yana savolingiz bormi?",
      topic: "Arximed qonuni va suzish kuchi",
    },
    {
      type: "done",
      title: "Bir yulduz yondi",
      body:
        "Endi po'lat kemaning sirini, Yevreka qichqirig'ining manosini, Beruniyning aniqligini bilasiz. Suvga jism tashlaganingizda — yodda tuting: u o'z hajmiga teng suvni surib chiqaradi, va shu kuch uni ushlab turadi.",
    },
  ],
};

// ---- Bob VI · Yorug'lik · Quyosh va Oy tutilishi --------------------------
export const tutilishLesson: Lesson = {
  id: "tutilish",
  subject: "physics",
  subjectLabel: "FIZIKA",
  title: "Quyosh va Oy tutilishi",
  cards: [
    {
      type: "intro",
      title: "Quyosh kunduzi qora bo'lib qoladi",
      hook:
        "Yiliga bir necha marta, Quyosh kunduzi qora bo'ladi. Yulduzlar paydo bo'ladi. Qushlar uxlashga uchadi. Bu sehr emas — bu geometriya. Bugun ko'k osmonda nima bo'layotganini birga ko'ramiz.",
      estMinutes: 7,
      cardCount: 9,
    },
    {
      type: "mcq",
      question: "Quyosh tutilishi qachon yuz beradi?",
      options: [
        "Oy Yer va Quyosh o'rtasiga to'g'ri kelganda",
        "Yer Oy va Quyosh o'rtasiga kelganda",
        "Quyosh Yer va Oyning o'rtasiga kelganda",
        "Oy kichrayganda",
      ],
      correctIndex: 0,
      explain:
        "To'g'ri — Quyosh tutilishi yangi oy davrida, Oy Yer va Quyosh o'rtasiga turg'un chiziq bo'ylab kelganda yuz beradi. Oy soyasi Yerga tushadi.",
      hint:
        "Tutilish — bir jism boshqasini to'sib qo'yishi. Quyoshni nima to'sa?",
    },
    {
      type: "simulation",
      heading: "Oyni torting, soyani Yerga tushiring",
      sim: "eclipse",
      instruction:
        "Oyni Quyosh va Yer o'rtasiga torting. Soya konusini ko'rasiz — uni Yerga tegizing. Qiyalikni ham siljiting: nega tutilish har oyda bo'lmaydi?",
      reveal:
        "Tutilish — uchta jismning aniq chizilgan qatorga tushishi. Oy orbitasi 5° qiya bo'lgani uchun, soya odatda Yerdan o'tib ketadi. Yiliga atigi 2-5 marta tutilish bo'ladi.",
    },
    {
      type: "explainer",
      heading: "Soya va yarim soya",
      body:
        "Yorug'lik to'g'ri chiziq bo'ylab tarqaladi — soya shu yo'l-yo'lakay paydo bo'ladi. Lekin Oy soyasi oddiy emas: u ikki qismdan iborat.\n\nUmbra — to'liq qorong'i ichki soya. Bu yerda Quyosh butunlay to'silgan, to'liq Quyosh tutilishi ko'rinadi.\n\nPenumbra — qisman qorong'i tashqi soya. Bu yerdan Quyoshning bir qismi ko'rinadi — qisman tutilish.\n\nShuning uchun bir tutilishni Toshkentda to'liq ko'rishingiz mumkin, Samarqandda esa faqat qisman ko'rinadi.",
    },
    {
      type: "story",
      heading: "Beruniy va 1019-yilgi tutilish",
      body:
        "1019-yilda, Buyuk olim Abu Rayhon Beruniy Hindistonda yashagan paytda Quyosh tutilishini bevosita kuzatdi. U faqat tomosha qilmadi — vaqtni, davomiyligini, soyaning shaklini aniq yozib qoldirdi.\n\nO'sha kuzatuvlar asosida Beruniy Yerning radiusini hisoblab chiqdi. Uning natijasi — 6339,9 km. Bugungi aniq qiymat — 6371 km. Xato bor-yo'g'i 0,5%.\n\nMing yil oldin, teleskop ham, sun'iy yo'ldosh ham yo'q paytda — geometriya va aql bilan.",
    },
    {
      type: "mcq",
      question:
        "Oy tutilishi nima? Bunda Oy Yer soyasiga kiradi va qizg'ish rangga bo'yaladi.",
      options: [
        "Yer Quyosh va Oy o'rtasiga kelganda",
        "Oy Quyosh va Yer o'rtasiga kelganda",
        "Quyosh Oy ortida turganda",
        "Oy o'zi qorong'i bo'lganda",
      ],
      correctIndex: 0,
      explain:
        "To'g'ri — Oy tutilishi to'liq oy davrida, Yer Quyosh va Oy o'rtasiga to'g'ri kelganda yuz beradi. Yer soyasi Oyga tushadi. Atmosferadan o'tgan qizil yorug'lik Oyni qizg'ish-misli ko'rinishga keltiradi — \"qonli oy\".",
      hint:
        "Oy tutilishida soya kim tomonidan tushiriladi? Quyosh tutilishida-chi?",
    },
    {
      type: "sequence",
      prompt:
        "To'liq Quyosh tutilishining bosqichlarini tartib bilan tanlang (1 dan 4 gacha).",
      pool: [3, 1, 4, 2],
      order: [1, 2, 3, 4],
      reveal:
        "1 — Oy Quyoshning chekkasini to'sa boshlaydi (qisman tutilish). 2 — Oy Quyosh diskini deyarli to'liq qoplaydi. 3 — To'liq tutilish: faqat tojli halqa ko'rinadi (2-3 daqiqa). 4 — Oy chiqib ketadi, kunduz qaytadi.",
    },
    {
      type: "ask",
      heading: "Yana savolingiz bormi?",
      topic: "Quyosh va Oy tutilishi, soya va yarim soya",
    },
    {
      type: "done",
      title: "Bir yulduz yondi",
      body:
        "Endi tutilishlar tasodif emas — Quyosh, Oy va Yerning aniq geometrik qatorga tushishi ekanini bilasiz. Va Beruniy ming yil avval shu hodisani bizning yurtimizda hisob-kitobga aylantirgan.",
    },
  ],
};

// ---- Bob VI · Yorug'lik · Kamalak va spektr -------------------------------
export const kamalakLesson: Lesson = {
  id: "kamalak",
  subject: "physics",
  subjectLabel: "FIZIKA",
  title: "Kamalak — oq nurning siri",
  cards: [
    {
      type: "intro",
      title: "Oq yorug'likning ichida 7 ta rang yashiringan",
      hook:
        "Bahor yomg'iridan keyin osmonda kamalak chiqadi. Lekin oq Quyosh nuri qayerdan rang oladi? Javob: hech qayerdan — ranglar har doim ichida bor edi. Bugun Nyutonning kashfiyotini takrorlaymiz.",
      estMinutes: 7,
      cardCount: 9,
    },
    {
      type: "mcq",
      question: "Kamalak qachon hosil bo'ladi?",
      options: [
        "Quyosh nuri havodagi suv tomchilaridan o'tib qaytganda",
        "Bulutlar rang berib qaytganda",
        "Quyoshning o'zi rang chiqarganda",
        "Yer sayyorasi soya bersagina",
      ],
      correctIndex: 0,
      explain:
        "To'g'ri — havoda osilgan suv tomchilari kichik prizma vazifasini bajaradi. Oq nur ichkariga kirib, har bir rang turli burchakda sinadi va qaytadi. Shuning uchun ranglar ajraladi.",
      hint:
        "Kamalakni qachon ko'rasiz — quruq kunmi yoki yomg'irdan keyin?",
    },
    {
      type: "simulation",
      heading: "Nyuton qildi — siz ham qiling",
      sim: "prism",
      instruction:
        "Oq nur manbaini torting va prizmaga turli burchak ostida yo'naltiring. Uchki burchakni o'zgartiring. Qachon spektr 4° dan kengayadi?",
      reveal:
        "Har bir rangning to'lqin uzunligi turlicha — shisha ichida ular turli burchakda sinadi. Qisqa to'lqin (binafsha) eng kuchli, uzun to'lqin (qizil) eng kam. Aynan shu kashfiyot — Nyuton 1666 yilda.",
    },
    {
      type: "story",
      heading: "Nyutonning xonasi, 1666-yil",
      body:
        "23 yoshli Isaak Nyuton vabo tufayli universitetdan uyiga qaytdi. Uyda zerikkanida darchani qora qog'oz bilan to'sib, faqat kichik teshik qoldirdi.\n\nQuyosh nuri teshikdan o'tib, devorda oq dog' qoldirdi. Nyuton dog' yo'liga shisha prizmani qo'ydi — va devorda kamalak paydo bo'ldi.\n\nO'sha paytda ko'pchilik prizma o'zi rang yaratadi deb o'ylardi. Nyuton ikkinchi prizmani teskari qo'yib, ranglarni yana oq nurga birlashtirdi. Demak ranglar prizmadan emas, Quyoshning o'zidan keladi.\n\nShu bir tajriba bilan optika ilmi tug'ildi.",
    },
    {
      type: "explainer",
      heading: "Nima uchun ranglar ajraladi?",
      body:
        "Har bir rang yorug'likning bir to'lqin uzunligiga mos keladi. Qizil — eng uzun to'lqin (≈700 nm), binafsha — eng qisqa (≈400 nm).\n\nYorug'lik shishaga (yoki suv tomchisiga) kirganda burchakni o'zgartiradi — bu sinish deb ataladi. Qisqa to'lqin (binafsha) ko'proq, uzun to'lqin (qizil) kamroq siniadi.\n\nShuning uchun oq nurning ranglari prizmadan chiqib turli yo'nalishlarga ketadi. Yomg'irdan keyin osmondagi millionlab tomchilar — milliardlab kichik prizmalar.",
    },
    {
      type: "sort",
      prompt:
        "Quyidagi yorug'lik to'lqin uzunliklari (nanometrda). Qaysisi qizil-to'q sariq tomonda, qaysisi ko'k-binafsha tomonda?",
      bucketA: "Qizil tomon (uzun to'lqin)",
      bucketB: "Ko'k tomon (qisqa to'lqin)",
      items: [
        { value: 700, bucket: "A" },
        { value: 650, bucket: "A" },
        { value: 620, bucket: "A" },
        { value: 470, bucket: "B" },
        { value: 450, bucket: "B" },
        { value: 400, bucket: "B" },
      ],
      reveal:
        "Qizil 700 nm dan boshlanadi va sekin sariq, yashilga o'tadi. 500 nm dan past — ko'k va binafsha. Eng qisqa to'lqin — eng kuchli sinadi.",
    },
    {
      type: "mcq",
      question:
        "Prizmadan chiqayotganda eng kuchli siniadigan rang qaysi?",
      options: [
        "Qizil",
        "Yashil",
        "Sariq",
        "Binafsha",
      ],
      correctIndex: 3,
      explain:
        "To'g'ri — binafsha eng qisqa to'lqin uzunligiga ega va shisha ichida eng katta burchak bilan sinadi. Shuning uchun spektrda u eng pastda turadi.",
      hint:
        "Qisqa to'lqin qattiqroq siniadi. Spektrda eng qisqa to'lqin qaysi rang?",
    },
    {
      type: "ask",
      heading: "Yana savolingiz bormi?",
      topic: "kamalak, prizma va yorug'lik spektri",
    },
    {
      type: "done",
      title: "Bir yulduz yondi",
      body:
        "Keyingi safar kamalakni ko'rsangiz, eslang: u havodagi suv tomchilarining ichidagi geometriya. Nyutondan 360 yil keyin, siz ham xuddi o'sha kashfiyotni takrorladingiz.",
    },
  ],
};

/**
 * EKUB va EKUK — the natural sequel to boluvchi. Lights up the second math
 * star after the student finishes the first. Same teaching shape: discover
 * the common divisors, recognise patterns, then bridge to "why this matters
 * for fractions."
 */
export const ekubEkukLesson: Lesson = {
  id: "ekub-ekuk",
  subject: "math",
  subjectLabel: "MATEMATIKA",
  title: "EKUB va EKUK",
  cards: [
    {
      type: "intro",
      title: "EKUB va EKUK — ikki nomdan bitta hikoya",
      hook: "Bo'luvchi va karralini bilasiz. Endi ikkita son ustida ishlaymiz — eng katta umumiy bo'luvchi (EKUB) va eng kichik umumiy karralisi (EKUK). Bularsiz kasrlar bilan ishlash qiyin.",
      estMinutes: 8,
      cardCount: 7,
    },
    {
      type: "discover",
      prompt: "12 va 18 ning umumiy bo'luvchilarini toping. Hammasini belgilang.",
      pool: [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 18],
      correct: [1, 2, 3, 6],
      reveal:
        "12 ning bo'luvchilari: 1, 2, 3, 4, 6, 12. 18 ning bo'luvchilari: 1, 2, 3, 6, 9, 18. Umumiylari: 1, 2, 3, 6. Ulardan eng kattasi — 6. Demak EKUB(12, 18) = 6.",
    },
    {
      type: "explainer",
      heading: "Ta'rif — qisqacha",
      body: "EKUB (eng katta umumiy bo'luvchi) — ikkala songa ham qoldiqsiz bo'linadigan eng katta son.\n\nEKUK (eng kichik umumiy karralisi) — ikkala songa ham qoldiqsiz bo'linadigan eng kichik son.\n\nEKUB ≤ kichik son · EKUK ≥ katta son. Aniq formula: EKUB × EKUK = a × b.",
    },
    {
      type: "sequence",
      prompt: "4 va 6 ning umumiy karralilarini kichikdan kattaga tartib bilan tanlang.",
      pool: [8, 12, 18, 24, 9, 6, 36, 10],
      order: [12, 24, 36],
      reveal:
        "12, 24, 36 — bularning hammasi 4 ga ham, 6 ga ham bo'linadi. Eng kichigi 12 — bu EKUK(4, 6).",
    },
    {
      type: "mcq",
      question: "EKUK(8, 12) ni toping. Tezkor usul: 8 va 12 ning karralilarini sanab chiqing.",
      options: ["16", "24", "32", "48"],
      correctIndex: 1,
      explain:
        "8 ning karralilari: 8, 16, 24, 32, 40 ... 12 ning karralilari: 12, 24, 36 ... Birinchi uchragan umumiy son — 24. EKUK(8, 12) = 24.",
      hint: "Ikkala songa ham bo'linadigan eng kichik sonni qidiring. 16 — faqat 8 ga bo'linadi; 24 — ikkalasiga ham.",
    },
    {
      type: "mcq",
      question: "Nima uchun EKUB va EKUKni o'rganamiz? Asosiy foydasi:",
      options: [
        "Faqat darslik mashqlari uchun",
        "Har xil maxrajli kasrlarni qo'shish va qisqartirish uchun",
        "Sonlarni xotirada saqlash uchun",
        "Hech qanday foydasi yo'q",
      ],
      correctIndex: 1,
      explain:
        "Aynan shunday. 1/4 + 1/6 ni hisoblash uchun avval EKUK(4,6) = 12 ni topamiz, keyin maxrajlarni 12 ga keltiramiz. EKUB esa kasrni qisqartirishda kerak — 6/12 = 1/2 chunki EKUB(6,12) = 6.",
      hint: "Keyingi mavzu kasrlar — shunda yaqqol ko'rasiz.",
    },
    {
      type: "done",
      title: "Ikkinchi yulduz yondi",
      body: "EKUB — eng katta umumiy bo'luvchi. EKUK — eng kichik umumiy karralisi. Bu ikkisi kasrlar uyiga ochqich. Keyingi darsda kasrlarning o'zini birga ko'ramiz.",
    },
  ],
};

/**
 * Oddiy kasrlar — fractions intro. Builds on EKUB to introduce numerator/
 * denominator and the geometric "share of the whole" intuition.
 */
export const oddiyKasrLesson: Lesson = {
  id: "oddiy-kasr",
  subject: "math",
  subjectLabel: "MATEMATIKA",
  title: "Oddiy kasrlar",
  cards: [
    {
      type: "intro",
      title: "Oddiy kasrlar — donadan butungacha",
      hook: "Pitsa 8 ga bo'lingan. Siz 3 bo'lakni oldingiz — kasr 3/8. Bugun shu yozuvni o'qishni, qiyoslashni va qisqartirishni o'rganamiz.",
      estMinutes: 7,
      cardCount: 6,
    },
    {
      type: "explainer",
      heading: "Surat va maxraj",
      body: "Har bir kasrning ikki qismi bor:\n\n• Maxraj (pastda) — butun nechta teng bo'lakka bo'lingan.\n• Surat (yuqorida) — siz nechta bo'lakni olganingiz.\n\n3/8 — butun 8 ga bo'lingan, siz 3 ta bo'lak oldingiz. Maxraj nolga teng bo'lolmaydi — narsani 0 ga bo'lib bo'lmaydi.",
    },
    {
      type: "mcq",
      question: "Qaysi kasr kattaroq: 1/3 yoki 1/5?",
      options: ["1/3 — chunki maxraj kichikroq, bo'laklar kattaroq", "1/5 — chunki maxraj kattaroq"],
      correctIndex: 0,
      explain:
        "1/3 katta. Pitsani 3 ga bo'lsak, har bir bo'lak kattaroq; 5 ga bo'lsak, har bir bo'lak kichikroq. Surat bir xil bo'lganda — maxraj kichik bo'lsa, kasr katta bo'ladi.",
      hint: "Pitsani 3 ta katta bo'lakka bo'ling, keyin 5 ta kichik bo'lakka. Qaysi bo'lak kattaroq?",
    },
    {
      type: "mcq",
      question: "Quyidagilardan qaysi biri 1/2 ga teng emas?",
      options: ["2/4", "3/6", "5/10", "3/8"],
      correctIndex: 3,
      explain:
        "3/8 ≠ 1/2 — chunki 3/8 ni qisqartirib bo'lmaydi. 2/4, 3/6, 5/10 — barchasida surat va maxraj bir xil songa ko'paytirilgan, hammasi 1/2 ning teng kasrlari. Bunday kasrlarni topish — EKUB orqali sodda holga keltirish.",
      hint: "Har birini soddalashtiring: 2/4 = 1/2, 3/6 = 1/2, 5/10 = 1/2. 3/8 — qisqarmaydi.",
    },
    {
      type: "mcq",
      question: "6/8 kasrini qisqartiring. EKUB(6, 8) = 2. Yangi kasr nima?",
      options: ["3/4", "4/6", "6/8", "12/16"],
      correctIndex: 0,
      explain:
        "Surat ham, maxraj ham 2 ga bo'linadi: 6 ÷ 2 = 3, 8 ÷ 2 = 4. Demak 6/8 = 3/4. EKUB orqali kasrlarni eng sodda holga keltiramiz.",
      hint: "Surat va maxrajni EKUBga bo'ling — kasr o'zgarmaydi, sodda bo'ladi.",
    },
    {
      type: "mcq",
      question: "Qaysi kasr to'g'ri kasr (proper fraction)? Ya'ni surat maxrajdan kichik:",
      options: ["7/4", "5/5", "3/8", "9/2"],
      correctIndex: 2,
      explain:
        "3/8 — surat (3) maxrajdan (8) kichik. Bu butundan kamroq. 7/4, 9/2 — noto'g'ri kasrlar (butundan ko'p), 5/5 — butunga teng.",
      hint: "Pitsadan ko'p bo'lak ololmaysiz — to'g'ri kasr har doim butundan kichik.",
    },
    {
      type: "done",
      title: "Uchinchi yulduz yondi",
      body: "Kasr — butunning teng bo'laklaridan nechtasi sizda. Surat — sizda; maxraj — butun necha bo'lakka bo'lingan. EKUB orqali qisqartirasiz. Keyingi darsda kasrlarni qo'shishni o'rganamiz.",
    },
  ],
};

/** Lookup helper — every Lesson Scorpius knows about, keyed by id. */
export const LESSONS_BY_ID: Record<string, Lesson> = {
  boluvchi: demoLesson,
  "ekub-ekuk": ekubEkukLesson,
  "oddiy-kasr": oddiyKasrLesson,
  brachistochrone: brachistochroneLesson,
  broun: brounLesson,
  arximed: arximedLesson,
  tutilish: tutilishLesson,
  kamalak: kamalakLesson,
};
