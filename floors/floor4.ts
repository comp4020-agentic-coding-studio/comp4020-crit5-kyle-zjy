// Floor 4 — Sisyphus pushes the stone. There is no holding on: a single
// charge decides the whole throw. Land it in the pale band near the crest
// and the stone stays; anything short or over sends it rolling back to the
// foot to try again. Nothing here can be failed outright — only retried.
import {
  stepStone,
  chargeOutcome,
  launchVelocityForCharge,
  TARGET_ZONE_MIN,
  TARGET_ZONE_MAX,
  STONE_FAIL_THRESHOLD,
  type StoneMotion,
  type ChargeOutcome,
} from "./rules.ts";
import { makeSphere, place, raf, rectOf, type FloorContext, type FloorController } from "./shared.ts";
import { showFloorMyth } from "./caption.ts";

const RAMP_X0 = 0.22;
const RAMP_X1 = 0.78;
const RAMP_Y0 = 0.82;
const RAMP_Y1 = 0.16;
const GROUND_X_MIN = 0.08;
const CHARGE_SECONDS = 1.1;
const SETTLE_VELOCITY = 0.02;
const LAUNCH_START_POSITION = 0.001;

function positionToPoint(position: number): { x: number; y: number } {
  if (position >= 0) {
    const clamped = Math.min(1, position);
    return {
      x: RAMP_X0 + clamped * (RAMP_X1 - RAMP_X0),
      y: RAMP_Y0 + clamped * (RAMP_Y1 - RAMP_Y0),
    };
  }
  // Past the foot of the slope: a flat landing, not a continued plunge along
  // the same diagonal — the stone rolls left on level ground while it
  // settles under friction before the next attempt.
  const clamped = Math.max(STONE_FAIL_THRESHOLD, position);
  const t = clamped / STONE_FAIL_THRESHOLD; // 0 at the foot, 1 at the visual floor
  return { x: RAMP_X0 - t * (RAMP_X0 - GROUND_X_MIN), y: RAMP_Y0 };
}

type Phase = "ready" | "charging" | "rolling";

export function mount(container: HTMLElement, ctx: FloorContext): FloorController {
  const myth = showFloorMyth(container, {
    title: "Sisyphus",
    text: "The boulder rolls back down every time. He climbs the slope again.",
  });

  const ramp = document.createElement("div");
  ramp.className = "ramp";
  container.appendChild(ramp);

  const ground = document.createElement("div");
  ground.className = "ramp-ground";
  container.appendChild(ground);

  const targetZone = document.createElement("div");
  targetZone.className = "target-zone";
  container.appendChild(targetZone);

  const chargeBar = document.createElement("div");
  chargeBar.className = "charge-bar";
  const chargeFill = document.createElement("div");
  chargeFill.className = "charge-bar__fill";
  chargeBar.appendChild(chargeFill);
  container.appendChild(chargeBar);

  const stone = makeSphere("target");
  stone.classList.add("sphere--stone");
  container.appendChild(stone);

  let phase: Phase = "ready";
  let charge = 0;
  let motion: StoneMotion = { position: 0, velocity: 0 };
  let pendingOutcome: ChargeOutcome | null = null;
  let apexArmed = false;

  function beginCharge(): void {
    if (phase !== "ready") return;
    phase = "charging";
    charge = 0;
  }

  function release(): void {
    if (phase !== "charging") return;
    phase = "rolling";
    pendingOutcome = chargeOutcome(charge);
    motion = { position: LAUNCH_START_POSITION, velocity: launchVelocityForCharge(charge) };
    apexArmed = true;
  }

  function onPointerDown(ev: PointerEvent): void {
    ev.preventDefault();
    beginCharge();
  }
  function onPointerUp(): void {
    release();
  }
  container.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  function onKeyDown(ev: KeyboardEvent): void {
    if (ev.code === "Space" || ev.code === "ArrowUp") beginCharge();
  }
  function onKeyUp(ev: KeyboardEvent): void {
    if (ev.code === "Space" || ev.code === "ArrowUp") release();
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  const zoneStart = positionToPoint(TARGET_ZONE_MIN);
  const zoneEnd = positionToPoint(Math.min(TARGET_ZONE_MAX, 1));

  const stop = raf((dt) => {
    const rect = rectOf(container);

    const x0 = zoneStart.x * rect.width;
    const y0 = zoneStart.y * rect.height;
    const x1 = zoneEnd.x * rect.width;
    const y1 = zoneEnd.y * rect.height;
    const length = Math.hypot(x1 - x0, y1 - y0);
    const angle = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
    targetZone.style.width = `${length}px`;
    targetZone.style.transform = `translate3d(${x0}px, ${y0}px, 0) rotate(${angle}deg)`;

    if (phase === "charging") {
      charge = Math.min(1, charge + dt / CHARGE_SECONDS);
      stone.style.setProperty("--breath", String(1 + charge * 0.18));
    } else {
      stone.style.setProperty("--breath", "1");
    }
    chargeFill.style.width = `${(phase === "charging" ? charge : 0) * 100}%`;
    chargeBar.classList.toggle("charge-bar--armed", phase === "charging");

    if (phase === "rolling") {
      motion = stepStone(motion, false, dt);
      const { x, y } = positionToPoint(motion.position);
      place(stone, x, y, rect);

      if (pendingOutcome === "clear" && apexArmed && motion.velocity <= 0) {
        apexArmed = false;
        phase = "ready";
        stone.classList.add("sphere--pressed");
        window.setTimeout(() => ctx.onClear(), 260);
        return;
      }

      if (pendingOutcome !== "clear" && motion.position <= 0 && Math.abs(motion.velocity) < SETTLE_VELOCITY) {
        phase = "ready";
        charge = 0;
        pendingOutcome = null;
        motion = { position: 0, velocity: 0 };
      }
      return;
    }

    const { x, y } = positionToPoint(motion.position);
    place(stone, x, y, rect);
  });

  return {
    destroy(): void {
      stop();
      myth.destroy();
      container.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      ramp.remove();
      ground.remove();
      targetZone.remove();
      chargeBar.remove();
      stone.remove();
    },
  };
}
