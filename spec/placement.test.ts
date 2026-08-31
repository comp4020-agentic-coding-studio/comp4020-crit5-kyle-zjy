// Fair-placement contract, unchanged from the previous prototype: placement.ts
// itself did not change in the Ninefold Tower redesign, only the callers did.
import { describe, expect, it } from "vitest";
import { gridFallback, placeButtons } from "../placement.ts";

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
