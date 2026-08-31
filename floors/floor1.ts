// Floor 1 — Awakening / first touch. The first lesson: a white sphere is
// interactive. Deliberately trivial; it establishes the visual language
// every later floor builds on.
import { makeSphere, place, raf, onTap, rectOf, type FloorContext, type FloorController } from "./shared.ts";
import { showFloorMyth } from "./caption.ts";

export function mount(container: HTMLElement, ctx: FloorContext): FloorController {
  const myth = showFloorMyth(container, {
    title: "Awakening",
    text: "Everything begins with a first touch.",
  });
  const sphere = makeSphere("target");
  sphere.classList.add("sphere--breathe");
  container.appendChild(sphere);
  let cleared = false;

  const stop = raf((_dt, t) => {
    const rect = rectOf(container);
    place(sphere, 0.5, 0.5, rect);
    sphere.style.setProperty("--breath", String(1 + 0.035 * Math.sin(t * 1.3)));
  });

  onTap(sphere, () => {
    if (cleared) return;
    cleared = true;
    sphere.classList.add("sphere--pressed");
    window.setTimeout(() => ctx.onClear(), 200);
  });

  return {
    destroy(): void {
      stop();
      myth.destroy();
      sphere.remove();
    },
  };
}
