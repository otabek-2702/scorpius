// components/laboratoriya/LabShell.tsx
/**
 * LabShell — reusable light-themed page chrome for every laboratory route.
 *
 * The orchestrator wraps each lab (Fizika, Kimyo, …) in this shell so the
 * sims themselves only have to render their cinematic dark stage. The shell
 * supplies: a back chevron to the hub, a serif title + optional subtitle, an
 * optional accent hairline (teal for physics, violet for chemistry), the lab
 * content, and the app's bottom navigation.
 *
 * Visual language matches app/page.tsx + SkyView.tsx — warm off-white surface,
 * gold-rationed accents, Newsreader serif display. The labs provide the dark
 * stages; this chrome stays light so the section still belongs to Scorpius.
 */
"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { BottomNav } from "@/components/nav/BottomNav";
import LabAsk from "./LabAsk";

export interface LabShellProps {
  /** Serif page title, e.g. "Fizika laboratoriyasi". */
  title: string;
  /** Optional one-line Uzbek subtitle / hook under the title. */
  subtitle?: string;
  /** Optional accent colour for the hairline + back chip (CSS color). Defaults to gold. */
  accent?: string;
  /** Topic string grounding the LabAsk mentor answers. Defaults to the title. */
  askTopic?: string;
  /** Optional starter questions for the LabAsk sheet. */
  askStarters?: string[];
  children: ReactNode;
}

export default function LabShell({
  title,
  subtitle,
  accent,
  askTopic,
  askStarters,
  children,
}: LabShellProps) {
  const accentColor = accent ?? "var(--color-antares-500)";

  return (
    <main className="relative flex min-h-dvh shrink-0 flex-col px-5 pb-36 pt-6">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col">
      {/* ---- top bar: back chevron to the hub + crumb ---- */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/laboratoriya"
          aria-label="Laboratoriyaga qaytish"
          className="inline-flex items-center gap-1.5 rounded-full border border-void-500 bg-void-800 py-1.5 pl-2 pr-3.5 text-[12px] font-semibold text-void-200 transition hover:border-void-400 hover:text-void-100 active:scale-95"
        >
          <ChevronLeft className="h-4 w-4" style={{ color: accentColor }} />
          Laboratoriya
        </Link>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-void-300">
          Scorpius · Lab
        </span>
      </div>

      {/* ---- serif title + optional subtitle ---- */}
      <header className="rise-in mt-5">
        <h1 className="font-serif text-[2rem] font-medium leading-[1.05] tracking-[-0.02em] text-void-100 sm:text-[2.4rem]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-[34rem] text-[14.5px] leading-[1.5] text-void-200">
            {subtitle}
          </p>
        )}
        {/* accent hairline — a single rationed stroke of the lab's colour */}
        <div
          aria-hidden
          className="mt-4 h-[2px] w-16 rounded-full"
          style={{ backgroundColor: accentColor }}
        />
      </header>

      {/* ---- lab content (provides its own dark stage) ---- */}
      <section className="rise-in mt-5 flex flex-1 flex-col">{children}</section>
      </div>

      <LabAsk topic={askTopic ?? title} accent={accentColor} starters={askStarters} />
      <BottomNav />
    </main>
  );
}
