"use client";

/**
 * Tovush kattaliklari — sound parameters.
 *
 * Two sliders: frequency (20–2000 Hz) and amplitude (0–1). They reshape a
 * single horizontal sine wave drawn on an SVG, AND drive a Web Audio API
 * OscillatorNode that actually plays the tone. Hearing the same physical
 * quantity you see — that's the lesson.
 *
 * Visual:
 *   • A long horizontal sine. Frequency scrubs # of cycles. Amplitude scrubs
 *     vertical span.
 *   • A "tightrope walker" metaphor — a tiny figure rides the wave's crest,
 *     bouncing up and down as the wave passes. The eye now has something
 *     concrete to track.
 *   • Frequency/amplitude axes labels and a "balandlik" / "kuchlilik" map.
 *
 * Audio:
 *   • One OscillatorNode + one GainNode. We unlock the AudioContext on the
 *     learner's first user gesture (mute/unmute button). On iOS Safari this
 *     is the only way audio will work.
 *   • Updates happen via param.setTargetAtTime to avoid clicks.
 *
 * Completion: fires once the learner has (a) heard a tone, AND (b) moved
 * frequency by ≥ 200 Hz over its starting value. (You can't learn that
 * frequency = pitch without scrubbing it.)
 */

import { useEffect, useRef, useState } from "react";

interface Props {
  onComplete?: () => void;
}

const VBW = 480;
const VBH = 280;

const WAVE_BASELINE_Y = 140;
const WAVE_AMPLITUDE_MAX = 70;
const WAVE_LEFT = 30;
const WAVE_RIGHT = VBW - 30;
const WAVE_WIDTH = WAVE_RIGHT - WAVE_LEFT;

const F_MIN = 60;
const F_MAX = 2000;

export function SoundSim({ onComplete }: Props) {
  const [freq, setFreq] = useState<number>(220); // A3
  const [amp, setAmp] = useState<number>(0.5);
  const [muted, setMuted] = useState<boolean>(true);
  const startFreqRef = useRef<number>(220);
  const heardOnceRef = useRef<boolean>(false);
  const completedRef = useRef<boolean>(false);

  // Animation phase (so the wave scrolls)
  const phaseRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());
  const [, forceRender] = useState(0);

  // Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  // Animation loop
  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      // Scroll speed scales with frequency — so the wave "looks" like it's
      // moving with the right rhythm. Cap so very high freqs don't blur.
      const visualSpeed = Math.min(2.5, freq / 200);
      phaseRef.current += dt * visualSpeed * Math.PI;
      forceRender((n) => n + 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [freq]);

  // Update audio params smoothly on slider change
  useEffect(() => {
    const ctx = audioCtxRef.current;
    const osc = oscRef.current;
    const gain = gainRef.current;
    if (!ctx || !osc || !gain) return;
    const t = ctx.currentTime;
    osc.frequency.setTargetAtTime(freq, t, 0.02);
    const targetGain = muted ? 0 : amp * 0.18; // cap so it never blasts
    gain.gain.setTargetAtTime(targetGain, t, 0.02);
  }, [freq, amp, muted]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      try { oscRef.current?.stop(); } catch { /* */ }
      try { audioCtxRef.current?.close(); } catch { /* */ }
    };
  }, []);

  // Check completion
  useEffect(() => {
    if (
      !completedRef.current &&
      heardOnceRef.current &&
      Math.abs(freq - startFreqRef.current) >= 200
    ) {
      completedRef.current = true;
      onComplete?.();
    }
  }, [freq, onComplete]);

  function toggleMute() {
    if (!audioCtxRef.current) {
      // Lazy-create on first user gesture. iOS Safari requirement.
      const Ctor: typeof AudioContext = (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      const ctx = new Ctor();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = 0;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      audioCtxRef.current = ctx;
      oscRef.current = osc;
      gainRef.current = gain;
    }
    audioCtxRef.current.resume();
    setMuted((m) => {
      const next = !m;
      if (!next) heardOnceRef.current = true;
      return next;
    });
  }

  // --- Build wave path ------------------------------------------------------
  // We render the wave as a polyline: y = baseline − amp * AMP_MAX * sin(2π f x / WIDTH + phase)
  // The drawn cycles count is purely visual — we scale "cycles per visible
  // window" with log(freq) so the learner can see the change without
  // turning the wave into a black blur at 2000 Hz.
  const cyclesVisible = Math.max(1, Math.log2(freq / 60) * 1.6 + 1);
  const samples = 240;
  const pts: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = WAVE_LEFT + t * WAVE_WIDTH;
    const theta = t * cyclesVisible * 2 * Math.PI + phaseRef.current;
    const y = WAVE_BASELINE_Y - amp * WAVE_AMPLITUDE_MAX * Math.sin(theta);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  const wavePath = `M ${pts.join(" L ")}`;

  // Walker rides one specific cycle position
  const walkerT = 0.5;
  const walkerTheta = walkerT * cyclesVisible * 2 * Math.PI + phaseRef.current;
  const walkerX = WAVE_LEFT + walkerT * WAVE_WIDTH;
  const walkerY = WAVE_BASELINE_Y - amp * WAVE_AMPLITUDE_MAX * Math.sin(walkerTheta);

  // Pitch label — what musical "note" is this roughly?
  const noteLabel = freqToNoteLabel(freq);

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="overflow-hidden rounded-[18px] border border-void-500 bg-void-700/40">
        <svg viewBox={`0 0 ${VBW} ${VBH}`} className="block w-full" role="img" aria-label="Sound wave visualization">
          {/* Amplitude reference ghost lines */}
          <line
            x1={WAVE_LEFT}
            y1={WAVE_BASELINE_Y - WAVE_AMPLITUDE_MAX}
            x2={WAVE_RIGHT}
            y2={WAVE_BASELINE_Y - WAVE_AMPLITUDE_MAX}
            stroke="rgba(132,126,107,0.3)"
            strokeWidth={0.8}
            strokeDasharray="2 4"
          />
          <line
            x1={WAVE_LEFT}
            y1={WAVE_BASELINE_Y + WAVE_AMPLITUDE_MAX}
            x2={WAVE_RIGHT}
            y2={WAVE_BASELINE_Y + WAVE_AMPLITUDE_MAX}
            stroke="rgba(132,126,107,0.3)"
            strokeWidth={0.8}
            strokeDasharray="2 4"
          />
          {/* Baseline */}
          <line
            x1={WAVE_LEFT}
            y1={WAVE_BASELINE_Y}
            x2={WAVE_RIGHT}
            y2={WAVE_BASELINE_Y}
            stroke="rgba(132,126,107,0.5)"
            strokeWidth={1}
          />

          {/* The wave itself */}
          <path
            d={wavePath}
            fill="none"
            stroke="#e8a21a"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Walker — a tiny stick figure riding the crest */}
          <g>
            <line x1={walkerX} y1={walkerY - 14} x2={walkerX} y2={walkerY - 4} stroke="#fbf9f3" strokeWidth={1.5} />
            <circle cx={walkerX} cy={walkerY - 18} r={3} fill="#fbf9f3" />
            {/* arms */}
            <line x1={walkerX - 5} y1={walkerY - 11} x2={walkerX + 5} y2={walkerY - 11} stroke="#fbf9f3" strokeWidth={1.5} />
            {/* legs */}
            <line x1={walkerX} y1={walkerY - 4} x2={walkerX - 3} y2={walkerY} stroke="#fbf9f3" strokeWidth={1.5} />
            <line x1={walkerX} y1={walkerY - 4} x2={walkerX + 3} y2={walkerY} stroke="#fbf9f3" strokeWidth={1.5} />
          </g>

          {/* Frequency / Amplitude callouts */}
          <text x={WAVE_LEFT} y={WAVE_BASELINE_Y - WAVE_AMPLITUDE_MAX - 8} fontSize={9} fontWeight={700} fill="rgba(232,162,26,0.85)" letterSpacing="0.04em">
            AMPLITUDA → KUCHLILIK
          </text>
          <text x={WAVE_RIGHT} y={WAVE_BASELINE_Y + WAVE_AMPLITUDE_MAX + 18} fontSize={9} fontWeight={700} fill="rgba(232,162,26,0.85)" letterSpacing="0.04em" textAnchor="end">
            FREKVENSIYA → BALANDLIK
          </text>

          {/* Live numeric readout — top right */}
          <g transform={`translate(${VBW - 132}, 10)`}>
            <rect
              x={0}
              y={0}
              width={120}
              height={68}
              rx={8}
              fill="rgba(242, 239, 230, 0.85)"
              stroke="rgba(132, 126, 107, 0.45)"
              strokeWidth={1}
            />
            <text x={10} y={16} fontSize={9} fontWeight={700} fill="#1a1813" letterSpacing="0.04em">
              FREKVENSIYA
            </text>
            <text x={10} y={32} fontSize={14} fontWeight={700} fill="#1a1813" fontFamily="ui-monospace, monospace">
              {freq.toFixed(0)} Hz
            </text>
            <text x={10} y={48} fontSize={9} fontWeight={700} fill="#a9760a" letterSpacing="0.04em">
              TAXMINIY NOTA
            </text>
            <text x={10} y={62} fontSize={11} fontWeight={700} fill="#1a1813" fontFamily="ui-monospace, monospace">
              {noteLabel}
            </text>
          </g>
        </svg>
      </div>

      {/* Mute / play */}
      <button
        type="button"
        onClick={toggleMute}
        className={`inline-flex h-[44px] w-full items-center justify-center gap-2 rounded-full px-6 text-[14px] font-semibold transition active:scale-[0.98] ${
          muted
            ? "bg-antares-500 text-void-100 hover:bg-antares-300"
            : "border border-void-500 bg-void-700 text-void-100 hover:bg-void-600"
        }`}
      >
        {muted ? (
          <>
            <span aria-hidden>▶</span>
            <span>Tovushni eshitish</span>
          </>
        ) : (
          <>
            <span aria-hidden>■</span>
            <span>Ovozni o&apos;chirish</span>
          </>
        )}
      </button>

      {/* Frequency slider */}
      <div className="rounded-[14px] border border-void-500 bg-void-700/60 p-3">
        <div className="flex items-baseline justify-between">
          <label htmlFor="snd-freq" className="text-[12px] font-semibold text-void-200">
            Frekvensiya (balandlik)
          </label>
          <span className="font-mono text-[12px] text-void-300">
            {freq.toFixed(0)} Hz
          </span>
        </div>
        <input
          id="snd-freq"
          type="range"
          min={F_MIN}
          max={F_MAX}
          step={1}
          value={freq}
          onChange={(e) => setFreq(Number(e.target.value))}
          className="mt-2 w-full accent-antares-500"
        />
        <div className="mt-1 flex justify-between text-[10px] text-void-300">
          <span>Bas (60 Hz)</span>
          <span>Nay (1000 Hz)</span>
          <span>Hushtak (2000 Hz)</span>
        </div>
      </div>

      {/* Amplitude slider */}
      <div className="rounded-[14px] border border-void-500 bg-void-700/60 p-3">
        <div className="flex items-baseline justify-between">
          <label htmlFor="snd-amp" className="text-[12px] font-semibold text-void-200">
            Amplituda (kuchlilik)
          </label>
          <span className="font-mono text-[12px] text-void-300">
            {(amp * 100).toFixed(0)}%
          </span>
        </div>
        <input
          id="snd-amp"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={amp}
          onChange={(e) => setAmp(Number(e.target.value))}
          className="mt-2 w-full accent-antares-500"
        />
        <div className="mt-1 flex justify-between text-[10px] text-void-300">
          <span>Sokin</span>
          <span>O&apos;rtacha</span>
          <span>Baland</span>
        </div>
      </div>

      <p className="text-[12px] leading-relaxed text-void-300">
        <span className="text-void-200">Frekvensiyani</span> oshiring — tovush balandroq bo&apos;ladi
        (nay kabi). <span className="text-void-200">Amplitudani</span> oshiring — kuchliroq
        bo&apos;ladi (sokin shivirdan baland qichqirgacha). Tovushni yoqib, ikkalasini ham
        siljitib ko&apos;ring. Bir to&apos;lqin — ikkita kattalik.
      </p>
    </div>
  );
}

function freqToNoteLabel(f: number): string {
  // A4 = 440 Hz. Note number n = 12 * log2(f / 440) + 69
  if (f <= 0) return "—";
  const n = Math.round(12 * Math.log2(f / 440) + 69);
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const name = names[((n % 12) + 12) % 12];
  const octave = Math.floor(n / 12) - 1;
  return `${name}${octave}`;
}
