# UX Design — Scorpius

> The design source of truth. Visual identity, the two highest-stakes surfaces
> (Onboarding and Learn mode), the mobile↔desktop strategy, and component specs with states.
> Companions: `PROJECT-PLAN.md` (product) · `ARCHITECTURE.md` (quiz DSL, data flow) · `CLAUDE.md` (constraints).
>
> Tech: Next.js 16 (App Router) · Tailwind v4 (`@theme`) · Framer Motion (`motion`).
> v1.1 · 2026-05-22 · Eve of the hackathon. (v1.1: §2/§2.5 onboarding rewritten toward
> expert minimalism — see the revision note at the top of §2.)

---

## 0. Design thesis — "connect the stars"

Scorpius is a constellation. The interface is not *decorated* with stars — it **is** a night
sky, and the metaphor is load-bearing at every layer:

- **A skill is a star.** Dim when unlearned, igniting when mastered.
- **A lesson is a short walk between stars.** You swipe from one to the next.
- **Mastery is light.** When `P(mastered)` crosses threshold, a star *ignites* — a real,
  earned, physical-feeling moment. This is the dopamine core of the product.
- **The student builds their own constellation.** Over weeks, their sky fills in. That sky
  is the home screen, the progress system, and the emotional hook in one object.
- **Antares is the heart.** The brand's warm red-orange supergiant — the single accent that
  signals "you, your progress, your tutor." Used sparingly, so it always means something.

This gives us a way to be premium and crafted without a single generic SaaS gradient. The
night sky is deep, quiet, and confident. The light is warm and earned. That contrast —
**cool dark canvas, warm earned light** — is the whole aesthetic in one sentence.

**What we are NOT building:** purple→pink gradients, glassmorphism cards floating on noise,
3-column feature grids, stock 3D blobs, a chatbot bubble, confetti cannons. A child can smell
a cheap app. The bar is Duolingo's craft with Linear's restraint and Arc's sense of motion.

---

## 1. Visual identity

### 1.1 Color system — semantic tokens

Dark-first. The night sky is the native environment; mastery reads as light against it.
A light theme exists only for the **Parent** surface (reassurance, daytime, document-like).

Tokens are defined in `app/globals.css` under Tailwind v4 `@theme`. Never use raw Tailwind
palette classes (`bg-slate-800`) in product code — use the semantic token.

#### Core ramp — "Void" (the night sky neutral)

A blue-black ramp, not a true-grey ramp. Cool, slightly desaturated indigo so the warm accent
sings against it. 10 steps.

| Token | Hex | Use |
|---|---|---|
| `void-950` | `#070912` | App background, deepest. The sky behind everything. |
| `void-900` | `#0B0E1A` | Default surface background |
| `void-850` | `#11142440` | (with alpha) overlay scrim base |
| `void-800` | `#151A2E` | Raised surface — cards, sheets |
| `void-700` | `#1E2540` | Card on card, input fields |
| `void-600` | `#2C3658` | Border — strong / interactive |
| `void-500` | `#3D496F` | Border — default |
| `void-400` | `#5A6788` | Border — subtle, dividers |
| `void-300` | `#8B97B8` | Text — tertiary, captions, metadata |
| `void-200` | `#B6BFD6` | Text — secondary, body on dark |
| `void-100` | `#E8ECF6` | Text — primary on dark, headings |
| `void-0`   | `#FFFFFF` | Pure white — rare, max-emphasis numerals only |

#### Antares — the brand accent (warm, earned)

The star at the heart of Scorpius. A red-orange supergiant. This is the *only* warm color in
the system and it is rationed: it marks the student, their progress, the primary action, and
the ignite moment. If everything is Antares, nothing is.

| Token | Hex | Use |
|---|---|---|
| `antares-50`  | `#FFF1EC` | Tint backgrounds (light theme only) |
| `antares-300` | `#FFB59A` | Hover lightening, glow inner |
| `antares-500` | `#FF6B3D` | **Primary action, brand mark, active star core** |
| `antares-600` | `#E8521F` | Pressed / active state |
| `antares-700` | `#BC3D12` | Text on light-warm backgrounds (contrast) |

#### Starlight — the "learned" / success spectrum

A skill ignites from cold to warm. We need a *temperature* scale, not a binary on/off. A star
moves through this scale as `P(mastered)` rises.

| Token | Hex | `P(mastered)` band | Meaning |
|---|---|---|---|
| `star-dormant` | `#3D496F` | 0.00–0.20 | Unlit — same as `void-500`. Just a point. |
| `star-ember`   | `#6B5A8E` | 0.20–0.40 | Faint warmth. The student has seen this. |
| `star-warm`    | `#C77BC0` | 0.40–0.65 | Glowing — practicing, not yet solid |
| `star-bright`  | `#FFC24D` | 0.65–0.85 | Bright gold — nearly mastered |
| `star-ignited` | `#FFE9A8` | 0.85–1.00 | Full ignition — white-gold core, the win state |

> The progression cold-violet → warm-gold mirrors real stellar temperature *inverted for
> emotion* (we want "hotter = better = warmer-looking"). It is intuitive to a child without
> a single word of explanation.

#### Functional state colors

Calm, not alarming. A wrong answer in a tutor is *normal* — never red-alert a child.

| Token | Hex | Use |
|---|---|---|
| `signal-correct`  | `#3DDC97` | Correct answer — a mint green, fresh not neon |
| `signal-rethink`  | `#FFC24D` | Wrong answer = "let's rethink" — **gold, not red.** A wrong answer is an invitation, not a failure. |
| `signal-info`     | `#5B9DFF` | Neutral info, hints, the Socratic tutor's voice |
| `signal-error`    | `#FF5C5C` | Reserved for *system* errors only (network, load fail) — never for a wrong quiz answer |

#### Subject identity

Each subject gets one identity hue so the student feels which world they are in. Used only as
an accent edge / icon tint — never as a full background.

| Subject | Token | Hex |
|---|---|---|
| Mathematics | `subject-math` | `#5B9DFF` (cool blue — logic, structure) |
| History | `subject-history` | `#E0A23D` (warm amber — old, golden, story) |

### 1.2 Typography

Two families. A geometric humanist sans for everything UI and pedagogical; a mono for math
and code-like precision moments.

| Role | Family | Why |
|---|---|---|
| UI + content | **Geist Sans** (already installed) | Modern, neutral, excellent at small sizes, ships with the scaffold — zero new dependency. Cyrillic subset covers Uzbek-Cyrillic; Latin covers Uzbek-Latin. |
| Math / numerals / mono | **Geist Mono** (already installed) | Equations, the `P(mastered)` numeral, the streak count. Tabular figures. |
| Display (optional, M5+) | Geist Sans at heavy weight + tight tracking | We do NOT add a separate display face for the hackathon. A display face is a Phase 1.0 polish item. |

> Uzbek note: the curriculum may render in **Latin or Cyrillic**. Geist supports both. All
> type tokens must be tested with `ў ғ қ ҳ` and long Uzbek compound words — Uzbek runs ~10–15%
> longer than English, so never set text in a fixed-width box without overflow handling.

#### Type scale — 1.25 modular (major third), 16px base

| Token | Size / Line-height | Weight / Tracking | Use |
|---|---|---|---|
| `display` | 44 / 48 (2.75rem / 3rem) | 600, −0.03em | Onboarding hero, the one big moment per screen |
| `title-1` | 32 / 38 | 600, −0.02em | Screen titles, card intro headlines |
| `title-2` | 25 / 31 | 600, −0.015em | Card question text (the thing being asked) |
| `title-3` | 20 / 27 | 550, −0.01em | Section headers, answer option text |
| `body-lg` | 18 / 28 | 400, 0 | Explainer card body — generous, readable, kids |
| `body`    | 16 / 25 | 400, 0 | Default UI text |
| `body-sm` | 14 / 21 | 450, 0 | Secondary text, helper text |
| `caption` | 13 / 17 | 500, +0.01em | Metadata, labels, timestamps |
| `overline`| 11 / 14 | 600, +0.08em UPPERCASE | Eyebrow labels ("LESSON 3 OF 6") |
| `mono-lg` | 20 / 28 | 500, 0, tabular-nums | Equations inside explainers |
| `numeral` | 56 / 56 | 600, −0.02em, tabular-nums | The big `P(mastered)` reveal, streak counts |

**Rules.**
- Body text never below 16px. Card explainer body is 18px — children, on phones, sometimes
  in poor light.
- Line-height never below 1.5 for any multi-line body text.
- Weight 550 is a real value via variable font `font-variation-settings: "wght" 550` — between
  medium and semibold. Used for option text so it has presence without shouting.
- Math always in Geist Mono with `font-feature-settings: "tnum"` so digits align.
- No letter-spacing on body text. Negative tracking only on 20px+ headings.

### 1.3 Spacing — 4px base grid

Every margin, padding, gap snaps to this. Inconsistent spacing is the #1 amateur tell.

| Token | px | Common use |
|---|---|---|
| `space-1` | 4 | Icon-to-label gaps, hairline insets |
| `space-2` | 8 | Tight internal padding, chip padding |
| `space-3` | 12 | Compact gaps |
| `space-4` | 16 | Default gap, default mobile gutter |
| `space-5` | 20 | Card internal padding (mobile) |
| `space-6` | 24 | Section gaps, card internal padding (desktop) |
| `space-8` | 32 | Major section separation |
| `space-10`| 40 | Screen vertical rhythm |
| `space-12`| 48 | Hero spacing |
| `space-16`| 64 | Desktop panel padding, big breathing room |
| `space-20`| 80 | Landing section rhythm |

**Layout constants.**
- Mobile gutter: `space-4` (16px) on screens < 480px, `space-5` (20px) at ≥ 480px.
- Card max content width: **560px** — past this, line length hurts reading.
- Desktop app shell max width: **1280px**, centered, with the two-panel Learn layout inside it.
- Landing page max width: **1120px** content, full-bleed sky background.
- Touch targets: minimum **44×44px**, primary actions **52px** tall on mobile.

### 1.4 Radii, elevation, borders

Prefer **1px tonal borders** over shadows. Shadows are used sparingly and are always *cool*
(the sky has no warm light source except the stars themselves).

| Token | Value | Use |
|---|---|---|
| `radius-sm` | 8px | Chips, small controls, inputs |
| `radius-md` | 14px | Buttons, option rows |
| `radius-lg` | 22px | Cards, sheets |
| `radius-xl` | 32px | The Learn card itself, modals |
| `radius-full` | 999px | Avatars, the star nodes, pills |

Corner radii are consistent within a tier — never mix a 12px button with a 16px button on the
same screen.

| Token | Value |
|---|---|
| `elev-card` | `0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.6)` |
| `elev-sheet`| `0 1px 0 0 rgba(255,255,255,0.05) inset, 0 24px 60px -20px rgba(0,0,0,0.75)` |
| `elev-glow-antares` | `0 0 0 1px rgba(255,107,61,0.35), 0 0 32px -4px rgba(255,107,61,0.45)` |
| `elev-glow-star` | `0 0 24px 0 var(--glow-color)` — `--glow-color` set per star temperature |

The inset top-highlight (1px white at 4–5% opacity) gives every raised surface a faint "lit
from the sky above" edge. This is the single most important detail that makes surfaces feel
crafted rather than flat. Steal it everywhere.

### 1.5 Motion language

Motion communicates causality and reward. Every animation cites a named curve and a duration
band. No `ease`. No motion without a reason.

#### Named curves

```
--ease-out-quart:  cubic-bezier(0.16, 1, 0.30, 1)   /* entrances, reveals — decisive, settles soft */
--ease-out-back:   cubic-bezier(0.34, 1.45, 0.50, 1) /* the ignite pop, rewards — slight overshoot */
--ease-in-out:     cubic-bezier(0.65, 0, 0.35, 1)    /* card-to-card swipe transitions */
--ease-spring:     spring(stiffness 420, damping 38) /* Framer Motion — swipe settle, drag release */
--ease-standard:   cubic-bezier(0.4, 0, 0.2, 1)      /* generic hover / state — the workhorse */
```

#### Duration bands

| Band | Range | Use |
|---|---|---|
| Micro | 80–140ms | Hover, press, focus ring, toggle, chip select |
| Transition | 220–360ms | Card swipe, sheet open, screen change |
| Theatrical | 450–800ms | Star ignite, `P(mastered)` count-up, onboarding payoff |
| Ambient | 4–12s loop | Background star twinkle, parallax drift — never blocking |

#### Signature motions (the ones that must be perfect)

1. **Card swipe between cards** — vertical drag, follows the finger 1:1. On release past 22%
   of viewport height or velocity > 500px/s, settle to next card with `--ease-spring`. The
   outgoing card scales to 0.94 and drops opacity to 0; the incoming card scales 0.96 → 1.
   Total settle ~320ms. Below threshold: rubber-band back, ~260ms.
2. **Star ignite** — when `P(mastered)` crosses 0.85. Three staged beats over ~700ms:
   - 0–120ms: the star core scales 1 → 1.6 with `--ease-out-back`, color jumps to `star-ignited`.
   - 120–400ms: a single radial glow ring expands from the core (8px → 64px), opacity 0.8 → 0.
   - 200–700ms: 5–7 thin light "rays" draw outward and fade; connecting lines to neighbor
     stars draw in with a 40ms stagger.
   Haptic: one crisp tap (`navigator.vibrate(12)`), if supported. One soft chime (optional, off by default).
3. **Answer feedback** — see §4.6. Correct: option fills `signal-correct`, a quick 1.0→1.06→1.0
   scale pulse (180ms, `--ease-out-back`). Rethink: option border goes `signal-rethink`, a
   1-amplitude horizontal shake (2 cycles, 6px, 240ms), then the Socratic hint slides up.
4. **Count-up** — the `P(mastered)` numeral animates from old value to new over 600ms,
   `--ease-out-quart`, with the bar filling in sync. Numbers feel *earned* when they move.

#### `prefers-reduced-motion`

Mandatory. When set:
- Swipe still works but settle is an instant cross-fade (120ms opacity only, no scale/translate).
- Star ignite becomes a 200ms color cross-fade + a static glow — **no rays, no expansion**.
- Background twinkle/parallax fully disabled — the sky is static.
- Count-up is replaced by an instant value set.
- The interaction never *loses* meaning — only the theatricality is removed.

---

## 2. Onboarding & first impression

> **Revision — 2026-05-22.** §2 and §2.5 rewritten toward expert minimalism. Removed the
> landing choreography (140-star staggered fade-in, the 1.4s self-drawing-constellation hero
> animation, cursor parallax) and the decorative per-interest motif backgrounds on the
> interest cards. They read as theatrical — a space-scene screensaver, not a product. The
> landing is now type-led: confident typography on deep calm space, the Scorpius mark rendered
> small, precise, and static, with at most one quiet micro-motion. The star/constellation
> stays as the brand metaphor; the in-product "ignite" reward (§3) is unchanged — the
> theatre belongs *inside* the product, earned, not spent on the front door.
> The bar: Linear / Vercel / Arc restraint. A landing page, not a light show.

Goal: in the first 10 seconds, a 14-year-old reads one confident sentence and understands
*this app is for me*. We do not open with a form, and we do not open with a performance.
We open with a clear idea, set in type, with room to breathe.

The flow: **Landing → Username sign-up → Profile (grade, age) → Interest discovery swipe →
The constellation reveal → first lesson handoff.**

### 2.1 Landing — the first 10 seconds

This is a web app; the landing page is also the marketing page (judges see it). It must land
in one viewport, no scrolling required to "get it." It earns attention with **clarity and
typographic confidence**, not with motion.

**Screen: full-bleed `void-950` space.** Not an animated sky — a deep, still, near-black
field. The only depth treatment is the faint radial *vignette* darkening the edges
(`void-950` → `#04050B`). Stars are present but they are **set, not performed**: roughly 24
stars, drawn once at their rest opacity on first paint, no fade-in, no shimmer, no parallax.
They are texture — like paper grain — not the subject. The subject is the words.

**Layout — editorial, type-led.** A single centered content column, max **600px**, sitting
slightly above optical center (≈42% from top, so the headline carries weight). Vertical
rhythm in `space-8`/`space-10`. On `lg+` it stays centered — no two-column hero, no
constellation occupying half the screen (see §2.4 for the desktop note).

**The Scorpius mark.** Above the headline, the brand mark: the Scorpius constellation drawn
**small and precise** — about **32px tall**, 9 stars and their connecting lines, rendered
static in `void-300` line / `void-200` star, with **Antares** alone in `antares-500`. It sits
like a logo, not a hero illustration. It is finished the moment the page paints — nothing
draws itself. Beside or below it, `overline` in `void-300`: **"SCORPIUS"**.

**The headline.** This is the hero. `display` (44/48, 600, −0.03em), `void-100`:

> **"Har bir mavzu — bitta yulduz."** *(Every topic is a star.)*

One sentence. It does the entire job the old 3-second animation was doing — states the
metaphor — but in type a judge can read at a glance and a child can read once and remember.

**The subhead.** `body-lg` (18/28), `void-200`, max ~46ch so the line length stays tight:

> "Scorpius emaktab baholaringizni shaxsiy darslarga aylantiradi." *(Scorpius turns your
> emaktab grades into personal lessons.)*

One sentence, not two. The second line of the old copy ("we'll light your stars") was
selling the metaphor twice — the headline already owns it. Restraint: say it once.

**The CTA.** One primary button, `antares-500`, `radius-md`, 52px tall, `space-6` top margin:
**"Boshlash"** *(Begin)*. Below it, `body-sm`, `void-300`: "Allaqachon hisobingiz bormi?
**Kirish**" *(Already have an account? Log in)* — the word "Kirish" is `void-100`, underlined
on hover.

**Hierarchy:** (1) the headline, (2) the subhead, (3) the CTA. The mark is a quiet
identifier above all three — it orients, it does not compete.

**Motion — one micro-motion, total.** On first paint the content column performs a single
restrained entrance: the mark, headline, subhead, and CTA fade up together (not staggered as
a sequence) — **opacity 0→1, 8px rise, 360ms `--ease-out-quart`**, beginning ~80ms after
paint. That is the whole landing animation. No sky waking up, no constellation drawing
itself, no cursor parallax, no ambient twinkle on this screen. Antares may carry one
*optional*, very slow ambient breath (glow opacity oscillating ±8% over ~6s) — a faint sign
of life on an otherwise still mark — and it is the first thing cut if it reads as gimmicky.
Everything obeys `prefers-reduced-motion`: with it set, the content is simply present, static.

No nav bar with 6 links. No cookie banner theatrics. No "trusted by" logo wall. No
hero-with-3-feature-columns. The mark, the sentence, the button — and stillness around them.
That restraint *is* the premium signal. (Benchmark: the Linear and Vercel homepage hero —
confident type on a calm field, motion measured in a single subtle fade, never a scene.)

**Copy tone throughout onboarding:** warm, direct, second-person, a peer not a principal.
Short sentences. Uzbek primary. Never "Welcome to the future of education" — a child gags on
that. Say "Keldingizmi? Yaxshi." *(You came? Good.)*

> **Anti-slop check:** no animated space scene, no self-drawing hero, no cursor parallax, no
> particle field. The landing is a typographic statement on calm space. The only gradient
> anywhere is the faint radial *vignette* (`void-950` → `#04050B`) — depth, not decoration.

### 2.2 Sign-up — username, no email

Tapping "Boshlash" does **not** push a new page. The mark, headline, subhead and CTA fade out
together (180ms), and a **sign-up sheet** rises from the bottom (mobile) / fades+scales in
centered (desktop) over 320ms `--ease-out-quart`. The same calm `void-950` space stays behind
it — still, not animated. We never leave the space; we just bring the sheet forward.

**Sheet contents — one field at a time, never a wall of inputs.**

*Step A — username.* `title-2`: "Sening isming nima?" *(What's your name / username?)*
A single large input (`void-700` fill, `radius-md`, 56px tall, `title-3` text, centered).
Live, friendly validation:

- As they type, a row below shows availability: a small dot + `caption`.
  - Empty / typing: dot `void-400`, "3–20 ta belgi" *(3–20 characters)*.
  - Checking: dot pulses `signal-info`, "Tekshirilmoqda…" *(Checking…)*.
  - Taken: dot `signal-rethink`, "Bu nom band. Mana bo'lishi mumkin:" *(Taken. Try:)* — then
    **3 tappable suggestion chips** (`{name}_07`, `{name}.uz`, `star_{name}`). Removing the
    dead-end. Never just "username taken" with no path forward.
  - Available: dot `signal-correct`, a soft check, "Ajoyib nom." *(Great name.)*
- No email field. No "confirm email." A child may not have email — this is deliberate and
  it is a feature: lower friction than any competitor.

*Step B — password / passcode.* `title-2`: "Maxfiy so'z o'ylab top." *(Think of a secret word.)*
One input, a show/hide eye toggle. A strength meter rendered as **3 small stars** that ignite
left-to-right as the passcode strengthens — the constellation metaphor doing real UI work.
Helper `caption`: "Kamida 6 ta belgi." For young kids this could later become a 4-emoji or
PIN passcode (roadmap note, not hackathon scope).

*Step C — grade & age.* `title-2`: "Nechanchi sinfdasan?" *(What grade are you in?)*
A horizontal scroller of grade chips **1–12** (`radius-full`, 52px). Grade 9 pre-highlighted
for the demo. Age is a compact stepper or a second small chip row (10–18). Two taps, done.

Each step transitions with a horizontal slide (next: +24px in from right, 260ms
`--ease-out-quart`; outgoing: −24px, fade). A 3-segment progress bar sits at the sheet's top.
A back chevron is always present. The primary button label updates: "Davom etish" → on the
last step "Tayyor!" *(Done!)*.

**States for every input:** default / focus (2px `antares-500` ring, `radius` matched, 120ms)
/ filled / error (`signal-rethink` border + helper text, never a red flash) / disabled
(`void-700` at 50%, no ring). The primary button is disabled (40% opacity, no pointer) until
the step is valid.

### 2.3 Interest discovery — the TikTok-style swipe (the wow)

This is the emotional hook. After grade selection, the sheet's last action ("Tayyor!") does
**not** dump them into a dashboard. It says:

> `title-2`: "Oxirgi narsa — sen kimsan?" *(One last thing — who are you?)*
> `body`: "Yoqtirgan narsangni tanla. Darslaringni shunga moslayman." *(Pick what you love.
> I'll shape your lessons around it.)*

Then the sheet expands to full screen and the **interest deck** begins.

**Card anatomy — clean and typographic.** A deck of interest cards, swiped like TikTok — but
here a swipe is a *choice*, and the card lets **type and a single accent** carry it. No motif,
no illustration, no per-interest scene behind the word.

Each card fills the viewport (with `space-4` inset, `radius-xl`), a calm `void-800` surface
with the standard 1px `void-500` border and `elev-card` — the same crafted surface as a
lesson card, so the deck feels like the product, not a separate toy. On it, centered:
- A small `overline` label above, in the interest's hue — e.g. "SPORT", "KOSMOS" — the
  category, quiet.
- The interest itself as the hero: a large, bold, single word — `display` size, `void-100` —
  e.g. **"Futbol"**, **"Super-qahramonlar"**, **"Video o'yinlar"**, **"Musiqa"**, **"Kosmos"**,
  **"Anime"**, **"Tabiat"**, **"Texnologiya"**. ~10–12 cards total.
- One accent only: a single small star node in the interest's hue, sitting just above or
  beside the word — the same `<StarNode>` primitive used everywhere else. It is the entire
  decoration. When the card is chosen, *this* is the star that flies to the tray.
- Top: `overline` counter "3 / 12".

The discipline: a child should feel the *word*, not a decorated card. Generous space, one
confident piece of type, one accent. This is the same restraint as the landing — the interest
deck is not where we get theatrical either. (Benchmark: a Stripe or Linear feature card —
type-led, one accent, no illustrated background.)

**The gesture — and this is the craft moment.** Two-axis swipe:
- **Swipe right = "Bu men" (this is me)** — the card flies right with a slight clockwise
  rotation (follows finger, max 12°), and as it leaves, it **collapses into a single bright
  star** that flies to a small constellation tray docked at the top of the screen. The
  student literally *sees their interests becoming stars.*
- **Swipe left = "Unchalik emas" (not really)** — card slides left, dims to `void-700`, gone.
  No star. No penalty, no judgment.
- **Tap up / "Davom" button** for accessibility and desktop — same as right-swipe.
- Drag follows the finger 1:1 with rotation (≤12°). A color hint appears at the screen edge:
  a soft `signal-correct` glow on the right edge as you drag right, a neutral `void-400` dim
  on the left. The decision is legible before release.
- Release threshold: 28% of viewport width OR velocity > 480px/s. Below → spring back.

**The running payoff.** The constellation tray at the top is not a counter — it is a *live
mini-constellation being born*. Each "yes" adds a star; after the 2nd star, a line draws
between them. By card 12 the student has assembled a small, personal, glowing shape. The tray
gently pulses brighter each time a star lands (`--ease-out-back`, 200ms). This is the dopamine
loop established *before they have learned a single thing* — so that when real mastery later
ignites real stars, the language is already fluent.

A "Boshqalar" *(Others)* / skip option appears after 6 cards so nobody is trapped. Minimum 3
"yes" picks to proceed (gently enforced: the button reads "Yana bittasini tanla" *(pick one
more)* until satisfied).

### 2.4 The reveal — your constellation

When the deck ends, the most important 4 seconds of onboarding:

1. The interest tray's small constellation **flies to screen center** and scales up (450ms,
   `--ease-out-quart`).
2. The full sky fades back in around it, and the student's personal constellation sits in the
   middle, glowing.
3. `display` headline fades up: **"Mana — sening osmoning."** *(Here it is — your sky.)*
4. `body-lg`, `void-200`: "Hozircha kichik. Har bir o'rganilgan mavzu unga yangi yulduz
   qo'shadi." *(Small for now. Every topic you master adds a new star.)*
5. Antares ignites at the constellation's heart with the full ignite motion — *the same motion
   they will see every time they master a skill.* We are teaching the reward language.
6. One primary button: **"Birinchi darsni boshlash"** *(Start my first lesson)* →
   hands off to Learn mode.

This screen *is* the home screen from now on — every return to Scorpius lands on the student's
growing constellation. Onboarding doesn't end at a tutorial; it ends by handing the student
the actual core object of the product, already meaningful.

### 2.5 Onboarding motion summary

Onboarding motion is deliberately sparse. The landing has exactly **one** entrance; the
theatre is saved for the in-product ignite (§3) and the constellation reveal (§2.4), where
it is *earned*. No staggered star fields, no self-drawing constellation, no cursor parallax —
those were cut in the 2026-05-22 revision.

| Beat | Duration | Curve |
|---|---|---|
| Landing — content column entrance (mark + headline + subhead + CTA, together) | 360ms, 8px rise | `--ease-out-quart` |
| Landing — Antares ambient breath (optional, glow ±8%) | ~6s loop | `--ease-in-out`, ambient — first thing cut if gimmicky |
| Sign-up sheet rise | 320ms | `--ease-out-quart` |
| Sign-up step slide | 260ms, 24px | `--ease-out-quart` |
| Interest card drag | 1:1 follow | `--ease-spring` on release |
| Interest "yes" → star to tray | 420ms | `--ease-out-back` |
| Reveal — constellation to center | 450ms | `--ease-out-quart` |
| Reveal — Antares ignite | 700ms | `--ease-out-back` (staged, §1.5) |

The single Antares ignite now appears **once** in onboarding — at the §2.4 reveal, where it
teaches the reward language right before the first lesson. It is no longer spent on the
landing. Under `prefers-reduced-motion`: the landing entrance becomes a static present state,
the ambient breath is disabled, and §1.5's reduced-motion ignite rules apply at the reveal.

---

## 3. Learn mode — the card system (the heart)

One lesson = an ordered deck of ~6 typed cards (the DSL in `ARCHITECTURE.md` §6). The student
moves through the deck with a **vertical swipe**, TikTok-style. This section specifies the
card anatomy, the gestures, progress feedback, the answer→feedback moment, the Socratic-hint
interaction, and how mastery ignites a star.

### 3.1 The deck — paradigm

- **Swipe BETWEEN cards: vertical.** Up = next card, down = previous card.
- **Scroll WITHIN a card: vertical too — but only when content overflows.** This is the
  conflict `ARCHITECTURE.md` §6 flags. Resolution below in §3.5. An explainer card with 3
  minutes of math must never be swiped past by accident.
- One card is "active" and fills the safe content area. The next card peeks ~10px at the
  bottom edge (a subtle promise that there is more) — see §3.4.
- Cards are typed; each type has a fixed template (no model free-text into layout).

### 3.2 Card anatomy — shared chrome

Every card, regardless of type, shares an outer frame so the deck feels like one system:

```
┌─────────────────────────────────────┐  ← card: void-800, radius-xl,
│  ▸ progress rail (top, see §3.4)     │     elev-card, 1px void-500 border
│                                      │
│  OVERLINE — subject + skill label    │  ← overline, subject-tinted dot
│                                      │
│  ┌─────────────────────────────┐    │
│  │   CARD-TYPE-SPECIFIC BODY    │    │  ← max content width 560px,
│  │   (see §3.3)                 │    │     centered, space-5/6 padding
│  └─────────────────────────────┘    │
│                                      │
│  [ primary action / swipe hint ]     │  ← footer, see per-type
└─────────────────────────────────────┘
```

- Card padding: `space-5` (20px) mobile, `space-6` (24px) desktop.
- The subject-tinted dot in the overline is the only place subject color appears on the card
  itself — calm, not a colored card.
- A persistent, low-emphasis **"Yordam" (Help)** affordance — a small `signal-info` dot,
  top-right — opens the Socratic tutor at any time, not only on a wrong answer.

### 3.3 Card types

#### `intro` — the lesson opens
- `overline`: "MATEMATIKA · KVADRAT TENGLAMALAR" with `subject-math` dot.
- `title-1`: the lesson title.
- `body-lg` `void-200`: the `hookText` — one or two sentences that connect the lesson to the
  student (their interest, or their recent grade: *"O'tgan hafta bu mavzudan 3 olding. 8 daqiqada
  tuzatamiz."* — *Last week you got a 3 on this. We'll fix it in 8 minutes.*).
- A small meta row: `caption` "≈ {estMinutes} daqiqa · {n} ta karta".
- Footer: a large nudge — an upward chevron that breathes (gentle 6px vertical loop, 2.4s
  ambient) + `body-sm` "Yuqoriga suring" *(Swipe up)*. The intro card is also where we teach
  the gesture, once, with a one-time ghost-hand hint that never repeats.

#### `explainer` — teaching content
- `overline` skill label.
- `title-3` optional sub-heading.
- `body-lg` markdown content — generous 18/28. Supports **bold**, lists, and inline math.
- Math via `latex[]`: rendered block-centered, Geist Mono `mono-lg`, in a `void-700` inset
  panel with `radius-md` so equations read as distinct objects.
- `imageId`: a figure from the curriculum RAG. Shown in a `void-900` framed panel, `radius-lg`,
  with a `caption` source line. Never stretched; letterboxed if needed.
- **This card scrolls internally** when content exceeds the viewport — see §3.5.
- Footer: when the student has scrolled to the end (or content fits), the upward chevron
  brightens from `void-400` to `antares-500` — *now you may continue.* Before that it is dim.

#### `mcq` — multiple choice
- `overline` skill label.
- `title-2`: the question `q`.
- Optional small figure/equation panel.
- **Options**: vertically stacked rows, `void-700` fill, `radius-md`, `space-3` gap, each min
  56px tall, `title-3` weight-550 text, generous tap area. A leading slot holds an index
  letter (A/B/C/D) in a `radius-full` `void-600` chip.
- Single select. On select → see §4.6 feedback choreography.
- `explainEach[]` drives the per-option feedback line; `hint` drives the Socratic interaction.
- Footer: no manual "submit" — selecting an option *is* the answer. Reduces taps; feels fast.

#### `fillBlank` — fill in the blank
- `title-2`: the question `q`, with the blank rendered as an underlined slot inline
  (`void-500` underline, `space-2` min-width, grows with input).
- Tapping the blank focuses an input; mobile keyboard or, for numeric answers, a custom
  compact number pad (math is mostly numeric — a full QWERTY is friction).
- A "Tekshirish" *(Check)* button, `antares-500`, appears once the blank is non-empty.
- `accepted[]` allows multiple correct forms (e.g. `"x=3"`, `"3"`). Whitespace/case tolerant.
- Feedback choreography: §4.6.

#### `freeWrite` — open response (History)
- `title-2` prompt, a `void-700` multi-line textarea (`radius-md`, min 5 lines, auto-grow).
- A live word counter `caption` against `minWords` — turns `signal-correct` when reached.
- `rubric[]` is not shown raw to the student; it feeds the tutor's feedback after submit.
- Submit → the Socratic tutor responds conversationally (not pass/fail) with one strengthening
  question. `freeWrite` is never "wrong" — it is iterated.

#### `checkpoint` — the mastery gate
- The emotional peak of a lesson. `overline`: "SINOV NUQTASI" *(Checkpoint)*.
- Shows the skill(s) being assessed as **star nodes** with their current `P(mastered)`.
- A short 2–3 question burst, then the result animates: the mastery bar fills, and **if a
  skill crosses 0.85, its star ignites** — full §1.5 ignite motion, here at full theatrical
  scale. See §3.7.

### 3.4 Progress feedback — the lesson rail

Top of the card, a slim **progress rail** — not a generic bar. It is the lesson rendered as a
**row of star nodes**, one per card, connected by a thin line — a tiny constellation-in-progress.

- Each node: a 6px dot. Passed cards = `star-bright`. Current = `antares-500`, slightly larger
  (10px) with a soft `elev-glow-antares`. Upcoming = `void-500` dormant.
- The connecting line fills `void-300` → `star-bright` as you progress, drawn left to right.
- Tapping the rail does nothing destructive — it is a status display, not a nav (prevents
  rage-skips). Going back is the down-swipe.
- Below the rail on the `intro` card only: `caption` "1 / 6".

This means progress and the brand metaphor are the *same object*. The student finishing a
lesson watches a small constellation complete — a preview of the bigger sky.

### 3.5 The swipe-vs-scroll resolution

The hard problem from `ARCHITECTURE.md` §6. The rule:

- **A card owns the vertical gesture until its own content is fully scrolled.** If an
  `explainer` card's content overflows, a vertical drag *scrolls the card*. Only when the
  card is scrolled to its bottom edge does a further upward drag *hand the gesture to the
  deck* (advance to the next card). Same logic at the top for going back.
- This is a standard nested-scroll handoff. Implement with a scroll-position check: deck swipe
  arms only when `scrollTop` is at the boundary (with a ~4px tolerance).
- **Visual signal of the handoff:** when the card is fully scrolled and the deck gesture is
  armed, the upward chevron brightens to `antares-500` and the next card's 10px peek at the
  bottom gains a faint glow. The student *sees* that "up" now means "next," not "scroll."
- `mcq` / `fillBlank` cards rarely overflow — for them, the deck gesture is armed immediately,
  but **only after the card is answered** (you cannot swipe past an unanswered question; an
  attempted up-swipe rubber-bands with a `body-sm` nudge "Avval javob ber" — *Answer first*).
- Accessibility / desktop: every swipe has a button equivalent (the footer chevron is a real
  button; Up/Down arrow keys and PageUp/PageDown move the deck).

### 3.6 The answer → feedback moment — see §4.6 for the full state machine.

The headline: a wrong answer is **never** a red failure. It is gold (`signal-rethink`) and it
opens a conversation. The feedback moment is the most-repeated interaction in the product —
it must feel encouraging on the 50th time.

### 3.7 Wrong answer → Socratic hint

When an answer is wrong, Scorpius does **not** reveal the correct option. (This is the
product's core promise — `ARCHITECTURE.md` §2, Socratic Tutor.) Choreography:

1. The chosen option border turns `signal-rethink` (gold), a 2-cycle 6px shake (240ms).
2. The other options dim to 55% (focus narrows to the moment, not to the right answer).
3. From the bottom of the card, a **tutor panel** slides up (`void-700`, `radius-lg`, 280ms
   `--ease-out-quart`) — distinct from the card so the student knows *the tutor is speaking
   now*. It has a small `signal-info` star glyph as the tutor's "avatar" — not a cartoon face.
4. Inside: the `hint` text — phrased as a **question**, never a statement. Not "You forgot to
   factor." Instead: *"Tenglamani nolga tenglashtirsang, qaysi qoidani ishlatasan?"* — *If you
   set the equation to zero, which rule do you use?*
5. The options re-enable. The student tries again. The previously-wrong option keeps a faint
   gold tint so they remember it.
6. **Escalating help, not repeated identical hints.** A second wrong answer → the tutor gives
   a *narrower* question or a worked sub-step (one prerequisite micro-explainer inline). A
   third → it walks the first step *with* them, then re-asks. It never just dumps the answer —
   but it always converges. The student must never feel stuck with no way forward. This
   escalation is the Orchestrator's job; the UI just renders whatever the tutor streams.
7. When they get it right after hints: the correct-answer choreography (§4.6) plays, and the
   tutor panel shows one short, genuine line — *"Mana — o'zing topding."* *(There — you found
   it yourself.)* Credit the student, not the app.

The tutor panel is reusable — the same component renders the `freeWrite` response and the
top-right "Yordam" conversation. One Socratic surface, three entry points.

### 3.8 Mastery → a star ignites

The payoff loop. When the Knowledge Tracer's `P(mastered)` for a skill crosses **0.85** —
typically on a `checkpoint` card, sometimes on a clean `mcq` streak:

1. The lesson rail's relevant node and the mastery bar update with the count-up motion (§1.5).
2. If the threshold is crossed, the full **star ignite** (§1.5) plays — but here it is given
   room: the card content gently recedes (scale 0.98, dim 80%) for ~700ms so the ignite owns
   the screen.
3. A single line, `title-2`: *"Yangi yulduz yondi."* *(A new star is lit.)* — and the skill's
   name beneath it.
4. On the lesson-complete screen (after the last card): the student's **constellation** —
   the same object from onboarding — is shown, and the newly-lit star **flies into place**
   in it, connecting to its neighbors. The lesson's local constellation merges into the
   permanent sky. This is the bridge between a single lesson and long-term progress: every
   lesson visibly grows the thing they were given on day one.

The mastery bar itself: a thin track, `void-700`, with a fill that is a **temperature
gradient** matching §1.1's `star-*` scale — at `P=0.3` the fill is short and `star-ember`
violet; at `P=0.7` it is longer and `star-warm`/`star-bright`; at `P=0.9` it is near-full and
`star-ignited` gold. The bar's *color* tells the student how hot their knowledge is. The
numeral (`numeral` token, tabular) sits to its right and counts up.

### 3.9 Lesson-complete screen

- The lesson's rail, now a complete mini-constellation, animates to center.
- `title-1`: "Dars tugadi." `body-lg`: a one-line honest summary — *"2 ta yangi yulduz, 1 tasi
  hali xira."* *(2 new stars, 1 still dim.)* — honesty over confetti.
- Any not-yet-mastered skill is shown as a still-dim star with `body-sm`: "Bu yulduzni keyinroq
  yoqamiz" *(We'll light this one later)* — sets up the return visit, no shame.
- Two actions: primary `antares-500` "Keyingi dars" *(Next lesson)*; secondary ghost button
  "Osmonimni ko'rish" *(See my sky)* → the full constellation home.
- No streak-guilt, no "you'll lose your progress" dark pattern. The reward is the sky filling.

---

## 4. Component specs & states

Every interactive component, every state. States are: **default, hover, focus-visible,
active/pressed, disabled, loading, error, empty** where applicable.

### 4.1 Button — primary

`antares-500` fill, `void-950` text (contrast 8.9:1 — passes AAA), `radius-md`, `title-3`
weight-600, 52px tall mobile / 44px desktop, `space-5` horizontal padding.

| State | Spec |
|---|---|
| Default | `antares-500`, `elev-card` |
| Hover | lighten to `antares-300` blend (mix 18%), lift `translateY(-1px)`, 120ms `--ease-standard` |
| Focus-visible | 2px `antares-300` ring, 2px offset, `radius` matched. Always visible on keyboard. |
| Active | `antares-600`, `translateY(0) scale(0.985)`, 80ms |
| Disabled | `antares-500` at 38% opacity, no shadow, `cursor: not-allowed`, no hover |
| Loading | label cross-fades to a 3-dot pulse (3 dots, ambient 1.2s stagger); button width locked, not collapsing |

### 4.2 Button — secondary / ghost

Transparent fill, 1px `void-500` border, `void-100` text. Hover: border `void-600`, fill
`void-800`. Focus/active/disabled mirror §4.1 with `void` tokens. Used for non-primary paths
("Log in", "See my sky").

### 4.3 Text input

`void-700` fill, 1px `void-500` border, `radius-md`, 56px tall (onboarding) / 48px (forms),
`body`/`title-3` text, `void-100`, placeholder `void-300`.

| State | Spec |
|---|---|
| Default | as above |
| Hover | border `void-600` |
| Focus | border transparent, 2px `antares-500` ring inset+outset, 120ms |
| Filled | border `void-600` |
| Error | border `signal-rethink`, helper text `signal-rethink` `body-sm` below, **no shake on a form field** (shake is reserved for quiz answers) |
| Success | a `signal-correct` check icon, right-aligned inside the field |
| Disabled | fill `void-800`, text `void-400`, 50% opacity |

### 4.4 Interest card (onboarding deck)

Full-bleed, `radius-xl`, calm `void-800` surface, 1px `void-500` border, `elev-card` — clean
and typographic, no motif background (§2.3). Content is the interest word in `display` over
an interest-hued `overline` label, with one small star node as the only accent. States:
default / dragging (1:1 follow, rotation ≤12°, edge color hint) / released-yes (fly right +
collapse to star) / released-no (slide left + dim) / spring-back (below threshold, 260ms).

### 4.5 Lesson card (shell)

`void-800`, `radius-xl`, 1px `void-500` border, `elev-card`. States: active (full size, in
focus) / peeking (next card, 10px visible, 92% scale, 60% opacity) / entering (96%→100% scale,
opacity 0→1, 320ms `--ease-spring`) / exiting (100%→94%, opacity→0) / loading (skeleton — see
§4.8).

### 4.6 Answer option — the state machine

This is the most-used component in the product. Every state is specified.

| State | Visual |
|---|---|
| Default | `void-700` fill, 1px `void-500` border, index chip `void-600`, text `void-100` weight-550 |
| Hover (desktop) | fill `void-600`, border `void-400`, 100ms |
| Focus-visible | 2px `signal-info` ring, 2px offset |
| Pressed | `scale(0.99)`, 80ms |
| Selected — correct | fill `signal-correct` at 16% over `void-700`, border `signal-correct`, index chip → `signal-correct` solid with a check, **1.0→1.06→1.0 pulse** (180ms `--ease-out-back`); a single `signal-correct` line of `explainEach` text expands below |
| Selected — wrong ("rethink") | border `signal-rethink`, index chip `signal-rethink` outline, **6px 2-cycle shake** (240ms); other options dim to 55%; tutor panel slides up (§3.7) |
| Previously-wrong (retry) | faint `signal-rethink` tint retained, re-enabled, full opacity |
| Disabled (post-answer, non-selected) | 45% opacity, no pointer |
| Correct answer, revealed only after success | the correct option gets the `signal-correct` treatment **only once the student reaches it themselves** — we never auto-reveal it on a wrong attempt |

Timing: select → feedback begins within 1 frame (optimistic UI); the BKT update + any tutor
text streams in after, into the tutor panel, with its own skeleton if latency > 250ms.

### 4.7 Star node

The atomic brand component. A `radius-full` dot. Props: `temperature` (0–1 → maps to the
`star-*` scale), `size` (6/10/16/24px), `igniting` (boolean → plays §1.5).

| State | Visual |
|---|---|
| Dormant | `star-dormant`, no glow |
| Ember/Warm/Bright | color per band, `elev-glow-star` with `--glow-color` set to the band color at low spread |
| Ignited | `star-ignited` core, max glow, 6px white-gold center |
| Igniting (transition) | the staged §1.5 motion |
| Focus-visible (when interactive) | 2px `antares-300` ring |

### 4.8 Loading & skeleton states

- **Cards loading from the model:** a skeleton card — the shell (§4.5) with content replaced
  by `void-700` blocks at the real type's layout rhythm, gently shimmering (a slow `void-600`
  highlight sweep, 1.6s ambient). Because cards *stream* (`ARCHITECTURE.md` §6), the `intro`
  card is interactive while later cards still skeleton-load behind it — the student starts
  immediately; the deck fills in under them.
- **Never a full-screen spinner.** The sky background is always there; loading happens *in*
  the sky.
- **Tutor thinking:** the tutor panel shows 3 pulsing dots in `signal-info`, max ~2s before
  first token; then text streams in word-group by word-group (not character-by-character —
  too slow, feels broken).

### 4.9 Empty & error states

- **Empty constellation (brand-new student):** never literally empty. Show the faint
  Scorpius "guide" constellation as dim `void-500` outline stars — *"This is where your sky
  fills."* `body` copy: "Osmoning hali bo'sh. Birinchi darsni boshla." A primary CTA.
- **No lessons today:** "Bugun yangi baho yo'q — bu yaxshi. Mashq qilamizmi?" *(No new grades
  today — that's good. Want to practice?)* Reframe emptiness as a choice, not a dead end.
- **System error** (`signal-error`, the only place red appears): a calm inline panel, never a
  browser alert. "Biror narsa noto'g'ri ketdi. Qayta urinib ko'r." + a "Qayta urinish"
  *(Retry)* button. The sky stays; the app never goes white.
- **Offline:** a slim `void-700` bar at the top, `caption`: "Aloqa yo'q — saqlangan darslar
  ishlaydi." Cached lessons remain swipeable.

---

## 5. Mobile ↔ desktop responsive strategy

The hard requirement: a vertical-swipe, single-card mobile paradigm must be **stunning on a
wide desktop screen** — not a phone-width column stranded in a black void.

### 5.1 Breakpoints

| Name | Range | Treatment |
|---|---|---|
| `sm` (phone) | < 640px | Single-column. The native paradigm. Full-bleed sky. |
| `md` (large phone / small tablet) | 640–1023px | Single-column, wider gutters, card max 560px centered, the sky breathes around it. |
| `lg` (desktop) | 1024–1439px | **Two-panel cockpit** — see §5.3. |
| `xl` (large desktop) | ≥ 1440px | Two-panel cockpit, content capped at 1280px, the sky extends full-bleed beyond it. |

### 5.2 The principle

The mobile experience is a *single instrument*: the card. The desktop experience reveals the
**context around the instrument** — the constellation, the lesson map, the tutor — that on
mobile is intentionally hidden behind gestures and sheets. Desktop is not "mobile, wider." It
is "mobile, with the room to show what mobile keeps in your pocket."

### 5.3 Learn mode — desktop "cockpit" layout

A two-panel layout inside the 1280px shell, full-bleed sky behind it.

```
┌──────────────────────────────────────────────────────────────────────┐
│  sky background (full-bleed, ambient twinkle, gentle parallax)          │
│                                                                         │
│   ┌────────────────────────┐   ┌──────────────────────────────────┐   │
│   │  LEFT — THE SKY PANEL   │   │  RIGHT — THE CARD DECK           │   │
│   │  ~38% width, max 460px  │   │  ~62%, card capped at 560px      │   │
│   │                         │   │                                  │   │
│   │  • the student's living │   │  the active lesson card,         │   │
│   │    constellation        │   │  vertically centered             │   │
│   │  • this lesson's rail   │   │                                  │   │
│   │    highlighted as a     │   │  next card peeks below (16px),   │   │
│   │    bright path within   │   │  previous card peeks above       │   │
│   │    the bigger sky       │   │                                  │   │
│   │  • current skill's      │   │  ▲ / ▼ affordances flank the     │   │
│   │    P(mastered) bar      │   │    card (real buttons)            │   │
│   │  • the star that will   │   │                                  │   │
│   │    ignite, pre-lit      │   │  scroll wheel / arrows / drag    │   │
│   │    faintly as a target  │   │  all advance the deck            │   │
│   └────────────────────────┘   └──────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

Why this works:
- **The void is filled with meaning, not padding.** The left panel shows the constellation —
  the thing mobile hides behind a swipe-to-home. On desktop you watch your sky *while* you
  learn. When a star ignites, on mobile it interrupts the card; on desktop it ignites in the
  left panel *in your peripheral vision* — quieter, but you see your whole sky react. Two
  genuinely different, both-correct treatments of the same event.
- **The card stays the hero.** It is still capped at 560px, still vertically swiped (wheel,
  arrows, or drag), still one card at a time. We did not turn it into a multi-column quiz.
  We surrounded one focused card with its context.
- **The peek above and below** the card is bigger on desktop (16px vs 10px) and the
  enter/exit motion is fully visible — the vertical-deck metaphor becomes a *feature* of the
  desktop view, cinematic rather than hidden.
- The whole shell sits on the full-bleed sky, so even at 1920px wide there is no dead black
  rectangle — the sky owns the overflow, the cockpit floats in it.

**Below `lg`:** the left panel collapses. The constellation becomes a single tap target in
the top bar (a small live constellation glyph); the lesson rail moves to the top of the card
(§3.4). All the context is one tap away, not gone.

### 5.4 Onboarding — desktop treatment

- **Landing:** the same type-led, single centered column as mobile (§2.1) — no two-column
  hero, no enlarged constellation occupying half the screen. On `lg+` the column simply has
  more space around it: the content stays max 600px and centered, the `void-950` field with
  its edge vignette extends full-bleed, and the `display` headline may step up one notch
  (toward 52px, −0.03em) so it carries the wider viewport. Confident type with generous void
  around it — that *is* the desktop treatment. The Scorpius mark stays small (≈32–40px). No
  extra motion is added for desktop.
- **Sign-up sheet:** on mobile it rises from the bottom; on desktop it is a centered panel
  (max 480px, `radius-xl`, `elev-sheet`) that fades+scales in (96%→100%, 320ms) over the
  still-twinkling sky. Same component, two presentations via a `presentation` prop.
- **Interest deck:** on desktop the card is capped at ~480px and centered, but the swipe gets
  **keyboard parity made obvious** — large ◀ / ▶ affordances flank the card, and "← →" arrow
  keys work, with a `caption` hint "Strelkalar bilan tanla" *(choose with arrows)*. The
  interest-star tray sits at the top, wider, with the forming constellation clearly visible.
  Drag still works with a mouse. The "collapse to star" animation is more visible with the
  room — desktop makes the payoff *bigger*, not absent.

### 5.5 Parent surface — the one light theme

Out of scope to fully spec here (PROJECT-PLAN marks it "brief only"), but the design system
must accommodate it: the Parent brief uses a **light theme** — `void-100`/white surfaces,
`void-900` text, a calm, document-like, Telegram-message feel (per the demo script, the
parent brief is the emotional close). It reuses the *same tokens inverted* — semantic naming
makes this a theme swap, not a redesign. Antares stays the accent. The parent surface is
daytime and reassuring by deliberate contrast with the student's night sky.

### 5.6 Responsive rules of thumb

- Touch targets ≥ 44px at every breakpoint; primary actions 52px on touch.
- The card content column never exceeds 560px regardless of screen — reading length is a
  constant, not a function of monitor size.
- Type scale does **not** shrink on mobile — `body-lg` is 18px on a phone too. Children, small
  screens. If anything, mobile gets *more* generous line-height.
- Hover states are desktop-only; touch uses the pressed/active state. Never ship a
  hover-dependent affordance.
- Test every screen at 320px (smallest real phone) and 1920px (a judge's laptop on a projector).

---

## 6. Accessibility

- **Contrast.** Body text targets WCAG **AA minimum, AAA preferred**. `void-100` on `void-900`
  = 15.8:1 (AAA). `void-200` on `void-800` = 9.1:1 (AAA). `void-300` on `void-800` = 5.4:1
  (AA, captions only). `antares-500` text on `void-950` = 5.9:1 (AA large). `void-950` text
  on `antares-500` button = 8.9:1 (AAA). **No body text below AA. No exceptions.**
- **Color is never the only signal.** Correct = green + a check icon + a pulse + text. Wrong =
  gold + a shake + the tutor panel + text. A colorblind student gets the message four ways.
  The star temperature scale is reinforced by *brightness/glow*, not hue alone.
- **Focus-visible** on every interactive element — a 2px ring, `antares-300` or `signal-info`,
  2px offset, radius-matched. Never `outline: none` without a replacement. The keyboard path
  through a lesson: Tab to options, Enter/Space to select, ↑/↓ or PageUp/PageDown to move the
  deck, Esc closes the tutor panel.
- **The swipe always has a button.** No interaction is gesture-only. Footer chevrons are real
  `<button>`s; the interest deck has ◀/▶ controls.
- **`prefers-reduced-motion`** — fully honored per §1.5. The product loses theatre, never
  meaning.
- **Semantics.** Cards are an ARIA `region` with a label ("Lesson card 3 of 6"); the deck
  announces position changes via an `aria-live="polite"` region; the tutor panel is
  `aria-live` so its streamed Socratic question is read aloud as it arrives. Answer options
  are a `radiogroup`.
- **Text scaling.** Layout must survive 200% browser zoom and OS-level large-text without
  clipping — hence no fixed-height text boxes (§1.2 Uzbek note).
- **Language.** `lang` attribute set correctly (`uz` / `uz-Cyrl`) so screen readers pronounce
  Uzbek properly. All interactive elements have Uzbek `aria-label`s.

---

## 7. Implementation notes (for the build, not code)

- **Tokens** live in `app/globals.css` under Tailwind v4 `@theme` — replace the scaffold's
  placeholder `--background`/`--foreground` with the full token set from §1. Reference tokens
  via Tailwind utilities (`bg-void-900`, `text-star-bright`) generated from the `@theme`.
- **Motion**: Framer Motion (`motion`) for the swipe deck (`drag="y"`, `dragConstraints`,
  `onDragEnd` velocity check), the ignite sequence (a `motion` timeline / `useAnimate`), and
  the sheet transitions. Named curves go in a single `lib/motion/` constants file so durations
  and easings are not scattered.
- **The star/constellation** is one reusable canvas/SVG component driven by data — used by the
  landing's static Scorpius mark, the onboarding tray, the lesson rail, and the home
  constellation. It must render cleanly **static** (the landing mark, the empty-state guide
  outline) as well as animated (the tray, the ignite). Build it once (rule of three is
  satisfied: 4 use sites).
- **Card renderer**: a `<LessonCard>` switch on `card.type` → one component per DSL type
  (§3.3), all wrapped in the shared `<CardShell>` (§3.2).
- **Streaming**: cards arrive over the stream from the model adapter; render the `intro` card
  the instant it parses, skeleton the rest (§4.8).
- **Reduced motion**: read `useReducedMotion()` once at the deck root, branch every signature
  motion off it.
- **Performance**: the landing field is static (no twinkle) — paint it once, cheap. Inside
  the product, the Learn-mode cockpit's ambient sky twinkle (§5.3) must not jank the swipe:
  render the sky on its own layer (`will-change: transform`, `transform`/`opacity` only), keep
  twinkling stars modest (~60–80), and pause ambient animation while a drag is in progress.

---

## 8. Trade-offs

- **Dark-first, not light-first.** A night sky cannot be light, and the ignite payoff needs
  darkness to read. Cost: the Parent surface needs a separate light theme. Accepted — semantic
  tokens make it a swap, and the day/night contrast between parent and student is itself good
  design.
- **Username, no email — chosen as a feature.** It blocks email-based password recovery (a
  roadmap problem: recovery via parent-link or a recovery phrase). For a hackathon and a
  young-student audience, the friction cut is worth more than the recovery edge case.
- **One accent color (Antares) only.** Rejected a fuller brand palette. The discipline is the
  point — when Antares appears it always means "you / action / progress." Subject hues are the
  only other color and they are rationed to an accent dot.
- **No separate display typeface.** Geist at heavy weight + tight tracking carries the hero
  for the hackathon. A bespoke display face is a real upgrade but a Phase 1.0 item — shipping
  a second font now is unjustified weight and risk.
- **Considered a horizontal-swipe deck** (Tinder-style) for lessons and rejected it: vertical
  matches the TikTok mental model the product explicitly invokes, keeps within-card scroll on
  the same axis as between-card swipe (one mental model), and reads naturally as "moving up
  through a lesson." The cost — the swipe/scroll handoff (§3.5) — is solved.
- **Rejected gamification guilt** (streak-loss warnings, timers, leaderboards). The reward is
  intrinsic: your sky fills. A child should return because the constellation is theirs, not
  because they fear losing a streak. This is a deliberate ethical line for a kids' product.
- **Cut the theatrical landing — type-led, not a light show** (revised 2026-05-22). An earlier
  draft of §2 opened with a 140-star staggered fade-in, a 1.4s self-drawing Scorpius
  constellation, cursor parallax, and ambient twinkle — a cinematic "sky waking up." Rejected:
  it read as an animated screensaver, the AI-slop tell the §0 thesis explicitly bans. The
  landing is now a single confident `display` sentence on a still `void-950` field, the
  Scorpius mark rendered small and static like a logo, with one restrained content-entrance
  fade. The theatre is not deleted — it is *relocated* to where it is earned: the in-product
  star ignite (§3.8) and the §2.4 constellation reveal still play in full. A front door
  should be quiet and confident; the payoff should be loud. Spending the ignite on the
  landing cheapened both. The metaphor is unchanged — it is now *stated*, not *performed*.
```


---

## 9. Revision v1.2 — light theme (2026-05-22)

Founder decision: Scorpius switched **dark-first to light**. It is a tool for school
pupils used in classrooms, where a light, high-contrast theme is more readable and
proven for young learners. The night-sky §1.1 dark palette is superseded.

- **Palette:** warm off-white ground, ink-navy text, gold-yellow accent. The live
  token set is in `app/globals.css` (Tailwind `@theme`). The constellation reads as a
  gold star-chart on white; a star "ignites" pale dot to glowing gold.
- **Personalization:** keys on interests + emaktab performance + live in-lesson
  feedback (the full LEARN-MODE engine); invisible — no "picked for you" labels.
- **Onboarding:** captures a richer profile — interests + favourite and hardest
  subject + a learning goal — feeding the personalization model.
- §0, §1.1 and §2 colour/dark references are superseded here; structure, layout,
  motion and component specs still hold.

---

## 10. Revision v1.3 — "Apple-mode" craft (2026-05-22)

Adopt Apple's web design *discipline* — reverent restraint, near-invisible UI, the
artifact over the chrome — while keeping Scorpius's gold accent and constellation identity.

**Taken from Apple:**
- **Surface alternation is the divider.** Full-bleed sections alternate `void-950`
  (warm off-white / "parchment") and `void-800` (pure white). The colour change IS the
  section break — no borders, no frames between sections.
- **One accent, rationed.** Gold (`antares-500`) is the only interactive colour — every
  link, primary CTA, focus ring. Nothing else. (Already true — hold it.)
- **Typography — "Apple-tight."** Headlines weight 600 (never 700), negative tracking
  -0.02em to -0.03em. Body 17px, line-height ~1.47, -0.01em tracking. Weight ladder
  300/400/600 — no 500. One quiet, confident voice.
- **Pill primary CTA.** The primary action is a full pill (`rounded-full`) — the pill
  itself is the "action" signal. Compact utility controls stay `rounded-md`. Two button
  grammars only.
- **Shadows — almost none.** Exactly one soft shadow, only under a resting object (the
  lesson card on the deck): `0 3px 30px -8px rgba(0,0,0,0.18)`. Never on buttons or text.
  Elevation = surface-colour change, not shadow.
- **Low density.** Generous air — >=64px above a section headline. The lesson/card is
  the artifact; the UI recedes.
- **Quiet press motion.** `transform: scale(0.97)` on every button — the one system
  micro-interaction.

**Stays Scorpius (not Apple):** the accent is gold, not Apple blue; the brand artifact
is the constellation / the igniting star / the lesson card (where Apple puts product
photography); Geist stays as the typeface (Apple-adjacent geometric sans, already installed).

**Component application order:** primary CTA -> pill; landing -> Apple-tight hero +
surface alternation; Learn card -> the one soft shadow + tighter type; onboarding ->
quiet type + pill CTAs. Each is a small, self-contained pass.