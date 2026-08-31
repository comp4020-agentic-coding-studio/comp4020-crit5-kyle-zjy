// Floor 9 — Pangu splits heaven and earth. The final trial, and the only one
// with three continuous stages inside a single floor: break the chaos egg
// with a timed strike, drag heaven up and earth down while they drift back
// toward each other, then hold Pangu steady between them until the pillar
// locks in. No on-screen "Stage 1/2/3" labels — the myth and the visuals
// carry the structure.
import {
  clamp,
  crackBrightnessAt,
  chaosStrikeOutcome,
  stepChaosInstability,
  isChaosCollapsed,
  havePanguHalvesCollided,
  driftHalfTowardCenter,
  panguHalvesSettled,
  supportDisturbanceAt,
  isCoreStable,
  stepSupportProgress,
  isSupportComplete,
  SUPPORT_HOLD_SECONDS,
  SKY_HOME_Y,
  type PanguPhase,
} from "./rules.ts";
import { makeSphere, place, raf, rectOf, type FloorContext, type FloorController } from "./shared.ts";
import { showStaticFloorMyth } from "./caption.ts";

const CHARGE_SECONDS = 1.3;
// The halves drag along the Y axis, but the requested separation is framed
// against viewport *width* — 50% of it, converted into a normalized Y
// distance via the viewport's own aspect ratio, so it scales responsively
// with the window instead of being a fixed fraction of height.
const HALVES_START_GAP_WIDTH_FRACTION = 0.5;
const HALVES_START_GAP_MIN = 0.14;
const SKY_DRAG_MIN_Y = 0.04;
const EARTH_DRAG_MAX_Y = 0.96;
// The distance from center to the home band is 0.5 - SKY_HOME_Y. Stop short
// of it by a real margin, so on ordinary wide viewports (where the raw 50vw
// conversion would land past the home band) the halves never start already
// "home" — stage 2 always still requires an actual drag, just a shorter one.
const HALVES_START_GAP_DRAG_MARGIN = 0.05;
const HALVES_START_GAP_MAX = 0.5 - SKY_HOME_Y - HALVES_START_GAP_DRAG_MARGIN;
const COLLISION_LIMIT = 3;
const COLLAPSE_OFFSET = 0.42;
const COLLAPSE_LIMIT = 3;
const SHAKE_DURATION = 0.34;

export function mount(container: HTMLElement, ctx: FloorContext): FloorController {
  const myth = showStaticFloorMyth(container, {
    title: "Floor IX · Pangu",
    lines: [
      "Heaven and Earth were once one, sealed inside chaos.",
      "Pangu split the void: the light rose, the heavy sank.",
      "If Heaven and Earth meet again, all returns to chaos.",
    ],
  });

  container.classList.add("pangu-stage");

  let phase: PanguPhase = "chaos";
  let stopped = false;
  // True during the brief pause between stages (crack widening, halves
  // re-fusing, pillar locking in) — blocks re-entrant detection checks and
  // stray input so a click or a lingering condition can't double-fire a
  // transition while the next stage's DOM hasn't been built yet.
  let transitioning = false;
  let currentEls: HTMLElement[] = [];
  const pointer = { x: 0, y: 0 };

  const flash = document.createElement("div");
  flash.className = "pangu-flash";
  container.appendChild(flash);

  function fireFlash(): void {
    flash.classList.add("pangu-flash--peak");
    window.setTimeout(() => flash.classList.remove("pangu-flash--peak"), 60);
  }

  function shakeStage(): void {
    container.classList.add("pangu-stage--shake");
    window.setTimeout(() => container.classList.remove("pangu-stage--shake"), 420);
  }

  function clearStageEls(): void {
    for (const el of currentEls) el.remove();
    currentEls = [];
  }

  function onPointerMove(ev: PointerEvent): void {
    const rect = rectOf(container);
    pointer.x = ev.clientX - rect.left;
    pointer.y = ev.clientY - rect.top;
  }
  container.addEventListener("pointermove", onPointerMove);

  // ---------- Stage 1: breaking chaos ----------
  let chaosStartT = 0;
  let charging = false;
  let charge = 0;
  let chaosInstability = 0;
  let eggEl: HTMLDivElement | null = null;
  let eggSwirl: HTMLDivElement | null = null;
  let eggCrack: HTMLDivElement | null = null;
  let chargeBar: HTMLDivElement | null = null;
  let chargeFill: HTMLDivElement | null = null;
  let shakeT = 0;

  function enterChaos(atT: number): void {
    clearStageEls();
    phase = "chaos";
    chaosStartT = atT;
    charging = false;
    charge = 0;

    eggEl = document.createElement("div");
    eggEl.className = "pangu-egg";
    eggSwirl = document.createElement("div");
    eggSwirl.className = "pangu-egg__swirl";
    eggEl.appendChild(eggSwirl);
    eggCrack = document.createElement("div");
    eggCrack.className = "pangu-egg__crack";
    eggEl.appendChild(eggCrack);
    container.appendChild(eggEl);

    chargeBar = document.createElement("div");
    chargeBar.className = "pangu-charge";
    chargeFill = document.createElement("div");
    chargeFill.className = "pangu-charge__fill";
    chargeBar.appendChild(chargeFill);
    container.appendChild(chargeBar);

    currentEls = [eggEl, chargeBar];
  }

  function onEggPointerDown(ev: PointerEvent): void {
    if (phase !== "chaos" || transitioning) return;
    ev.preventDefault();
    charging = true;
    charge = 0;
  }

  function resolveChaosStrike(atT: number): void {
    charging = false;
    const brightness = crackBrightnessAt(atT - chaosStartT);
    const outcome = chaosStrikeOutcome(charge, brightness);
    chaosInstability = stepChaosInstability(chaosInstability, outcome);
    if (outcome === "success") {
      beginSplit();
      return;
    }
    shakeT = SHAKE_DURATION;
    shakeStage();
    if (isChaosCollapsed(chaosInstability)) {
      window.setTimeout(() => ctx.onFail(), 320);
    }
  }

  function beginSplit(): void {
    transitioning = true;
    phase = "separating";
    fireFlash();
    shakeStage();
    clearStageEls();
    // A beat of silence before the halves appear, so the strike lands with
    // weight instead of the floor instantly reorganising itself.
    window.setTimeout(() => {
      if (stopped) return;
      enterSeparating();
      transitioning = false;
    }, 460);
  }

  // ---------- Stage 2: dividing heaven and earth ----------
  let skyY = 0.5;
  let earthY = 0.5;
  let draggingSky = false;
  let draggingEarth = false;
  let collisionCount = 0;
  let skyEl: HTMLDivElement | null = null;
  let earthEl: HTMLDivElement | null = null;

  function enterSeparating(): void {
    clearStageEls();
    const rect = rectOf(container);
    const rawHalfGap = rect.height > 0 ? (HALVES_START_GAP_WIDTH_FRACTION * rect.width) / (2 * rect.height) : HALVES_START_GAP_MIN;
    const halfGap = clamp(rawHalfGap, HALVES_START_GAP_MIN, HALVES_START_GAP_MAX);
    skyY = 0.5 - halfGap;
    earthY = 0.5 + halfGap;
    draggingSky = false;
    draggingEarth = false;

    skyEl = document.createElement("div");
    skyEl.className = "pangu-half pangu-half--sky";
    container.appendChild(skyEl);
    earthEl = document.createElement("div");
    earthEl.className = "pangu-half pangu-half--earth";
    container.appendChild(earthEl);
    currentEls = [skyEl, earthEl];

    skyEl.addEventListener("pointerdown", (ev) => {
      if (phase !== "separating" || transitioning) return;
      ev.preventDefault();
      draggingSky = true;
      skyEl!.setPointerCapture(ev.pointerId);
    });
    skyEl.addEventListener("pointerup", () => {
      draggingSky = false;
    });
    earthEl.addEventListener("pointerdown", (ev) => {
      if (phase !== "separating" || transitioning) return;
      ev.preventDefault();
      draggingEarth = true;
      earthEl!.setPointerCapture(ev.pointerId);
    });
    earthEl.addEventListener("pointerup", () => {
      draggingEarth = false;
    });
  }

  function collideHalves(): void {
    transitioning = true;
    collisionCount++;
    fireFlash();
    shakeStage();
    clearStageEls();
    if (collisionCount >= COLLISION_LIMIT) {
      window.setTimeout(() => ctx.onFail(), 340);
      return;
    }
    window.setTimeout(() => {
      if (stopped) return;
      enterChaos(rafT);
      transitioning = false;
    }, 260);
  }

  // ---------- Stage 3: supporting heaven and earth ----------
  let coreX = 0.5;
  let supportProgress = 0;
  let held = false;
  let collapseCount = 0;
  let pillarEl: HTMLDivElement | null = null;
  let coreEl: HTMLDivElement | null = null;

  function beginSupport(): void {
    transitioning = true;
    fireFlash();
    clearStageEls();
    window.setTimeout(() => {
      if (stopped) return;
      enterSupporting();
      transitioning = false;
    }, 240);
  }

  function enterSupporting(): void {
    clearStageEls();
    phase = "supporting";
    coreX = 0.5;
    supportProgress = 0;
    held = false;

    pillarEl = document.createElement("div");
    pillarEl.className = "pangu-pillar";
    container.appendChild(pillarEl);

    coreEl = makeSphere("target");
    coreEl.classList.add("sphere--pangu-core");
    container.appendChild(coreEl);
    currentEls = [pillarEl, coreEl];

    coreEl.addEventListener("pointerdown", (ev) => {
      if (phase !== "supporting" || transitioning) return;
      ev.preventDefault();
      held = true;
      coreEl!.setPointerCapture(ev.pointerId);
    });
  }

  function collapseSupport(): void {
    supportProgress = 0;
    collapseCount++;
    fireFlash();
    shakeStage();
    if (collapseCount >= COLLAPSE_LIMIT) {
      window.setTimeout(() => ctx.onFail(), 340);
    }
  }

  function onPointerUp(): void {
    if (phase === "chaos" && charging) {
      resolveChaosStrike(rafT);
    }
    if (phase === "supporting") {
      held = false;
    }
    draggingSky = false;
    draggingEarth = false;
  }

  container.addEventListener("pointerdown", onEggPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  let rafT = 0;
  enterChaos(0);

  const stop = raf((dt, t) => {
    rafT = t;
    if (stopped) return;
    const rect = rectOf(container);

    if (phase === "chaos") {
      if (charging) charge = Math.min(1, charge + dt / CHARGE_SECONDS);
      if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
      const shakeAmt = shakeT > 0 ? 6 * (shakeT / SHAKE_DURATION) : 0;
      const shakeX = shakeAmt * Math.sin(shakeT * 60);
      const shakeY = shakeAmt * Math.cos(shakeT * 47);
      const breathe = 1 + 0.035 * Math.sin(t * 1.4);
      if (eggEl) place(eggEl, 0.5, 0.5, rect, `scale(${breathe}) translate(${shakeX}px, ${shakeY}px)`);
      if (eggCrack) {
        const brightness = crackBrightnessAt(t - chaosStartT);
        eggCrack.style.opacity = String(0.15 + brightness * 0.85);
      }
      if (chargeFill) chargeFill.style.width = `${(charging ? charge : 0) * 100}%`;
      if (chargeBar) chargeBar.classList.toggle("pangu-charge--armed", charging);
      return;
    }

    if (phase === "separating") {
      if (transitioning || !skyEl || !earthEl) return;
      const pointerYNorm = pointer.y / rect.height;
      skyY = draggingSky ? clamp(pointerYNorm, SKY_DRAG_MIN_Y, 0.5) : driftHalfTowardCenter(skyY, true, dt);
      earthY = draggingEarth ? clamp(pointerYNorm, 0.5, EARTH_DRAG_MAX_Y) : driftHalfTowardCenter(earthY, false, dt);
      place(skyEl, 0.5, skyY, rect);
      place(earthEl, 0.5, earthY, rect);

      if (havePanguHalvesCollided(skyY, earthY)) {
        collideHalves();
        return;
      }
      if (panguHalvesSettled(skyY, earthY)) {
        beginSupport();
      }
      return;
    }

    if (phase === "supporting") {
      if (!pillarEl || !coreEl) return;
      if (held) {
        const pointerXNorm = clamp(pointer.x / rect.width, 0, 1);
        coreX += (pointerXNorm - coreX) * Math.min(1, dt * 8);
      }
      coreX += supportDisturbanceAt(t) * dt * 0.12;
      coreX = clamp(coreX, 0.08, 0.92);
      const offset = coreX - 0.5;
      const stable = isCoreStable(offset);
      supportProgress = stepSupportProgress(supportProgress, stable && held, dt);

      const progressFrac = supportProgress / SUPPORT_HOLD_SECONDS;
      const skyTargetY = 0.5 - 0.34 * progressFrac;
      const earthTargetY = 0.5 + 0.34 * progressFrac;
      pillarEl.style.setProperty("--pangu-pillar-top", `${skyTargetY * 100}%`);
      pillarEl.style.setProperty("--pangu-pillar-bottom", `${(1 - earthTargetY) * 100}%`);
      pillarEl.style.setProperty("--pangu-pillar-bend", `${offset * 120}px`);
      pillarEl.style.setProperty("--pangu-pillar-glow", String(0.25 + progressFrac * 0.75));
      place(coreEl, coreX, 0.5, rect);
      coreEl.classList.toggle("sphere--pressed", held && stable);

      if (Math.abs(offset) > COLLAPSE_OFFSET) {
        collapseSupport();
      }
      if (isSupportComplete(supportProgress)) {
        phase = "complete";
        window.setTimeout(() => ctx.onClear(), 460);
      }
    }
  });

  return {
    destroy(): void {
      if (stopped) return;
      stopped = true;
      stop();
      myth.destroy();
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerdown", onEggPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      clearStageEls();
      flash.remove();
      container.classList.remove("pangu-stage", "pangu-stage--shake");
    },
  };
}
