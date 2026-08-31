// Floor 3 — Prometheus carries fire. Three walls of wind stand between the
// cradle and the altar, each cycling windy and calm on its own clock. The
// ember can sit anywhere safely, but crossing a wall while it's windy snuffs
// it out at once — the floor is about timing a crossing, not steering.
import { WIND_WALLS, isWindWallActive } from "./rules.ts";
import { makeSphere, place, raf, rectOf, clamp, type FloorContext, type FloorController } from "./shared.ts";
import { showFloorMyth } from "./caption.ts";

const ALTAR_X = 0.86;
const ALTAR_Y = 0.5;
const ARRIVE_RADIUS = 0.07;
const START_X = 0.12;
const NEAR_RANGE = 0.12;

export function mount(container: HTMLElement, ctx: FloorContext): FloorController {
  const myth = showFloorMyth(container, {
    title: "Prometheus Steals the Fire",
    text: "He stole the flame from the gods, and carried it through the raging wind.",
  });

  const wallEls = WIND_WALLS.map((wall) => {
    const el = document.createElement("div");
    el.className = "wind-wall";
    el.style.left = `${wall.x0 * 100}%`;
    el.style.width = `${(wall.x1 - wall.x0) * 100}%`;
    container.appendChild(el);
    return el;
  });
  const wasActive = WIND_WALLS.map(() => false);

  const altar = makeSphere("ghost");
  altar.classList.add("altar");
  container.appendChild(altar);

  const ember = makeSphere("target");
  ember.classList.add("sphere--ember");
  container.appendChild(ember);

  let x = START_X;
  let y = 0.5;
  let dragging = false;
  let resolved = false;

  ember.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    dragging = true;
    ember.setPointerCapture(ev.pointerId);
  });
  ember.addEventListener("pointermove", (ev) => {
    if (!dragging) return;
    const rect = rectOf(container);
    x = clamp((ev.clientX - rect.left) / rect.width, 0.05, 0.95);
    y = clamp((ev.clientY - rect.top) / rect.height, 0.08, 0.92);
  });
  ember.addEventListener("pointerup", () => {
    dragging = false;
  });
  ember.addEventListener("pointercancel", () => {
    dragging = false;
  });

  const stop = raf((_dt, t) => {
    if (resolved) return;
    const rect = rectOf(container);

    let tilt = 0;
    for (let i = 0; i < WIND_WALLS.length; i++) {
      const wall = WIND_WALLS[i]!;
      const active = isWindWallActive(wall, t);
      wallEls[i]!.classList.toggle("wind-wall--active", active);
      if (active && !wasActive[i]) ctx.onCue?.("wind-rises");
      wasActive[i] = active;

      const within = x >= wall.x0 && x <= wall.x1;
      if (active && within) {
        resolved = true;
        ember.classList.add("sphere--extinguish");
        window.setTimeout(() => ctx.onFail(), 260);
        return;
      }
      if (active) {
        const dist = Math.abs(x - (wall.x0 + wall.x1) / 2);
        if (dist < NEAR_RANGE) tilt += 7 * (1 - dist / NEAR_RANGE);
      }
    }

    place(altar, ALTAR_X, ALTAR_Y, rect);
    place(ember, x, y, rect, `rotate(${clamp(tilt, -12, 12)}deg)`);

    const distToAltar = Math.hypot(x - ALTAR_X, y - ALTAR_Y);
    if (distToAltar <= ARRIVE_RADIUS) {
      resolved = true;
      ember.classList.add("sphere--pressed");
      window.setTimeout(() => ctx.onClear(), 260);
    }
  });

  return {
    destroy(): void {
      stop();
      myth.destroy();
      for (const el of wallEls) el.remove();
      altar.remove();
      ember.remove();
    },
  };
}
