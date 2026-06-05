import Link from "next/link";

/** Faint, static star texture — the night sky, not a performance (UX-DESIGN §2.1). */
const STARS = [
  { top: 6, left: 14, s: 2, o: 0.55 },
  { top: 11, left: 67, s: 1.5, o: 0.4 },
  { top: 9, left: 88, s: 2, o: 0.5 },
  { top: 19, left: 33, s: 1, o: 0.35 },
  { top: 22, left: 91, s: 1.5, o: 0.45 },
  { top: 28, left: 8, s: 2, o: 0.5 },
  { top: 31, left: 54, s: 1, o: 0.3 },
  { top: 37, left: 79, s: 1.5, o: 0.4 },
  { top: 44, left: 19, s: 1, o: 0.3 },
  { top: 52, left: 93, s: 2, o: 0.5 },
  { top: 58, left: 6, s: 1.5, o: 0.4 },
  { top: 63, left: 72, s: 1, o: 0.3 },
  { top: 69, left: 38, s: 1.5, o: 0.4 },
  { top: 73, left: 88, s: 2, o: 0.45 },
  { top: 78, left: 16, s: 1, o: 0.35 },
  { top: 82, left: 60, s: 1.5, o: 0.4 },
  { top: 88, left: 30, s: 1, o: 0.3 },
  { top: 91, left: 82, s: 2, o: 0.5 },
  { top: 94, left: 49, s: 1.5, o: 0.4 },
  { top: 16, left: 50, s: 1, o: 0.25 },
];

const MARK_STARS = [
  [20, 30],
  [45, 27],
  [70, 33],
  [118, 59],
  [139, 69],
  [154, 58],
  [162, 40],
];

export default function Home() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-hidden px-6">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {STARS.map((st, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-star-bright"
            style={{
              top: `${st.top}%`,
              left: `${st.left}%`,
              width: st.s,
              height: st.s,
              opacity: st.o,
            }}
          />
        ))}
      </div>

      {/* Brand stamp — small, mono, top-left. Replaces a logo: defines that this is a real product, not a one-page mock. */}
      <div className="relative z-10 flex items-center justify-between pt-7 text-[11px] uppercase tracking-[0.18em] text-void-300">
        <span className="font-mono">Scorpius · 2026</span>
        <span className="font-mono hidden sm:inline">Toshkent</span>
      </div>

      {/* HERO — editorial column, single centered axis.
          flex-1 grows to viewport; inner my-auto centers WHEN there's room and
          releases naturally when content overflows (fixes mobile clip-off bug). */}
      <section className="rise-in relative z-10 mx-auto flex w-full max-w-[640px] flex-1 flex-col items-center py-8 text-center">
        <div className="my-auto flex flex-col items-center">
        {/* Larger constellation — 280px on mobile, 360px on sm+. The mark is the brand. */}
        <svg
          width="280"
          height="126"
          viewBox="0 0 200 90"
          fill="none"
          role="img"
          aria-label="Scorpius constellation"
          className="mb-10 h-auto w-[280px] sm:w-[360px]"
        >
          <polyline
            points="20,30 45,27 70,33 95,46 118,59 139,69 154,58 162,40"
            stroke="var(--color-void-500)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {MARK_STARS.map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="2.6" fill="var(--color-void-200)" />
          ))}
          {/* Antares — the heart, gold halo + ember */}
          <circle cx="95" cy="46" r="10" fill="var(--color-antares-500)" opacity="0.16" />
          <circle cx="95" cy="46" r="4.4" fill="var(--color-antares-500)" />
        </svg>

        {/* Editorial display headline — serif, italic emphasis, footnote marker */}
        <h1 className="font-serif text-[2.6rem] font-normal leading-[1.04] tracking-[-0.018em] text-void-100 sm:text-[3.4rem]">
          Har bir mavzu —
          <br />
          bitta <em className="italic font-medium">yulduz.</em>
          <sup className="ml-1 align-super text-[0.42em] font-normal text-void-300">
            [1]
          </sup>
        </h1>

        {/* Short editorial dek — sans-serif, restrained */}
        <p className="mt-7 max-w-[28rem] text-[1.05rem] leading-[1.55] text-void-200">
          Sizning emaktab — endi tirik o&apos;qituvchi.
        </p>

        <Link
          href="/onboarding"
          className="mt-10 inline-flex h-[52px] items-center justify-center rounded-full bg-antares-500 px-9 text-[1.05rem] font-semibold text-void-100 transition hover:bg-antares-300 active:scale-[0.97]"
        >
          Boshlash
        </Link>

        <p className="mt-5 text-sm text-void-300">
          Allaqachon hisobingiz bormi?{" "}
          <Link href="/learn" className="text-void-100 underline underline-offset-2">
            Kirish
          </Link>
        </p>
        </div>
      </section>

      {/* FOOTNOTE — the brand definition. PG move: bold claim above, citation below.
          Defines what Scorpius IS, what the name means, and the edtech context — so
          first-time visitors never see "Scorpius" without context. */}
      <footer className="relative z-10 mx-auto w-full max-w-[640px] pb-10 pt-12 sm:pb-14">
        <div className="border-t border-void-500/60 pt-6">
          <p className="font-serif text-[0.92rem] leading-[1.6] text-void-200">
            <span className="mr-2 align-super text-[0.7em] text-void-300">[1]</span>
            <em className="not-italic font-semibold text-void-100">Scorpius</em>{" "}
            <span className="text-void-300">— emaktab.uz uchun AI o&apos;qituvchi.</span>{" "}
            Baholaringizni shaxsiy darslarga aylantiradi: har bir uy vazifasini
            tushuntiradi, ota-onangizga o&apos;zbek tilida kunlik xulosa yuboradi.
            Nomi yulduz turkumidan — alohida yulduzlar bog&apos;lansa, yo&apos;l
            ko&apos;rsatadi. Biz bilim mavzularini xuddi shunday bog&apos;laymiz.
          </p>
          <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-void-300">
            — Toshkent · GDG Build with AI · NUU · 2026
          </p>
        </div>
      </footer>
    </main>
  );
}
