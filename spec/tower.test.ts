// Contract tests for the top-level saga (tower.ts): the intro/floor/dying/
// rewinding/ending loop that every floor module sits inside. Pure and
// DOM-free, so these run directly against the state machine.
import { describe, expect, it } from "vitest";
import {
  createTower,
  beginFloors,
  clearFloor,
  failFloor,
  beginRewind,
  finishRewind,
  setAnchorEnabled,
  FLOOR_COUNT,
} from "../tower.ts";

describe("createTower", () => {
  it("starts in the intro phase only on the first run", () => {
    const first = createTower(true);
    expect(first.phase).toBe("intro");
    expect(first.firstRun).toBe(true);

    const later = createTower(false);
    expect(later.phase).toBe("floor");
    expect(later.firstRun).toBe(false);
  });

  it("starts on floor 0 with every orb unclaimed", () => {
    const state = createTower(true);
    expect(state.floor).toBe(0);
    expect(state.cleared).toHaveLength(FLOOR_COUNT);
    expect(state.cleared.every((c) => c === false)).toBe(true);
  });
});

describe("beginFloors", () => {
  it("moves the intro into floor 1", () => {
    const state = beginFloors(createTower(true));
    expect(state.phase).toBe("floor");
    expect(state.floor).toBe(0);
  });

  it("is a no-op outside the intro phase", () => {
    const state = createTower(false);
    expect(beginFloors(state)).toBe(state);
  });
});

describe("clearFloor", () => {
  it("marks the current floor's orb and advances to the next floor", () => {
    const state = clearFloor(createTower(false));
    expect(state.cleared[0]).toBe(true);
    expect(state.cleared.slice(1).every((c) => c === false)).toBe(true);
    expect(state.floor).toBe(1);
    expect(state.phase).toBe("floor");
  });

  it("reaches the ending after floor 9 (index 8) is cleared", () => {
    let state = createTower(false);
    for (let i = 0; i < FLOOR_COUNT - 1; i++) {
      state = clearFloor(state);
      expect(state.phase).toBe("floor");
    }
    state = clearFloor(state);
    expect(state.phase).toBe("ending");
    expect(state.cleared.every((c) => c === true)).toBe(true);
  });

  it("is a no-op outside the floor phase", () => {
    const state = createTower(true); // phase: "intro"
    expect(clearFloor(state)).toBe(state);
  });
});

describe("death and time-reversal loop", () => {
  it("moves a failed floor through dying and rewinding back to floor 1", () => {
    let state = clearFloor(createTower(false)); // now on floor 2 (index 1)
    state = failFloor(state);
    expect(state.phase).toBe("dying");

    state = beginRewind(state);
    expect(state.phase).toBe("rewinding");

    state = finishRewind(state);
    expect(state.phase).toBe("floor");
    expect(state.floor).toBe(0);
  });

  it("resets every orb on rewind, even ones cleared this run", () => {
    let state = clearFloor(createTower(false));
    state = clearFloor(state);
    expect(state.cleared.filter(Boolean)).toHaveLength(2);

    state = finishRewind(beginRewind(failFloor(state)));
    expect(state.cleared.every((c) => c === false)).toBe(true);
  });

  it("clears the first-run flag so a later rewind never replays the intro", () => {
    let state = createTower(true);
    state = beginFloors(state);
    state = failFloor(state);
    state = beginRewind(state);
    state = finishRewind(state);
    expect(state.firstRun).toBe(false);
  });

  it("is a no-op when the expected phase doesn't match", () => {
    const intro = createTower(true);
    expect(failFloor(intro)).toBe(intro); // intro, not floor

    const playing = createTower(false);
    expect(beginRewind(playing)).toBe(playing); // floor, not dying
    expect(finishRewind(playing)).toBe(playing); // floor, not rewinding
  });
});

describe("Rewind Anchor", () => {
  it("toggling the preference alone never touches phase, floor or progress", () => {
    let state = clearFloor(createTower(false)); // floor 2 (index 1), one orb cleared
    const before = { ...state };
    state = setAnchorEnabled(state, true);
    expect(state.anchorEnabled).toBe(true);
    expect(state.phase).toBe(before.phase);
    expect(state.floor).toBe(before.floor);
    expect(state.cleared).toEqual(before.cleared);
  });

  it("is a no-op (same reference) when set to its current value", () => {
    const state = createTower(false);
    expect(setAnchorEnabled(state, false)).toBe(state);
  });

  it("OFF: failing on floor 6 rewinds fully back to floor 1 with every orb reset", () => {
    let state = createTower(false);
    for (let i = 0; i < 5; i++) state = clearFloor(state); // clears floors 1-5, now on floor 6 (index 5)
    expect(state.floor).toBe(5);
    expect(state.cleared.filter(Boolean)).toHaveLength(5);

    state = setAnchorEnabled(state, false);
    state = finishRewind(beginRewind(failFloor(state)));

    expect(state.phase).toBe("floor");
    expect(state.floor).toBe(0);
    expect(state.cleared.every((c) => c === false)).toBe(true);
  });

  it("ON: failing on floor 6 restarts only floor 6, preserving the first five orbs", () => {
    let state = createTower(false);
    for (let i = 0; i < 5; i++) state = clearFloor(state); // clears floors 1-5, now on floor 6 (index 5)

    state = setAnchorEnabled(state, true);
    state = finishRewind(beginRewind(failFloor(state)));

    expect(state.phase).toBe("floor");
    expect(state.floor).toBe(5); // still floor 6, not reset to floor 1
    expect(state.cleared.slice(0, 5).every((c) => c === true)).toBe(true);
    expect(state.cleared.slice(5).every((c) => c === false)).toBe(true);
  });

  it("commits the rewind mode at the moment of failure, not at rewind-finish time", () => {
    let state = createTower(false);
    for (let i = 0; i < 5; i++) state = clearFloor(state);
    state = setAnchorEnabled(state, true);
    state = failFloor(state); // commits "anchor"
    state = setAnchorEnabled(state, false); // flipped mid-death; must not retroactively change this failure
    state = finishRewind(beginRewind(state));

    expect(state.floor).toBe(5); // still anchor behaviour for this failure
    expect(state.cleared.slice(0, 5).every((c) => c === true)).toBe(true);
  });
});
