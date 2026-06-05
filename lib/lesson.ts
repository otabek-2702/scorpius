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
      /** Optional live visualization of the phenomenon the question is about.
       *  Registry key — see components/learn/sims/index.tsx. When set (and the
       *  key resolves), MCQCard renders the sim COMPACTLY above the options as
       *  the "phenomenon you're predicting about" (phenomenon → predict →
       *  reveal). Purely additive — text-only MCQs omit it. */
      sim?: string;
      /** Optional sim-specific config payload (the renderer decides the shape). */
      simConfig?: Record<string, unknown>;
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
      /** Mixed-context retrieval — the only path to "mastered" status. Renders
       *  3–5 short MCQs, each from a DIFFERENT skill the student recently
       *  practiced. Pass = all correct → calls passMasteryChallenge() on each
       *  skill in the list. Mastery Challenge cards always live at the end of
       *  the constellation's terminal lesson; never inserted into a single
       *  lesson's normal arc. */
      type: "mastery-challenge";
      heading: string;
      /** Optional intro line shown above the first item. */
      promptUz?: string;
      items: ReadonlyArray<{
        skillId: string;
        question: string;
        options: string[];
        correctIndex: number;
        hint?: string;
      }>;
      reveal: string;
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
      sim: "brownian",
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
      sim: "brownian",
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
      sim: "density-buoyancy-tank",
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
      sim: "density-buoyancy-tank",
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
      type: "mastery-challenge",
      heading: "Mastery — suyuqlik qonunlari",
      promptUz:
        "Hozir biz o'rgangan tushunchalarni aralash savollarda sinab ko'ramiz. Hammasi to'g'ri javob bo'lsa — yulduz \"o'rganildi\" deb belgilanadi.",
      items: [
        {
          skillId: "phys.fluid.buoyancy",
          question: "Suvga botgan jismga qaratilgan ko'tarish kuchi nimaga teng?",
          options: [
            "Jismning og'irligi",
            "Siqib chiqargan suv og'irligi",
            "Suvning umumiy massasi",
            "Jismning hajmi",
          ],
          correctIndex: 1,
          hint: "Arximed qonunini eslang — F = ρ · g · V.",
        },
        {
          skillId: "phys.fluid.density",
          question: "Po'lat zichligi suvdan kattaroq. Kema nega cho'kmaydi?",
          options: [
            "Po'lat suvda yengillashadi",
            "Kema + havoning o'rtacha zichligi suvdan kichik",
            "Kema motori uni ko'taradi",
            "Suv kemani magnit kabi tortadi",
          ],
          correctIndex: 1,
          hint: "Kemaning ichi bo'shmi yoki to'lami?",
        },
        {
          skillId: "phys.fluid.pressure",
          question: "Suvda chuqurroq tushgan sari bosim qanday o'zgaradi?",
          options: [
            "Kamayadi",
            "O'zgarmaydi",
            "Ortadi",
            "Avval ortadi, keyin kamayadi",
          ],
          correctIndex: 2,
          hint: "Yuqoridagi suv ustuni qancha baland bo'lsa, ostiga shuncha kuchli bosadi.",
        },
      ],
      reveal:
        "Uchovi bir-biriga bog'liq: bosim → ko'tarish kuchi → suzish-cho'kish. Bularni alohida emas, birga eslang.",
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
      sim: "eclipse",
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
      sim: "eclipse",
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
      sim: "prism",
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
      sim: "prism",
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

// ---- Bob III · Kuch momenti / Richag --------------------------------------
export const richagLesson: Lesson = {
  id: "richag",
  subject: "physics",
  subjectLabel: "FIZIKA",
  title: "Richag — kuch momenti",
  cards: [
    {
      type: "intro",
      title: "Menga tayanch nuqtasini bering",
      hook:
        "\"Menga tayanch nuqtasini bering — men Yer kurrasini ko'taraman.\" Bu so'zlarni 2200 yil avval Arximed aytgan. Bugun siz Arximed sirini o'z qo'lingiz bilan sinaymiz: og'irni yengil bilan ko'tarish.",
      estMinutes: 7,
      cardCount: 8,
    },
    {
      type: "mcq",
      question:
        "5 kg toshni ko'tarish uchun, 2 kg tosh richagning ikkinchi tomonida turibdi. 5 kg tayanchgacha 0,4 m. 2 kg qaysi masofada turishi kerak — muvozanat uchun?",
      options: [
        "0,4 m (bir xil masofa)",
        "1,0 m (uzoqroq)",
        "0,16 m (yaqinroq)",
        "Hech qanday holatda muvozanat bo'lmaydi",
      ],
      correctIndex: 1,
      explain:
        "To'g'ri — 5 · 0,4 = 2,0 N·m. Bu momentni 2 kg tosh 1,0 m masofadan beradi: 2 · 1,0 = 2,0 N·m. Yengilroq tosh tayanchdan uzoqroq turishi kerak.",
      hint:
        "Moment = og'irlik · yelka. Ikki tomonning momentlari teng bo'lganda — muvozanat.",
      sim: "richag",
    },
    {
      type: "simulation",
      heading: "Tarozini muvozanatga keltiring",
      sim: "richag",
      instruction:
        "Richag ustidagi ikki toshni torting. Tayanch nuqtasini siljiting. \"Net moment\" nolga yaqinlashganda — muvozanat.",
      reveal:
        "Kuch momenti τ = F · d — kuch va uning yelkasi ko'paytmasi. Og'irni yengil bilan ko'tarish: yengilni tayanchdan UZOQROQ qo'ying. Aynan shu sir bilan bir bola katta toshni siljita oladi.",
    },
    {
      type: "story",
      heading: "Arximed va kema",
      body:
        "Mil. avv. III asrda Sirakuza shohi Hieron Arximedga katta savol berdi: \"Tortib bo'lmaydigan kemani qanday qilib dengizga tushiraman?\"\n\nArximed bloklar, polispastlar va richaglar tizimi yasadi. Shoh kema yoniga keldi, arqonni tortdi — va kema o'z-o'zidan suvga sirpandi.\n\n\"Menga tayanch nuqtasini bering — men Yer kurrasini ko'taraman,\" — bu so'zlar shu kundan qoldi. Richag — eng oddiy, lekin eng kuchli oddiy mexanizm.",
    },
    {
      type: "explainer",
      heading: "Oltin qoida",
      body:
        "Kuch momenti — kuchning aylantirish ta'siri:\n\nτ = F · d\n\nQayerda F — kuch (N), d — kuchning tayanchgacha bo'lgan yelka uzunligi (m).\n\nRichag muvozanati shartlari:\n• Chap tomon momenti = O'ng tomon momenti\n• F₁ · d₁ = F₂ · d₂\n\nBu — mexanikaning \"oltin qoidasi\": kuchni kamaytirsangiz, yelkani uzaytirishingiz kerak. Kichik kuch bilan katta yukni ko'tarish mumkin — lekin uni yo'lda ko'p siljitishingiz lozim. Ish (W = F · s) o'zgarmaydi.",
    },
    {
      type: "mcq",
      question:
        "Qaysi misol — kundalik hayotdagi richag emas?",
      options: [
        "Qaychi",
        "Eshik tutqichi",
        "Tarozi",
        "Velosiped g'ildiragi",
      ],
      correctIndex: 3,
      explain:
        "G'ildirak — richag emas, aylanma mexanizm (pona oilasidan). Qaychi, eshik tutqichi, tarozi — uchchalasi ham tayanch nuqtasi atrofida aylanadi, demak richag.",
      hint:
        "Richagda tayanch nuqtasi va ikki yelka bor. G'ildirak nima atrofida aylanadi? Tayanch nuqtasi qaerda?",
    },
    {
      type: "ask",
      heading: "Yana savolingiz bormi?",
      topic: "kuch momenti, richag muvozanati va oddiy mexanizmlar",
    },
    {
      type: "done",
      title: "Bir yulduz yondi",
      body:
        "Endi bilasiz: og'irni yengil bilan ko'tarish mumkin — lekin yengilni uzoqroqqa qo'yish kerak. Qaychidan to kran-balkagacha, hammasida shu bitta qoida: τ = F · d. Arximed haqli edi.",
    },
  ],
};

// ---- Bob II · Paskal qonuni / gidravlik press -----------------------------
export const paskalLesson: Lesson = {
  id: "paskal",
  subject: "physics",
  subjectLabel: "FIZIKA",
  title: "Paskal qonuni — kichik kuch, katta yuk",
  cards: [
    {
      type: "intro",
      title: "Bola barmog'i bilan mashina ko'taradi",
      hook:
        "Avtoservisda 1 tonnalik mashina havo bosimi bilan tepaga ko'tariladi. Buni hatto bola ham qo'lda bajara oladi. Sehrmi? Yo'q — bu Blez Paskal 1648-yilda kashf etgan qonun.",
      estMinutes: 7,
      cardCount: 8,
    },
    {
      type: "mcq",
      question:
        "Ikki silindr suyuqlik bilan ulangan. Kichik pistonning yuzasi 10 sm². Katta pistonniki — 200 sm². Kichik pistonga 100 N kuch bilan bossangiz, katta pistonda qancha kuch paydo bo'ladi?",
      options: [
        "100 N (bir xil)",
        "200 N (ikki marta ko'p)",
        "2000 N (yigirma marta ko'p)",
        "0 N (suyuqlik to'sadi)",
      ],
      correctIndex: 2,
      explain:
        "To'g'ri — Paskal qonuni: bosim hamma joyda bir xil. F₁/A₁ = F₂/A₂. Yuza 20 marta katta bo'lsa, kuch ham 20 marta ko'p: 100 · 20 = 2000 N. Bu — 200 kg ni ko'tara oladi.",
      hint:
        "Bosim P = F/A. Yuza qancha katta bo'lsa, shuncha katta kuch chiqadi.",
      sim: "paskal",
    },
    {
      type: "simulation",
      heading: "Gidravlik pressni o'zingiz boshqaring",
      sim: "paskal",
      instruction:
        "Kichik pistonni pastga torting. Katta pistonda 1200 kg mashina turibdi. Yuzalar nisbatini ham o'zgartiring. Mashinani ko'taring.",
      reveal:
        "Suyuqlik siqilmaydi: kichik pistonning bosgan hajmi katta pistondan chiqadi. Lekin yuza 20 marta ko'p bo'lgani uchun, katta piston atigi 20 marta KAM siljiydi. Kuchni yutdingiz, lekin masofani yo'qotdingiz. Energiya saqlandi.",
    },
    {
      type: "story",
      heading: "Blez Paskal va vino bochkasi",
      body:
        "1648-yil, Frantsiya. 25 yoshli Blez Paskal vino bochkasi tepasiga uzun, ingichka quvur ulashga ruxsat oldi. Bochka suv bilan to'la, kapikning og'zigacha. Keyin quvurga oz-ozdan suv quydi.\n\nO'n metr balandlikdagi bir oz suv — bochka portladi. Ozgina suv massasi — emas, balki balandlik orqali hosil bo'lgan bosim katta yuzaga ta'sir qilib, devorni yorgan.\n\nShu tajriba bilan Paskal isbotladi: suyuqlikdagi bosim hamma yo'nalishga teng tarqaladi. Yuz yildan keyin shu kashfiyot ustiga gidravlik pressdan to avtomobil tormozigacha qurildi.",
    },
    {
      type: "explainer",
      heading: "Paskal qonuni va hayot",
      body:
        "Yopiq idishdagi suyuqlikka qo'yilgan bosim, suyuqlikning har bir nuqtasiga teng kuch bilan tarqaladi.\n\nP = F / A\n\nF₁/A₁ = F₂/A₂   →   F₂ = F₁ · (A₂/A₁)\n\nQayerda P — bosim (Pa), F — kuch (N), A — yuza (m²).\n\nQayerda foydalanamiz:\n• Avtomobil tormozlari — kichik pedal kuchi katta toza disklarga\n• Ekskavator chelaki — gidravlik silindrlar\n• Mashina liftlari va kraniklar\n• Hatto stomatologning kursisi shu printsipda yuqoriga ko'tariladi",
    },
    {
      type: "mcq",
      question:
        "Paskal qonuni qaysi muhitlarda ishlaydi?",
      options: [
        "Faqat suvda",
        "Faqat yog'da",
        "Har qanday suyuqlik va gazda (siqilmaydigan)",
        "Faqat qattiq jismda",
      ],
      correctIndex: 2,
      explain:
        "To'g'ri — Paskal qonuni suyuqlik va gazlar uchun ishlaydi. Lekin gaz siqilishi mumkin, shuning uchun amaliy mashinalarda asosan suyuqlik (yog') ishlatiladi: u siqilmaydi, bosimni yo'qotmaydi.",
      hint:
        "Bosim qaerda tarqaladi? Qattiq jism o'z shaklini saqlaydi, suyuqlik esa har joyga oqadi.",
    },
    {
      type: "ask",
      heading: "Yana savolingiz bormi?",
      topic: "Paskal qonuni va gidravlik mashinalar",
    },
    {
      type: "done",
      title: "Bir yulduz yondi",
      body:
        "Bolaning barmog'i mashinani ko'taradi — sehr emas, qonun. Bosim har joyga teng tarqaladi. Yuzani 20 marta kattalashtiring — kuchingiz 20 marta kuchayadi. Avtomobil tormozini bosganda — Paskalga rahmat ayting.",
    },
  ],
};

// ---- Bob VII · Tovush kattaliklari ----------------------------------------
export const tovushLesson: Lesson = {
  id: "tovush",
  subject: "physics",
  subjectLabel: "FIZIKA",
  title: "Tovush — balandlik va kuchlilik",
  cards: [
    {
      type: "intro",
      title: "Nima uchun nay yupqa, tuba qalin?",
      hook:
        "Nay ingichka tovush chiqaradi — quvnoq, yengil. Tuba esa qalin va og'ir bo'kiradi. Ikkalasi ham havoni tebratadi — lekin boshqacha. Bugun shu farq nima ekanini eshitib, ko'rib o'rganamiz.",
      estMinutes: 7,
      cardCount: 8,
    },
    {
      type: "predict",
      heading: "Avval taxmin qiling",
      prompt:
        "Frekvensiya — bir soniyada tebranishlar soni. Frekvensiya OSHSA, tovush qanday o'zgaradi?",
      mode: "choice",
      options: [
        "Balandroq bo'ladi (nay kabi yupqa)",
        "Pastroq bo'ladi (tuba kabi qalin)",
        "Kuchliroq bo'ladi (qichqirgan kabi)",
        "O'zgarmaydi",
      ],
      correctIndex: 0,
      reveal:
        "To'g'ri — frekvensiya balandlikni belgilaydi. Yuqori frekvensiya = yupqa, baland tovush. Past frekvensiya = qalin, bas tovush. Endi qulog'ingiz bilan tasdiqlang.",
    },
    {
      type: "simulation",
      heading: "Eshiting va ko'ring",
      sim: "tovush",
      instruction:
        "\"Tovushni eshitish\" tugmasini bosing (telefonni ovozni o'chirilmagan holatda tuting). Frekvensiyani 220 dan 800 ga olib chiqing. Tovush balandlasha boshlaydi. Keyin amplitudani siljiting.",
      reveal:
        "Frekvensiya — balandlik (balandmi yo pastmi). Amplituda — kuchlilik (sokinmi yo baland). Bu ikkala kattalik mustaqil: yupqa tovush sokin ham, baland ham bo'lishi mumkin. Qalin tovush ham xuddi shunday.",
    },
    {
      type: "explainer",
      heading: "Tovushning ikkita yuzi",
      body:
        "Tovush — havoning tebranishi. Har bir tebranish ikkita kattaliklar bilan o'lchanadi:\n\n• FREKVENSIYA (Hz) — bir soniyada nechta tebranish bo'ladi. Yuqori frekvensiya — baland (yupqa) tovush. Past — qalin tovush. Inson qulog'i 20 dan 20 000 Hz gacha eshitadi.\n\n• AMPLITUDA — tebranishning kattaligi. Katta amplituda — kuchli (baland) tovush. Kichik amplituda — sokin tovush. Decibellarda (dB) o'lchanadi.\n\nBu ikkala kattalik mustaqil: yupqa tovushni sekin ham, qattiq ham eshitish mumkin. Tuba pastroq, nay balandroq, lekin har ikkalasi sokin yoki kuchli bo'la oladi.",
    },
    {
      type: "mcq",
      question:
        "Bolaning ovozi va katta odamning ovozi farqlanishi nima sababli?",
      options: [
        "Ularning amplitudasi har xil",
        "Bola ovozining frekvensiyasi balandroq, katta odamniki past",
        "Ular har xil til ishlatadi",
        "Hech qanday fizik farq yo'q",
      ],
      correctIndex: 1,
      explain:
        "To'g'ri — bolaning tovush boylamlari kichik va tez tebranadi (yuqori frekvensiya). Katta odamniki uzun va sekin (past frekvensiya). Ikkalasi ham baland yoki sokin gapirishi mumkin — bu amplituda.",
      hint:
        "Bolaning tovush boylamlari kichik. Kichik narsa tezroq tebranadi.",
      sim: "tovush",
    },
    {
      type: "sort",
      prompt:
        "Quyidagi tovush manbalari frekvensiyasi taxminan (Hz). Qaysisi past tovush, qaysisi baland?",
      bucketA: "Past tovush (< 250 Hz)",
      bucketB: "Baland tovush (> 250 Hz)",
      items: [
        { value: 80, bucket: "A" },   // erkak ovozi
        { value: 120, bucket: "A" },  // gitara bassi
        { value: 200, bucket: "A" },  // ayol ovozi past
        { value: 440, bucket: "B" },  // La (A4)
        { value: 800, bucket: "B" },  // bolaning baqirishi
        { value: 1500, bucket: "B" }, // chumchuq sayrashi
      ],
      reveal:
        "Past tovushlar (80–200 Hz) — basslar, kattalar ovozi. Baland tovushlar (440 Hz +) — La notasidan tepa, ayollar, bolalar va qushlar. Eng baland nota pianinoda 4186 Hz.",
    },
    {
      type: "ask",
      heading: "Yana savolingiz bormi?",
      topic: "tovush — frekvensiya, amplituda va balandlik",
    },
    {
      type: "done",
      title: "Bir yulduz yondi",
      body:
        "Endi qulog'ingiz bilgan narsani fizika ham biladi: tovushning ikki yuzi bor — balandlik (frekvensiya) va kuchlilik (amplituda). Keyingi safar nay yoki tuba eshitsangiz — endi bilasiz, ularning farqi qaerda.",
    },
  ],
};

// ---- Bob VI · Linzalar -----------------------------------------------------
export const linzaLesson: Lesson = {
  id: "linza",
  subject: "physics",
  subjectLabel: "FIZIKA",
  title: "Linza — yorug'likni egadigan oyna",
  cards: [
    {
      type: "intro",
      title: "Lupa quyoshni nuqtaga to'playdi",
      hook:
        "Quyoshli kunda lupani qog'ozga to'g'rilang. Yorug'lik bitta yorqin nuqtaga to'planadi — qog'oz tutab boshlaydi. Lupaning ichida hech narsa yo'q, faqat shisha. Qanday qilib u nurni egib oldi? Bugun bilamiz.",
      estMinutes: 8,
      cardCount: 9,
    },
    {
      type: "mcq",
      question:
        "Lupa orqali yaqindan tikilsangiz — buyumning kattalashgan rasmini ko'rasiz. Bu rasm:",
      options: [
        "Haqiqiy — uni ekranga tushirsa bo'ladi",
        "Virtual — uni faqat ko'z ko'radi, ekranga tushmaydi",
        "Rangli, lekin teskari",
        "Buyumning soyasi",
      ],
      correctIndex: 1,
      explain:
        "To'g'ri — lupada buyum fokusdan yaqinroq turganda, hosil bo'lgan tasvir virtual. Ya'ni nurlar haqiqatda kesishmaydi — ular kesishadi degan tuyg'u beradi. Shuning uchun rasmni ekranga tushirib bo'lmaydi, lekin ko'z uni \"ko'radi\".",
      hint:
        "Lupada qachon kattalashishni ko'rasiz — buyum lupaga juda yaqin bo'lganda yoki uzoqda?",
      sim: "linza",
    },
    {
      type: "simulation",
      heading: "Pashshani lupa orqali kuzating",
      sim: "linza",
      instruction:
        "Oltin pashshani linzaning chap tomonida torting — fokusdan uzoqroqqa, keyin yaqinroqqa. Tasvir qanday o'zgaradi? Fokus masofasini ham siljiting.",
      reveal:
        "Uchta nur har doim aniq qoidaga bo'ysunadi: markazdan o'tgan nur to'g'ri, parallel nur fokusdan o'tadi, fokusdan keluvchi nur parallel chiqadi. Ular kesishadigan joy — tasvir. Fokusdan yaqin bo'lsa — virtual, katta, tik. Uzoq bo'lsa — haqiqiy, teskari.",
    },
    {
      type: "story",
      heading: "Galiley va birinchi teleskop",
      body:
        "1609-yil, Italya. Galiley Galiley Gollandiyadan kelgan yangilik eshitdi: \"Yog'och naychada ikkita shisha bilan uzoqdagi narsalarni yaqinroq ko'rsa bo'larkan.\"\n\nGaliley hech qanday chizma yoki tushuntirishni ko'rmagan edi. Faqat ikki shisha — biri qavariq, biri botiq linza — gapni eshitdi. Bir oy ichida o'zi 30 marta kattalashtiruvchi teleskopni yasadi.\n\nU teleskopni osmonga to'g'ridi va — kashfiyot. Oyda tog'lar. Yupiter atrofida 4 ta yo'ldosh. Quyoshda dog'lar. Bir kishi linza yordamida koinotni qaytadan ochdi.",
    },
    {
      type: "explainer",
      heading: "Yupqa linza tenglamasi",
      body:
        "Yupqa linza uchun jism (u), tasvir (v) va fokus masofasi (f) o'rtasidagi munosabat:\n\n1/f = 1/u + 1/v\n\nKattalashish: m = -v/u\n\n• u > 2f  →  haqiqiy, teskari, kichik tasvir (fotokamera)\n• u = 2f  →  haqiqiy, teskari, teng o'lchamli\n• f < u < 2f  →  haqiqiy, teskari, katta tasvir (proyektor, ko'z gavhari)\n• u = f  →  tasvir cheksizlikda (lazer)\n• u < f  →  virtual, tik, katta tasvir (lupa)\n\nFokus masofasi qanchalik kichik bo'lsa, linza shunchalik kuchli — yorug'likni qattiq egadi.",
    },
    {
      type: "mcq",
      question:
        "Inson ko'zining gavhari ham linza. U buyum tasvirini qaerga tushiradi?",
      options: [
        "Ko'zning oldida — havoda",
        "Ko'zning ichida, retsina ustida — teskari va kichik haqiqiy tasvir",
        "Soni katta tasvir, tik",
        "Tasvirni umuman tushirmaydi",
      ],
      correctIndex: 1,
      explain:
        "To'g'ri — ko'zda gavhar haqiqiy, teskari, kichik tasvirni retsina ustida hosil qiladi. Miya keyin bu tasvirni \"to'g'rilab\" ko'rsatadi. Shuning uchun yiqilgan bola dunyoni oyog'i bilan ko'rmaydi — miya o'zi qaytaradi.",
      hint:
        "Ko'zning ichida tasvirni qabul qiluvchi ekran — retsina bor. Tasvir qaerda hosil bo'ladi?",
      sim: "linza",
    },
    {
      type: "sort",
      prompt:
        "Quyidagi asboblar qaysi linza turiga asoslangan?",
      bucketA: "Yig'uvchi linza (qavariq)",
      bucketB: "Tarqatuvchi linza (botiq)",
      items: [
        { value: 1, bucket: "A" },   // lupa
        { value: 2, bucket: "A" },   // fotokamera obyektivi
        { value: 3, bucket: "A" },   // teleskop obyektivi
        { value: 4, bucket: "B" },   // miyopiya (yaqindan ko'ruvchi) ko'zoynagi
        { value: 5, bucket: "B" },   // peep-hole eshik teshigi
        { value: 6, bucket: "A" },   // proyektor
      ],
      reveal:
        "Yig'uvchi linza nurni bir nuqtaga to'playdi — lupa, kamera, teleskop, proyektor, ko'z gavhari shu turdan. Tarqatuvchi linza nurni yoyadi — miyopiya ko'zoynagi va eshik teshigi shu turga kiradi.",
    },
    {
      type: "ask",
      heading: "Yana savolingiz bormi?",
      topic: "linzalar, fokus va tasvir hosil bo'lishi",
    },
    {
      type: "done",
      title: "Bir yulduz yondi",
      body:
        "Lupaning ichida hech qanday sehr yo'q — faqat geometriya. Yorug'lik shisha ichida ma'lum burchakda sinadi, va uchta nur har doim bir nuqtada uchrashadi. Galiley shu bilan koinotni ko'rdi. Siz ham endi ko'ra olasiz.",
    },
  ],
};

// ---- Bob V · Oddiy elektr zanjiri ------------------------------------------
export const zanjirLesson: Lesson = {
  id: "zanjir",
  subject: "physics",
  subjectLabel: "FIZIKA",
  title: "Oddiy elektr zanjiri",
  cards: [
    {
      type: "intro",
      title: "Lampochka qanday yonadi?",
      hook:
        "Tugmani bosasiz — xona yorishadi. Bu jarayonda nima sodir bo'ladi? Simlarning ichida hech qanday harakat ko'rinmaydi, lekin bir narsa albatta yuradi. Bugun ko'rinmas oqimni ko'ramiz.",
      estMinutes: 8,
      cardCount: 9,
    },
    {
      type: "predict",
      heading: "Avval taxmin qiling",
      prompt:
        "Batareya kuchlanishini ikki marta oshirsangiz, lampochka yorqinligi qanday o'zgaradi?",
      mode: "choice",
      options: [
        "Aynan ikki marta yorqinroq bo'ladi",
        "To'rt marta yorqinroq bo'ladi (chunki P = I² · R)",
        "Ikki marta sokinroq bo'ladi",
        "O'zgarmaydi",
      ],
      correctIndex: 1,
      reveal:
        "Ehtimol siz \"ikki marta\" deb taxmin qildingiz — lekin to'g'rirog'i to'rt marta! Sababi: kuchlanish ikki marta oshganda, tok ham ikki marta oshadi (I = V/R), va quvvat P = I² · R — kvadratga ko'tariladi. Endi sinab ko'ring.",
    },
    {
      type: "simulation",
      heading: "Zanjirni yoping, elektronlarni kuzating",
      sim: "zanjir",
      instruction:
        "\"Kalitni yopish\" tugmasini bosing — oltin elektronlar yo'lga tushadi, lampochka yonadi. Keyin batareya kuchlanishini va qarshilikni siljiting. Lampochka qanday o'zgaradi?",
      reveal:
        "Elektronlar — kichik zaryadli zarralar. Batareya ularni harakatga keltiradi, simlardan o'tib, lampochka ichida energiyani yorug'lik va issiqlikka aylantiradi. Qarshilik (rezistor) ularning yo'lini qiyinlashtiradi, tok kamayadi. Ohm qonuni: I = V/R.",
    },
    {
      type: "story",
      heading: "Edison va birinchi lampochka",
      body:
        "1879-yil, Menlo Park, Amerika. Tomas Edison va uning jamoasi 6000 dan ortiq materialni sinab ko'rdi — temir, platina, hatto cho'tka mo'ylovi — birinchi uzoq yonadigan lampochka uchun filamentni topish maqsadida.\n\nOktyabr 22-da kuyish jarayonida 13,5 soat yonib turgan karbonlangan bambukni topdilar. Birinchi marta inson xonasini elektr bilan yoritdi.\n\nLekin Edison ham bir narsani unutmadi: elektr toki bo'lmasa, lampochka ham bo'lmasdi. U haqiqatan elektrning Aleksandr Volta (1800), Maykl Faradey (1831) va boshqa olimlar ish bilan boshlangan ilmiy sarguzashtning yakuni edi.",
    },
    {
      type: "explainer",
      heading: "Ohm qonuni va quvvat",
      body:
        "Elektr zanjirida uchta asosiy kattalik bor:\n\n• KUCHLANISH V (volt, V) — batareyaning \"zo'ri\". Elektronlarni qancha kuchli itaradi.\n• TOK KUCHI I (amper, A) — bir soniyada nechta elektron sim kesimidan o'tadi.\n• QARSHILIK R (Ohm, Ω) — simning elektronga \"qarshiligi\".\n\nOhm qonuni: I = V / R\n\nQuvvat (yorug'lik + issiqlik) chiqishi: P = V · I = I² · R = V² / R\n\nQuvvat kuchlanishning KVADRATIga proportsional. Shuning uchun 1,5 V batareya bilan 220 V tarmoq orasidagi farq ulkan: 22 000 marta ko'p quvvat.",
    },
    {
      type: "mcq",
      question:
        "Lampochka V = 6 V, I = 1,5 A da yonayapti. Uning qarshiligi qanchaga teng?",
      options: [
        "0,25 Ω",
        "4 Ω",
        "7,5 Ω",
        "9 Ω",
      ],
      correctIndex: 1,
      explain:
        "Ohm qonunidan: R = V / I = 6 / 1,5 = 4 Ω. Ya'ni har 4 Ohm qarshilikka 1 V kuchlanish 0,25 A tokni hosil qiladi.",
      hint:
        "I = V/R. R ni topish uchun formulani aylantiring: R = V/I.",
      sim: "zanjir",
    },
    {
      type: "sort",
      prompt:
        "Quyidagi narsalar — o'tkazgichmi yoki dielektrik (qarshilik)?",
      bucketA: "Yaxshi o'tkazgich (kichik R)",
      bucketB: "Dielektrik (juda katta R)",
      items: [
        { value: 1, bucket: "A" },  // mis sim
        { value: 2, bucket: "A" },  // alyuminiy sim
        { value: 3, bucket: "B" },  // rezina
        { value: 4, bucket: "B" },  // shisha
        { value: 5, bucket: "A" },  // sho'r suv
        { value: 6, bucket: "B" },  // quruq yog'och
      ],
      reveal:
        "O'tkazgichlar (metallar, sho'r suv) — elektronlar erkin harakatlanadi. Dielektriklar (rezina, shisha, quruq yog'och) — elektronlar \"qamoqda\". Shuning uchun simni rezina bilan o'rab qo'yiladi: ichi o'tkazadi, sirti elektrni zinhor o'tkazmaydi.",
    },
    {
      type: "ask",
      heading: "Yana savolingiz bormi?",
      topic: "elektr toki, Ohm qonuni va oddiy zanjir",
    },
    {
      type: "done",
      title: "Bir yulduz yondi",
      body:
        "Endi xona yorug'ligi ortida nima borligini ko'rdingiz: million elektron har soniyada simdan o'tib, filamentni qizdiradi. Ohm qonuni — V = I · R — bu nafaqat darslik formulasi, balki xonangizdagi har bir lampochka ortida turibdi.",
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
  richag: richagLesson,
  paskal: paskalLesson,
  tovush: tovushLesson,
  linza: linzaLesson,
  zanjir: zanjirLesson,
};
