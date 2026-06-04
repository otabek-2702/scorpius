import Link from "next/link";

/**
 * STAGE 1 STUB — shared placeholder for features that are on the roadmap but not
 * yet built. Every screen that renders this is planned; see STAGE-PLAN.md for the
 * working-vs-planned status of each feature.
 */
export function ComingSoon({
  titleUz,
  descUz,
}: {
  titleUz: string;
  descUz?: string;
}) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-5 overflow-x-hidden px-6 text-center">
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-void-300">
        Scorpius · Stage 1
      </span>
      <h1 className="font-serif text-[2.1rem] font-normal leading-[1.06] tracking-[-0.018em] text-void-100 sm:text-[2.7rem]">
        {titleUz}
      </h1>
      <p className="max-w-[28rem] text-[1.02rem] leading-[1.55] text-void-200">
        {descUz ?? "Bu bo'lim hali ishlab chiqilmoqda."}
      </p>
      <span className="rounded-full bg-void-700 px-3 py-1 text-xs font-medium text-void-300">
        Rejalashtirilgan · tez orada
      </span>
      <Link
        href="/learn"
        className="mt-2 inline-flex h-[48px] items-center justify-center rounded-full bg-antares-500 px-7 text-[1rem] font-semibold text-void-100 transition hover:bg-antares-300 active:scale-[0.97]"
      >
        ← Darslarga qaytish
      </Link>
    </main>
  );
}
