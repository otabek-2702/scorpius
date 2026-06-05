@AGENTS.md

# Interactive lessons — always delegate

Whenever the task involves designing, building, or iterating on an **interactive visual lesson** (simulations, visualizations, games, puzzles, experiments, discovery-based learning experiences, or any educational content where the user is learning a concept by doing rather than reading), you MUST delegate the work to the `interactive-learning-designer` agent via the Agent tool.

This applies even when the user does not explicitly name the agent. Triggers include but are not limited to:
- "teach me X" / "help me understand X" / "I want to learn X"
- requests for lessons, tutorials, explainers, or educational pages on Scorpius
- any work on `/learn`, lesson modules, or interactive concept pages
- requests for simulations, visualizers, or "show me how X works"

Do not write the lesson yourself first and then hand it off — invoke the agent at the start so the discovery-based design drives the implementation. Only skip the agent if the user explicitly says they want a plain text explanation or that they do not want an interactive lesson.

## Quality bar: Brilliant.org-level

Lessons on Scorpius must hit **Brilliant.org production quality**. Reference designs live in `/scrn/` (periodic-function point-marking on a "leap year searches" graph, Olympics search-wave fill-in-the-blank, rate-of-change with a filling water bottle paired to a v–t line graph, photon-counting Galton-board with classical-vs-experimental growth curves driven by a slider). Study those before designing, and aim to match or beat them.

When briefing the `interactive-learning-designer` agent, demand that it:

- **Lead with a hook, not a definition.** Open every concept with a concrete, surprising, real-world phenomenon (Olympics searches, water filling a bottle, a photon hitting a beam splitter) — not a textbook intro paragraph.
- **One idea per screen.** Socratic micro-steps. Each screen poses a single question the learner answers by clicking, dragging, marking a point, dropping a value into a blank, or moving a slider — never by reading and clicking "next".
- **Make the visual the lesson.** The graph, simulation, or diagram is the primary teaching surface; text is a caption, not a wall. If you can replace a sentence with an animation or a manipulable parameter, do.
- **Be physically real for physics.** Build genuine simulations with real equations of motion — pendulums that actually swing under gravity, projectiles with drag, springs that obey Hooke's law, waves that interfere, circuits where current actually flows, charged particles that respond to fields. No fake animations. Let the learner change mass, gravity, length, charge, frequency, damping — and watch the physics respond. Use `requestAnimationFrame` integration loops, not CSS keyframes, for anything dynamic.
- **Get creative with the metaphor.** Pick a visual analogy that *no textbook would use* — that's where lessons become memorable. (Brilliant's "leap year searches" for periodicity is the move: a familiar phenomenon that secretly *is* the math.)
- **Reward exploration.** Sliders should reveal something. Dragging a point should snap-feedback. Wrong answers should explain via the visualization, not a paragraph. Right answers should unlock the next layer of the idea.
- **Respect the visual language already established.** Dark background, single saturated accent per lesson (teal, violet, lime — pick one), crisp line-art axes, generous whitespace, large legible labels, no clutter. Match the `/scrn/` aesthetic.
- **Use the right tech for the job.** SVG + Framer Motion for graphs and diagrams. Canvas or WebGL (via `react-three-fiber` if needed) for particle systems, fields, or 3D. Keep it 60fps on a mid-range laptop.

When you delegate, pass the agent the lesson topic, the target learner level, and a pointer to `/scrn/` as the visual reference. Tell it to invent the metaphor itself — do not pre-specify the interaction.

## Pedagogy arc — mandatory for every lesson

Every Scorpius lesson must follow **three beats, in this order**, regardless of how cool the simulation is:

1. **Experiment / phenomenon first — no physical terms.** Concrete observation: milk spreading in water, balloon rubbed on hair, kid lifting a box with a stick. Learner watches, predicts, or pokes without needing any vocabulary. Goal: generate the "huh, why?" question.

2. **Real teaching.** Now introduce the concept properly — the name of the phenomenon, definitions, the equation, the historical hook. This is where the learner gets the framework they'll need to make sense of the sim.

3. **Interactive practice.** Only AFTER the teaching does the simulation appear. The learner now has both intuition (step 1) and vocabulary (step 2), so they manipulate parameters knowing what they're doing.

A simulation that arrives on card 2 with no prior framing is a **bug**, even if the sim itself is beautiful. The user is a teacher targeting Grade-6 Uzbek students who know nothing beyond the previous lesson — assume zero physics vocabulary at each lesson's start.

Concretely, the card sequence for a typical lesson looks like:
- `intro` → `mcq`/`discover`/`diagram` (phenomenon, no terms) → `explainer`/`story` (teach the concept + vocabulary) → `simulation` (now they can play meaningfully) → `mcq` (consolidate) → `ask` → `done`.

Sims that appear before the explainer/story must be reframed or moved.

# Bug hunts — always delegate

Whenever the task involves a **project-wide audit for bugs, logical errors, mathematical mistakes, type problems, race conditions, dead code, or any defect that requires deep analysis across multiple files**, you MUST delegate the work to the `deep-bug-hunter` agent via the Agent tool.

This applies even when the user does not explicitly name the agent. Triggers include but are not limited to:
- "find bugs in the project" / "audit the codebase" / "what's broken"
- "the math feels off" / "the simulation doesn't match what I expect"
- post-refactor verification ("I just refactored X, can you check nothing's broken")
- pre-release sweeps ("before we ship, do a deep audit")
- "fix any illogical code / mistakes / dead code across the project"

Do not start hunting bugs yourself first — invoke the agent at the start so the systematic categorization (syntax / logical / mathematical / async / type / API / performance / security / architectural) drives the investigation. Skip the agent only when the user pinpoints a specific known bug at a specific file:line and asks for that one fix.
