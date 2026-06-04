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

Lessons on Scorpius must hit **Brilliant.org production quality**. Aim to match or beat the best Brilliant.org interactive lessons — e.g. periodic-function point-marking on a "leap year searches" graph, Olympics search-wave fill-in-the-blank, rate-of-change with a filling water bottle paired to a v–t line graph, or a photon-counting Galton-board with classical-vs-experimental growth curves driven by a slider.

When briefing the `interactive-learning-designer` agent, demand that it:

- **Lead with a hook, not a definition.** Open every concept with a concrete, surprising, real-world phenomenon (Olympics searches, water filling a bottle, a photon hitting a beam splitter) — not a textbook intro paragraph.
- **One idea per screen.** Socratic micro-steps. Each screen poses a single question the learner answers by clicking, dragging, marking a point, dropping a value into a blank, or moving a slider — never by reading and clicking "next".
- **Make the visual the lesson.** The graph, simulation, or diagram is the primary teaching surface; text is a caption, not a wall. If you can replace a sentence with an animation or a manipulable parameter, do.
- **Be physically real for physics.** Build genuine simulations with real equations of motion — pendulums that actually swing under gravity, projectiles with drag, springs that obey Hooke's law, waves that interfere, circuits where current actually flows, charged particles that respond to fields. No fake animations. Let the learner change mass, gravity, length, charge, frequency, damping — and watch the physics respond. Use `requestAnimationFrame` integration loops, not CSS keyframes, for anything dynamic.
- **Get creative with the metaphor.** Pick a visual analogy that *no textbook would use* — that's where lessons become memorable. (Brilliant's "leap year searches" for periodicity is the move: a familiar phenomenon that secretly *is* the math.)
- **Reward exploration.** Sliders should reveal something. Dragging a point should snap-feedback. Wrong answers should explain via the visualization, not a paragraph. Right answers should unlock the next layer of the idea.
- **Respect the visual language already established.** Dark background, single saturated accent per lesson (teal, violet, lime — pick one), crisp line-art axes, generous whitespace, large legible labels, no clutter.
- **Use the right tech for the job.** SVG + Framer Motion for graphs and diagrams. Canvas or WebGL (via `react-three-fiber` if needed) for particle systems, fields, or 3D. Keep it 60fps on a mid-range laptop.

When you delegate, pass the agent the lesson topic and the target learner level. Tell it to invent the metaphor itself — do not pre-specify the interaction.
