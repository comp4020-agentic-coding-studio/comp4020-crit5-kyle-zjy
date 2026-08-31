// Floor 6 — Orpheus must not look back. Walking forward is automatic; the
// only thing that can go wrong is where he's actually looking. The mouse
// sets his gaze, decoupled from movement — glance more than 120° off
// forward and hold it, and Eurydice is lost. A few temptations try to pull
// the eye backward; none of them ever block the path itself.
import { gazeAngleDeg, isGazingBackward, stepLookBackTimer, hasLookedBack } from "./rules.ts";
import { makeSphere, place, raf, rectOf, clamp, type FloorContext, type FloorController } from "./shared.ts";
import { showFloorMyth } from "./caption.ts";

const START_X = 0.12;
const EXIT_X = 0.88;
const FORWARD_SPEED = 0.055;
const NUDGE_SPEED = 0.09;
const FOLLOWER_OFFSET = 0.16;

interface Temptation {
  time: number;
  kind: "sound" | "flash" | "vanish" | "light";
}

const TEMPTATIONS: Temptation[] = [
  { time: 2.4, kind: "sound" },
  { time: 5.2, kind: "flash" },
  { time: 8.6, kind: "vanish" },
  { time: 12.4, kind: "light" },
];

export function mount(container: HTMLElement, ctx: FloorContext): FloorController {
  const myth = showFloorMyth(container, {
    title: "Orpheus",
    text: "He led his love out of the underworld. The one condition: never look back before the light.",
  });

  const exit = makeSphere("ghost");
  exit.classList.add("maze-exit");
  container.appendChild(exit);

  const follower = makeSphere("plain");
  follower.classList.add("sphere--follower");
  container.appendChild(follower);

  const walker = makeSphere("target");
  walker.classList.add("sphere--walker");
  container.appendChild(walker);

  const gazeCone = document.createElement("div");
  gazeCone.className = "gaze-cone";
  container.appendChild(gazeCone);

  const flash = document.createElement("div");
  flash.className = "temptation-flash";
  container.appendChild(flash);

  const light = document.createElement("div");
  light.className = "temptation-light";
  container.appendChild(light);

  let x = START_X;
  let y = 0.5;
  let nudge = 0;
  let resolved = false;
  let lookBackMs = 0;
  let temptationIndex = 0;

  const pointer = { x: 0, y: 0, active: false };
  container.addEventListener("pointermove", (ev) => {
    const rect = rectOf(container);
    pointer.x = ev.clientX - rect.left;
    pointer.y = ev.clientY - rect.top;
    pointer.active = true;
  });
  container.addEventListener("pointerleave", () => {
    pointer.active = false;
  });

  function onKeyDown(ev: KeyboardEvent): void {
    if (ev.code === "ArrowUp" || ev.code === "KeyW") nudge = -1;
    if (ev.code === "ArrowDown" || ev.code === "KeyS") nudge = 1;
  }
  function onKeyUp(ev: KeyboardEvent): void {
    if (["ArrowUp", "KeyW", "ArrowDown", "KeyS"].includes(ev.code)) nudge = 0;
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  function triggerTemptation(kind: Temptation["kind"]): void {
    if (kind === "sound") {
      ctx.onCue?.("temptation-whisper");
    } else if (kind === "flash") {
      flash.classList.add("temptation-flash--active");
      window.setTimeout(() => flash.classList.remove("temptation-flash--active"), 260);
    } else if (kind === "vanish") {
      follower.style.transition = "opacity 140ms ease";
      follower.style.opacity = "0";
      window.setTimeout(() => {
        follower.style.opacity = "1";
      }, 220);
    } else {
      light.classList.add("temptation-light--active");
      window.setTimeout(() => light.classList.remove("temptation-light--active"), 500);
    }
  }

  const stop = raf((dt, t) => {
    if (resolved) return;
    const rect = rectOf(container);

    x = Math.min(EXIT_X, x + FORWARD_SPEED * dt);
    y = clamp(y + nudge * NUDGE_SPEED * dt, 0.22, 0.78);

    while (temptationIndex < TEMPTATIONS.length && t >= TEMPTATIONS[temptationIndex]!.time) {
      triggerTemptation(TEMPTATIONS[temptationIndex]!.kind);
      temptationIndex++;
    }

    const playerPx = { x: x * rect.width, y: y * rect.height };
    const gazeDx = pointer.active ? pointer.x - playerPx.x : 1;
    const gazeDy = pointer.active ? pointer.y - playerPx.y : 0;
    const angleDeg = gazeAngleDeg(gazeDx, gazeDy);
    const backward = isGazingBackward(angleDeg);
    lookBackMs = stepLookBackTimer(lookBackMs, backward, dt * 1000);
    walker.classList.toggle("sphere--danger", backward);

    const coneAngle = (Math.atan2(gazeDy, gazeDx) * 180) / Math.PI;
    place(gazeCone, x, y, rect, `rotate(${coneAngle}deg)`);

    const followerX = Math.max(START_X, x - FOLLOWER_OFFSET);
    place(follower, followerX, y, rect);
    place(walker, x, y, rect);
    place(exit, EXIT_X, 0.5, rect);

    if (hasLookedBack(lookBackMs)) {
      resolved = true;
      walker.classList.add("sphere--extinguish");
      window.setTimeout(() => ctx.onFail(), 300);
      return;
    }

    if (x >= EXIT_X) {
      resolved = true;
      walker.classList.add("sphere--pressed");
      window.setTimeout(() => ctx.onClear(), 260);
    }
  });

  return {
    destroy(): void {
      stop();
      myth.destroy();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      exit.remove();
      follower.remove();
      walker.remove();
      gazeCone.remove();
      flash.remove();
      light.remove();
    },
  };
}
