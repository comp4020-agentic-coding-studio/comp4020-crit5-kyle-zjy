// Floor 8 — the true and false Monkey King. Several near-identical spheres
// share the stage; only one answers the pointer's approach honestly. This
// is the old game's entire mechanic, re-skinned into myth — the pointer
// deception toolkit is a direct reuse of render.ts's original system.
import { placeButtons } from "../placement.ts";
import { pickTrue } from "./rules.ts";
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

const COUNT = 5;
const QUALITIES: PointerQuality[] = ["authentic", "delayed", "exaggerated", "mirrored", "none"];

interface Figure {
  id: string;
  el: HTMLDivElement;
  x: number;
  y: number;
  bobPhase: number;
  deceiver: ReturnType<typeof createDeceiver>;
}

export function mount(container: HTMLElement, ctx: FloorContext): FloorController {
  const positions = placeButtons({ count: COUNT, minDistance: 0.24, margin: 0.14, rng: ctx.rng });
  const trueIndex = Math.floor(ctx.rng() * COUNT);
  const figures: Figure[] = [];
  const pointer = { x: -9999, y: -9999, active: false };
  let resolved = false;

  for (let i = 0; i < COUNT; i++) {
    const isTrue = i === trueIndex;
    const el = makeSphere(isTrue ? "target" : "decoy");
    el.classList.add("sphere--figure");
    container.appendChild(el);
    const quality = isTrue ? "authentic" : QUALITIES[1 + (i % (QUALITIES.length - 1))]!;
    const figure: Figure = {
      id: `figure-${i}`,
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

  function handlePick(figure: Figure): void {
    if (resolved) return;
    resolved = true;
    const outcome = pickTrue(figure.id, trueId);
    for (const f of figures) f.el.classList.add(f.id === figure.id ? "sphere--pressed" : "sphere--extinguish");
    if (outcome === "clear") window.setTimeout(() => ctx.onClear(), 280);
    else window.setTimeout(() => ctx.onFail(), 280);
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

  const stop = raf((_dt, t) => {
    const rect = rectOf(container);
    const size = Math.min(rect.width, rect.height) * 0.14;
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
  });

  return {
    destroy(): void {
      stop();
      for (const f of figures) f.el.remove();
    },
  };
}
