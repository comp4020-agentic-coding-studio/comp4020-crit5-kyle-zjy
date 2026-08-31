// Contract tests for this week's brief: the actual game rules (§16), not
// "the page contains a button". game.ts is pure, so these run against the
// state machine directly with a deterministic rng — no DOM, no flakiness.
import { describe, expect, it } from "vitest";
import {
  createGame,
  pressButton,
  MAX_MISTAKES,
  STAGE_COUNT,
  type GameState,
} from "../game.ts";
import { gridFallback, placeButtons } from "../placement.ts";

// A fixed, non-degenerate sequence so layouts vary like a real rng would,
// without ever depending on Math.random.
function deterministicRng(seed = 1): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };
}

function firstDecoyId(state: GameState): string {
  const decoy = state.buttons.find((b) => !b.isTarget);
  if (!decoy) throw new Error("expected a decoy on this stage");
  return decoy.id;
}

describe("createGame", () => {
  it("starts idle with a single authentic button and no mistakes", () => {
    const state = createGame({ rng: deterministicRng() });
    expect(state.status).toBe("idle");
    expect(state.stage).toBe(0);
    expect(state.mistakes).toBe(0);
    expect(state.buttons).toHaveLength(1);
    expect(state.buttons[0]!.isTarget).toBe(true);
    expect(state.startedAt).toBeNull();
  });
});

describe("correct target press", () => {
  it("advances the stage and starts the clock, without adding a mistake", () => {
    const rng = deterministicRng();
    const before = createGame({ rng });
    const after = pressButton(before, before.targetId, rng, 1000);

    expect(after.stage).toBe(before.stage + 1);
    expect(after.mistakes).toBe(0);
    expect(after.status).toBe("playing");
    expect(after.startedAt).toBe(1000);
  });

  it("keeps the authentic button's id stable across stages", () => {
    const rng = deterministicRng();
    let state = createGame({ rng });
    for (let i = 0; i < 3; i++) {
      state = pressButton(state, state.targetId, rng, i);
      expect(state.targetId).toBe("target");
      expect(state.buttons.some((b) => b.id === state.targetId && b.isTarget)).toBe(true);
    }
  });
});

describe("wrong decoy press", () => {
  it("adds a mistake and does not advance the round", () => {
    const rng = deterministicRng();
    // reach stage 2, the first stage with a decoy to click
    let state = createGame({ rng });
    state = pressButton(state, state.targetId, rng, 1);
    state = pressButton(state, state.targetId, rng, 2);
    expect(state.stage).toBe(2);

    const decoyId = firstDecoyId(state);
    const stageBefore = state.stage;
    const after = pressButton(state, decoyId, rng, 3);

    expect(after.mistakes).toBe(state.mistakes + 1);
    expect(after.stage).toBe(stageBefore);
    expect(after.status).toBe("playing");
  });
});

describe("lose condition", () => {
  it("becomes lost after reaching the mistake limit, and stops accepting presses", () => {
    const rng = deterministicRng();
    let state = createGame({ rng });
    state = pressButton(state, state.targetId, rng, 1); // stage 1
    state = pressButton(state, state.targetId, rng, 2); // stage 2, has a decoy

    for (let i = 0; i < MAX_MISTAKES; i++) {
      const decoyId = firstDecoyId(state);
      state = pressButton(state, decoyId, rng, 10 + i);
    }

    expect(state.mistakes).toBe(MAX_MISTAKES);
    expect(state.status).toBe("lost");
    expect(state.finishedAt).toBe(10 + MAX_MISTAKES - 1);

    // once lost, further presses are no-ops
    const frozen = pressButton(state, state.targetId, rng, 999);
    expect(frozen).toBe(state);
  });
});

describe("win condition", () => {
  it("becomes won after the final authentic press, and stops accepting presses", () => {
    const rng = deterministicRng();
    let state = createGame({ rng });
    for (let i = 0; i < STAGE_COUNT; i++) {
      expect(state.status).not.toBe("won");
      state = pressButton(state, state.targetId, rng, i);
    }

    expect(state.status).toBe("won");
    expect(state.finishedAt).not.toBeNull();
    expect(state.mistakes).toBe(0);

    const frozen = pressButton(state, state.targetId, rng, 999);
    expect(frozen).toBe(state);
  });
});

describe("fair placement", () => {
  it("keeps every button inside the safe margin", () => {
    const rng = deterministicRng(7);
    const points = placeButtons({ count: 9, minDistance: 0.2, margin: 0.1, rng });
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0.1 - 1e-9);
      expect(p.x).toBeLessThanOrEqual(0.9 + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(0.1 - 1e-9);
      expect(p.y).toBeLessThanOrEqual(0.9 + 1e-9);
    }
  });

  it("falls back to a deterministic grid slot instead of retrying forever", () => {
    // an rng that always returns the same value places the first point
    // freely (nothing to collide with yet), then makes every later random
    // attempt collide with it, forcing the bounded-attempt fallback.
    const constantRng = () => 0.5;
    const points = placeButtons({ count: 5, minDistance: 0.9, margin: 0.1, rng: constantRng });
    expect(points).toHaveLength(5);
    expect(points[0]).toEqual({ x: 0.5, y: 0.5 });
    for (let i = 1; i < 5; i++) {
      expect(points[i]).toEqual(gridFallback(i, 5, 0.1));
    }
  });
});
