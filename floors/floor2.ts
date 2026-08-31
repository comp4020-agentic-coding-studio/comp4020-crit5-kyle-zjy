// Floor 2 — Hou Yi shoots the suns. Ten suns drift in the dark sky; the
// player must shoot nine down and then hold their nerve — shooting the
// tenth and last is the one way to fail. Success is proven by *not*
// clicking, which is why there's a grace window instead of an instant win.
import { applySunShot, SUN_COUNT } from "./rules.ts";
import { makeSphere, place, raf, onTap, rectOf, clamp, type FloorContext, type FloorController } from "./shared.ts";

interface Sun {
  el: HTMLDivElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
}

const GRACE_MS = 1500;

export function mount(container: HTMLElement, ctx: FloorContext): FloorController {
  const suns: Sun[] = [];
  let remaining = SUN_COUNT;
  let resolved = false;
  let graceTimer: number | null = null;

  for (let i = 0; i < SUN_COUNT; i++) {
    const el = makeSphere("decoy");
    el.classList.add("sphere--sun");
    container.appendChild(el);
    const x = 0.14 + ctx.rng() * 0.72;
    const y = 0.1 + ctx.rng() * 0.5;
    const angle = ctx.rng() * Math.PI * 2;
    const speed = 0.04 + ctx.rng() * 0.05;
    const sun: Sun = {
      el,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alive: true,
    };
    suns.push(sun);
    onTap(el, () => handleShot(sun));
  }

  function handleShot(sun: Sun): void {
    if (resolved || !sun.alive) return;
    const result = applySunShot(remaining);
    sun.alive = false;
    sun.el.classList.add("sphere--extinguish");
    window.setTimeout(() => sun.el.remove(), 260);

    if (result.outcome === "fail") {
      resolved = true;
      if (graceTimer !== null) window.clearTimeout(graceTimer);
      window.setTimeout(() => ctx.onFail(), 260);
      return;
    }

    remaining = result.remaining;
    if (result.outcome === "clear") {
      // Nine are down; one sun is left alive on screen. Clearing the floor
      // now would make the tenth un-clickable, which hides the failure —
      // instead the last sun stays live and dangerous until the grace
      // window elapses on its own.
      const lastSun = suns.find((s) => s.alive);
      lastSun?.el.classList.add("sphere--spared");
      graceTimer = window.setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ctx.onClear();
        }
      }, GRACE_MS);
    }
  }

  const stop = raf((dt) => {
    const rect = rectOf(container);
    for (const sun of suns) {
      if (!sun.alive) continue;
      sun.x += sun.vx * dt;
      sun.y += sun.vy * dt;
      if (sun.x < 0.08 || sun.x > 0.92) sun.vx *= -1;
      if (sun.y < 0.08 || sun.y > 0.68) sun.vy *= -1;
      sun.x = clamp(sun.x, 0.08, 0.92);
      sun.y = clamp(sun.y, 0.08, 0.68);
      place(sun.el, sun.x, sun.y, rect);
    }
  });

  return {
    destroy(): void {
      stop();
      if (graceTimer !== null) window.clearTimeout(graceTimer);
      for (const sun of suns) sun.el.remove();
    },
  };
}
