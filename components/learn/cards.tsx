"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, ChevronUp, Lightbulb, Loader2, Sparkles, Star } from "lucide-react";
import type { Card } from "@/lib/lesson";
import { loadProfile } from "@/lib/profile";
import { SIM_REGISTRY } from "./sims";
import type { ImageState } from "./useLessonImagePrefetch";
import { PredictCard } from "./cards/PredictCard";
import { ExploreSandboxCard } from "./cards/ExploreSandboxCard";
import { ChallengeCard } from "./cards/ChallengeCard";
import { PatternDiscoverCard } from "./cards/PatternDiscoverCard";
import { CompareDecideCard } from "./cards/CompareDecideCard";
import { BuildCard } from "./cards/BuildCard";

/** Card types whose state must be completed before the deck unlocks the next card. */
export function cardRequiresCompletion(type: Card["type"]): boolean {
  return (
    type === "mcq" || type === "discover" || type === "sequence" ||
    type === "sort" || type === "numberline" || type === "simulation" ||
    type === "predict" || type === "explore-sandbox" || type === "challenge" ||
    type === "pattern-discover" || type === "compare-and-decide" || type === "build"
  );
}

function CardShell({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-[560px] rounded-[32px] border border-void-500 bg-void-800 p-6 shadow-[0_3px_30px_-8px_rgba(0,0,0,0.18)] sm:p-8">
      {children}
    </div>
  );
}

function Overline({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-1.5 w-1.5 rounded-full bg-subject-math" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-void-300">
        {label}
      </span>
    </div>
  );
}

/** A real photograph on a card — rounded, responsive, with a small credit line.
 *  Uses a plain <img> (matching DiagramCard) so locally-hosted /public assets
 *  need no next/image remote-domain config. */
function CardPhoto({
  src,
  alt,
  credit,
}: {
  src: string;
  alt: string;
  credit?: string;
}) {
  return (
    <figure className="overflow-hidden rounded-[18px] border border-void-500 bg-void-700">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" className="block w-full object-cover" />
      {credit && (
        <figcaption className="px-3 py-1.5 text-[10.5px] leading-snug text-void-400">
          {credit}
        </figcaption>
      )}
    </figure>
  );
}

function IntroCard({
  card,
  subjectLabel,
}: {
  card: Extract<Card, { type: "intro" }>;
  subjectLabel: string;
}) {
  const [name, setName] = useState("");
  useEffect(() => {
    const profile = loadProfile();
    if (profile?.name) setName(profile.name);
  }, []);
  return (
    <CardShell>
      <Overline label={subjectLabel} />
      {name && (
        <p className="mt-3 text-sm font-semibold text-antares-700">Salom, {name}!</p>
      )}
      <h2 className="mt-4 text-[2rem] font-semibold leading-tight tracking-[-0.02em] text-void-100">
        {card.title}
      </h2>
      <p className="mt-4 text-lg leading-relaxed text-void-200">{card.hook}</p>
      {card.image && (
        <div className="mt-5">
          <CardPhoto src={card.image.src} alt={card.image.alt} credit={card.image.credit} />
        </div>
      )}
      <p className="mt-5 text-[13px] font-medium text-void-300">
        ≈ {card.estMinutes} daqiqa · {card.cardCount} ta karta
      </p>
      <div className="mt-8 flex flex-col items-center gap-1 text-void-300">
        <ChevronUp className="h-5 w-5 animate-bounce" />
        <span className="text-sm">Yuqoriga suring</span>
      </div>
    </CardShell>
  );
}

function ExplainerCard({
  card,
  subjectLabel,
}: {
  card: Extract<Card, { type: "explainer" }>;
  subjectLabel: string;
}) {
  return (
    <CardShell>
      <Overline label={subjectLabel} />
      <h3 className="mt-4 text-xl font-semibold text-void-100">{card.heading}</h3>
      {card.image && (
        <div className="mt-4">
          <CardPhoto src={card.image.src} alt={card.image.alt} credit={card.image.credit} />
        </div>
      )}
      <div className="mt-3 space-y-3">
        {card.body.split("\n\n").map((paragraph, i) => (
          <p key={i} className="text-lg leading-relaxed text-void-200">
            {paragraph}
          </p>
        ))}
      </div>
    </CardShell>
  );
}

function McqCard({
  card,
  subjectLabel,
  onComplete,
}: {
  card: Extract<Card, { type: "mcq" }>;
  subjectLabel: string;
  onComplete?: () => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [wrong, setWrong] = useState<number[]>([]);
  const solved = picked !== null && picked === card.correctIndex;
  const letters = ["A", "B", "C", "D"];

  useEffect(() => {
    if (solved) onComplete?.();
  }, [solved, onComplete]);

  function choose(index: number) {
    if (solved) return;
    setPicked(index);
    if (index !== card.correctIndex && !wrong.includes(index)) {
      setWrong([...wrong, index]);
    }
  }

  return (
    <CardShell>
      <Overline label={`${subjectLabel} · Savol`} />
      <h3 className="mt-4 text-[1.55rem] font-semibold leading-snug text-void-100">
        {card.question}
      </h3>

      <div className="mt-5 flex flex-col gap-3">
        {card.options.map((option, i) => {
          const isCorrect = solved && i === card.correctIndex;
          const isCurrentWrong = picked === i && i !== card.correctIndex;
          const wasWrong = wrong.includes(i) && !isCurrentWrong;

          let cls =
            "flex items-center gap-3 rounded-[14px] border px-4 py-3.5 text-left text-lg font-medium transition-colors";
          if (isCorrect) {
            cls += " border-signal-correct bg-signal-correct/15 text-void-100 pulse-correct";
          } else if (isCurrentWrong) {
            cls += " border-signal-rethink bg-signal-rethink/10 text-void-100 shake";
          } else if (wasWrong) {
            cls += " border-signal-rethink/40 bg-void-700 text-void-200";
          } else {
            cls += " border-void-500 bg-void-700 text-void-100 hover:border-void-400";
          }
          if (solved && !isCorrect) cls += " opacity-50";

          return (
            <button
              key={i}
              type="button"
              onClick={() => choose(i)}
              disabled={solved}
              className={cls}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-void-600 text-sm font-semibold">
                {isCorrect ? <Check className="h-4 w-4" /> : letters[i]}
              </span>
              <span>{option}</span>
            </button>
          );
        })}
      </div>

      {solved && (
        <div className="mt-4 flex items-start gap-2 rounded-[14px] bg-void-700 p-3.5">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-signal-correct" />
          <p className="text-sm leading-relaxed text-void-200">{card.explain}</p>
        </div>
      )}
      {!solved && picked !== null && (
        <div className="mt-4 flex items-start gap-2 rounded-[14px] bg-void-700 p-3.5">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-signal-info" />
          <p className="text-sm leading-relaxed text-void-200">{card.hint}</p>
        </div>
      )}
    </CardShell>
  );
}

function DiscoverCard({
  card,
  subjectLabel,
  onComplete,
}: {
  card: Extract<Card, { type: "discover" }>;
  subjectLabel: string;
  onComplete?: () => void;
}) {
  const [found, setFound] = useState<number[]>([]);
  const [missed, setMissed] = useState<number | null>(null);
  const complete = found.length === card.correct.length;
  useEffect(() => { if (complete) onComplete?.(); }, [complete, onComplete]);

  function tap(n: number) {
    if (complete || found.includes(n)) return;
    if (card.correct.includes(n)) {
      setFound((f) => [...f, n]);
    } else {
      setMissed(n);
      setTimeout(() => setMissed((m) => (m === n ? null : m)), 420);
    }
  }

  return (
    <CardShell>
      <Overline label={`${subjectLabel} · Kashfiyot`} />
      <h3 className="mt-4 text-[1.4rem] font-semibold leading-snug text-void-100">
        {card.prompt}
      </h3>
      <p className="mt-2 text-sm font-medium text-void-300">
        {found.length} / {card.correct.length} topildi
      </p>

      <div className="mt-4 grid grid-cols-4 gap-2.5">
        {card.pool.map((n) => {
          const isFound = found.includes(n);
          const isMissed = missed === n;
          let cls =
            "flex h-14 items-center justify-center rounded-[14px] border text-lg font-semibold transition";
          if (isFound) {
            cls += " border-signal-correct bg-signal-correct/15 text-void-100";
          } else if (isMissed) {
            cls += " border-signal-rethink bg-signal-rethink/10 text-void-100 shake";
          } else if (complete) {
            cls += " border-void-500 bg-void-700 text-void-300 opacity-50";
          } else {
            cls +=
              " border-void-500 bg-void-700 text-void-100 hover:border-void-400 active:scale-95";
          }
          return (
            <button
              key={n}
              type="button"
              onClick={() => tap(n)}
              disabled={complete}
              className={cls}
            >
              {n}
            </button>
          );
        })}
      </div>

      {complete && (
        <div className="mt-4 flex items-start gap-2 rounded-[14px] bg-signal-correct/10 p-3.5">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-signal-correct" />
          <p className="text-sm leading-relaxed text-void-200">{card.reveal}</p>
        </div>
      )}
    </CardShell>
  );
}

function SequenceCard({
  card,
  subjectLabel,
  onComplete,
}: {
  card: Extract<Card, { type: "sequence" }>;
  subjectLabel: string;
  onComplete?: () => void;
}) {
  const [placed, setPlaced] = useState<number[]>([]);
  const [missed, setMissed] = useState<number | null>(null);
  const complete = placed.length === card.order.length;
  useEffect(() => { if (complete) onComplete?.(); }, [complete, onComplete]);

  function tap(n: number) {
    if (complete || placed.includes(n)) return;
    if (n === card.order[placed.length]) {
      setPlaced((p) => [...p, n]);
    } else {
      setMissed(n);
      setTimeout(() => setMissed((m) => (m === n ? null : m)), 420);
    }
  }

  return (
    <CardShell>
      <Overline label={`${subjectLabel} · Ketma-ketlik`} />
      <h3 className="mt-4 text-[1.4rem] font-semibold leading-snug tracking-[-0.02em] text-void-100">
        {card.prompt}
      </h3>

      <div className="mt-4 flex min-h-[52px] flex-wrap items-center gap-1.5 rounded-[14px] bg-void-700 p-2.5">
        {placed.length === 0 ? (
          <span className="px-1 text-sm text-void-400">Tartib bilan tanlang…</span>
        ) : (
          placed.map((n, i) => (
            <div key={n} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-void-300">→</span>}
              <span className="flex h-9 min-w-[36px] items-center justify-center rounded-[10px] bg-signal-correct/15 px-2 font-semibold text-void-100">
                {n}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2.5">
        {card.pool.map((n) => {
          const isPlaced = placed.includes(n);
          const isMissed = missed === n;
          let cls =
            "flex h-14 items-center justify-center rounded-[14px] border text-lg font-semibold transition";
          if (isPlaced) {
            cls += " border-void-500 bg-void-700 text-void-300 opacity-40";
          } else if (isMissed) {
            cls += " border-signal-rethink bg-signal-rethink/10 text-void-100 shake";
          } else {
            cls +=
              " border-void-500 bg-void-700 text-void-100 hover:border-void-400 active:scale-95";
          }
          return (
            <button
              key={n}
              type="button"
              onClick={() => tap(n)}
              disabled={isPlaced || complete}
              className={cls}
            >
              {n}
            </button>
          );
        })}
      </div>

      {complete && (
        <div className="mt-4 flex items-start gap-2 rounded-[14px] bg-signal-correct/10 p-3.5">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-signal-correct" />
          <p className="text-sm leading-relaxed text-void-200">{card.reveal}</p>
        </div>
      )}
    </CardShell>
  );
}

function SortCard({
  card,
  subjectLabel,
  onComplete,
}: {
  card: Extract<Card, { type: "sort" }>;
  subjectLabel: string;
  onComplete?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [bucketA, setBucketA] = useState<number[]>([]);
  const [bucketB, setBucketB] = useState<number[]>([]);
  const [wrong, setWrong] = useState(false);
  const complete = index >= card.items.length;
  const current = complete ? null : card.items[index];
  useEffect(() => { if (complete) onComplete?.(); }, [complete, onComplete]);

  function choose(side: "A" | "B") {
    if (!current) return;
    if (current.bucket === side) {
      if (side === "A") setBucketA((x) => [...x, current.value]);
      else setBucketB((x) => [...x, current.value]);
      setIndex((i) => i + 1);
      setWrong(false);
    } else {
      setWrong(true);
      setTimeout(() => setWrong(false), 420);
    }
  }

  function bucket(label: string, items: number[], onClick: () => void) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={complete}
        className="flex flex-1 flex-col items-center gap-2 rounded-[18px] border border-void-500 bg-void-700 p-3 transition hover:border-void-400 active:scale-[0.98] disabled:opacity-60"
      >
        <span className="text-[13px] font-semibold text-void-200">{label}</span>
        <div className="flex min-h-[28px] flex-wrap justify-center gap-1">
          {items.map((v) => (
            <span
              key={v}
              className="flex h-7 min-w-[28px] items-center justify-center rounded-[8px] bg-signal-correct/15 px-1.5 text-sm font-semibold text-void-100"
            >
              {v}
            </span>
          ))}
        </div>
      </button>
    );
  }

  return (
    <CardShell>
      <Overline label={`${subjectLabel} · Saralash`} />
      <h3 className="mt-4 text-[1.4rem] font-semibold leading-snug tracking-[-0.02em] text-void-100">
        {card.prompt}
      </h3>

      <div
        className={`mt-4 flex h-20 items-center justify-center rounded-[18px] border-2 border-dashed border-void-500 ${wrong ? "shake" : ""}`}
      >
        {current ? (
          <span className="text-[2rem] font-semibold text-void-100">{current.value}</span>
        ) : (
          <span className="flex items-center gap-2 text-base font-medium text-void-200">
            <Check className="h-5 w-5 text-signal-correct" />
            Hammasi saralandi
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-3">
        {bucket(card.bucketA, bucketA, () => choose("A"))}
        {bucket(card.bucketB, bucketB, () => choose("B"))}
      </div>

      {complete && (
        <div className="mt-4 flex items-start gap-2 rounded-[14px] bg-signal-correct/10 p-3.5">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-signal-correct" />
          <p className="text-sm leading-relaxed text-void-200">{card.reveal}</p>
        </div>
      )}
    </CardShell>
  );
}

function NumberLineCard({
  card,
  subjectLabel,
  onComplete,
}: {
  card: Extract<Card, { type: "numberline" }>;
  subjectLabel: string;
  onComplete?: () => void;
}) {
  const [found, setFound] = useState<number[]>([]);
  const [missed, setMissed] = useState<number | null>(null);
  const complete = found.length === card.correct.length;
  const positions = Array.from({ length: card.max + 1 }, (_, i) => i);
  useEffect(() => { if (complete) onComplete?.(); }, [complete, onComplete]);

  function tap(n: number) {
    if (complete || found.includes(n)) return;
    if (card.correct.includes(n)) {
      setFound((f) => [...f, n]);
    } else {
      setMissed(n);
      setTimeout(() => setMissed((m) => (m === n ? null : m)), 420);
    }
  }

  return (
    <CardShell>
      <Overline label={`${subjectLabel} · Sonlar o'qi`} />
      <h3 className="mt-4 text-[1.4rem] font-semibold leading-snug tracking-[-0.02em] text-void-100">
        {card.prompt}
      </h3>
      <p className="mt-2 text-sm font-medium text-void-300">
        {found.length} / {card.correct.length} belgilandi
      </p>

      <div className="mt-6">
        <div className="relative flex items-center">
          <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded bg-void-400" />
          {positions.map((n) => {
            const isFound = found.includes(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => tap(n)}
                disabled={complete}
                className={`relative z-10 flex flex-1 items-center justify-center py-2.5 ${
                  missed === n ? "shake" : ""
                }`}
              >
                <span
                  className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${
                    isFound
                      ? "border-antares-500 bg-antares-500"
                      : "border-void-400 bg-void-950"
                  }`}
                  style={
                    isFound ? { boxShadow: "0 0 9px 2px rgba(232,162,26,0.5)" } : undefined
                  }
                />
              </button>
            );
          })}
        </div>
        <div className="mt-1 flex">
          {positions.map((n) => (
            <span
              key={n}
              className={`flex-1 text-center text-[11px] ${
                found.includes(n) ? "font-semibold text-void-100" : "text-void-300"
              }`}
            >
              {n}
            </span>
          ))}
        </div>
      </div>

      {complete && (
        <div className="mt-5 flex items-start gap-2 rounded-[14px] bg-signal-correct/10 p-3.5">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-signal-correct" />
          <p className="text-sm leading-relaxed text-void-200">{card.reveal}</p>
        </div>
      )}
    </CardShell>
  );
}

function AskCard({ card }: { card: Extract<Card, { type: "ask" }> }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function ask() {
    const q = question.trim();
    if (q.length < 2 || status === "loading") return;
    setStatus("loading");
    setAnswer("");
    try {
      // Pull the captured profile so the LLM can frame examples around the
      // student's actual interests (Batman, Mercedes, Real Madrid, …) instead
      // of generic "a friend has 3 apples." This closes the promise/reality
      // gap from the onboarding flow.
      const profile = loadProfile();
      const profileHints = profile
        ? {
            grade: profile.grade,
            interests: profile.interests,
            subInterests: profile.subInterests,
            painPoint: profile.painPoint,
          }
        : null;
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, topic: card.topic, profile: profileHints }),
      });
      const data = (await res.json()) as { answer?: string };
      if (!res.ok || !data.answer) throw new Error("no answer");
      setAnswer(data.answer);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <CardShell>
      <Overline label="Scorpiusdan so'rang" />
      <h3 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-void-100">
        {card.heading}
      </h3>
      <p className="mt-2 text-[15px] leading-relaxed text-void-200">
        Mavzu yuzasidan tushunmagan joyingizni yozing — Scorpius javob beradi.
      </p>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={2}
        placeholder="Masalan: nega 1 har qanday sonning bo'luvchisi?"
        className="mt-4 w-full resize-none rounded-[14px] border border-void-500 bg-void-700 px-4 py-3 text-base text-void-100 outline-none transition-colors placeholder:text-void-400 focus:border-antares-500"
      />
      <button
        type="button"
        onClick={ask}
        disabled={status === "loading" || question.trim().length < 2}
        className="mt-3 inline-flex h-[46px] w-full items-center justify-center gap-2 rounded-full bg-antares-500 text-[15px] font-semibold text-void-100 transition hover:bg-antares-300 active:scale-[0.97] disabled:opacity-40"
      >
        {status === "loading" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Scorpius o&apos;ylamoqda…
          </>
        ) : (
          "So'rash"
        )}
      </button>
      {answer && (
        <div className="mt-4 flex items-start gap-2 rounded-[14px] bg-antares-50 p-3.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-antares-700" />
          <p className="text-[15px] leading-relaxed text-void-100">{answer}</p>
        </div>
      )}
      {status === "error" && (
        <p className="mt-3 text-sm text-signal-error">
          Hozir javob berib bo&apos;lmadi. Internetni tekshirib, qayta urinib
          ko&apos;ring.
        </p>
      )}
    </CardShell>
  );
}

/** A "simulation" card hosts an interactive component from SIM_REGISTRY. The
 *  sim fires its own onComplete callback when the user has meaningfully
 *  interacted (raced the balls / built the circuit / etc.) — the deck unlocks
 *  the next card from that signal. */
function SimulationCard({
  card,
  subjectLabel,
  onComplete,
}: {
  card: Extract<Card, { type: "simulation" }>;
  subjectLabel: string;
  onComplete?: () => void;
}) {
  const [done, setDone] = useState(false);
  const Sim = SIM_REGISTRY[card.sim];
  return (
    <CardShell>
      <Overline label={`${subjectLabel} · Laboratoriya`} />
      <h3 className="mt-4 text-[1.4rem] font-semibold leading-snug tracking-[-0.02em] text-void-100">
        {card.heading}
      </h3>
      <p className="mt-2 text-[14px] text-void-300">{card.instruction}</p>
      <div className="mt-4">
        {Sim ? (
          <Sim
            config={card.config}
            onComplete={() => {
              setDone(true);
              onComplete?.();
            }}
          />
        ) : (
          <div className="rounded-[14px] border border-signal-rethink/40 bg-void-700 p-4 text-[13px] text-void-300">
            Simulyatsiya topilmadi: <code>{card.sim}</code>
          </div>
        )}
      </div>
      {done && card.reveal && (
        <div className="mt-4 flex items-start gap-2 rounded-[14px] bg-signal-correct/10 p-3.5">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-signal-correct" />
          <p className="text-sm leading-relaxed text-void-200">{card.reveal}</p>
        </div>
      )}
    </CardShell>
  );
}

/** A "diagram" card — renders an image (pre-baked static asset OR an image
 *  state injected by useLessonImagePrefetch). Pure render — does NOT fetch.
 *  Spec §6. */
function DiagramCard({
  card,
  subjectLabel,
  imageState,
}: {
  card: Extract<Card, { type: "diagram" }>;
  subjectLabel: string;
  imageState?: ImageState;
}) {
  const src = imageState?.src ?? card.src;
  const hasPrompt = Boolean(card.prompt);
  const isError = imageState?.status === "error";
  const isLoading = !src && hasPrompt && !isError;

  return (
    <CardShell>
      <Overline label={`${subjectLabel} · Tasvir`} />
      <h3 className="mt-3 text-[1.3rem] font-semibold leading-snug text-void-100">
        {card.heading}
      </h3>
      <div className="mt-4 overflow-hidden rounded-[18px] border border-void-500 bg-void-700">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={card.caption} className="block w-full" />
        ) : isError ? (
          <div className="flex aspect-video items-center justify-center px-4 text-center text-[13px] text-signal-rethink">
            Tasvirni yaratib bo&apos;lmadi — internetni tekshirib qayta urinib ko&apos;ring.
          </div>
        ) : isLoading ? (
          <div
            className="flex aspect-video items-center justify-center text-[13px] text-void-300"
            style={{
              background:
                "linear-gradient(110deg, rgba(232,162,26,0.05) 0%, rgba(232,162,26,0.18) 50%, rgba(232,162,26,0.05) 100%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.6s linear infinite",
            }}
          >
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Scorpius tasvirni yaratmoqda…
            </span>
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-[14px] leading-relaxed text-void-200">{card.caption}</p>
    </CardShell>
  );
}

/** A "story" card — narrative beat with a serif accent (used for historical
 *  hooks like Newton solving the brachistochrone overnight). */
function StoryCard({
  card,
  subjectLabel,
}: {
  card: Extract<Card, { type: "story" }>;
  subjectLabel: string;
}) {
  return (
    <CardShell>
      <Overline label={`${subjectLabel} · Hikoya`} />
      <h3 className="mt-3 text-[1.4rem] font-semibold tracking-[-0.02em] text-void-100">
        {card.heading}
      </h3>
      {card.image && (
        <div className="mt-4">
          <CardPhoto src={card.image.src} alt={card.image.alt} credit={card.image.credit} />
        </div>
      )}
      <div className="mt-3 space-y-3">
        {card.body.split("\n\n").map((p, i) => (
          <p
            key={i}
            className="text-[1.05rem] leading-relaxed text-void-200"
            style={{ fontFamily: '"Inter Tight", Georgia, serif', letterSpacing: "-0.005em" }}
          >
            {p}
          </p>
        ))}
      </div>
    </CardShell>
  );
}

function DoneCard({ card }: { card: Extract<Card, { type: "done" }> }) {
  return (
    <CardShell>
      <div className="flex flex-col items-center text-center">
        <Star className="h-12 w-12 text-star-ignited" fill="currentColor" />
        <h2 className="mt-4 text-[1.55rem] font-semibold text-void-100">{card.title}</h2>
        <p className="mt-3 text-lg leading-relaxed text-void-200">{card.body}</p>
        <Link
          href="/learn"
          className="mt-7 inline-flex h-[52px] items-center justify-center rounded-full bg-antares-500 px-9 text-base font-semibold text-void-100 transition hover:bg-antares-300 active:scale-[0.97]"
        >
          Yakunlash
        </Link>
      </div>
    </CardShell>
  );
}

export function LessonCardView({
  card,
  subjectLabel,
  onComplete,
  imageState,
}: {
  card: Card;
  subjectLabel: string;
  /** Fires once when a completion-required card finishes (mcq/discover/sequence/sort/numberline). */
  onComplete?: () => void;
  imageState?: ImageState;
}) {
  switch (card.type) {
    case "intro":
      return <IntroCard card={card} subjectLabel={subjectLabel} />;
    case "explainer":
      return <ExplainerCard card={card} subjectLabel={subjectLabel} />;
    case "mcq":
      return <McqCard card={card} subjectLabel={subjectLabel} onComplete={onComplete} />;
    case "discover":
      return <DiscoverCard card={card} subjectLabel={subjectLabel} onComplete={onComplete} />;
    case "sequence":
      return <SequenceCard card={card} subjectLabel={subjectLabel} onComplete={onComplete} />;
    case "sort":
      return <SortCard card={card} subjectLabel={subjectLabel} onComplete={onComplete} />;
    case "numberline":
      return <NumberLineCard card={card} subjectLabel={subjectLabel} onComplete={onComplete} />;
    case "simulation":
      return <SimulationCard card={card} subjectLabel={subjectLabel} onComplete={onComplete} />;
    case "diagram":
      return <DiagramCard card={card} subjectLabel={subjectLabel} imageState={imageState} />;
    case "story":
      return <StoryCard card={card} subjectLabel={subjectLabel} />;
    case "ask":
      return <AskCard card={card} />;
    case "done":
      return <DoneCard card={card} />;
    case "predict":
      return <PredictCard card={card} onComplete={onComplete} />;
    case "explore-sandbox":
      return <ExploreSandboxCard card={card} onComplete={onComplete} />;
    case "challenge":
      return <ChallengeCard card={card} onComplete={onComplete} />;
    case "pattern-discover":
      return <PatternDiscoverCard card={card} onComplete={onComplete} />;
    case "compare-and-decide":
      return <CompareDecideCard card={card} onComplete={onComplete} />;
    case "build":
      return <BuildCard card={card} onComplete={onComplete} />;
  }
}
