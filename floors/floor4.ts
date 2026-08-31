// Floor 4 — Sisyphus pushes the stone. Holding push climbs the slope;
// letting go, even briefly, lets gravity claw the stone back down. Falling
// past the foot of the slope loses the stone entirely.
import { stepStone, stoneOutcome, STONE_FAIL_THRESHOLD, type StoneMotion } from "./rules.ts";
import { makeSphere, place, raf, rectOf, type FloorContext, type FloorController } from "./shared.ts";

const RAMP_X0 = 0.22;
const RAMP_X1 = 0.78;
const RAMP_Y0 = 0.82;
const RAMP_Y1 = 0.16;
const GROUND_X_MIN = 0.08;

function positionToPoint(position: number): { x: number; y: number } {
  if (position >= 0) {
    const clamped = Math.min(1, position);
    return {
      x: RAMP_X0 + clamped * (RAMP_X1 - RAMP_X0),
      y: RAMP_Y0 + clamped * (RAMP_Y1 - RAMP_Y0),
    };
  }
  // Past the foot of the slope: a flat landing, not a continued plunge along
  // the same diagonal — the stone rolls left on level ground until it either
  // gets pushed back up or rolls off the far edge.
  const clamped = Math.max(STONE_FAIL_THRESHOLD, position);
  const t = clamped / STONE_FAIL_THRESHOLD; // 0 at the foot, 1 at the failing edge
  return { x: RAMP_X0 - t * (RAMP_X0 - GROUND_X_MIN), y: RAMP_Y0 };
}

export function mount(container: HTMLElement, ctx: FloorContext): FloorController {
  const ramp = document.createElement("div");
  ramp.className = "ramp";
  container.appendChild(ramp);

  const ground = document.createElement("div");
  ground.className = "ramp-ground";
  container.appendChild(ground);

  const stone = makeSphere("target");
  stone.classList.add("sphere--stone");
  container.appendChild(stone);

  let motion: StoneMotion = { position: 0, velocity: 0 };
  let pushing = false;
  let resolved = false;

  function setPushing(next: boolean): void {
    pushing = next;
    stone.classList.toggle("sphere--pressed", next);
  }

  function onPointerDown(ev: PointerEvent): void {
    ev.preventDefault();
    setPushing(true);
  }
  function onPointerUp(): void {
    setPushing(false);
  }

  container.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  function onKeyDown(ev: KeyboardEvent): void {
    if (ev.code === "Space" || ev.code === "ArrowUp") setPushing(true);
  }
  function onKeyUp(ev: KeyboardEvent): void {
    if (ev.code === "Space" || ev.code === "ArrowUp") setPushing(false);
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  const stop = raf((dt) => {
    if (resolved) return;
    motion = stepStone(motion, pushing, dt);
    const rect = rectOf(container);
    const { x, y } = positionToPoint(motion.position);
    place(stone, x, y, rect);

    const outcome = stoneOutcome(motion.position);
    if (outcome === "clear") {
      resolved = true;
      stone.classList.add("sphere--pressed");
      window.setTimeout(() => ctx.onClear(), 260);
    } else if (outcome === "fail") {
      resolved = true;
      stone.classList.add("sphere--extinguish");
      window.setTimeout(() => ctx.onFail(), 300);
    }
  });

  return {
    destroy(): void {
      stop();
      container.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      ramp.remove();
      ground.remove();
      stone.remove();
    },
  };
}
