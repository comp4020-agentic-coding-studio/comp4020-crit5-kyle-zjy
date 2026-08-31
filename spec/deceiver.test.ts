// Contract tests for Floor 8's pointer-deception toolkit (floors/shared.ts).
// createDeceiver's update() is pure numeric math (no DOM), so its five
// behaviours — one honest, four dishonest — are directly testable: they must
// look identical at rest, and diverge in a specific, checkable way once the
// pointer engages.
import { describe, expect, it } from "vitest";
import { createDeceiver, type PointerQuality, type PointerState } from "../floors/shared.ts";

const FLOOR8_QUALITIES: PointerQuality[] = ["authentic", "mirrored", "panic", "orbit", "pulse"];

function idlePointer(): PointerState {
  return { x: 0, y: 0, active: false };
}

function nearPointer(cx: number, cy: number, offset = 20): PointerState {
  return { x: cx + offset, y: cy, active: true };
}

describe("Floor 8 deceivers — baseline (idle) parity", () => {
  it("all five qualities render zero tilt/magnet offset while the pointer is inactive", () => {
    for (const quality of FLOOR8_QUALITIES) {
      const deceiver = createDeceiver(quality);
      const result = deceiver.update(100, 100, 40, idlePointer(), 1 / 60);
      expect(result.tiltX).toBe(0);
      expect(result.tiltY).toBe(0);
      expect(result.magX).toBe(0);
      expect(result.magY).toBe(0);
    }
  });

  it("all five qualities settle back to resting scale (1) while idle", () => {
    for (const quality of FLOOR8_QUALITIES) {
      const deceiver = createDeceiver(quality);
      let result = deceiver.update(100, 100, 40, idlePointer(), 1 / 60);
      for (let i = 0; i < 30; i++) result = deceiver.update(100, 100, 40, idlePointer(), 1 / 60);
      expect(result.scale ?? 1).toBeCloseTo(1, 2);
    }
  });
});

describe("Floor 8 deceivers — the true one is magnetic", () => {
  it("authentic settles toward the pointer (magX shares the pointer's sign)", () => {
    const deceiver = createDeceiver("authentic");
    const cx = 100;
    const cy = 100;
    const pointer = nearPointer(cx, cy); // pointer is to the right (+x)
    let result = { magX: 0 };
    for (let i = 0; i < 60; i++) result = deceiver.update(cx, cy, 40, pointer, 1 / 60);
    expect(result.magX).toBeGreaterThan(0);
  });
});

describe("Floor 8 deceivers — mirrored flees at the same rate authentic follows", () => {
  it("moves away from the pointer instead of toward it", () => {
    const cx = 100;
    const cy = 100;
    const pointer = nearPointer(cx, cy);
    let mirroredResult = { magX: 0 };
    const mirrored = createDeceiver("mirrored");
    for (let i = 0; i < 60; i++) mirroredResult = mirrored.update(cx, cy, 40, pointer, 1 / 60);
    expect(mirroredResult.magX).toBeLessThan(0);
  });

  it("mirrors authentic's magnitude one-for-one (same gain, opposite sign)", () => {
    const cx = 100;
    const cy = 100;
    const pointer = nearPointer(cx, cy);
    const authentic = createDeceiver("authentic");
    const mirrored = createDeceiver("mirrored");
    let a = { magX: 0 };
    let m = { magX: 0 };
    for (let i = 0; i < 60; i++) {
      a = authentic.update(cx, cy, 40, pointer, 1 / 60);
      m = mirrored.update(cx, cy, 40, pointer, 1 / 60);
    }
    expect(m.magX).toBeCloseTo(-a.magX, 5);
  });
});

describe("Floor 8 deceivers — panic flees harder than mirrored", () => {
  it("panic's fleeing magnitude exceeds mirrored's under the same approach", () => {
    const cx = 100;
    const cy = 100;
    const pointer = nearPointer(cx, cy);
    const mirrored = createDeceiver("mirrored");
    const panic = createDeceiver("panic");
    let m = { magX: 0 };
    let p = { magX: 0 };
    for (let i = 0; i < 10; i++) {
      m = mirrored.update(cx, cy, 40, pointer, 1 / 60);
      p = panic.update(cx, cy, 40, pointer, 1 / 60);
    }
    expect(Math.abs(p.magX)).toBeGreaterThan(Math.abs(m.magX));
  });
});

describe("Floor 8 deceivers — orbit never settles into a fixed offset", () => {
  it("keeps moving under a perfectly still pointer, unlike authentic/mirrored/panic", () => {
    const cx = 100;
    const cy = 100;
    const pointer = nearPointer(cx, cy);

    function settles(quality: PointerQuality): boolean {
      const deceiver = createDeceiver(quality);
      let prev = { magX: 0, magY: 0 };
      let maxDelta = 0;
      for (let i = 0; i < 300; i++) {
        const cur = deceiver.update(cx, cy, 40, pointer, 1 / 60);
        if (i > 200) {
          maxDelta = Math.max(maxDelta, Math.abs(cur.magX - prev.magX), Math.abs(cur.magY - prev.magY));
        }
        prev = cur;
      }
      return maxDelta < 1e-3;
    }

    expect(settles("authentic")).toBe(true);
    expect(settles("mirrored")).toBe(true);
    expect(settles("orbit")).toBe(false);
  });
});

describe("Floor 8 deceivers — pulse breathes, the others hold steady scale", () => {
  it("pulse's scale swings both above and below 1 while near the pointer", () => {
    const cx = 100;
    const cy = 100;
    const pointer = nearPointer(cx, cy, 5); // close, so influence stays high
    const deceiver = createDeceiver("pulse");
    let maxScale = 0;
    let minScale = Infinity;
    for (let i = 0; i < 180; i++) {
      const result = deceiver.update(cx, cy, 40, pointer, 1 / 30);
      const scale = result.scale ?? 1;
      maxScale = Math.max(maxScale, scale);
      minScale = Math.min(minScale, scale);
    }
    expect(maxScale).toBeGreaterThan(1.1);
    expect(minScale).toBeLessThan(0.99);
  });

  it("authentic's scale stays close to resting size under the same approach", () => {
    const cx = 100;
    const cy = 100;
    const pointer = nearPointer(cx, cy, 5);
    const deceiver = createDeceiver("authentic");
    let maxDeviation = 0;
    for (let i = 0; i < 180; i++) {
      const result = deceiver.update(cx, cy, 40, pointer, 1 / 30);
      maxDeviation = Math.max(maxDeviation, Math.abs((result.scale ?? 1) - 1));
    }
    expect(maxDeviation).toBeLessThan(0.05);
  });
});

describe("Floor 8 deceivers — 'none' behaves as if the pointer were never there", () => {
  it("stays at zero offset even while the pointer is active and close", () => {
    const cx = 100;
    const cy = 100;
    const pointer = nearPointer(cx, cy, 5);
    const deceiver = createDeceiver("none");
    let result = { tiltX: 0, tiltY: 0, magX: 0, magY: 0 };
    for (let i = 0; i < 30; i++) result = deceiver.update(cx, cy, 40, pointer, 1 / 60);
    expect(result.tiltX).toBe(0);
    expect(result.tiltY).toBe(0);
    expect(result.magX).toBe(0);
    expect(result.magY).toBe(0);
  });
});
