// Pure top-level saga for NINEFOLD TOWER. No DOM, no timers, no randomness —
// every transition is a plain function of the current state, so the loop
// (intro -> floor -> dying -> rewinding -> floor 1, and floor -> ending) is
// unit-testable in isolation from rendering (main.ts owns the DOM side).
export type Phase = "intro" | "floor" | "dying" | "rewinding" | "ending";

export const FLOOR_COUNT = 9;

export interface TowerState {
  phase: Phase;
  /** 0-based floor index, 0..FLOOR_COUNT-1. */
  floor: number;
  /** cleared[i] is true once floor i has been cleared this run. */
  cleared: boolean[];
  /** True only for the very first tower ever created this session. */
  firstRun: boolean;
}

function emptyCleared(): boolean[] {
  return Array.from({ length: FLOOR_COUNT }, () => false);
}

/**
 * Create the initial saga state. `firstRun` decides whether the full
 * wake-up intro plays (`phase: "intro"`) or the tower drops straight into
 * Floor 1 (`phase: "floor"`) — the caller (main.ts) decides this from
 * sessionStorage, not this module.
 */
export function createTower(firstRun: boolean): TowerState {
  return {
    phase: firstRun ? "intro" : "floor",
    floor: 0,
    cleared: emptyCleared(),
    firstRun,
  };
}

/** The wake-up intro has finished playing; begin Floor 1. */
export function beginFloors(state: TowerState): TowerState {
  if (state.phase !== "intro") return state;
  return { ...state, phase: "floor" };
}

/**
 * The current floor was cleared. Marks its orb, then either advances to the
 * next floor or — after Floor 9 — moves to "ending".
 */
export function clearFloor(state: TowerState): TowerState {
  if (state.phase !== "floor") return state;
  const cleared = [...state.cleared];
  cleared[state.floor] = true;
  const nextFloor = state.floor + 1;
  if (nextFloor >= FLOOR_COUNT) {
    return { ...state, cleared, phase: "ending" };
  }
  return { ...state, cleared, floor: nextFloor };
}

/** The current floor was failed; the death/rewind sequence begins. */
export function failFloor(state: TowerState): TowerState {
  if (state.phase !== "floor") return state;
  return { ...state, phase: "dying" };
}

/** The failure effect finished playing; the time-reversal effect begins. */
export function beginRewind(state: TowerState): TowerState {
  if (state.phase !== "dying") return state;
  return { ...state, phase: "rewinding" };
}

/**
 * The rewind effect finished; time has looped back to Floor 1 with every
 * orb restored. `firstRun` is cleared (if it wasn't already) so a future
 * intro is never replayed — this loop is the "time reversal", not a fresh
 * awakening.
 */
export function finishRewind(state: TowerState): TowerState {
  if (state.phase !== "rewinding") return state;
  return {
    phase: "floor",
    floor: 0,
    cleared: emptyCleared(),
    firstRun: false,
  };
}
