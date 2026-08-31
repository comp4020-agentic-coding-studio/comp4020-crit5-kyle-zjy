// Contract tests for the pure per-floor rules (floors/rules.ts): the actual
// mythic mechanics, not "the sphere renders". Every function here is DOM-free
// and deterministic, so these run directly with plain numbers.
import { describe, expect, it } from "vitest";
import {
  applySunShot,
  SUN_COUNT,
  stepFlame,
  stepStone,
  stoneOutcome,
  bandCenterAt,
  isWithinBand,
  isLookingBack,
  canEnter,
  MAZE_START,
  MAZE_EXIT,
  pickTrue,
  isInsideCorridor,
  collidesWithObstacle,
  type StoneMotion,
} from "../floors/rules.ts";

describe("Floor 2 — Hou Yi shoots the suns", () => {
  it("clears once exactly one sun remains", () => {
    const result = applySunShot(2);
    expect(result).toEqual({ outcome: "clear", remaining: 1 });
  });

  it("continues while more than one sun remains after the shot", () => {
    const result = applySunShot(SUN_COUNT);
    expect(result.outcome).toBe("continue");
    expect(result.remaining).toBe(SUN_COUNT - 1);
  });

  it("fails to shoot the last remaining sun — the myth's whole point", () => {
    const result = applySunShot(1);
    expect(result).toEqual({ outcome: "fail", remaining: 1 });
  });
});

describe("Floor 3 — Prometheus carries fire", () => {
  it("drains while inside the wind hazard", () => {
    const next = stepFlame(1, true, 1);
    expect(next).toBeLessThan(1);
  });

  it("recovers once clear of the hazard, never past full strength", () => {
    const next = stepFlame(0.9, false, 1);
    expect(next).toBeGreaterThan(0.9);
    expect(next).toBeLessThanOrEqual(1);
  });

  it("never drops below zero", () => {
    const next = stepFlame(0.01, true, 10);
    expect(next).toBe(0);
  });
});

describe("Floor 4 — Sisyphus pushes the stone", () => {
  it("rolls back down when not pushed", () => {
    const start: StoneMotion = { position: 0.5, velocity: 0 };
    const after = stepStone(start, false, 0.5);
    expect(after.velocity).toBeLessThan(0);
    expect(after.position).toBeLessThan(start.position);
  });

  it("climbs when pushed steadily", () => {
    let motion: StoneMotion = { position: 0, velocity: 0 };
    for (let i = 0; i < 40; i++) motion = stepStone(motion, true, 1 / 60);
    expect(motion.position).toBeGreaterThan(0);
  });

  it("clears at the crest and only fails after rolling clear across the flat landing", () => {
    expect(stoneOutcome(1)).toBe("clear");
    expect(stoneOutcome(1.2)).toBe("clear");
    expect(stoneOutcome(-0.2)).toBe("continue"); // still on the flat ground at the foot
    expect(stoneOutcome(-0.5)).toBe("fail");
    expect(stoneOutcome(0.5)).toBe("continue");
  });

  it("settles on the flat ground under friction instead of continuing to accelerate down", () => {
    const rolling: StoneMotion = { position: -0.1, velocity: -0.3 };
    const after = stepStone(rolling, false, 0.1);
    expect(Math.abs(after.velocity)).toBeLessThan(Math.abs(rolling.velocity));
  });
});

describe("Floor 5 — Icarus flies too high", () => {
  it("keeps the safe band centered around 0.5 on average", () => {
    // sin(t*0.6) covers its full range over a period; sampling many points
    // should stay within the documented +-0.22 amplitude around 0.5.
    for (let t = 0; t < 20; t += 0.7) {
      const center = bandCenterAt(t);
      expect(center).toBeGreaterThanOrEqual(0.5 - 0.22 - 1e-9);
      expect(center).toBeLessThanOrEqual(0.5 + 0.22 + 1e-9);
    }
  });

  it("is within the band exactly when the distance to center is within half-width", () => {
    expect(isWithinBand(0.5, 0.5, 0.1)).toBe(true);
    expect(isWithinBand(0.61, 0.5, 0.1)).toBe(false);
    expect(isWithinBand(0.6, 0.5, 0.1)).toBe(true);
  });
});

describe("Floor 6 — Orpheus must not look back", () => {
  it("treats a backward drag past the tolerance as looking back", () => {
    expect(isLookingBack(-0.05, 0.02)).toBe(true);
  });

  it("tolerates small jitter and forward motion", () => {
    expect(isLookingBack(-0.01, 0.02)).toBe(false);
    expect(isLookingBack(0.05, 0.02)).toBe(false);
  });
});

describe("Floor 7 — Theseus in the labyrinth", () => {
  it("keeps the start and exit cells open", () => {
    expect(canEnter(MAZE_START.x, MAZE_START.y)).toBe(true);
    expect(canEnter(MAZE_EXIT.x, MAZE_EXIT.y)).toBe(true);
  });

  it("rejects walls and anything outside the grid", () => {
    expect(canEnter(0, 0)).toBe(false); // a wall cell
    expect(canEnter(-1, 2)).toBe(false);
    expect(canEnter(99, 2)).toBe(false);
  });
});

describe("Floor 8 / 9 — the true object among decoys", () => {
  it("clears only when the true id is picked", () => {
    expect(pickTrue("true-id", "true-id")).toBe("clear");
    expect(pickTrue("decoy-id", "true-id")).toBe("fail");
  });
});

describe("Floor 9 — final trial escort leg", () => {
  it("is inside the corridor exactly within half-width of center", () => {
    expect(isInsideCorridor(0.5, 0.5, 0.1)).toBe(true);
    expect(isInsideCorridor(0.65, 0.5, 0.1)).toBe(false);
  });

  it("collides with an obstacle only within its radius", () => {
    expect(collidesWithObstacle(0.5, 0.5, 0.52, 0.5, 0.05)).toBe(true);
    expect(collidesWithObstacle(0.5, 0.5, 0.7, 0.5, 0.05)).toBe(false);
  });
});
