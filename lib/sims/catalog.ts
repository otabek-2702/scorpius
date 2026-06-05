// lib/sims/catalog.ts
/**
 * Catalog of EMBEDDABLE animations the AI mentor can show inline when a student
 * asks a question (roadmap: "dynamic animations from questions"). Pure data —
 * NO component imports — so the server (app/api/ask) can list it in the prompt
 * and the client (LabAsk) can label it, while the actual rendering goes through
 * the client-only SIM_REGISTRY (components/learn/sims).
 *
 * Every `key` MUST exist in SIM_REGISTRY. The LLM is told to pick a key from
 * this list (or "none"), so it can never invent a sim that doesn't exist.
 */
export interface SimCatalogEntry {
  /** Must match a key in components/learn/sims SIM_REGISTRY. */
  key: string;
  /** Uzbek title shown above the inline animation. */
  titleUz: string;
  /** One-line Uzbek summary of what the animation shows — used in the LLM prompt. */
  summaryUz: string;
}

export const SIM_CATALOG: SimCatalogEntry[] = [
  {
    key: "prism",
    titleUz: "Prizma — kamalak",
    summaryUz:
      "Oq yorugʻlik prizmada sinadi va ranglarga ajraladi (sinish, dispersiya, kamalak, toʻlqin uzunligi).",
  },
  {
    key: "density-buoyancy-tank",
    titleUz: "Zichlik va suzish",
    summaryUz:
      "Jismlar suvga tashlanadi — suzadimi yoki choʻkadimi (zichlik, Arximed kuchi, koʻtarish kuchi).",
  },
  {
    key: "brownian",
    titleUz: "Broun harakati",
    summaryUz:
      "Zarrachalarning tartibsiz issiqlik harakati (Broun harakati, harorat, diffuziya, molekulalar).",
  },
  {
    key: "eclipse",
    titleUz: "Tutilish",
    summaryUz:
      "Quyosh, Oy va Yer bir chiziqda joylashganda tutilish sodir boʻladi (soya, orbita).",
  },
  {
    key: "brachistochrone",
    titleUz: "Eng tez yoʻl",
    summaryUz:
      "Qaysi egri chiziq boʻylab jism eng tez pastga tushadi — brakistoxrona (tortishish, energiya, tezlik).",
  },
  {
    key: "divisor-grid",
    titleUz: "Boʻluvchilar panjarasi",
    summaryUz:
      "Sonning boʻluvchilari, tub sonlar va EKUB/EKUK panjarali koʻrinishda (matematika).",
  },
  {
    key: "richag",
    titleUz: "Richag",
    summaryUz:
      "Richag — kuch, yelka va muvozanat; moment va oddiy mexanizmlar (fizika).",
  },
  {
    key: "paskal",
    titleUz: "Paskal qonuni",
    summaryUz:
      "Suyuqlikdagi bosim har tomonga teng uzatiladi — Paskal qonuni, gidravlika (fizika).",
  },
  {
    key: "tovush",
    titleUz: "Tovush toʻlqini",
    summaryUz:
      "Tovush toʻlqini — chastota, amplituda, balandlik va tovush kuchi (fizika).",
  },
  {
    key: "linza",
    titleUz: "Linza",
    summaryUz:
      "Linza — yorugʻlik sinishi, fokus masofasi va tasvir hosil boʻlishi; optika (fizika).",
  },
  {
    key: "zanjir",
    titleUz: "Elektr zanjiri",
    summaryUz:
      "Elektr zanjiri — tok, kuchlanish, qarshilik va Om qonuni (fizika).",
  },
];

export const SIM_CATALOG_KEYS = SIM_CATALOG.map((c) => c.key);
export const SIM_CATALOG_BY_KEY: Record<string, SimCatalogEntry> = Object.fromEntries(
  SIM_CATALOG.map((c) => [c.key, c])
);
