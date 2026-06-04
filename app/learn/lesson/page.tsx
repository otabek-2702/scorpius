import { notFound } from "next/navigation";
import { LessonDeck } from "@/components/learn/LessonDeck";
import { demoLesson, LESSONS_BY_ID } from "@/lib/lesson";
import { loadAndAdapt } from "@/lib/curriculum/registerJson";

export const metadata = {
  title: "Dars · Scorpius",
};

/**
 * /learn/lesson — renders a lesson deck. `?topic={id}` selects a specific
 * lesson from the registry; without a topic, opens the math demo (boluvchi).
 *
 * Next 16 hands route handlers an async `searchParams` — we await it.
 */
export default async function LessonPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const { topic } = await searchParams;
  if (topic) {
    const lesson =
      LESSONS_BY_ID[topic] ??
      (await loadAndAdapt(6, "tabiiy-fan", topic));
    if (!lesson) notFound();
    return <LessonDeck lesson={lesson} />;
  }
  return <LessonDeck lesson={demoLesson} />;
}
