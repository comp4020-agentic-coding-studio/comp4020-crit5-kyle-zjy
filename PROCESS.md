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

The whole rewrite landed as one commit,
[`a1755a4`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-kyle-zjy/commit/a1755a4),
since none of it was usable mid-way through --- there was no working
intermediate state worth checkpointing separately. Three decisions inside it
are worth calling out on their own:

Splitting `tower.ts` (the intro/floor/dying/rewinding/ending saga) away from
`floors/rules.ts` (the pure per-floor mechanics) away from the nine
presentation modules was the choice that made nine different mechanics
tractable at all. `spec/tower.test.ts` and `spec/floor-rules.test.ts` test
real game logic --- floor-9-reaches-ending, death resetting every orb, the
"shooting the last sun always fails" rule --- with no DOM in the loop, the
same shape as the previous prototype's `spec/game.test.ts`.

Floor 9's escort leg had a real bug caught before it was ever run: the
escorted sphere's position was left wherever it happened to be after the
discern phase instead of being reset to the corridor's start, so "escort it
from the beginning" could silently start partway through. Fixing it meant
`beginEscort()` explicitly resetting the figure's coordinates before the
escort phase starts, rather than trusting whatever state the discern phase
left behind.

Floor 4 (Sisyphus) went through a real playtest correction, not a
self-caught one: the first version let the stone roll back down the same
diagonal it climbed and failed almost immediately once it passed the foot of
the ramp, which read as "falls too fast" and as an unfair cliff-edge rather
than a slope. The fix split the physics in two --- gravity and a real terminal
speed while still on the incline, friction settling the stone on a flat
landing once it's off the ramp --- so there's a genuine horizontal plane to
recover on before the fail edge, matching what playtesting actually asked
for.

## Later changes: Floor 8's hint, Floor 9's replacement, the Rewind Anchor

Three further, targeted changes on top of the shipped nine-floor build, made
without touching any floor's underlying mechanic except Floor 9's own.

**Floor 8's hint** was too thin: one flat caption line risked either naming
the answer outright or reading as throwaway flavour text nobody paused for.
It's now a two-part staged reveal --- "The false can copy the shape. It cannot
copy the heart." then, after a pause, "The true one does not flee, does not
defy, does not perform. It only answers your approach." --- followed by a
faint residual line once the caption settles, "Only its nature cannot be
disguised." None of the three lines names a sphere, a position, or a specific
behaviour; they exist to stretch how long the floor invites the player to
watch before acting, which is the entire mechanic here (five figures with
different observable tells: a magnetic authentic one, plus mirrored, panic,
orbit and pulse decoys). `createDeceiver` and `assignFloor8Qualities` are
untouched --- this was a caption and pacing change only.

**Floor 9 was fully replaced**, not patched. The former "综合试炼"
(discern-then-escort) leaned on the same deception toolkit as Floor 8 plus a
corridor/obstacle chase, which made the tower's final floor read as "Floor 8
again, now with walking" rather than a distinct climax. It's now Pangu
splitting heaven and earth: three continuous stages inside one floor, with no
on-screen phase labels. Breaking the chaos egg is a charge-then-release
strike gated on *both* charge and release timing (`chaosStrikeOutcome`) ---
deliberately unlike Floor 4's charge mechanic, which gates on power alone, so
the final floor doesn't just repeat an earlier verb. Dividing heaven and
earth is a drag against a constant pull back toward reunion
(`driftHalfTowardCenter`), and supporting the pillar is a hold-steady contest
against a lateral disturbance (`supportDisturbanceAt`). Failure inside any of
the three stages is deliberately non-fatal on a first miss --- the egg shakes
and re-arms, a collision drops back to the strike stage, a support collapse
just resets the hold's progress --- and only escalates to `ctx.onFail()`
after repeated failures within a stage (`CHAOS_INSTABILITY_LIMIT`,
`COLLISION_LIMIT`, `COLLAPSE_LIMIT`), so a slow or exploratory attempt at the
last floor isn't punished as bluntly as a wrong answer earlier in the tower
would be. The ending gained one line to match: after "You have escaped," a
quieter second line now appears --- "The chaos has opened. The cycle has
ended." --- echoing 混沌已开，轮回已止 without reverting any of the rest of
the ending back to Chinese.

**The Rewind Anchor** is a new opt-in toggle (top-right, off by default, a
real `<button role="switch">`) that changes what a death costs. Off, nothing
changes from the original build: death rewinds all the way to Floor 1 with
every orb reset. On, a death restarts only the floor the player was standing
on, leaving already-cleared floors' orbs alone. This is deliberately not a
DOM-side `if (checkbox.checked)` patch: `TowerState` carries `anchorEnabled`
and a committed `rewindMode`, and `failFloor` reads the anchor preference and
commits it onto the state at the exact moment of failure --- so toggling the
switch mid-death-animation can never reach back and change an outcome that's
already in flight. `finishRewind` then branches purely on that committed
mode. This was a design decision made ahead of the fact, not a response to
playtest feedback --- no one has played with the Anchor on yet, and this file
won't claim otherwise; `spec/tower.test.ts`'s Anchor tests (off-behaviour,
on-behaviour, and the toggle itself being inert until the next failure) are
what stand in for that until a real playtest happens.

What the tests for these three changes actually verify, and what they can't:
`spec/deceiver.test.ts` confirms Floor 8's five behaviours are numerically
distinct and identical at rest; `spec/floor-rules.test.ts` confirms Floor 9's
gating math (charge+timing, half-collision, hold-completion) behaves as
designed; `spec/tower.test.ts` confirms the Anchor's off/on branching and its
non-retroactive commit timing. None of that is a substitute for playing it:
whether Floor 9's three stages *feel* continuous rather than like three
separate mini-games stitched together, whether the chaos egg's charge/timing
window feels fair rather than fiddly, and whether the Anchor's shorter
rewind reads as meaningfully different in the moment rather than just a
number changing --- all of that is still outstanding and unclaimed here.

## Before you ship

`pnpm check:evidence` verifies your citations resolve to real commits, that a
reflection entry the marker reads is in `reflections/`, and that your
`CLAUDE.md` is there --- before a marker ever opens the file. It checks that
your map is traceable, not that it is good: the marker judges whether your
small, deliberately chosen set of moments shows real judgement and reflection. A
green check is not a substitute for that curation.

Images aren't checked: unlike a citation whose SHA doesn't resolve, a broken
image is visible the moment this file is rendered on GitHub.
