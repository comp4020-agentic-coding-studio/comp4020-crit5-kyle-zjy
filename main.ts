// Wiring only: owns the one mutable TowerState, calls into tower.ts for every
// transition, and mounts/unmounts the active floor module. No game rules and
// no floor-specific animation code live here.
import {
  createTower,
  beginFloors,
  clearFloor,
  failFloor,
  beginRewind,
  finishRewind,
  setAnchorEnabled,
  FLOOR_COUNT,
  type TowerState,
  type RewindMode,
} from "./tower.ts";
import { createOrbRail } from "./orbs.ts";
import { createAnchorToggle, loadAnchorPreference } from "./anchor.ts";
import { playAwakening, playRewindFlash, playAnchorRewindFlash } from "./intro.ts";
import { playEnding } from "./ending.ts";
import { playAwaken, playFloorClear, playRewind, playEndingChord, primeAudio } from "./audio.ts";
import type { FloorContext, FloorController } from "./floors/shared.ts";
import * as floor1 from "./floors/floor1.ts";
import * as floor2 from "./floors/floor2.ts";
import * as floor3 from "./floors/floor3.ts";
import * as floor4 from "./floors/floor4.ts";
import * as floor5 from "./floors/floor5.ts";
import * as floor6 from "./floors/floor6.ts";
import * as floor7 from "./floors/floor7.ts";
import * as floor8 from "./floors/floor8.ts";
import * as floor9 from "./floors/floor9.ts";

const FLOORS = [floor1, floor2, floor3, floor4, floor5, floor6, floor7, floor8, floor9];
if (FLOORS.length !== FLOOR_COUNT) throw new Error("floor module count must match FLOOR_COUNT");

const stageEl = document.querySelector<HTMLElement>("#floor-stage");
const orbRailEl = document.querySelector<HTMLElement>("#orb-rail");
const introOverlay = document.querySelector<HTMLElement>("#intro-overlay");
const endingOverlay = document.querySelector<HTMLElement>("#ending-overlay");
const anchorMountEl = document.querySelector<HTMLElement>("#anchor-toggle-mount");

if (!stageEl || !orbRailEl || !introOverlay || !endingOverlay || !anchorMountEl) {
  throw new Error("expected tower markup is missing from index.html");
}

// Unlock audio on the very first gesture, wherever it lands.
window.addEventListener("pointerdown", primeAudio, { once: true });
window.addEventListener("keydown", primeAudio, { once: true });

const orbRail = createOrbRail(orbRailEl);

// The wake-up intro plays once per browser tab; a death/rewind back to
// Floor 1 later in the same session gets the brief flash instead.
const SEEN_KEY = "ninefold-tower:seen";
const firstRun = sessionStorage.getItem(SEEN_KEY) === null;
sessionStorage.setItem(SEEN_KEY, "1");

let state: TowerState = createTower(firstRun, loadAnchorPreference());
let controller: FloorController | null = null;

createAnchorToggle(anchorMountEl, state.anchorEnabled, (enabled) => {
  state = setAnchorEnabled(state, enabled);
});

void run();

async function run(): Promise<void> {
  orbRail.setCleared(state.cleared);

  if (state.phase === "intro") {
    playAwaken();
    await playAwakening(introOverlay!);
    state = beginFloors(state);
  }

  mountFloor();
}

function mountFloor(): void {
  controller?.destroy();
  const mod = FLOORS[state.floor]!;
  const ctx: FloorContext = {
    rng: Math.random,
    onClear: handleClear,
    onFail: handleFail,
  };
  controller = mod.mount(stageEl!, ctx);
}

function handleClear(): void {
  playFloorClear(state.floor);
  state = clearFloor(state);
  orbRail.setCleared(state.cleared);

  if (state.phase === "ending") {
    controller?.destroy();
    controller = null;
    playEndingChord();
    void orbRail.dissolve().then(() => playEnding(endingOverlay!, handleReplay));
    return;
  }

  mountFloor();
}

function handleFail(): void {
  playRewind();
  state = failFloor(state);
  const mode: RewindMode = state.rewindMode ?? "full";
  const anchoredFloor = state.floor;
  state = beginRewind(state);
  void rewindAndRestart(mode, anchoredFloor);
}

async function rewindAndRestart(mode: RewindMode, anchoredFloor: number): Promise<void> {
  controller?.destroy();
  controller = null;
  if (mode === "anchor") {
    await playAnchorRewindFlash(introOverlay!);
    orbRail.pulseCurrent(anchoredFloor);
  } else {
    await playRewindFlash(introOverlay!);
    await orbRail.playRewind();
  }
  state = finishRewind(state);
  orbRail.setCleared(state.cleared);
  mountFloor();
}

function handleReplay(): void {
  state = createTower(false, state.anchorEnabled);
  orbRailEl!.classList.remove("orb-rail--fade");
  orbRail.setCleared(state.cleared);
  mountFloor();
}
