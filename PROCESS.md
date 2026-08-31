# Process overview

A reading-guide to how the work came together --- a map to your process, not an
essay about it. Markers read this file and follow its citations; they don't
trawl the repo for evidence you didn't point at, so if a moment mattered, cite
it.

This file is the shape; the course site's
[assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#what-you-submit)
is the requirement, and its
[word counts](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#word-counts)
cover every deliverable.

## What I built

**NINEFOLD TOWER** replaces this repo's original one-real-button mechanic with
a nine-floor pagoda of myth-inspired trials. The player wakes up trapped
inside it; each floor is a short, mechanically distinct challenge told through
its rules rather than its text (Hou Yi sparing the last sun, Sisyphus's stone
rolling back under gravity, Orpheus failing the moment you drag backward,
Theseus's maze going dark after a brief preview, and so on). Dying doesn't end
the run --- it rewinds time back to Floor 1 with every floor's progress reset,
and the loop repeats until the player clears all nine floors and the screen
resolves to white. Visually the whole tower stays black, white and grey; the
only gold in the game is the nine-orb progress rail on the right edge, which
never shows a number or a label, only which floors are still alight.

## Why this direction

The previous build (**ONE BUTTON TOO MANY**) was one mechanic repeated across
nine stages of escalating deception. That was a good fit for its own brief,
but asked to build something with real narrative shape, repeating the same
click-the-real-one loop nine times would have been the wrong move even with
new art on top --- escalation needs the *mechanic* to change, not just its
disguise. Nine floors, each teaching one myth through a different verb (aim,
escort, push, balance, resist, remember, discern), is what makes "everything I
learned is being tested now" on Floor 9 actually true rather than a slogan.

The intro-once / death-rewind loop is the emotional spine the brief asked for:
a full wake-up sequence only means something the first time, so it's gated
behind `sessionStorage` and every later death gets a brief flash-and-whisper
instead --- the player should feel time folding back, not sit through the same
five lines again. The nine gold-to-ash orbs are the only progress readout by
design; a "3/9" counter would have turned a ritual into a checklist.

Architecturally, the single old `game.ts` state machine is retired in favour
of a small pure saga (`tower.ts`) for the intro/floor/dying/rewinding/ending
loop, a pure rule module per floor (`floors/rules.ts`) with no DOM or timers,
and one presentation module per floor (`floors/floor1.ts`...`floor9.ts`) that
calls into those rules and owns its own `requestAnimationFrame` loop. That
split is what kept nine wildly different mechanics from turning into one
tangled file: `spec/tower.test.ts` and `spec/floor-rules.test.ts` test the
rules directly, with no DOM in sight, the same way the old `spec/game.test.ts`
tested the single mechanic.

What the automated tests actually verify: floor progression and the
floor-9-reaches-ending transition, that death resets floor and orb state while
clearing the first-run flag so the intro never replays, Floor 2's rule that
shooting the last sun always fails, and the numeric mechanics behind Floors
3--7 and 9 (flame drain/recovery, the stone's gravity-vs-push physics, the
drifting safe band, the look-back tolerance, maze wall collision, corridor
containment and obstacle collision). What they cannot verify, and what still
needs a person: whether the drag-based floors (Prometheus, Sisyphus, Orpheus,
the Floor 9 escort) *feel* right rather than merely work, whether the intro's
pacing lands as cinematic rather than slow, whether the audio cues are
audible without being intrusive, and whether nine floors together read as
escalating rather than just "different." None of that is claimed here as
already checked --- it's flagged as outstanding.

## The moments that mattered

This section is not yet re-filled for the Ninefold Tower rewrite. The redesign
above hasn't been committed yet (the work explicitly stopped short of
committing or pushing pending review), and `pnpm check:evidence` requires
every citation here to resolve to a real commit in this repo --- so citing the
*previous* mechanic's commits under a section that now describes a different
game would misrepresent what those commits actually did. Once the redesign is
committed, replace this section with 2--4 real moments drawn from that
history. Strong candidates already visible in the diff: the Floor 2 ("Hou Yi")
redesign from an auto-clearing rule that made the "don't shoot the last sun"
failure mechanically unreachable, into a grace-window that keeps the last sun
alive and clickable so restraint is an active, failable choice; the Floor 4
listener-removal bug where `destroy()` tried to remove event listeners with
freshly-created closures instead of the ones actually attached, a real leak
fixed by naming the handlers; and the Floor 9 bug where the escorted sphere
never reset to the corridor's start position after the discern phase, so the
"escort from the beginning" challenge could silently start from wherever the
sphere happened to be placed.

## Before you ship

`pnpm check:evidence` verifies your citations resolve to real commits, that a
reflection entry the marker reads is in `reflections/`, and that your
`CLAUDE.md` is there --- before a marker ever opens the file. It checks that
your map is traceable, not that it is good: the marker judges whether your
small, deliberately chosen set of moments shows real judgement and reflection. A
green check is not a substitute for that curation.

Images aren't checked: unlike a citation whose SHA doesn't resolve, a broken
image is visible the moment this file is rendered on GitHub.
