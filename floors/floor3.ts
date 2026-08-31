// Floor 3 — Prometheus carries fire. A fragile ember must be dragged from
// its cradle to the altar; a band of wind across the middle drains it while
// it lingers there, and recovers it once clear. The whole floor is about
// careful, continuous movement rather than a single decisive input.
import { stepFlame } from "./rules.ts";
import { makeSphere, place, raf, rectOf, clamp, type FloorContext, type FloorController } from "./shared.ts";

const HAZARD_X0 = 0.38;
const HAZARD_X1 = 0.62;
const ALTAR_X = 0.86;
const ALTAR_Y = 0.5;
const ARRIVE_RADIUS = 0.07;

export function mount(container: HTMLElement, ctx: FloorContext): FloorController {
  const hazard = document.createElement("div");
  hazard.className = "hazard hazard--wind";
  hazard.style.left = `${HAZARD_X0 * 100}%`;
  hazard.style.width = `${(HAZARD_X1 - HAZARD_X0) * 100}%`;
  container.appendChild(hazard);

  const altar = makeSphere("ghost");
  altar.classList.add("altar");
  container.appendChild(altar);

  const ember = makeSphere("target");
  ember.classList.add("sphere--ember");
  container.appendChild(ember);

  let x = 0.12;
  let y = 0.5;
  let strength = 1;
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

  const stop = raf((dt) => {
    if (resolved) return;
    const rect = rectOf(container);
    const inHazard = x >= HAZARD_X0 && x <= HAZARD_X1;
    strength = stepFlame(strength, inHazard, dt);

    place(altar, ALTAR_X, ALTAR_Y, rect);
    place(ember, x, y, rect);
    const scale = 0.55 + strength * 0.55;
    ember.style.setProperty("--breath", String(scale));
    ember.style.opacity = String(0.35 + strength * 0.65);

    if (strength <= 0) {
      resolved = true;
      ember.classList.add("sphere--extinguish");
      window.setTimeout(() => ctx.onFail(), 320);
      return;
    }

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
      hazard.remove();
      altar.remove();
      ember.remove();
    },
  };
}
