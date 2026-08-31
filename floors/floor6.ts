// Floor 6 — Orpheus must not look back. Holding the pointer down carries
// the sphere forward; letting go simply pauses, which is always safe. The
// one way to fail is a deliberate backward drag past the tolerance — the
// temptation to check what's following is the whole floor.
import { isLookingBack, clamp } from "./rules.ts";
import { makeSphere, place, raf, rectOf, type FloorContext, type FloorController } from "./shared.ts";

const START_X = 0.12;
const EXIT_X = 0.88;
const FORWARD_SPEED = 0.055;
const LOOK_BACK_TOLERANCE = 0.02;
const FOLLOWER_OFFSET = 0.16;
const TEMPTATION_INTERVAL = 3.4;

export function mount(container: HTMLElement, ctx: FloorContext): FloorController {
  const follower = makeSphere("ghost");
  follower.classList.add("sphere--follower");
  container.appendChild(follower);

  const walker = makeSphere("target");
  walker.classList.add("sphere--walker");
  container.appendChild(walker);

  let x = START_X;
  let pointerX = 0;
  let lastPointerX = 0;
  let holding = false;
  let resolved = false;
  let sinceTemptation = 0;

  function onPointerDown(ev: PointerEvent): void {
    holding = true;
    const rect = rectOf(container);
    pointerX = (ev.clientX - rect.left) / rect.width;
    lastPointerX = pointerX;
  }
  function onPointerMove(ev: PointerEvent): void {
    if (!holding) return;
    const rect = rectOf(container);
    pointerX = (ev.clientX - rect.left) / rect.width;
  }
  function onPointerUp(): void {
    holding = false;
  }

  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  const stop = raf((dt, t) => {
    if (resolved) return;

    if (holding) {
      const delta = pointerX - lastPointerX;
      if (isLookingBack(delta, LOOK_BACK_TOLERANCE)) {
        resolved = true;
        walker.classList.add("sphere--extinguish");
        follower.classList.add("sphere--extinguish");
        window.setTimeout(() => ctx.onFail(), 300);
        return;
      }
      x = clamp(x + FORWARD_SPEED * dt, START_X, EXIT_X);
      lastPointerX = pointerX;
    }

    sinceTemptation += dt;
    if (sinceTemptation >= TEMPTATION_INTERVAL) {
      sinceTemptation = 0;
      follower.classList.add("sphere--flicker");
      window.setTimeout(() => follower.classList.remove("sphere--flicker"), 420);
    }

    const rect = rectOf(container);
    place(walker, x, 0.5, rect);
    place(follower, Math.max(START_X, x - FOLLOWER_OFFSET), 0.5, rect);

    if (x >= EXIT_X) {
      resolved = true;
      walker.classList.add("sphere--pressed");
      window.setTimeout(() => ctx.onClear(), 260);
    }
  });

  return {
    destroy(): void {
      stop();
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      follower.remove();
      walker.remove();
    },
  };
}
