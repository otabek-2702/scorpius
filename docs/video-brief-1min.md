# Scorpius — 60-Second Intro Video · Shoot + Edit Brief

> **For:** Zaynobiddin (CTO, Da Vinci Resolve) · **From:** Murodjon
>
> **Audience:** GDG judges + parents/students who land on scorpius.uz after the pitch.
>
> **Goal of this 60 seconds:** make a viewer who has never heard of Scorpius understand,
> in one breath, that emaktab can become a personal AI tutor. Not pitch the company, not
> list features — **make them want to scan the QR**.
>
> **Hard constraints:**
> - Total length: **55–65 seconds** (≤ 60 if possible — TikTok / Instagram Reels cap)
> - Vertical 9:16 export (1080×1920) for Telegram + IG/TikTok · also 16:9 1080p for projector loop
> - No voice-over (we don't have studio time); rely on **typography + motion + music**
> - On-brand: cream `#fbf9f3` ground · ink `#1a1813` text · gold `#e8a21a` accent
> - Fonts in titles: **Newsreader** (serif, italic for emphasis) + **Inter Tight** (sans)
> - Zero emoji, zero stock footage, zero generic AI motion graphics

---

## 1. Beat sheet — second-by-second

| Sec | Beat | What's on screen | Camera move | Title card / cap |
|---:|---|---|---|---|
| **00–04** | **Hook frame** — the silent problem | Black-on-cream title only, perfectly still | None (1 hold) | `emaktab tells you the grade.` *(serif, italic, ~80pt, fade-in 600ms)* |
| **04–08** | The follow-up that lands | Same frame, new line drops in below | None | `It doesn't tell you why.` *(same style, line slides up from below + holds)* |
| **08–12** | Real screen — the problem made concrete | Mockup of an emaktab grade row "2" + parent staring at phone, blurred | **Slow push-in** on the "2" mark (1.05× → 1.15× over 4s) | small mono cap top-left: `2.4M STUDENTS · 0 PERSONAL HELP` |
| **12–18** | The solution arrives | Cut to scorpius.uz landing — the Scorpius* constellation + headline | **Pull-back** from the gold Antares heart (1.4× → 1.0× over 6s) | none — let the brand speak |
| **18–24** | Personalization "wow" | Cut to /personalizing screen — circular ring filling, "Qiziqishlaringizni o'rganyapman" message swap | **Static** — let the message swap do the motion. **Speed-ramp** the ring to 1.5× | mono cap: `personalising for sevimli fan` |
| **24–32** | Constellation reveal | Cut to /learn — Brilliant tiles + HOZIRGI badge + unit pill | **Slow zoom on HOZIRGI star** (0.95× → 1.2× over 8s with subtle parallax of dormant stars) | serif italic cap: `*Bo'luvchilar va karralilar* — bugun 8 daqiqada` |
| **32–42** | The lesson — the actual product | Tap the HOZIRGI star → bottom sheet rises → tap **Boshlash** → first lesson card fills screen | **Match-cut** from sheet rising into card filling, no transition | none — UI motion is the show |
| **42–50** | The wow lesson | Cut to Brachistochrone card — straight vs cycloid race, ball drops, cycloid wins | **Push in** on the gold cycloid path as the ball reaches the end (1.0× → 1.3×) | serif italic cap: `bu — Nyuton bir kechada hal qilgan.` |
| **50–56** | Parent brief | Cut to /parent — daily Uzbek brief card | **Slow vertical pan** down the card (top → bottom over 6s) | mono cap: `ota-onaga — har kuni o'zbekcha xulosa` |
| **56–60** | CTA + QR | Cut to slide-9-style frame: big QR + `scorpius.uz/gdg` + `umrbod 50%` headline | **Hold dead still** — the QR must be scannable for the full 4 seconds | serif title: `Birinchi 100 ga · *umrbod 50%* off.` |

---

## 2. What to record · phone-camera shot list

Capture these clips ahead of editing. **Use the iPhone screen recording (Control Center) at 60fps.** Each clip can be 2–4 seconds longer than its final spot in the edit — gives room for trim.

### Clip A — emaktab "2" grade (8s raw)
Open emaktab on phone or browser. Scroll to a row showing a 2 or 3 in red. Hold camera steady on the row for 6 seconds. **Tip:** if you don't have a real "2", mock it in Figma in 2 min using the emaktab table style — judges won't inspect the pixels.

### Clip B — Scorpius landing (8s raw)
Open `https://scorpius.uz` in mobile Safari. Wait for the rise-in animation to settle. Capture from the constellation through "*yulduz.*" — let the gold antares heart breathe in frame.

### Clip C — Personalizing screen (10s raw)
From `https://scorpius.uz/onboarding` → flash through 8 steps with placeholder answers (any name, grade 6, any subject, "Yangi narsa o'rganish") → land on `/personalizing`. Record from the moment the ring starts filling, through 2–3 message swaps.

### Clip D — Constellation + tap (12s raw)
On `/learn`, scroll into view, hold for 3 seconds, then tap HOZIRGI star (Sonning bo'luvchilari) — let the bottom sheet rise — tap **Boshlash** — first card fills. **Don't rush.**

### Clip E — Brachistochrone (10s raw)
`scorpius.uz/learn/lesson?topic=brachistochrone` → tap "Tap the fastest path" → tap cycloid → let the race play to the end. Capture the cycloid winning.

### Clip F — Parent brief (10s raw)
`scorpius.uz/parent` — let the Vasliddin dashboard render fully, then slow-scroll down once.

### Clip G — QR code (4s raw)
Static. Open `docs/pitch/Scorpius-Pitch.pdf` to slide 9 OR screenshot the QR PNG at `public/qr-gdg.png`. Compose so the QR fills ~60% of frame, with the "Umrbod 50% off" headline beside it.

---

## 3. Color + motion direction (for Da Vinci Resolve)

### Look
- **Slight warm grade** — push the temperature +200 K so the cream looks like late-afternoon paper, not generic white. Keep ink at #1a1813, don't crush blacks
- **No film grain, no light leaks, no lens flares** — those are AI-slop signals. The product itself is the visual

### Cuts
- **Hard cuts** between scenes (no cross-fade). Pace must feel intentional, not soft
- **Match-cuts** at 32s (sheet → card) and 42s (card → sim) — these are the "wow" beats and a clean cut sells the magic
- The only exception: a **white flash cross-fade (4 frames)** at the 50s mark from Brachistochrone to Parent brief, signaling the "and there's more" beat

### Zooms (the Brilliant move)
- Use **smooth keyframe scaling** in Resolve (not the basic "Transform" — the **Stabilizer-driven push** for buttery results)
- All zooms ease-in-out (cubic-bezier 0.4, 0, 0.2, 1) — never linear
- Max scale: **1.3×** (never go past — feels amateur). Min: 0.9×

### Motion blur
- Add subtle **motion blur (4-frame shutter)** to all scale animations. Without it, zooms look choppy at 60fps source / 30fps export

---

## 4. Typography on screen

### Title cards (the held lines at 00–08s)
- Font: **Newsreader 500 italic** for `emaktab tells you the grade.` and `It doesn't tell you why.`
- Size: ~80pt on 1920px canvas (= 4.2% of height)
- Color: `#1a1813` on `#fbf9f3` cream
- **Letter-spacing -2% (tight Apple-mode tracking)**
- Drop-shadow: **none**. Stay flat.
- Animation: each line **fades in over 600ms** (opacity 0→1, no slide). Then **holds dead still for 3s**.

### Inline captions (mono small caps at 12s, 24s, 50s)
- Font: **JetBrains Mono 600**
- Size: ~26pt
- Letter-spacing +16%, UPPERCASE
- Color: `#6b675f` (soft grey)
- Position: top-left, ~80px from edge
- Animation: appear 200ms after cut, fade-in 300ms, hold for the full beat, fade-out 200ms before next cut

### Serif italic emphasis (24s "*Bo'luvchilar...*", 42s "*Nyuton...*")
- Newsreader 500 italic, gold `#c98910` for the italicized word, ink for the rest
- Same fade-in pattern as title cards

### QR frame (56–60s)
- Heading "Birinchi 100 ga · *umrbod 50%* off." — Newsreader 500 + italic gold on "umrbod 50%"
- URL "scorpius.uz/gdg" — JetBrains Mono 600, gold `#c98910`, ~24pt
- QR PNG at 320×320, centered with 24px white padding around it
- Dead still — **no animation** on the QR or text. Scannability > drama.

---

## 5. Music — what to pick

The single most important non-visual choice. **Don't pick generic uplifting EDM** — that signals startup-explainer-from-2019.

### Direction: "warm minimalist piano with a quiet pulse"

**Reference tracks** (give one of these to your audio person, or buy from a stock library):
- **Nils Frahm** — *"Says"* (slow build, piano + synth pulse — pitch shorter version)
- **Ólafur Arnalds** — *"Near Light"* (piano + string swell, very Apple Ad)
- **Hauschka** — anything from *"Abandoned City"*
- Or modern stock: **Epidemic Sound** → genre "Modern Classical" → sort by tempo 70–90 BPM, mood "Hopeful, Reflective"
- Avoid: corporate motivational rock, generic LoFi beats, EDM drops

### Music structure
- **00–08s** — silent or near-silent. Just title cards land. **Music starts at 08s** with the cut to the emaktab "2".
- **08–32s** — single piano motif, quiet, building. No drums.
- **32s** — **drum/pulse enters** when the sheet rises (match-cut moment). Adds energy
- **42s** — full instrumentation when Brachistochrone wins the race
- **56–60s** — strip back to piano only as the QR holds. Let it land in silence almost.

### Audio mix
- Keep music at **-18 dB LUFS** so it doesn't fight any future voice-over add
- Add a soft **30 Hz sub-bass thump** on the 32s match-cut (subliminal "this is the wow") — Da Vinci has a built-in EQ that handles this
- No SFX on UI taps. The product motion is the SFX.

---

## 6. Export settings

| Use case | Resolution | Aspect | Codec | Bitrate |
|---|---|---|---|---|
| Telegram + IG/TikTok | 1080×1920 | 9:16 | H.264 | 12 Mbps |
| Booth projector loop | 1920×1080 | 16:9 | H.264 | 20 Mbps |
| Embed on scorpius.uz/intro | 1280×720 | 16:9 | H.264 | 8 Mbps (smaller for web) |

**For the projector loop**: also export a version with the **last 2 seconds (QR hold) extended to 8 seconds**, so when it loops, judges who glance over have a full 8-second window to scan.

---

## 7. End-frame variants — pick one

After the QR hold, last frame (the freeze):

**Option A — minimal (recommended):**
```
[centered]   Scorpius
[centered]   *
[centered]   scorpius.uz/gdg
```

**Option B — credit line:**
```
[centered]   Scorpius
[bottom mono]   GDG Build with AI · Tashkent · 2026
```

I recommend Option A — leaves no doubt the call-to-action is the URL.

---

## 8. Delivery checklist for Zayn

Before sending the final cut back:

- [ ] Total length 55–65s
- [ ] All 7 clips (A–G) captured at 60fps source
- [ ] Zero stock footage, zero emoji on screen
- [ ] Cream background never drifts grey or warm-yellow
- [ ] Gold accent (`#c98910` italic on emphasis) appears at least 3 times in the cut
- [ ] Music starts at 08s, not 00s
- [ ] Match-cuts at 32s and 42s are clean (no frame gap)
- [ ] QR holds dead still for ≥ 4 seconds (test by pulling out a phone and scanning the export — it MUST scan)
- [ ] Export at all three resolutions (9:16, 16:9 1080p, 16:9 720p web)
- [ ] No watermark, no copyright music, no AI-generated frames

When done, drop the files in a shared folder + DM Murodjon with the durations + scan-test result.

---

## 9. If you want a single-take version (no editing required)

**45-second walk-through, one continuous screen recording, no cuts:**

1. Open `scorpius.uz` on phone screen
2. Wait 4s on the landing for the constellation to settle
3. Tap **Boshlash** → swipe through onboarding fast (use the "next" buttons rapidly with placeholder answers)
4. Hold on `/personalizing` for the full 7-second cycle (this is the wow)
5. Land on `/learn`, hold 3s on the HOZIRGI badge
6. Tap the gold star → sheet rises → tap **Boshlash**
7. Swipe through 2 cards
8. Open another tab → `scorpius.uz/learn/lesson?topic=brachistochrone`
9. Tap the cycloid path → watch it win
10. Hold the QR slide (slide 9 of `docs/pitch/index.html` works) for 4s

Add music in Resolve later (just the audio track over the screen recording). 30 min total work.

---

**Questions or want me to mock specific frames in HTML/CSS as references? DM Murodjon.**
