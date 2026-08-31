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
