// components/laboratoriya/LabAsk.tsx
/**
 * LabAsk — a personalised "ask a question" surface for every laboratory.
 *
 * A floating "Soʻrang" button opens a sheet where the student asks about the
 * experiment they're looking at. The answer comes in their chosen MENTOR
 * PERSONA's voice (Scorpius / Al-Xorazmiy / Newton / Einstein / Elon) and is
 * flavoured with the student's HOBBIES — the server (app/api/ask) injects the
 * captured profile (interests, subInterests like Futbol→Real) via profileLine(),
 * so a football fan gets football examples. Personas with an ElevenLabs voice id
 * can be heard aloud (reuses /api/voice/prerender, like MentorOverlay).
 *
 * Wired once in LabShell, so every lab + tajriba experiment gets it for free.
 * `topic` grounds the answer in the current lab (passed from the route).
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircleQuestion, Send, Sparkles, Volume2, X } from "lucide-react";
import { PERSONAS, type PersonaId } from "@/lib/personas";
import { loadProfile } from "@/lib/profile";
import { SIM_REGISTRY } from "@/components/learn/sims";
import { SIM_CATALOG_BY_KEY } from "@/lib/sims/catalog";

/** Persona → ElevenLabs voice id (env). Only some personas have a voice;
 *  the rest simply hide the "listen" affordance. Mirrors MentorOverlay. */
const VOICE_ID_BY_PERSONA: Record<PersonaId, string | undefined> = {
  scorpius: undefined,
  xorazmiy: process.env.NEXT_PUBLIC_ELEVENLABS_XORAZMIY_VOICE_ID,
  beruniy: undefined,
  "ibn-sino": undefined,
  ulugbek: undefined,
  newton: process.env.NEXT_PUBLIC_ELEVENLABS_NEWTON_VOICE_ID,
  einstein: process.env.NEXT_PUBLIC_ELEVENLABS_EINSTEIN_VOICE_ID,
  elon: undefined,
};

const PERSONA_KEY = "scorpius:lab-persona";
const PERSONA_ORDER: PersonaId[] = [
  "scorpius",
  "xorazmiy",
  "beruniy",
  "ibn-sino",
  "ulugbek",
  "newton",
  "einstein",
  "elon",
];

/** Short label for the compact persona chip + composer placeholder. A plain
 *  displayName.split(" ")[0] collides for the scholar honorific "Abu" (both
 *  Beruniy and Ibn Sino would read "Abu"), so we keep a distinctive token per
 *  persona. Falls back to the first word for any future persona. */
const SHORT_LABEL: Record<PersonaId, string> = {
  scorpius: "Scorpius",
  xorazmiy: "Al-Xorazmiy",
  beruniy: "Beruniy",
  "ibn-sino": "Ibn Sino",
  ulugbek: "Ulug'bek",
  newton: "Newton",
  einstein: "Einstein",
  elon: "Elon",
};

function shortLabel(id: PersonaId): string {
  return SHORT_LABEL[id] ?? PERSONAS[id].displayName.split(" ")[0];
}

interface Turn {
  role: "user" | "persona";
  text: string;
  personaId?: PersonaId;
  error?: boolean;
  /** Optional inline animation the mentor chose to illustrate the answer. */
  simKey?: string | null;
}

export default function LabAsk({
  topic,
  accent = "var(--color-antares-500)",
  starters,
}: {
  topic: string;
  accent?: string;
  starters?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [personaId, setPersonaId] = useState<PersonaId>("scorpius");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [thread, setThread] = useState<Turn[]>([]);
  const [playing, setPlaying] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // restore the student's preferred lab mentor
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PERSONA_KEY);
      if (saved && saved in PERSONAS) setPersonaId(saved as PersonaId);
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  function pickPersona(id: PersonaId) {
    setPersonaId(id);
    try {
      localStorage.setItem(PERSONA_KEY, id);
    } catch {
      /* ignore */
    }
  }

  // keep the conversation scrolled to the newest turn
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [thread, busy]);

  // stop any audio when the sheet closes / unmounts
  useEffect(() => {
    if (!open && audioRef.current) {
      audioRef.current.pause();
      setPlaying(null);
    }
  }, [open]);
  useEffect(() => () => audioRef.current?.pause(), []);

  async function ask(qRaw: string) {
    const q = qRaw.trim();
    if (q.length < 2 || busy) return;
    setInput("");
    setThread((t) => [...t, { role: "user", text: q }]);
    setBusy(true);
    try {
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
        body: JSON.stringify({ question: q, topic, profile: profileHints, personaId }),
      });
      const data = (await res.json()) as { answer?: string; simKey?: string | null };
      if (!res.ok || !data.answer) throw new Error("no answer");
      setThread((t) => [
        ...t,
        { role: "persona", text: data.answer!, personaId, simKey: data.simKey ?? null },
      ]);
    } catch {
      setThread((t) => [
        ...t,
        {
          role: "persona",
          text: "Kechirasiz, hozir javob bera olmadim. Birozdan keyin yana urinib koʻring.",
          personaId,
          error: true,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function speak(text: string, pid: PersonaId, idx: number) {
    const voiceId = VOICE_ID_BY_PERSONA[pid];
    if (!voiceId) return;
    try {
      audioRef.current?.pause();
      setPlaying(idx);
      const res = await fetch("/api/voice/prerender", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 800), voiceId }),
      });
      if (!res.ok) {
        setPlaying(null);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setPlaying(null);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setPlaying(null);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch {
      setPlaying(null);
    }
  }

  const persona = PERSONAS[personaId];
  const starterChips = starters && starters.length > 0 ? starters : persona.startersUz;

  return (
    <>
      {/* floating launcher — above the bottom nav */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Mentordan soʻrash"
          className="fixed bottom-[88px] right-4 z-30 inline-flex items-center gap-2 rounded-full border border-void-500 bg-void-900 py-2.5 pl-3 pr-4 text-[13px] font-semibold text-void-100 shadow-[0_8px_30px_-8px_rgba(20,18,14,0.35)] transition hover:-translate-y-0.5 active:scale-95"
          style={{ boxShadow: `0 10px 30px -10px ${persona.accentColor}66` }}
        >
          <span className="grid h-7 w-7 place-items-center rounded-full text-[15px]" style={{ backgroundColor: `${persona.accentColor}1f` }}>
            {persona.emoji}
          </span>
          Soʻrang
        </button>
      )}

      {/* the ask sheet */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Yopish"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-void-100/35 backdrop-blur-[2px]"
          />
          <div className="rise-in relative z-10 flex max-h-[82vh] w-full max-w-[560px] flex-col rounded-t-[24px] border border-void-500 bg-void-950 shadow-[0_-12px_48px_-12px_rgba(20,18,14,0.25)] sm:rounded-[24px]">
            {/* header */}
            <div className="flex items-center justify-between gap-3 border-b border-void-500 px-5 pb-3 pt-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <MessageCircleQuestion className="h-4 w-4" style={{ color: accent }} />
                  <span className="text-[14px] font-semibold text-void-100">Mentordan soʻrang</span>
                </div>
                <p className="mt-0.5 truncate text-[11.5px] text-void-300">{topic}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Yopish"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-void-300 transition hover:bg-void-700 hover:text-void-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* persona picker */}
            <div className="flex gap-1.5 overflow-x-auto px-5 py-2.5 scrollbar-none">
              {PERSONA_ORDER.map((id) => {
                const p = PERSONAS[id];
                const active = id === personaId;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => pickPersona(id)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition ${
                      active ? "text-void-100" : "border-void-500 text-void-300 hover:text-void-100"
                    }`}
                    style={active ? { borderColor: p.accentColor, backgroundColor: `${p.accentColor}1a` } : undefined}
                  >
                    <span className="text-[14px]">{p.emoji}</span>
                    {shortLabel(id)}
                  </button>
                );
              })}
            </div>

            {/* conversation / starters */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-3">
              {thread.length === 0 && (
                <div className="space-y-2.5">
                  <p className="text-[12.5px] leading-relaxed text-void-300">{persona.greetingUz}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {starterChips.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => ask(s)}
                        className="rounded-full border border-void-500 bg-void-800 px-3 py-1.5 text-left text-[12px] text-void-200 transition hover:border-void-400 hover:text-void-100 active:scale-95"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {thread.map((turn, i) =>
                turn.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[82%] rounded-[16px] rounded-br-md bg-antares-50 px-3.5 py-2 text-[13.5px] leading-snug text-void-100">
                      {turn.text}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex items-start gap-2">
                    <span
                      className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[14px]"
                      style={{ backgroundColor: `${PERSONAS[turn.personaId ?? "scorpius"].accentColor}1f` }}
                    >
                      {PERSONAS[turn.personaId ?? "scorpius"].emoji}
                    </span>
                    <div className="min-w-0">
                      <div
                        className={`rounded-[16px] rounded-tl-md px-3.5 py-2 text-[13.5px] leading-snug ${
                          turn.error ? "bg-[#fae3e0] text-[#9b2f26]" : "bg-void-800 text-void-100"
                        }`}
                      >
                        {turn.text}
                      </div>
                      {!turn.error && VOICE_ID_BY_PERSONA[turn.personaId ?? "scorpius"] && (
                        <button
                          type="button"
                          onClick={() => speak(turn.text, turn.personaId ?? "scorpius", i)}
                          className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-void-300 transition hover:text-void-100"
                        >
                          {playing === i ? <Loader2 className="h-3 w-3 animate-spin" /> : <Volume2 className="h-3 w-3" />}
                          Eshitish
                        </button>
                      )}
                      {!turn.error && turn.simKey && <InlineSim simKey={turn.simKey} />}
                    </div>
                  </div>
                )
              )}

              {busy && (
                <div className="flex items-center gap-2 text-[12px] text-void-300">
                  <span
                    className="grid h-7 w-7 place-items-center rounded-full text-[14px]"
                    style={{ backgroundColor: `${persona.accentColor}1f` }}
                  >
                    {persona.emoji}
                  </span>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> oʻylamoqda…
                </div>
              )}
            </div>

            {/* composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
              className="flex items-center gap-2 border-t border-void-500 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`${shortLabel(personaId)}dan soʻrang…`}
                className="min-w-0 flex-1 rounded-full border border-void-500 bg-void-800 px-4 py-2.5 text-[14px] text-void-100 outline-none transition focus:border-void-400"
                aria-label="Savolingiz"
              />
              <button
                type="submit"
                disabled={busy || input.trim().length < 2}
                aria-label="Yuborish"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-void-100 transition active:scale-90 disabled:opacity-40"
                style={{ backgroundColor: accent }}
              >
                <Send className="h-[18px] w-[18px]" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

/** Renders the animation the mentor chose, inline under its answer. The key is
 *  validated server-side against SIM_CATALOG, so SIM_REGISTRY[key] always exists;
 *  we still guard for safety. */
function InlineSim({ simKey }: { simKey: string }) {
  const Sim = SIM_REGISTRY[simKey];
  if (!Sim) return null;
  const meta = SIM_CATALOG_BY_KEY[simKey];
  return (
    <div className="mt-2 max-w-[420px] rounded-[14px] border border-void-600 bg-void-900 p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 px-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-void-300">
        <Sparkles className="h-3 w-3 text-antares-500" />
        {meta?.titleUz ?? "Animatsiya"}
      </div>
      <Sim />
    </div>
  );
}
