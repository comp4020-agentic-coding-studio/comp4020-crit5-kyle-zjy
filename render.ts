// Presentation only: turns a GameState into DOM, animates it every frame, and
// reports raw presses back to main.ts. No game rules live here — game.ts
// stays testable without a DOM.
import type { ButtonBehaviour, ButtonEntity, GameState } from "./game.ts";

export interface RendererCallbacks {
  onPress: (id: string) => void;
  onFirstGesture: () => void;
}

interface MountedButton {
  entity: ButtonEntity;
  el: HTMLButtonElement;
  highlightEl: HTMLSpanElement;
  /** Current animated position, in px, relative to the arena. */
  cx: number;
  cy: number;
  /** Target position, in px, derived from the entity's normalised x/y. */
  tx: number;
  ty: number;
  /** 0 at rest, springs toward 1 on press and decays back down. */
  pressT: number;
  /** 0..1 entrance progress for a freshly spawned decoy. */
  spawnT: number;
  /** Once true, the rAF loop stops touching this element (the win/lose
   *  sequence drives it directly with its own CSS transitions instead). */
  frozen: boolean;
}

const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

function motionScale(): number {
  return reducedMotionQuery.matches ? 0.12 : 1;
}

function springFactor(): number {
  return reducedMotionQuery.matches ? 0.6 : 0.1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const STAGE_SIZE_FACTOR = [0, 0, 0.34, 0.3, 0.27, 0.24, 0.2, 0.17, 0.15];

function buttonDiameter(stage: number, shortSide: number): number {
  if (stage <= 1) return clamp(shortSide * 0.42, 180, 260);
  const factor = STAGE_SIZE_FACTOR[stage] ?? 0.15;
  return clamp(shortSide * factor * 0.78, 44, 200);
}

function easeOutBack(x: number): number {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

function buildButtonDom(id: string): { el: HTMLButtonElement; highlightEl: HTMLSpanElement } {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "obtn";
  el.dataset["id"] = id;

  const face = document.createElement("span");
  face.className = "obtn-face";

  const highlight = document.createElement("span");
  highlight.className = "obtn-highlight";
  face.appendChild(highlight);
  el.appendChild(face);

  return { el, highlightEl: highlight };
}

export function createRenderer(arena: HTMLElement, callbacks: RendererCallbacks) {
  const mounted = new Map<string, MountedButton>();
  const pointerTilt = new Map<string, { tiltX: number; tiltY: number; magX: number; magY: number }>();
  const pointer = { x: -9999, y: -9999, active: false };
  const clockStart = performance.now();
  let currentStage = 0;
  let armedGesture = false;

  function arenaRect(): DOMRect {
    return arena.getBoundingClientRect();
  }

  function toPx(entity: ButtonEntity, rect: DOMRect): { x: number; y: number } {
    return { x: entity.x * rect.width, y: entity.y * rect.height };
  }

  function primeGesture(): void {
    if (armedGesture) return;
    armedGesture = true;
    callbacks.onFirstGesture();
  }

  function mountButton(entity: ButtonEntity, rect: DOMRect, spawnFrom?: { x: number; y: number }): void {
    const { el, highlightEl } = buildButtonDom(entity.id);
    const target = toPx(entity, rect);
    const start = spawnFrom ?? target;

    const m: MountedButton = {
      entity,
      el,
      highlightEl,
      cx: start.x,
      cy: start.y,
      tx: target.x,
      ty: target.y,
      pressT: 0,
      spawnT: spawnFrom ? 0 : 1,
      frozen: false,
    };

    el.addEventListener("pointerdown", (event) => {
      primeGesture();
      m.pressT = 1;
      el.setPointerCapture(event.pointerId);
    });
    el.addEventListener("pointerup", () => callbacks.onPress(entity.id));
    el.addEventListener("pointercancel", () => {
      m.pressT = 0;
    });

    arena.appendChild(el);
    mounted.set(entity.id, m);
  }

  function unmountButton(m: MountedButton): void {
    m.frozen = true;
    mounted.delete(m.entity.id);
    m.el.style.transition = "transform 380ms cubic-bezier(.4,0,.6,1), opacity 340ms ease-out";
    requestAnimationFrame(() => {
      m.el.style.opacity = "0";
      m.el.style.transform = `translate3d(${m.cx}px, ${m.cy}px, 0) translate(-50%, -50%) scale(0)`;
    });
    window.setTimeout(() => m.el.remove(), 420);
  }

  function syncButtons(state: GameState, stage: number): void {
    currentStage = stage;
    const rect = arenaRect();
    const seen = new Set<string>();
    const target = state.buttons.find((b) => b.isTarget);
    const targetMounted = target ? mounted.get(target.id) : undefined;

    for (const entity of state.buttons) {
      seen.add(entity.id);
      const existing = mounted.get(entity.id);
      if (existing) {
        existing.entity = entity;
        const pos = toPx(entity, rect);
        existing.tx = pos.x;
        existing.ty = pos.y;
        continue;
      }
      // A brand-new decoy visually splits off from wherever the authentic
      // button currently sits, tying the duplication to its source instead
      // of appearing out of nowhere.
      const spawnFrom = !entity.isTarget && targetMounted ? { x: targetMounted.cx, y: targetMounted.cy } : undefined;
      mountButton(entity, rect, spawnFrom);
    }

    for (const [id, m] of mounted) {
      if (!seen.has(id)) unmountButton(m);
    }
  }

  // Deliberately keyed off the behaviour flags, never off `entity.isTarget`
  // directly — the authentic button must never carry a CSS hook that gives
  // away the answer. Its identity is only ever the sum of these cues.
  function applyBehaviourClasses(m: MountedButton, behaviour: ButtonBehaviour): void {
    m.el.classList.toggle("obtn--breathing", behaviour.breathing);
    m.el.classList.toggle("obtn--highlight", behaviour.highlight);
  }

  function tick(now: number): void {
    requestAnimationFrame(tick);
    const t = (now - clockStart) / 1000;
    const rect = arenaRect();
    const shortSide = Math.min(rect.width, rect.height);
    const size = buttonDiameter(currentStage, shortSide);
    const scaleAmp = 0.028 * motionScale();
    const tiltMax = 9 * motionScale();
    const magnetMax = 10 * motionScale();
    const spring = springFactor();

    for (const m of mounted.values()) {
      if (m.frozen) continue;
      applyBehaviourClasses(m, m.entity.behaviour);
      m.el.style.setProperty("--size", `${size}px`);

      m.spawnT = Math.min(1, m.spawnT + 0.06);
      m.pressT += (0 - m.pressT) * 0.22;

      const posSpring = m.entity.isTarget ? spring * 0.9 : spring;
      m.cx += (m.tx - m.cx) * posSpring;
      m.cy += (m.ty - m.cy) * posSpring;

      let scale = 1;
      if (m.entity.behaviour.breathing) {
        scale += scaleAmp * Math.sin(2 * Math.PI * (t / 4.2 + m.entity.behaviour.breathPhase));
      }

      let tiltX = 0;
      let tiltY = 0;
      let magX = 0;
      let magY = 0;
      const quality = m.entity.behaviour.pointerQuality;
      if (pointer.active && quality !== "none") {
        const dx = pointer.x - m.cx;
        const dy = pointer.y - m.cy;
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

        const wantTiltX = -ny * tiltMax * influence * mult * invert;
        const wantTiltY = nx * tiltMax * influence * mult * invert;
        const wantMagX = nx * magnetMax * influence * mult * invert;
        const wantMagY = ny * magnetMax * influence * mult * invert;

        const prev = pointerTilt.get(m.entity.id) ?? { tiltX: 0, tiltY: 0, magX: 0, magY: 0 };
        tiltX = prev.tiltX + (wantTiltX - prev.tiltX) * follow;
        tiltY = prev.tiltY + (wantTiltY - prev.tiltY) * follow;
        magX = prev.magX + (wantMagX - prev.magX) * follow;
        magY = prev.magY + (wantMagY - prev.magY) * follow;
        pointerTilt.set(m.entity.id, { tiltX, tiltY, magX, magY });
      } else {
        pointerTilt.delete(m.entity.id);
      }

      if (m.entity.behaviour.highlight) {
        const hz = m.entity.behaviour.highlightSpeed;
        const pos = ((t * hz) / 2.6 + m.entity.behaviour.highlightPhase) % 1;
        m.highlightEl.style.backgroundPosition = `${pos * 140 - 20}% 40%`;
        m.highlightEl.style.opacity = "1";
      } else {
        m.highlightEl.style.opacity = "0";
      }

      const spawnScale = 0.3 + 0.7 * easeOutBack(m.spawnT);
      const pressScale = 1 - m.pressT * 0.1;
      const finalScale = scale * spawnScale * pressScale;
      const lift = clamp(10 * (1 - m.pressT * 0.75) * (0.85 + (scale - 1) * 6), 1, 16);
      m.el.style.setProperty("--lift", `${lift}px`);
      m.el.style.opacity = m.spawnT < 1 ? `${m.spawnT}` : "1";
      m.el.style.transform = [
        `translate3d(${m.cx}px, ${m.cy}px, 0)`,
        "translate(-50%, -50%)",
        `translate(${magX}px, ${magY}px)`,
        `rotateX(${tiltX}deg)`,
        `rotateY(${tiltY}deg)`,
        `scale(${finalScale})`,
      ].join(" ");
    }
  }

  arena.addEventListener("pointermove", (event) => {
    const rect = arenaRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.active = true;
  });
  arena.addEventListener("pointerleave", () => {
    pointer.active = false;
  });

  window.addEventListener("resize", () => {
    const rect = arenaRect();
    for (const m of mounted.values()) {
      const pos = toPx(m.entity, rect);
      m.tx = pos.x;
      m.ty = pos.y;
    }
  });

  requestAnimationFrame(tick);

  function playWinEnding(): Promise<void> {
    return new Promise((resolve) => {
      const rect = arenaRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const all = [...mounted.values()];
      const target = all.find((m) => m.entity.isTarget);
      const decoys = all.filter((m) => !m.entity.isTarget);

      for (const m of decoys) {
        m.frozen = true;
        m.el.style.transition = "transform 480ms cubic-bezier(.5,0,.75,0), opacity 420ms ease-in";
        requestAnimationFrame(() => {
          m.el.style.transform = `translate3d(${m.cx}px, ${m.cy}px, 0) translate(-50%, -50%) scale(0)`;
          m.el.style.opacity = "0";
        });
        window.setTimeout(() => m.el.remove(), 500);
      }
      mounted.clear();

      if (!target) {
        resolve();
        return;
      }
      mounted.set(target.entity.id, target);
      target.frozen = true;
      target.el.style.transition = "transform 620ms cubic-bezier(.2,.8,.2,1)";
      requestAnimationFrame(() => {
        target.el.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%) scale(1.05)`;
      });
      window.setTimeout(() => {
        target.el.classList.add("obtn--sunk");
        target.el.style.transition = "transform 700ms cubic-bezier(.7,0,.3,1), opacity 700ms ease-in";
        target.el.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%) scale(0.82) translateY(6px)`;
        target.el.style.opacity = "0.28";
        window.setTimeout(resolve, 720);
      }, 640);
    });
  }

  function playLoseEnding(): Promise<void> {
    return new Promise((resolve) => {
      const all = [...mounted.values()];
      for (const m of all) m.el.classList.add("obtn--overwhelm");
      window.setTimeout(() => {
        for (const m of all) {
          m.frozen = true;
          m.el.style.transition = "opacity 480ms ease-out, filter 480ms ease-out";
          m.el.style.opacity = "0";
          m.el.style.filter = "blur(3px)";
        }
        window.setTimeout(resolve, 520);
      }, 420);
    });
  }

  return {
    render(state: GameState, stage: number): void {
      syncButtons(state, stage);
    },
    playEnding(status: "won" | "lost"): Promise<void> {
      return status === "won" ? playWinEnding() : playLoseEnding();
    },
    pulseCorrect(id: string): void {
      const m = mounted.get(id);
      if (!m) return;
      m.el.classList.add("obtn--correct");
      window.setTimeout(() => m.el.classList.remove("obtn--correct"), 260);
    },
    pulseInvalid(id: string): void {
      const m = mounted.get(id);
      if (!m) return;
      m.el.classList.add("obtn--invalid");
      window.setTimeout(() => m.el.classList.remove("obtn--invalid"), 260);
    },
    setDamage(mistakes: number): void {
      arena.dataset["damage"] = String(mistakes);
    },
    shake(): void {
      arena.classList.add("arena--shake");
      window.setTimeout(() => arena.classList.remove("arena--shake"), 320);
    },
    reset(): void {
      for (const m of mounted.values()) m.el.remove();
      mounted.clear();
      pointerTilt.clear();
      arena.classList.remove("arena--shake");
      arena.dataset["damage"] = "0";
    },
  };
}

export type Renderer = ReturnType<typeof createRenderer>;
