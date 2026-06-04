"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { PersonaId } from "@/lib/personas";

const VOICE_ID_BY_PERSONA: Record<PersonaId, string | undefined> = {
  newton: process.env.NEXT_PUBLIC_ELEVENLABS_NEWTON_VOICE_ID,
  xorazmiy: process.env.NEXT_PUBLIC_ELEVENLABS_XORAZMIY_VOICE_ID,
  einstein: process.env.NEXT_PUBLIC_ELEVENLABS_EINSTEIN_VOICE_ID,
  scorpius: undefined,
  elon: undefined,
};

const PORTRAIT_BY_PERSONA: Record<PersonaId, string> = {
  scorpius: "/personas/scorpius.png",
  newton: "/personas/newton.png",
  xorazmiy: "/personas/xorazmiy.png",
  einstein: "/personas/einstein.png",
  elon: "/personas/elon.png",
};

export function MentorOverlay({ personaId, voiceText }: { personaId: PersonaId; voiceText?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const voiceId = VOICE_ID_BY_PERSONA[personaId];

  useEffect(() => {
    function unlock() {
      setUnlocked(true);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("click", unlock);
    }
    window.addEventListener("touchstart", unlock, { once: true });
    window.addEventListener("click", unlock, { once: true });
    return () => {
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("click", unlock);
    };
  }, []);

  useEffect(() => {
    if (!voiceText || !voiceId || !unlocked) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/voice/prerender", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: voiceText, voiceId }),
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onplaying = () => setSpeaking(true);
        audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
        audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); };
        await audio.play();
      } catch { /* autoplay blocked or network error — silent, non-fatal */ }
    })();
    return () => {
      cancelled = true;
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [voiceText, voiceId, unlocked]);

  function replay() { audioRef.current?.play().catch(() => {}); }

  return (
    <button
      type="button"
      onClick={replay}
      className={`fixed right-3 top-3 z-30 h-14 w-14 overflow-hidden rounded-full border-2 bg-void-900 shadow-md transition-transform ${
        speaking ? "border-amber-400 scale-105 shadow-[0_0_24px_rgba(217,168,90,0.5)]" : "border-void-500"
      }`}
      aria-label={`${personaId} mentor — tap to replay`}
    >
      <Image src={PORTRAIT_BY_PERSONA[personaId]} alt={personaId} width={56} height={56} priority />
    </button>
  );
}
