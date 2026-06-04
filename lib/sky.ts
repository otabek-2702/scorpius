import { getTopic, topicsOf, type CurriculumTopic } from "@/lib/curriculum";

/** The student's constellation — each star is a curriculum topic (UX-DESIGN §0). */
export interface SkyStar {
  id: string;
  topic: string;
  x: number; // 0–100, horizontal position in the sky
  y: number; // 0–100, vertical position
  state: "ignited" | "available" | "dormant";
  lessonId?: string; // localStorage completion key — a finished lesson ignites the star
  href?: string; // tappable destination
}

/**
 * Hand-tuned star positions, drawn as a Scorpius-tail curve. Layout is decoration,
 * not curriculum — it is matched to the topic list by index. Add positions here
 * when a subject's unit grows; the topics themselves come from lib/curriculum.ts.
 */
const SKY_POSITIONS: { x: number; y: number }[] = [
  { x: 20, y: 16 },
  { x: 50, y: 10 },
  { x: 72, y: 28 },
  { x: 74, y: 52 },
  { x: 54, y: 72 },
  { x: 30, y: 86 },
];

function placeStars(
  topics: CurriculumTopic[],
  firstAvailableLessonId: string | null
): SkyStar[] {
  return topics.slice(0, SKY_POSITIONS.length).map((topic, i) => {
    const pos = SKY_POSITIONS[i];
    let state: SkyStar["state"];
    if (topic.lessonId && topic.lessonId === firstAvailableLessonId) {
      state = "available";
    } else if (topic.lessonId) {
      state = "ignited";
    } else {
      state = "dormant";
    }

    return {
      id: topic.id,
      topic: topic.title,
      x: pos.x,
      y: pos.y,
      state,
      ...(topic.lessonId
        ? { lessonId: topic.lessonId, href: "/learn/lesson" }
        : {}),
    };
  });
}

/**
 * Builds the constellation for one subject from the curriculum graph (whole-unit
 * walk). Best for short, linear subjects like Grade-6 mathematics whose first
 * unit fits the six SKY_POSITIONS.
 */
export function buildSky(grade: number, subjectId: string): SkyStar[] {
  const topics = topicsOf(grade, subjectId);
  const visible = topics.slice(0, SKY_POSITIONS.length);
  const firstWithLessonIndex = topics.findIndex((t) => t.lessonId);

  return visible.map((topic, i) => {
    const pos = SKY_POSITIONS[i];
    let state: SkyStar["state"];
    if (topic.lessonId) state = "available";
    else if (firstWithLessonIndex === -1 || i < firstWithLessonIndex) state = "ignited";
    else state = "dormant";
    return {
      id: topic.id,
      topic: topic.title,
      x: pos.x,
      y: pos.y,
      state,
      ...(topic.lessonId
        ? { lessonId: topic.lessonId, href: "/learn/lesson" }
        : {}),
    };
  });
}

/**
 * Builds a constellation from a hand-picked list of topic ids. Used for subjects
 * (like Grade-6 physics) whose curriculum has 60+ topics across 7 chapters — we
 * curate a 6-star path through the most interesting hops instead of walking
 * one unit linearly.
 */
export function buildFeaturedSky(
  grade: number,
  subjectId: string,
  topicIds: string[]
): SkyStar[] {
  const topics = topicIds
    .map((id) => getTopic(grade, subjectId, id))
    .filter((t): t is CurriculumTopic => Boolean(t));
  const firstWithLesson = topics.find((t) => t.lessonId)?.lessonId ?? null;
  return placeStars(topics, firstWithLesson);
}

/** The Grade-6 mathematics unit, drawn as a Scorpius-tail curve. */
export const skyStars: SkyStar[] = buildSky(6, "math");

/**
 * The Grade-6 physics constellation — six curated hops across the textbook's
 * seven chapters. Order follows pedagogical flow: matter structure → mechanics
 * → light. The four with cached lessons in `lib/lesson.ts` light up; the other
 * two stay dormant as "Tez orada" placeholders.
 */
export const physicsSkyStars: SkyStar[] = buildFeaturedSky(6, "physics", [
  "molekula", // Bob I — dormant intro
  "broun", // Bob I — lesson
  "arximed", // Bob II — lesson
  "issiqlik-uzatish", // Bob IV — dormant
  "tutilish", // Bob VI — lesson
  "kamalak", // Bob VI — lesson
]);

/** Subject metadata used by the constellation page (labels, pills, blurbs). */
export interface SubjectSky {
  id: "math" | "physics";
  label: string;
  unitPill: string;
  unitTitle: string;
  greeting: string;
  stars: SkyStar[];
}

export const SUBJECT_SKIES: Record<"math" | "physics", SubjectSky> = {
  math: {
    id: "math",
    label: "Matematika",
    unitPill: "1-bo'lim · 6-sinf matematika",
    unitTitle: "Bo'luvchilar va karralilar",
    greeting: "Bo'luvchilar, EKUB, EKUK — kasrlarga o'tishdan oldingi asos.",
    stars: skyStars,
  },
  physics: {
    id: "physics",
    label: "Fizika",
    unitPill: "Tanlangan · 6-sinf fizika",
    unitTitle: "Modda, kuch va yorug'lik",
    greeting:
      "Yetti bobdan tanlangan oltita yulduz — molekuladan kamalakgacha bir yo'lda.",
    stars: physicsSkyStars,
  },
};
