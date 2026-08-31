// Floor 9 — the final trial. Everything learned is tested at once: first
// discern the true sphere among decoys (Floor 8's mechanic), then escort it
// by hand (Floor 3's mechanic) through a corridor that narrows like Floor
// 5's safe band, past obstacles it must not touch. One composite challenge,
// not nine floors stitched together.
import { placeButtons } from "../placement.ts";
import { pickTrue, isInsideCorridor, collidesWithObstacle, clamp } from "./rules.ts";
import {
  makeSphere,
  place,
  raf,
  onTap,
  rectOf,
  createDeceiver,
  type PointerQuality,
  type FloorContext,
  type FloorController,
} from "./shared.ts";

const DISCERN_COUNT = 4;
const QUALITIES: PointerQuality[] = ["delayed", "exaggerated", "mirrored"];

const START_X = 0.1;
const EXIT_X = 0.9;
const CORRIDOR_START_HALF = 0.24;
const CORRIDOR_END_HALF = 0.09;
const OBSTACLES = [
  { x: 0.42, y: 0.42, r: 0.055 },
  { x: 0.63, y: 0.58, r: 0.06 },
];

interface Figure {
  id: string;
  el: HTMLDivElement;
  x: number;
  y: number;
  bobPhase: number;
  deceiver: ReturnType<typeof createDeceiver>;
}

function corridorHalfWidthAt(x: number): number {
  const progress = clamp((x - START_X) / (EXIT_X - START_X), 0, 1);
  return CORRIDOR_START_HALF + (CORRIDOR_END_HALF - CORRIDOR_START_HALF) * progress;
}

export function mount(container: HTMLElement, ctx: FloorContext): FloorController {
  const positions = placeButtons({ count: DISCERN_COUNT, minDistance: 0.26, margin: 0.16, rng: ctx.rng });
  const trueIndex = Math.floor(ctx.rng() * DISCERN_COUNT);
  const figures: Figure[] = [];
  const pointer = { x: -9999, y: -9999, active: false };
  let phase: "discern" | "escort" | "done" = "discern";
  let stopped = false;

  for (let i = 0; i < DISCERN_COUNT; i++) {
    const isTrue = i === trueIndex;
    const el = makeSphere(isTrue ? "target" : "decoy");
    el.classList.add("sphere--figure");
    container.appendChild(el);
    const quality: PointerQuality = isTrue ? "authentic" : QUALITIES[i % QUALITIES.length]!;
    const figure: Figure = {
      id: `final-${i}`,
      el,
      x: positions[i]!.x,
      y: positions[i]!.y,
      bobPhase: ctx.rng() * Math.PI * 2,
      deceiver: createDeceiver(quality),
    };
    figures.push(figure);
    onTap(el, () => handlePick(figure));
  }
  const trueId = figures[trueIndex]!.id;

  function fail(el: HTMLElement): void {
    if (phase === "done") return;
    phase = "done";
    el.classList.add("sphere--extinguish");
    window.setTimeout(() => ctx.onFail(), 300);
  }

  function handlePick(figure: Figure): void {
    if (phase !== "discern") return;
    const outcome = pickTrue(figure.id, trueId);
    for (const f of figures) {
      if (f.id === figure.id) continue;
      f.el.classList.add("sphere--extinguish");
      window.setTimeout(() => f.el.remove(), 260);
    }
    if (outcome === "fail") {
      fail(figure.el);
      return;
    }
    phase = "escort";
    figure.el.classList.remove("sphere--decoy");
    figure.el.classList.add("sphere--target", "sphere--ember");
    beginEscort(figure);
  }

  container.addEventListener("pointermove", (ev) => {
    const rect = rectOf(container);
    pointer.x = ev.clientX - rect.left;
    pointer.y = ev.clientY - rect.top;
    pointer.active = true;
  });
  container.addEventListener("pointerleave", () => {
    pointer.active = false;
  });

  let corridorEls: HTMLDivElement[] = [];
  let obstacleEls: HTMLDivElement[] = [];
  let altar: HTMLDivElement | null = null;

  function beginEscort(figure: Figure): void {
    figure.x = START_X;
    figure.y = 0.5;

    const top = document.createElement("div");
    top.className = "corridor-wall corridor-wall--top";
    const bottom = document.createElement("div");
    bottom.className = "corridor-wall corridor-wall--bottom";
    container.insertBefore(top, figure.el);
    container.insertBefore(bottom, figure.el);
    corridorEls = [top, bottom];

    obstacleEls = OBSTACLES.map((o) => {
      const el = makeSphere("ghost");
      el.classList.add("obstacle");
      el.style.width = `${o.r * 2 * 100}%`;
      container.insertBefore(el, figure.el);
      return el;
    });

    altar = makeSphere("ghost") as HTMLDivElement;
    altar.classList.add("altar");
    container.insertBefore(altar, figure.el);

    let dragging = false;
    figure.el.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      dragging = true;
      figure.el.setPointerCapture(ev.pointerId);
    });
    figure.el.addEventListener("pointermove", (ev) => {
      if (!dragging) return;
      const rect = rectOf(container);
      figure.x = clamp((ev.clientX - rect.left) / rect.width, 0.04, 0.96);
      figure.y = clamp((ev.clientY - rect.top) / rect.height, 0.06, 0.94);
    });
    figure.el.addEventListener("pointerup", () => {
      dragging = false;
    });
  }

  const stop = raf((_dt, t) => {
    const rect = rectOf(container);

    if (phase === "discern") {
      const size = Math.min(rect.width, rect.height) * 0.13;
      for (const figure of figures) {
        const bobX = figure.x + 0.01 * Math.sin(t * 0.5 + figure.bobPhase);
        const bobY = figure.y + 0.012 * Math.cos(t * 0.42 + figure.bobPhase);
        const cx = bobX * rect.width;
        const cy = bobY * rect.height;
        const { tiltX, tiltY, magX, magY } = figure.deceiver.update(cx, cy, size, pointer);
        place(
          figure.el,
          bobX,
          bobY,
          rect,
          `translate(${magX}px, ${magY}px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
        );
      }
      return;
    }

    if (phase !== "escort") return;
    const figure = figures[trueIndex]!;
    const centerY = 0.5;
    const halfWidth = corridorHalfWidthAt(figure.x);
    const [top, bottom] = corridorEls;
    if (top && bottom) {
      top.style.height = `${(centerY - halfWidth) * 100}%`;
      bottom.style.top = `${(centerY + halfWidth) * 100}%`;
      bottom.style.height = `${(1 - (centerY + halfWidth)) * 100}%`;
    }
    for (let i = 0; i < OBSTACLES.length; i++) {
      const o = OBSTACLES[i]!;
      place(obstacleEls[i]!, o.x, o.y, rect);
    }
    if (altar) place(altar, EXIT_X, centerY, rect);
    place(figure.el, figure.x, figure.y, rect);

    const safe = isInsideCorridor(figure.y, centerY, halfWidth);
    figure.el.classList.toggle("sphere--danger", !safe);
    if (!safe) {
      fail(figure.el);
      return;
    }
    for (const o of OBSTACLES) {
      if (collidesWithObstacle(figure.x, figure.y, o.x, o.y, o.r)) {
        fail(figure.el);
        return;
      }
    }

    if (figure.x >= EXIT_X) {
      phase = "done";
      figure.el.classList.add("sphere--pressed");
      window.setTimeout(() => ctx.onClear(), 280);
    }
  });

  return {
    destroy(): void {
      if (stopped) return;
      stopped = true;
      stop();
      for (const f of figures) f.el.remove();
      for (const el of corridorEls) el.remove();
      for (const el of obstacleEls) el.remove();
      altar?.remove();
    },
  };
}
