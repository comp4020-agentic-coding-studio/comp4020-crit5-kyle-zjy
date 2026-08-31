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

**ONE BUTTON TOO MANY** is a short perception game: one button on the page is
real and always responds the same way; everything else is a decoy that
multiplies and gets better at pretending. There is no instruction screen
anywhere --- the only way to learn which button is real is to press one and
watch what happens. The game teaches its own rules through nine stages of
increasingly convincing deception (duplication, false similarity, shuffling,
pointer mimicry, crowding), ends in one of two short, distinct sequences
("ONE WAS ENOUGH." or "TOO MANY."), and never uses colour alone, an
instructions modal, or a labelled/starred button to reveal the answer.

## The moments that mattered

1. **Decoy IDs would have broken the "shuffle" stage.**
   The first draft of the state machine (`game.ts`) gave decoys a per-stage id
   (`decoy-${stage}-${i}`), which is the obvious way to model "a new stage has
   a new set of buttons." But the brief's shuffle stage needs a decoy that
   survives a stage transition to be smoothly repositioned, not torn down and
   recreated --- a fresh id per stage would make every stage transition look
   like a hard cut. I checked that `STAGE_BUTTON_COUNT` never decreases, which
   guarantees no slot is ever orphaned, and switched to slot-stable ids
   (`decoy-${i}`) so the renderer's diff-by-id logic in `render.ts` can animate
   continuity instead of despawning and respawning.
   [`81c0ec1`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-kyle-zjy/commit/81c0ec1)

2. **A CSS class almost leaked which button was real.**
   While writing `applyBehaviourClasses` in `render.ts`, I added
   `classList.toggle("obtn--target", m.entity.isTarget)` out of habit ---
   useful for debugging, and harmless as long as nothing styled it. But the
   brief is explicit that nothing may give the answer away, and an unstyled
   hook today is one CSS rule away from a giveaway tomorrow, and a `grep` away
   from a marker or a curious player finding it in dev tools. I removed the
   toggle entirely rather than leaving it "safe for now," and left a comment
   explaining why `entity.isTarget` must never drive a class.
   [`52053ab`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-kyle-zjy/commit/52053ab)

3. **Browser verification was blocked, so I fixed the sandbox instead of skipping the check.**
   Playwright's headless Chromium failed to launch
   (`libnspr4.so: cannot open shared object file`), and `apt-get install`
   needed interactive sudo that wasn't available. Rather than reporting "typecheck
   and unit tests pass" as if that were equivalent to seeing the game run, I
   downloaded the four missing `.deb` packages with `apt-get download` (no root
   required), extracted them with `dpkg-deb -x` into a scratch directory, and
   pointed `LD_LIBRARY_PATH` at the extracted libraries. That got a real headless
   browser working against the dev server: screenshots through all nine stages,
   a forced loss (3 wrong presses), and a forced win (all stages cleared), with
   zero console/page errors.
   [`42cd499`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-kyle-zjy/commit/42cd499)

4. **The win screen's own screenshot caught a real bug.**
   The forced-win screenshot showed the settled target button sitting fully
   opaque, dead centre, directly behind the "0 mistakes · 4.6s" stats line ---
   legible, but visually competing with the text it was supposed to sit behind.
   I hadn't noticed this from reading the animation code; it only showed up once
   I looked at the rendered frame. Fixed by fading the settled button's opacity
   to 0.28 in the same transition that scales it down
   (`render.ts`'s `playWinEnding`), so it reads as a dim, settled artifact
   instead of competing with the end-screen text. Re-ran the same screenshot
   script to confirm the fix before committing.
   [`42cd499`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-kyle-zjy/commit/42cd499)

## Before you ship

`pnpm check:evidence` verifies your citations resolve to real commits, that a
reflection entry the marker reads is in `reflections/`, and that your
`CLAUDE.md` is there --- before a marker ever opens the file. It checks that
your map is traceable, not that it is good: the marker judges whether your
small, deliberately chosen set of moments shows real judgement and reflection. A
green check is not a substitute for that curation.

Images aren't checked: unlike a citation whose SHA doesn't resolve, a broken
image is visible the moment this file is rendered on GitHub.
