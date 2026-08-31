// Pure top-level saga for NINEFOLD TOWER. No DOM, no timers, no randomness —
// every transition is a plain function of the current state, so the loop
// (intro -> floor -> dying -> rewinding -> floor 1, and floor -> ending) is
// unit-testable in isolation from rendering (main.ts owns the DOM side).
export type Phase = "intro" | "floor" | "dying" | "rewinding" | "ending";

export const FLOOR_COUNT = 9;

/** "full" rewinds all the way to Floor 1 with every orb restored (the
 *  original, default behaviour). "anchor" restarts only the current floor,
 *  leaving already-cleared orbs alone. Chosen by the Rewind Anchor toggle,
 *  but committed onto the state the moment a floor is failed — flipping the
 *  toggle later, mid-death-animation, never changes an outcome already in
 *  flight. */
export type RewindMode = "full" | "anchor";

export interface TowerState {
  phase: Phase;
  /** 0-based floor index, 0..FLOOR_COUNT-1. */
  floor: number;
  /** cleared[i] is true once floor i has been cleared this run. */
  cleared: boolean[];
  /** True only for the very first tower ever created this session. */
  firstRun: boolean;
  /** The player's current Rewind Anchor preference. Toggling this never by
   *  itself changes phase/floor/cleared — it only decides what the *next*
   *  failure does. */
  anchorEnabled: boolean;
  /** The rewind mode committed by the failure currently being resolved, or
   *  null outside the dying/rewinding phases. */
  rewindMode: RewindMode | null;
}

function emptyCleared(): boolean[] {
  return Array.from({ length: FLOOR_COUNT }, () => false);
}

/**
 * Create the initial saga state. `firstRun` decides whether the full
 * wake-up intro plays (`phase: "intro"`) or the tower drops straight into
 * Floor 1 (`phase: "floor"`) — the caller (main.ts) decides this from
 * sessionStorage, not this module. `anchorEnabled` likewise comes from the
 * caller's stored preference (defaults to off, the original experience).
 */
export function createTower(firstRun: boolean, anchorEnabled = false): TowerState {
  return {
    phase: firstRun ? "intro" : "floor",
    floor: 0,
    cleared: emptyCleared(),
    firstRun,
    anchorEnabled,
    rewindMode: null,
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

/** The player's Rewind Anchor preference changed. Purely a setting — it
 *  never touches phase, floor or cleared progress, so toggling mid-floor
 *  cannot reset or restart anything by itself. */
export function setAnchorEnabled(state: TowerState, enabled: boolean): TowerState {
  if (state.anchorEnabled === enabled) return state;
  return { ...state, anchorEnabled: enabled };
}

/** The current floor was failed; the death/rewind sequence begins. The
 *  rewind mode is committed here, from whatever the anchor preference is at
 *  this exact moment, and carried through dying/rewinding untouched. */
export function failFloor(state: TowerState): TowerState {
  if (state.phase !== "floor") return state;
  return { ...state, phase: "dying", rewindMode: state.anchorEnabled ? "anchor" : "full" };
}

/** The failure effect finished playing; the time-reversal effect begins. */
export function beginRewind(state: TowerState): TowerState {
  if (state.phase !== "dying") return state;
  return { ...state, phase: "rewinding" };
}

/**
 * The rewind effect finished playing. Under "full" mode, time loops back to
 * Floor 1 with every orb restored — `firstRun` is cleared (if it wasn't
 * already) so a future intro is never replayed, since this loop is the
 * "time reversal", not a fresh awakening. Under "anchor" mode, only the
 * current floor restarts: floor index and cleared progress are left exactly
 * as they were the instant the floor was entered.
 */
export function finishRewind(state: TowerState): TowerState {
  if (state.phase !== "rewinding") return state;
  if (state.rewindMode === "anchor") {
    return { ...state, phase: "floor", rewindMode: null };
  }
  return {
    phase: "floor",
    floor: 0,
    cleared: emptyCleared(),
    firstRun: false,
    anchorEnabled: state.anchorEnabled,
    rewindMode: null,
  };
}
