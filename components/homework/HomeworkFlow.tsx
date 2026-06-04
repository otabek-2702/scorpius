"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { LessonDeck } from "@/components/learn/LessonDeck";
import { BottomNav } from "@/components/nav/BottomNav";
import { HOMEWORK_WALKTHROUGHS } from "@/lib/homework/walkthroughs";
import { ensureAnonymousUser } from "@/lib/auth";
import { UploadZone } from "./UploadZone";
import { TopicPicker } from "./TopicPicker";

interface Extraction {
  isProblem: boolean;
  subject: "math" | "physics" | "history" | "language" | "other" | null;
  grade: number | null;
  topicUz: string | null;
  problemSummaryUz: string;
  studentHintUz: string;
}

interface ExtractResponse {
  extraction: Extraction;
  matchedWalkthroughId: string | null;
  cached: boolean;
}

type Phase =
  | { kind: "idle" }
  | { kind: "previewing"; blob: Blob; previewUrl: string }
  | { kind: "extracting"; previewUrl: string }
  | { kind: "matched"; previewUrl: string; extraction: Extraction; walkthroughId: string }
  | { kind: "no-match"; previewUrl: string | null; extraction: Extraction | null; reason: string }
  | { kind: "walkthrough"; walkthroughId: string };

/**
 * Homework surface — real upload, real vision extraction, real Socratic
 * walkthrough. State machine:
 *   idle → previewing → extracting → matched | no-match → walkthrough
 * If the extracted topic doesn't match any cached walkthrough, the student
 * can pick one from the TopicPicker grid instead.
 */
export function HomeworkFlow() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    void ensureAnonymousUser().then(setUid);
  }, []);

  // Revoke object URLs whenever a preview is replaced
  useEffect(() => {
    return () => {
      if (phase.kind === "previewing") URL.revokeObjectURL(phase.previewUrl);
    };
  }, [phase]);

  async function submit(blob: Blob, previewUrl: string) {
    setPhase({ kind: "extracting", previewUrl });
    try {
      const form = new FormData();
      form.append("image", blob, "homework.jpg");
      const res = await fetch("/api/homework/extract", {
        method: "POST",
        body: form,
        headers: uid ? { "X-Scorpius-Uid": uid } : undefined,
      });
      const body = (await res.json()) as ExtractResponse | { error?: string; message?: string };
      if (!res.ok) {
        const msg = (body as { message?: string }).message ?? "Xatolik yuz berdi";
        setPhase({
          kind: "no-match",
          previewUrl,
          extraction: null,
          reason: msg,
        });
        return;
      }
      const ok = body as ExtractResponse;
      if (ok.matchedWalkthroughId) {
        setPhase({
          kind: "matched",
          previewUrl,
          extraction: ok.extraction,
          walkthroughId: ok.matchedWalkthroughId,
        });
      } else {
        setPhase({
          kind: "no-match",
          previewUrl,
          extraction: ok.extraction,
          reason: ok.extraction.isProblem
            ? "Bu mavzu uchun maxsus yo'l-yo'riq hozircha yo'q. Quyidan tanlang."
            : "Rasmda masala ko'rinmadi. Boshqa rasm yuklang yoki mavzuni tanlang.",
        });
      }
    } catch {
      setPhase({
        kind: "no-match",
        previewUrl,
        extraction: null,
        reason: "Internet xatosi. Qaytadan urinib ko'ring.",
      });
    }
  }

  // The deck takes over the full surface when a walkthrough is mounted.
  if (phase.kind === "walkthrough") {
    const lesson = HOMEWORK_WALKTHROUGHS[phase.walkthroughId];
    if (lesson) return <LessonDeck lesson={lesson} />;
  }

  return (
    <main className="relative flex min-h-dvh flex-col px-6 pb-32 pt-10">
      <div className="mx-auto w-full max-w-[440px]">
        {/* Brand stamp */}
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-void-300">
          <span className="font-mono">Uy vazifasi</span>
          <span className="font-mono">Scorpius · 2026</span>
        </div>

        {/* IDLE — upload zone */}
        {phase.kind === "idle" && (
          <div className="mt-8">
            <h1 className="text-[1.7rem] font-semibold leading-tight text-void-100">
              Uy vazifangizni yuklang
            </h1>
            <p className="mt-2 text-void-300">
              Masala rasmini yuborung — Scorpius tayyor javobni bermaydi,
              balki uni birga yechishda yordam beradi.
            </p>
            <div className="mt-7">
              <UploadZone
                onReady={(blob, previewUrl) =>
                  setPhase({ kind: "previewing", blob, previewUrl })
                }
              />
            </div>
            <div className="mt-6 border-t border-void-500 pt-5 text-center">
              <p className="text-[11.5px] uppercase tracking-[0.14em] text-void-400">
                yoki
              </p>
              <button
                type="button"
                onClick={() => setPhase({ kind: "walkthrough", walkthroughId: "ekub" })}
                className="mt-3 text-[14px] font-medium text-void-200 underline underline-offset-4 transition hover:text-void-100"
              >
                Namuna masala bilan ko&apos;rish
              </button>
            </div>
          </div>
        )}

        {/* PREVIEWING — confirm or retry */}
        {phase.kind === "previewing" && (
          <div className="mt-8">
            <h1 className="text-[1.5rem] font-semibold leading-tight text-void-100">
              Rasm to&apos;g&apos;rimi?
            </h1>
            <p className="mt-2 text-[14px] text-void-300">
              O&apos;qib chiqishdan oldin tasdiqlang.
            </p>
            <div className="mt-5 overflow-hidden rounded-[18px] border border-void-500 bg-void-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={phase.previewUrl}
                alt="Yuklangan rasm"
                className="block max-h-[360px] w-full object-contain"
              />
            </div>
            <button
              type="button"
              onClick={() => submit(phase.blob, phase.previewUrl)}
              className="mt-5 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-antares-500 text-[1.05rem] font-semibold text-void-100 transition hover:bg-antares-300 active:scale-[0.98]"
            >
              O&apos;qib chiq <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                URL.revokeObjectURL(phase.previewUrl);
                setPhase({ kind: "idle" });
              }}
              className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-void-500 text-[14.5px] font-medium text-void-200 transition hover:border-void-400 hover:text-void-100"
            >
              <RotateCcw className="h-4 w-4" /> Boshqa rasm
            </button>
          </div>
        )}

        {/* EXTRACTING — friendly loading */}
        {phase.kind === "extracting" && (
          <div className="mt-8 flex flex-col items-center text-center">
            <div className="overflow-hidden rounded-[18px] border border-void-500 bg-void-800 opacity-70">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={phase.previewUrl}
                alt=""
                className="block max-h-[240px] w-full object-contain"
              />
            </div>
            <div className="mt-7 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-antares-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              O&apos;rganib chiqyapman…
            </div>
            <h2 className="mt-4 font-serif text-[1.7rem] font-medium leading-tight text-void-100">
              Masalangizni o&apos;qiyapman
            </h2>
            <p className="mt-2 max-w-[22rem] text-[14.5px] text-void-300">
              Mavzuni aniqlab, sizga mos yo&apos;l-yo&apos;riqni tanlayman. Bir necha soniya.
            </p>
          </div>
        )}

        {/* MATCHED — reveal + go */}
        {phase.kind === "matched" && (
          <div className="mt-8">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-antares-700">
              <Sparkles className="h-4 w-4" />
              Topdim
            </div>
            <h2 className="mt-3 font-serif text-[1.8rem] font-medium italic leading-[1.15] text-void-100">
              {phase.extraction.problemSummaryUz}
            </h2>
            {phase.extraction.studentHintUz && (
              <p className="mt-4 rounded-[14px] border border-antares-500/30 bg-antares-50 p-4 text-[14.5px] leading-snug text-void-100">
                <span className="font-semibold">Maslahat: </span>
                {phase.extraction.studentHintUz}
              </p>
            )}
            <button
              type="button"
              onClick={() =>
                setPhase({ kind: "walkthrough", walkthroughId: phase.walkthroughId })
              }
              className="mt-7 inline-flex h-[56px] w-full items-center justify-center gap-2 rounded-full bg-antares-500 text-[1.1rem] font-semibold text-void-100 transition hover:bg-antares-300 active:scale-[0.98]"
            >
              Birga yechamiz <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPhase({ kind: "idle" })}
              className="mt-3 inline-flex h-11 w-full items-center justify-center text-[14px] font-medium text-void-300 transition hover:text-void-100"
            >
              Boshqa rasm
            </button>
          </div>
        )}

        {/* NO-MATCH — show extraction + topic picker */}
        {phase.kind === "no-match" && (
          <div className="mt-8">
            <div className="flex items-start gap-3 rounded-[16px] border border-void-500 bg-void-800/60 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-antares-500" />
              <div>
                <p className="text-[14.5px] font-semibold leading-snug text-void-100">
                  {phase.reason}
                </p>
                {phase.extraction?.problemSummaryUz && phase.extraction?.isProblem && (
                  <p className="mt-2 text-[13.5px] leading-snug text-void-300">
                    Aniqlangan: {phase.extraction.problemSummaryUz}
                  </p>
                )}
              </div>
            </div>

            <h2 className="mt-7 text-[1.3rem] font-semibold leading-tight text-void-100">
              Mavzulardan birini tanlang
            </h2>
            <p className="mt-1 text-[13.5px] text-void-300">
              Bo&apos;limning Socratic yordami bilan birga yechamiz.
            </p>
            <div className="mt-4">
              <TopicPicker
                onPick={(id) => setPhase({ kind: "walkthrough", walkthroughId: id })}
              />
            </div>

            <button
              type="button"
              onClick={() => setPhase({ kind: "idle" })}
              className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 text-[14px] font-medium text-void-300 transition hover:text-void-100"
            >
              <RotateCcw className="h-4 w-4" /> Yangi rasm yuklash
            </button>
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
