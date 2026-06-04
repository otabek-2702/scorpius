const ELEVEN_BASE = "https://api.elevenlabs.io/v1";
const PRERENDER_MODEL = "eleven_v3";
export const STREAM_MODEL = "eleven_flash_v2_5";

/** Lossy Uzbek-Latin → Turkish-phoneme normalizer for ElevenLabs Turkish voices. */
export function normalizeUzToTurkishPhonemes(uz: string): string {
  return uz
    .replace(/oʻ/g, "o").replace(/oʼ/g, "o").replace(/o'/g, "o")
    .replace(/gʻ/g, "g").replace(/gʼ/g, "g").replace(/g'/g, "g")
    .replace(/q/g, "k").replace(/Q/g, "K")
    .replace(/x/g, "h").replace(/X/g, "H");
}

export interface SynthesizeOpts {
  text: string;
  voiceId: string;
  model?: string;
}

export async function synthesizePrerender(opts: SynthesizeOpts): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY missing");

  const res = await fetch(`${ELEVEN_BASE}/text-to-speech/${opts.voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text: normalizeUzToTurkishPhonemes(opts.text),
      model_id: opts.model ?? PRERENDER_MODEL,
      voice_settings: { stability: 0.55, similarity_boost: 0.7, style: 0.3 },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}
