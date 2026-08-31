// Floor 5 — Icarus flies too high. The sphere's altitude eases toward the
// pointer; a safe corridor drifts slowly between the sun above and the sea
// below. Straying out of it for too long burns or drowns; holding the
// corridor for the full flight clears the floor.
import { bandCenterAt, isWithinBand, clamp } from "./rules.ts";
import { makeSphere, place, raf, rectOf, type FloorContext, type FloorController } from "./shared.ts";

const BAND_HALF_WIDTH = 0.14;
const OUTSIDE_LIMIT = 0.75;
const SURVIVE_SECONDS = 16;

export function mount(container: HTMLElement, ctx: FloorContext): FloorController {
  const corridor = document.createElement("div");
  corridor.className = "corridor";
  container.appendChild(corridor);

  const bird = makeSphere("target");
  bird.classList.add("sphere--bird");
  container.appendChild(bird);

  let altitude = 0.5;
  let targetAltitude = 0.5;
  let outsideTime = 0;
  let resolved = false;

  function onPointerMove(ev: PointerEvent): void {
    const rect = rectOf(container);
    targetAltitude = clamp((ev.clientY - rect.top) / rect.height, 0.04, 0.96);
  }
  container.addEventListener("pointermove", onPointerMove);

  const stop = raf((dt, t) => {
    if (resolved) return;
    const rect = rectOf(container);
    altitude += (targetAltitude - altitude) * Math.min(1, dt * 3.2);

    const center = bandCenterAt(t);
    corridor.style.top = `${(center - BAND_HALF_WIDTH) * 100}%`;
    corridor.style.height = `${BAND_HALF_WIDTH * 2 * 100}%`;
    place(bird, 0.5, altitude, rect);

    const safe = isWithinBand(altitude, center, BAND_HALF_WIDTH);
    bird.classList.toggle("sphere--danger", !safe);
    outsideTime = safe ? 0 : outsideTime + dt;

    if (outsideTime >= OUTSIDE_LIMIT) {
      resolved = true;
      bird.classList.add("sphere--extinguish");
      window.setTimeout(() => ctx.onFail(), 300);
      return;
    }

    if (t >= SURVIVE_SECONDS) {
      resolved = true;
      bird.classList.add("sphere--pressed");
      window.setTimeout(() => ctx.onClear(), 260);
    }
  });

  return {
    destroy(): void {
      stop();
      container.removeEventListener("pointermove", onPointerMove);
      corridor.remove();
      bird.remove();
    },
  };
}
