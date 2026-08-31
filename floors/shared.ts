// Presentation toolkit shared across floor1.ts..floor9.ts. No game rules
// live here (those are in rules.ts) — this is purely DOM/animation plumbing
// so each floor module can stay focused on its own mechanic.
import { clamp } from "./rules.ts";

export interface FloorContext {
  /** Deterministic rng for this run, same contract as game.ts's old Rng. */
  rng: () => number;
  onClear: () => void;
  onFail: () => void;
  /** Fire-and-forget audio cue, wired by main.ts. */
  onCue?: (cue: string) => void;
}

export interface FloorController {
  destroy(): void;
}

export type SphereKind = "target" | "decoy" | "plain" | "ghost";

export function makeSphere(kind: SphereKind = "plain"): HTMLDivElement {
  const el = document.createElement("div");
  el.className = `sphere sphere--${kind}`;
  return el;
}

export function rectOf(el: HTMLElement): DOMRect {
  return el.getBoundingClientRect();
}

/** Position an element by normalised [0,1] coordinates within `rect`. */
export function place(el: HTMLElement, xNorm: number, yNorm: number, rect: DOMRect, extra = ""): void {
  el.style.transform = `translate3d(${xNorm * rect.width}px, ${yNorm * rect.height}px, 0) translate(-50%, -50%) ${extra}`;
}

/**
 * Run `step` every animation frame until the returned function is called.
 * `t` is seconds since the loop started, `dt` is clamped so a tab coming
 * back from the background doesn't apply a huge single step.
 */
export function raf(step: (dt: number, t: number) => void): () => void {
  let running = true;
  let last = performance.now();
  const start = last;
  let handle = 0;

  function frame(now: number): void {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(dt, (now - start) / 1000);
    handle = requestAnimationFrame(frame);
  }

  handle = requestAnimationFrame(frame);
  return () => {
    running = false;
    cancelAnimationFrame(handle);
  };
}

/** Unified press handling for mouse/touch/pen, mirroring the old renderer. */
export function onTap(el: HTMLElement, handler: (ev: PointerEvent) => void): void {
  el.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    handler(ev);
  });
}

// ---------- pointer-deception, lifted from the old render.ts ----------
// Floor 8 ("True and False Monkey King") and Floor 9's discern leg are this
// mechanic re-skinned into myth: every decoy imitates the true sphere's
// pointer response with one deliberate flaw.
export type PointerQuality =
  | "authentic"
  | "delayed"
  | "exaggerated"
  | "mirrored"
  | "none"
  | "panic"
  | "orbit"
  | "pulse";

export interface PointerState {
  x: number;
  y: number;
  active: boolean;
}

export interface Deception {
  tiltX: number;
  tiltY: number;
  magX: number;
  magY: number;
  /** Uniform scale multiplier, 1 = resting size. Only "pulse" moves this. */
  scale?: number;
}

export function createDeceiver(quality: PointerQuality) {
  let tiltX = 0;
  let tiltY = 0;
  let magX = 0;
  let magY = 0;
  let orbitAngle = 0;
  let panicBounce = 0;
  let wasNear = false;
  let pulsePhase = 0;
  let scale = 1;

  return {
    update(cx: number, cy: number, size: number, pointer: PointerState, dt = 1 / 60): Deception {
      if (!pointer.active || quality === "none") {
        tiltX = tiltY = magX = magY = 0;
        panicBounce = 0;
        wasNear = false;
        pulsePhase = 0;
        scale += (1 - scale) * 0.2;
        return { tiltX, tiltY, magX, magY, scale };
      }

      const dx = pointer.x - cx;
      const dy = pointer.y - cy;
      const dist = Math.hypot(dx, dy);
      const radius = size * 2.4;
      const influence = clamp(1 - dist / radius, 0, 1) ** 1.6;
      const nx = dist > 0 ? dx / dist : 0;
      const ny = dist > 0 ? dy / dist : 0;

      let follow = 1;
      let mult = 1;
      let invert = 1;
      if (quality === "delayed") follow = 0.35;
      if (quality === "exaggerated") mult = 1.9;
      if (quality === "mirrored") invert = -1;
      if (quality === "panic") {
        follow = 1;
        mult = 2.2;
        invert = -1;
      }

      const tiltMax = 9;
      const magnetMax = 10;
      let wantTiltX = -ny * tiltMax * influence * mult * invert;
      let wantTiltY = nx * tiltMax * influence * mult * invert;
      let wantMagX = nx * magnetMax * influence * mult * invert;
      let wantMagY = ny * magnetMax * influence * mult * invert;

      if (quality === "panic") {
        // A short, decaying flinch fired the instant the pointer swings close,
        // on top of the steady flee — reads as startled, not just repelled.
        const near = influence > 0.5;
        if (near && !wasNear) panicBounce = 1;
        wasNear = near;
        panicBounce *= Math.exp(-dt * 8);
        wantMagX -= nx * magnetMax * 1.8 * panicBounce;
        wantMagY -= ny * magnetMax * 1.8 * panicBounce;
        const boundary = magnetMax * 3.2;
        wantMagX = clamp(wantMagX, -boundary, boundary);
        wantMagY = clamp(wantMagY, -boundary, boundary);
      }

      if (quality === "orbit") {
        orbitAngle += dt * 2.6;
        const orbitRadius = size * 0.9;
        wantMagX = (dx + Math.cos(orbitAngle) * orbitRadius) * influence;
        wantMagY = (dy + Math.sin(orbitAngle) * orbitRadius) * influence;
        wantTiltX = -ny * tiltMax * influence;
        wantTiltY = nx * tiltMax * influence;
      }

      tiltX += (wantTiltX - tiltX) * follow;
      tiltY += (wantTiltY - tiltY) * follow;
      magX += (wantMagX - magX) * follow;
      magY += (wantMagY - magY) * follow;

      if (quality === "pulse") {
        pulsePhase += dt * (0.6 + influence * 1.1);
        const frac = pulsePhase % 1;
        let wantScale: number;
        if (frac < 0.25) wantScale = 1 + 0.25 * (frac / 0.25);
        else if (frac < 0.5) wantScale = 1.25 - 0.3 * ((frac - 0.25) / 0.25);
        else if (frac < 0.75) wantScale = 0.95 + 0.05 * ((frac - 0.5) / 0.25);
        else wantScale = 1;
        scale += (1 + (wantScale - 1) * influence - scale) * 0.5;
      } else {
        scale += (1 - scale) * 0.2;
      }

      return { tiltX, tiltY, magX, magY, scale };
    },
  };
}

export { clamp };
