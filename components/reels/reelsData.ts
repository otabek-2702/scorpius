// components/reels/reelsData.ts
/**
 * Curated content for the Reels learning feed — a vertical, swipeable stream of
 * short, dopamine-driven learning moments. Pure data, no component imports, so
 * the feed component can shuffle / personalize it cheaply on the client.
 *
 * Facts are real and checked. Embedded-sim reels reference real SIM_CATALOG /
 * SIM_REGISTRY keys (prism, brownian, density-buoyancy-tank, eclipse,
 * brachistochrone, divisor-grid).
 *
 * All learner-facing copy is Uzbek (Latin, proper okina U+02BB → ʻ).
 */

/** Accent identity for a reel — drives the stage gradient + glow + chrome. */
export type ReelAccent = "teal" | "violet" | "emerald" | "gold" | "blue";

export type ReelSubject =
  | "fizika"
  | "kimyo"
  | "biologiya"
  | "matematika"
  | "astronomiya";

/** A surprising-fact reel with one big animated number / visual. */
export interface FactReel {
  id: string;
  kind: "fact";
  subject: ReelSubject;
  accent: ReelAccent;
  /** Small kicker shown above the hook (e.g. "Bilarmidingiz?"). */
  kicker: string;
  /** The big serif hook line. */
  hook: string;
  /** A single headline number to count up to (optional). */
  stat?: {
    /** Target value the count-up animates to. */
    value: number;
    /** How to render — controls decimals + thousands separators. */
    format?: "int" | "comma" | "float1";
    /** Suffix unit (e.g. " km/s", "×", "°C"). */
    suffix?: string;
    /** Prefix (e.g. "~"). */
    prefix?: string;
    /** Caption under the number. */
    caption: string;
  };
  /** Supporting sentence. */
  body: string;
  /** Optional per-hobby reframing of the hook. Keyed by interest label. */
  hobbyVariants?: Partial<Record<HobbyKey, { kicker?: string; hook: string; body?: string }>>;
}

/** An embedded interactive mini-sim reel. */
export interface SimReel {
  id: string;
  kind: "sim";
  subject: ReelSubject;
  accent: ReelAccent;
  kicker: string;
  hook: string;
  /** Key into SIM_REGISTRY. */
  simKey: "prism" | "brownian" | "density-buoyancy-tank" | "eclipse" | "brachistochrone" | "divisor-grid";
  /** One-line "sinab koʻr" prompt under the title. */
  prompt: string;
  hobbyVariants?: Partial<Record<HobbyKey, { hook: string; prompt?: string }>>;
}

/** A fast 2-choice quiz reel. */
export interface QuizReel {
  id: string;
  kind: "quiz";
  subject: ReelSubject;
  accent: ReelAccent;
  kicker: string;
  question: string;
  options: [string, string];
  /** Index (0|1) of the correct option. */
  answerIndex: 0 | 1;
  /** Shown after answering — the "aha". */
  explain: string;
  hobbyVariants?: Partial<Record<HobbyKey, { question: string; explain?: string }>>;
}

/** A "real-world" reel tying a concept to everyday life. */
export interface RealWorldReel {
  id: string;
  kind: "real";
  subject: ReelSubject;
  accent: ReelAccent;
  kicker: string;
  hook: string;
  body: string;
  /** A pair of short "before → because" beats revealed on tap. */
  reveal: { prompt: string; answer: string };
  hobbyVariants?: Partial<Record<HobbyKey, { hook: string; body?: string }>>;
}

export type Reel = FactReel | SimReel | QuizReel | RealWorldReel;

/** Interest labels captured at onboarding (lib/profile → StudentProfile.interests). */
export type HobbyKey =
  | "Futbol"
  | "Super-qahramonlar"
  | "Video oʻyinlar"
  | "Kosmos"
  | "Musiqa"
  | "Tabiat"
  | "Texnologiya"
  | "San'at";

/**
 * Onboarding stores some interests with a straight apostrophe ("Video o'yinlar",
 * "San'at"). We normalize both spellings to the same key so personalization
 * still fires regardless of how the profile was written.
 */
export function normalizeHobby(raw: string): HobbyKey | null {
  const k = raw.replace(/['’]/g, "ʻ").trim();
  switch (k) {
    case "Futbol":
      return "Futbol";
    case "Super-qahramonlar":
      return "Super-qahramonlar";
    case "Video oʻyinlar":
      return "Video oʻyinlar";
    case "Kosmos":
      return "Kosmos";
    case "Musiqa":
      return "Musiqa";
    case "Tabiat":
      return "Tabiat";
    case "Texnologiya":
      return "Texnologiya";
    case "San'at":
    case "Sanʻat":
      return "San'at";
    default:
      return null;
  }
}

/**
 * The reel deck. ~14 reels across subjects. Order here is the default (SSR-safe);
 * the feed shuffles a copy on mount.
 */
export const REELS: Reel[] = [
  // 1 — FACT · astronomy · the speed you are moving right now
  {
    id: "fact-orbit-speed",
    kind: "fact",
    subject: "astronomiya",
    accent: "violet",
    kicker: "Bilarmidingiz?",
    hook: "Siz hozir oʻtirgan boʻlsangiz ham — kosmosda uchib ketyapsiz.",
    stat: {
      value: 30,
      format: "int",
      suffix: " km/s",
      caption: "Yer Quyosh atrofida shu tezlikda aylanadi",
    },
    body: "Yer Quyosh atrofida sekundiga ~30 km tezlikda harakatlanadi. Bir koʻz yumib ochguningizcha — 9 km yoʻl bosib boʻlasiz.",
    hobbyVariants: {
      Kosmos: {
        hook: "Hech qaerga ketmay turib — Quyosh atrofida 1 yilda 940 million km yoʻl bosasiz.",
      },
      Futbol: {
        kicker: "Bilarmidingiz?",
        hook: "Penaltidan zarba toʻpdan 100 marta tez — sizning sayyorangiz uchyapti.",
        body: "Eng kuchli penalti ~130 km/soat. Yer esa sekundiga 30 km — yaʼni soatiga 108 000 km uchadi.",
      },
    },
  },

  // 2 — SIM · physics · prism / dispersion
  {
    id: "sim-prism",
    kind: "sim",
    subject: "fizika",
    accent: "violet",
    kicker: "Sinab koʻr",
    hook: "Oq yorugʻlikning ichida butun kamalak yashiringan.",
    simKey: "prism",
    prompt: "Manbani torting — oq nurni ranglarga ajrating.",
    hobbyVariants: {
      Tabiat: {
        hook: "Yomgʻirdan keyingi kamalak — aslida millionlab prizma-tomchilar.",
        prompt: "Nurni torting va Nyutonning kashfiyotini takrorlang.",
      },
    },
  },

  // 3 — QUIZ · biology · heart
  {
    id: "quiz-heart-beats",
    kind: "quiz",
    subject: "biologiya",
    accent: "emerald",
    kicker: "Tez savol",
    question: "Inson yuragi bir kunda necha marta uradi?",
    options: ["~10 000 marta", "~100 000 marta"],
    answerIndex: 1,
    explain:
      "Yurak daqiqasiga ~70 marta uradi → kuniga ~100 000 marta, bir umrda ~3 milliard marta. Toxtamasdan.",
    hobbyVariants: {
      Futbol: {
        question: "Futbolchining yuragi 90 daqiqalik oʻyinda eng koʻp qachon uradi?",
        explain:
          "Sprint paytida yurak daqiqasiga 180+ marta uradi — tinch holatdagidan 3 baravar tez. Shuning uchun futbolchilar nafasini sozlashni oʻrganadi.",
      },
    },
  },

  // 4 — FACT · chemistry · gold in seawater / atoms
  {
    id: "fact-atoms-breath",
    kind: "fact",
    subject: "kimyo",
    accent: "gold",
    kicker: "Bilarmidingiz?",
    hook: "Hozirgi nafasingizda — bir paytlar boshqa odam nafas olgan atomlar bor.",
    body: "Bir nafasda ~10²² ta molekula bor — bu butun atmosferadagi nafaslar sonidan koʻproq. Statistik jihatdan, ularning baʼzilari ilgari boshqa odam oʻpkasidan oʻtgan.",
  },

  // 5 — SIM · physics · density / buoyancy
  {
    id: "sim-buoyancy",
    kind: "sim",
    subject: "fizika",
    accent: "blue",
    kicker: "Sinab koʻr",
    hook: "Nega temir choʻkadi, lekin temir kema suzadi?",
    simKey: "density-buoyancy-tank",
    prompt: "Jismlarni suvga tashlang — zichlikni oʻzgartiring va kuzating.",
    hobbyVariants: {
      Texnologiya: {
        hook: "Suzish yoki choʻkish — bu vazn emas, zichlik haqida.",
        prompt: "Materialni almashtiring: qaysi biri suvdan yengilroq?",
      },
    },
  },

  // 6 — QUIZ · astronomy · sun
  {
    id: "quiz-sun-volume",
    kind: "quiz",
    subject: "astronomiya",
    accent: "gold",
    kicker: "Tez savol",
    question: "Quyosh ichiga nechta Yer sigʻadi?",
    options: ["~1 300 ta", "~1 300 000 ta"],
    answerIndex: 1,
    explain:
      "Quyosh diametri Yernikidan ~109 baravar katta. Hajm esa kub bilan oʻsadi → ichiga ~1.3 million Yer sigʻadi.",
  },

  // 7 — FACT · math · exponential / paper folding
  {
    id: "fact-paper-fold",
    kind: "fact",
    subject: "matematika",
    accent: "teal",
    kicker: "Bilarmidingiz?",
    hook: "Bir varaq qogʻozni 42 marta buksangiz — u Oygacha yetadi.",
    stat: {
      value: 42,
      format: "int",
      suffix: " marta",
      caption: "Oygacha yetish uchun kerakli buklash",
    },
    body: "Har buklashda qalinlik 2 ga koʻpayadi. 0.1 mm × 2⁴² ≈ 440 000 km — bu Yer va Oy orasidagi masofa. Eksponensial oʻsish shunchalik kuchli.",
    hobbyVariants: {
      "Video oʻyinlar": {
        hook: "Har levelda dushman 2 baravar kuchaysa — 30-levelga borib u milliard barobar kuchli boʻladi.",
        body: "Bu eksponensial oʻsish: 2³⁰ ≈ 1 milliard. Shuning uchun oʻyinlar darajani sekin oshiradi.",
      },
    },
  },

  // 8 — SIM · physics · brownian motion
  {
    id: "sim-brownian",
    kind: "sim",
    subject: "fizika",
    accent: "teal",
    kicker: "Sinab koʻr",
    hook: "Hech kim turtmasa ham — chang zarrasi nega titraydi?",
    simKey: "brownian",
    prompt: "Haroratni oshiring — koʻrinmas molekulalarning zarbasini koʻring.",
  },

  // 9 — QUIZ · biology · DNA length
  {
    id: "quiz-dna-length",
    kind: "quiz",
    subject: "biologiya",
    accent: "emerald",
    kicker: "Tez savol",
    question: "Bitta hujayrangizdagi DNK ipini choʻzsangiz, uzunligi qancha?",
    options: ["~2 metr", "~2 millimetr"],
    answerIndex: 0,
    explain:
      "Bitta hujayradagi DNK ~2 metr! Tanangizdagi barcha hujayralarni qoʻshsangiz — Quyoshga borib qaytadigan masofa chiqadi. Hammasi mikroskopik yadroga sigʻgan.",
  },

  // 10 — REAL · physics · why ice floats
  {
    id: "real-ice-floats",
    kind: "real",
    subject: "kimyo",
    accent: "blue",
    kicker: "Hayotda",
    hook: "Muz suvda suzadi — va bu hayotni saqlab qoladi.",
    body: "Deyarli barcha moddalar qotganda choʻkadi. Suv esa aksincha — muz suvdan yengilroq.",
    reveal: {
      prompt: "Nega bu muhim?",
      answer:
        "Agar muz choʻkkanda — koʻllar tubdan muzlab, baliqlar qirilib ketardi. Muz yuzada qalqib, pastdagi suvni issiq saqlaydi.",
    },
  },

  // 11 — SIM · astronomy · eclipse
  {
    id: "sim-eclipse",
    kind: "sim",
    subject: "astronomiya",
    accent: "gold",
    kicker: "Sinab koʻr",
    hook: "Oy Quyoshdan 400 marta kichik — lekin uni toʻliq yopa oladi.",
    simKey: "eclipse",
    prompt: "Oyni harakatlantiring — soyani Yerga tushiring.",
    hobbyVariants: {
      Kosmos: {
        hook: "Quyosh Oydan 400 marta katta, lekin 400 marta uzoqda — shuning uchun osmonda teng koʻrinadi.",
      },
    },
  },

  // 12 — FACT · chemistry · diamond is carbon
  {
    id: "fact-diamond-carbon",
    kind: "fact",
    subject: "kimyo",
    accent: "violet",
    kicker: "Bilarmidingiz?",
    hook: "Olmos va qalam grafiti — bir xil atomdan: uglerod.",
    body: "Faqat atomlar joylashuvi farq qiladi. Grafitda qatlam-qatlam (yumshoq, suriladi), olmosda esa qattiq toʻr (eng qattiq tabiiy modda).",
    hobbyVariants: {
      "San'at": {
        hook: "Qalamingizdagi grafit va eng qimmat olmos — ayni bir atom: uglerod.",
        body: "Chizganingizda qogʻozga uglerod qatlamlari koʻchadi. Bir xil atom, boshqa tartib — butunlay boshqa modda.",
      },
    },
  },

  // 13 — QUIZ · math · birthday paradox
  {
    id: "quiz-birthday",
    kind: "quiz",
    subject: "matematika",
    accent: "teal",
    kicker: "Tez savol",
    question: "Sinfda 23 oʻquvchi bor. Ikkitasining tugʻilgan kuni bir kun boʻlishi ehtimoli?",
    options: ["Juda kam (~6%)", "50% dan koʻp"],
    answerIndex: 1,
    explain:
      "Bu mashhur «tugʻilgan kun paradoksi». 23 kishida moslik ehtimoli ~50.7%. Chunki biz juftlarni sanaymiz: 23 kishida 253 ta juft bor!",
    hobbyVariants: {
      Futbol: {
        question: "Futbol maydonida 23 kishi (2 jamoa + hakam). Ikkitasi bir kunda tugʻilgan boʻlishi mumkinmi?",
        explain:
          "Ha — ehtimoli ~50.7%! Bu «tugʻilgan kun paradoksi». 23 kishida 253 ta juft bor, shuning uchun moslik kutilganidan koʻra koʻp uchraydi.",
      },
    },
  },

  // 14 — REAL · physics · phone GPS & relativity
  {
    id: "real-gps-relativity",
    kind: "real",
    subject: "fizika",
    accent: "blue",
    kicker: "Hayotda",
    hook: "Telefoningizdagi GPS — Eynshteyn nazariyasiz adashardi.",
    body: "Sunʼiy yoʻldoshlardagi soat, tezlik va past tortishish tufayli, Yerdagidan biroz boshqacha yuradi.",
    reveal: {
      prompt: "Tuzatilmasa nima boʻladi?",
      answer:
        "Har kuni GPS ~11 km gacha xato qilardi! Nisbiylik nazariyasi har soniyada hisobga olinadi — shuning uchun xarita aniq.",
    },
  },

  // 15 — SIM · math · divisor grid (bonus, keeps math represented in sims)
  {
    id: "sim-divisors",
    kind: "sim",
    subject: "matematika",
    accent: "emerald",
    kicker: "Sinab koʻr",
    hook: "Qaysi sonlarning boʻluvchisi kam? Ular — tub sonlar.",
    simKey: "divisor-grid",
    prompt: "Sonni tanlang — boʻluvchilari panjarada yonadi.",
  },
];
