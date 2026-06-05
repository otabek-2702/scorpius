import Link from "next/link";
import type { Metadata } from "next";
import { WaitlistForm } from "@/components/gdg/WaitlistForm";

export const metadata: Metadata = {
  title: "Erta kirish · Scorpius",
  description:
    "Scorpius — emaktab.uz uchun AI o'qituvchi. Birinchi 100 foydalanuvchi umrbod 50% chegirma oladi.",
};

/** Faint, static star texture — same atmosphere as the landing. */
const STARS = [
  { top: 7, left: 12, s: 2, o: 0.5 },
  { top: 13, left: 78, s: 1.5, o: 0.4 },
  { top: 22, left: 38, s: 1, o: 0.35 },
  { top: 28, left: 88, s: 2, o: 0.5 },
  { top: 36, left: 6, s: 1.5, o: 0.4 },
  { top: 44, left: 65, s: 1, o: 0.3 },
  { top: 53, left: 22, s: 1.5, o: 0.4 },
  { top: 61, left: 92, s: 1, o: 0.3 },
  { top: 70, left: 50, s: 2, o: 0.45 },
  { top: 78, left: 14, s: 1, o: 0.35 },
  { top: 85, left: 72, s: 1.5, o: 0.4 },
  { top: 92, left: 36, s: 2, o: 0.5 },
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

export default function GdgWaitlistPage() {
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

      {/* Brand stamp — establishes this is the same product as the QR scan target */}
      <div className="relative z-10 flex items-center justify-between pt-7 text-[11px] uppercase tracking-[0.18em] text-void-300">
        <Link href="/" className="font-mono hover:text-void-100">
          Scorpius · 2026
        </Link>
        <span className="font-mono">Erta kirish</span>
      </div>

      <section className="rise-in relative z-10 mx-auto flex w-full max-w-[460px] flex-1 flex-col py-8">
        {/* my-auto centers vertically WHEN there's room, releases naturally when
            content overflows the viewport — fixes the mobile bug where
            justify-center clipped the form's submit button off-screen. */}
        <div className="my-auto">
          {/* Small constellation to anchor the brand visual */}
          <svg
            width="160"
            height="72"
            viewBox="0 0 200 90"
            fill="none"
            role="img"
            aria-label="Scorpius"
            className="mb-8 self-center mx-auto block"
          >
            <polyline
              points="20,30 45,27 70,33 95,46 118,59 139,69 154,58 162,40"
              stroke="var(--color-void-500)"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {MARK_STARS.map(([cx, cy], i) => (
              <circle key={i} cx={cx} cy={cy} r="2.4" fill="var(--color-void-200)" />
            ))}
            <circle cx="95" cy="46" r="9" fill="var(--color-antares-500)" opacity="0.16" />
            <circle cx="95" cy="46" r="4.2" fill="var(--color-antares-500)" />
          </svg>

          {/* Editorial headline — different lede than landing, focused on the offer */}
          <h1 className="text-center font-serif text-[2.2rem] font-normal leading-[1.08] tracking-[-0.018em] text-void-100 sm:text-[2.55rem]">
            Birinchi 100 ga
            <br />
            <em className="italic font-medium">umrbod 50%</em>.
          </h1>

          <p className="mx-auto mt-5 max-w-[26rem] text-center text-[1rem] leading-[1.55] text-void-200">
            Telefon raqamingizni qoldiring — beta tayyor bo&apos;lganda Telegram orqali
            erta kirish havolasini yuboramiz.
          </p>

          <div className="mt-10">
            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* Footnote — same brand-definition discipline as the landing */}
      <footer className="relative z-10 mx-auto w-full max-w-[460px] pb-10 pt-8">
        <div className="border-t border-void-500/60 pt-6">
          <p className="font-serif text-[0.88rem] leading-[1.6] text-void-200">
            <span className="mr-2 align-super text-[0.7em] text-void-300">[1]</span>
            <em className="not-italic font-semibold text-void-100">Scorpius</em>{" "}
            <span className="text-void-300">— emaktab.uz uchun AI o&apos;qituvchi.</span>{" "}
            Baholaringizni shaxsiy darslarga aylantiradi: har bir uy vazifasini
            tushuntiradi, ota-onangizga o&apos;zbek tilida kunlik xulosa yuboradi.
          </p>
          <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-void-300">
            — Andijan · Build with AI · NUU · 2026
          </p>
        </div>
      </footer>
    </main>
  );
}
