// Contract tests for the pure per-floor rules (floors/rules.ts): the actual
// mythic mechanics, not "the sphere renders". Every function here is DOM-free
// and deterministic, so these run directly with plain numbers.
import { describe, expect, it } from "vitest";
import {
  applySunShot,
  SUN_COUNT,
  stepFlame,
  WIND_WALLS,
  isWindWallActive,
  stepStone,
  stoneOutcome,
  peakPositionForCharge,
  chargeOutcome,
  launchVelocityForCharge,
  TARGET_ZONE_MIN,
  TARGET_ZONE_MAX,
  bandCenterAt,
  isWithinBand,
  gazeAngleDeg,
  isGazingBackward,
  stepLookBackTimer,
  hasLookedBack,
  LOOK_BACK_DWELL_MS,
  canEnter,
  MAZE_START,
  MAZE_EXIT,
  MAZE_SOLUTION,
  pickTrue,
  assignFloor8Qualities,
  DECOY_QUALITIES,
  crackBrightnessAt,
  chaosStrikeOutcome,
  stepChaosInstability,
  isChaosCollapsed,
  CHAOS_INSTABILITY_LIMIT,
  isSkyHome,
  isEarthHome,
  havePanguHalvesCollided,
  driftHalfTowardCenter,
  panguHalvesSettled,
  supportDisturbanceAt,
  isCoreStable,
  stepSupportProgress,
  isSupportComplete,
  SUPPORT_HOLD_SECONDS,
  type StoneMotion,
  type ChargeOutcome,
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

  it("cycles each wind wall deterministically between windy and calm", () => {
    for (const wall of WIND_WALLS) {
      // At the very start of its windy fraction, the wall is active.
      expect(isWindWallActive(wall, -wall.phase + 0.001)).toBe(true);
      // Just past the windy fraction, it has gone calm — a passable window exists.
      expect(isWindWallActive(wall, -wall.phase + wall.period * wall.windyFraction + 0.001)).toBe(false);
    }
  });

  it("desynchronises the three walls so their calm windows don't fully overlap", () => {
    // Sample densely across a shared window and confirm at least one instant
    // exists where every wall is simultaneously calm (a crossing is always
    // possible), without all three being calm at every instant (desynced).
    let allCalmCount = 0;
    let anyWindyCount = 0;
    const samples = 400;
    for (let i = 0; i < samples; i++) {
      const t = (i / samples) * 10;
      const states = WIND_WALLS.map((wall) => isWindWallActive(wall, t));
      if (states.every((active) => !active)) allCalmCount++;
      if (states.some((active) => active)) anyWindyCount++;
    }
    expect(allCalmCount).toBeGreaterThan(0);
    expect(anyWindyCount).toBeGreaterThan(0);
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

  it("charges below the target zone come up short", () => {
    expect(chargeOutcome(0.2)).toBe("short");
    expect(peakPositionForCharge(0.2)).toBeLessThan(TARGET_ZONE_MIN);
  });

  it("charges landing inside the target zone clear", () => {
    // Binary-search-free: pick a charge whose peak is known to land inside
    // [TARGET_ZONE_MIN, TARGET_ZONE_MAX] given the exported physics.
    let found: number | null = null;
    for (let c = 0; c <= 1; c += 0.001) {
      if (chargeOutcome(c) === "clear") {
        found = c;
        break;
      }
    }
    expect(found).not.toBeNull();
    const peak = peakPositionForCharge(found!);
    expect(peak).toBeGreaterThanOrEqual(TARGET_ZONE_MIN);
    expect(peak).toBeLessThanOrEqual(TARGET_ZONE_MAX);
  });

  it("full charge overshoots the target zone", () => {
    expect(chargeOutcome(1)).toBe("over");
    expect(peakPositionForCharge(1)).toBeGreaterThan(TARGET_ZONE_MAX);
  });

  it("charge outcome has no fail variant — this floor structurally cannot call onFail", () => {
    const outcomes: ChargeOutcome[] = [chargeOutcome(0), chargeOutcome(0.5), chargeOutcome(1)];
    for (const outcome of outcomes) {
      expect(["short", "clear", "over"]).toContain(outcome);
    }
  });

  it("launch velocity scales with charge and matches the peak-position physics", () => {
    expect(launchVelocityForCharge(0)).toBe(0);
    expect(launchVelocityForCharge(1)).toBeGreaterThan(launchVelocityForCharge(0.5));
    // Stepping stepStone forward from the launch velocity should approach
    // (not exceed, within tolerance) the peak position predicted analytically.
    let motion: StoneMotion = { position: 0.001, velocity: launchVelocityForCharge(0.6) };
    let peak = motion.position;
    for (let i = 0; i < 600 && motion.velocity >= 0; i++) {
      motion = stepStone(motion, false, 1 / 60);
      peak = Math.max(peak, motion.position);
    }
    expect(peak).toBeCloseTo(peakPositionForCharge(0.6), 1);
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
  it("measures 0 degrees for a gaze pointed straight forward", () => {
    expect(gazeAngleDeg(1, 0)).toBeCloseTo(0);
  });

  it("measures 180 degrees for a gaze pointed straight back", () => {
    expect(gazeAngleDeg(-1, 0)).toBeCloseTo(180);
  });

  it("is not backward within 120 degrees of forward", () => {
    expect(isGazingBackward(gazeAngleDeg(1, 1))).toBe(false); // 45deg
    expect(isGazingBackward(119)).toBe(false);
  });

  it("is backward past 120 degrees off forward", () => {
    expect(isGazingBackward(121)).toBe(true);
    expect(isGazingBackward(gazeAngleDeg(-1, 0.1))).toBe(true);
  });

  it("resets the look-back timer the instant the gaze turns forward", () => {
    let ms = stepLookBackTimer(0, true, 100);
    expect(ms).toBe(100);
    ms = stepLookBackTimer(ms, false, 50);
    expect(ms).toBe(0);
  });

  it("does not fail a brief glance under the dwell threshold", () => {
    const ms = stepLookBackTimer(0, true, LOOK_BACK_DWELL_MS - 10);
    expect(hasLookedBack(ms)).toBe(false);
  });

  it("fails a sustained backward gaze past the dwell threshold", () => {
    const ms = stepLookBackTimer(0, true, LOOK_BACK_DWELL_MS + 10);
    expect(hasLookedBack(ms)).toBe(true);
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

  it("has a solution thread that starts at the start and ends at the exit", () => {
    expect(MAZE_SOLUTION[0]).toEqual(MAZE_START);
    expect(MAZE_SOLUTION[MAZE_SOLUTION.length - 1]).toEqual(MAZE_EXIT);
  });

  it("has a solution thread that only steps through open, adjacent cells", () => {
    for (const cell of MAZE_SOLUTION) {
      expect(canEnter(cell.x, cell.y)).toBe(true);
    }
    for (let i = 1; i < MAZE_SOLUTION.length; i++) {
      const prev = MAZE_SOLUTION[i - 1]!;
      const cur = MAZE_SOLUTION[i]!;
      const dist = Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
      expect(dist).toBe(1);
    }
  });
});

describe("Floor 8 — the true object among decoys", () => {
  it("clears only when the true id is picked", () => {
    expect(pickTrue("true-id", "true-id")).toBe("clear");
    expect(pickTrue("decoy-id", "true-id")).toBe("fail");
  });
});

describe("Floor 8 — five behaviours, one honest", () => {
  it("places authentic at the given true index", () => {
    const qualities = assignFloor8Qualities(2, 5);
    expect(qualities[2]).toBe("authentic");
    expect(qualities.filter((q) => q === "authentic")).toHaveLength(1);
  });

  it("cycles the decoy qualities deterministically across the remaining slots", () => {
    const qualities = assignFloor8Qualities(0, 5);
    expect(qualities.slice(1)).toEqual(DECOY_QUALITIES.slice(0, 4));
  });

  it("is deterministic for the same inputs", () => {
    expect(assignFloor8Qualities(1, 5)).toEqual(assignFloor8Qualities(1, 5));
  });
});

describe("Floor 9 — Pangu splits heaven and earth", () => {
  describe("stage 1: breaking the chaos egg", () => {
    it("peaks the crack's brightness a quarter-period after it starts pulsing", () => {
      expect(crackBrightnessAt(0.65)).toBeCloseTo(1, 5);
      expect(crackBrightnessAt(0)).toBeCloseTo(0.5, 5);
    });

    it("succeeds only when both charge and release timing clear their thresholds", () => {
      expect(chaosStrikeOutcome(0.5, 0.9)).toBe("success");
      expect(chaosStrikeOutcome(0.2, 0.9)).toBe("fail"); // strong timing, weak charge
      expect(chaosStrikeOutcome(0.5, 0.5)).toBe("fail"); // strong charge, bad timing
    });

    it("resets instability on success and accumulates it on failure", () => {
      expect(stepChaosInstability(2, "success")).toBe(0);
      expect(stepChaosInstability(2, "fail")).toBe(3);
    });

    it("collapses only after repeated failures reach the limit, not on the first miss", () => {
      let instability = 0;
      for (let i = 0; i < CHAOS_INSTABILITY_LIMIT - 1; i++) {
        instability = stepChaosInstability(instability, "fail");
        expect(isChaosCollapsed(instability)).toBe(false);
      }
      instability = stepChaosInstability(instability, "fail");
      expect(isChaosCollapsed(instability)).toBe(true);
    });
  });

  describe("stage 2: dividing heaven and earth", () => {
    it("recognises each half only once it reaches its home band", () => {
      expect(isSkyHome(0.1)).toBe(true);
      expect(isSkyHome(0.2)).toBe(false);
      expect(isEarthHome(0.9)).toBe(true);
      expect(isEarthHome(0.7)).toBe(false);
    });

    it("flags a collision only once the halves have closed to nearly nothing", () => {
      expect(havePanguHalvesCollided(0.48, 0.5)).toBe(true);
      expect(havePanguHalvesCollided(0.3, 0.7)).toBe(false);
    });

    it("drifts an un-dragged half back toward the center, never past it", () => {
      expect(driftHalfTowardCenter(0.3, true, 1)).toBeCloseTo(0.33, 5);
      expect(driftHalfTowardCenter(0.49, true, 10)).toBe(0.5);
      expect(driftHalfTowardCenter(0.7, false, 1)).toBeCloseTo(0.67, 5);
      expect(driftHalfTowardCenter(0.51, false, 10)).toBe(0.5);
    });

    it("pulls a half back far more weakly once it has already reached its home band", () => {
      // Not home yet: full-strength drift.
      expect(driftHalfTowardCenter(0.2, true, 1)).toBeCloseTo(0.23, 5);
      // Already home: the same dt moves it a fraction as far.
      expect(driftHalfTowardCenter(0.16, true, 1)).toBeCloseTo(0.166, 5);
      expect(driftHalfTowardCenter(0.9, false, 1)).toBeCloseTo(0.894, 5);
    });

    it("settles only when both halves have reached their home bands", () => {
      expect(panguHalvesSettled(0.1, 0.9)).toBe(true);
      expect(panguHalvesSettled(0.3, 0.9)).toBe(false);
    });
  });

  describe("stage 3: supporting heaven and earth", () => {
    it("is deterministic and bounded", () => {
      expect(supportDisturbanceAt(1.23)).toBe(supportDisturbanceAt(1.23));
      expect(Math.abs(supportDisturbanceAt(1.23))).toBeLessThanOrEqual(0.8);
    });

    it("is stable only within the safe radius of center", () => {
      expect(isCoreStable(0.1)).toBe(true);
      expect(isCoreStable(0.2)).toBe(false);
    });

    it("advances progress while stable and decays it while unstable", () => {
      expect(stepSupportProgress(0, true, 1)).toBe(1);
      expect(stepSupportProgress(2, false, 1)).toBeCloseTo(1.4, 5);
      expect(stepSupportProgress(0, false, 1)).toBe(0); // never goes negative
    });

    it("completes only once the hold reaches its full duration", () => {
      expect(isSupportComplete(SUPPORT_HOLD_SECONDS)).toBe(true);
      expect(isSupportComplete(SUPPORT_HOLD_SECONDS - 0.1)).toBe(false);
    });
  });
});
