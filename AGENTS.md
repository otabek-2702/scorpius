<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This project runs **Next.js 16** — APIs, conventions, and file structure may differ from
training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing
Next.js code, and heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Scorpius — agent notes

- **Constitution:** `CLAUDE.md` — read it first.
- **Stack:** Next.js 16 (App Router, TypeScript), Tailwind v4, Firebase (Firestore, Auth),
  Gemini 2.5 — all LLM calls go through the adapter in `lib/ai/`.

## Session recap reports / any long report
When the user asks "save everything" — or any deliverable runs past ~30 lines of prose —
produce an **interactive HTML experience** at `session-YYYY-MM-DD-<topic>.html`
(gitignored via `/session-*.html`), VERIFY it in a real browser (serve via
`python -m http.server`; screenshot the cover + one interactive element), then open in
Chrome default profile. A plain wall of text — or even a plain snap-scroll page — is a
failure; the bar is dopamine-level, read-to-the-end. Full spec + the must-work mechanics
(typewriter reveal + key-click sound, count-ups, drawing ring, 3D-tilt, pentatonic chimes,
confetti, embedded live sim proof, reading-progress bar; NEVER clip text with
max-height+overflow:hidden; reserve typed height after `document.fonts.ready`; inline
confetti not CDN) live in global `~/.claude/CLAUDE.md` §11 and project memory
`report-style-preference`.
