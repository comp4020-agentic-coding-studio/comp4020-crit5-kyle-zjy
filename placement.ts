// Fair, deterministic placement for buttons inside a normalised [0,1] arena.
// No infinite retry loops: a bounded number of random attempts per point,
// falling back to a deterministic grid slot when the arena is too crowded to
// satisfy the minimum distance randomly.
import type { Rng } from "./game.ts";

export interface Point {
  x: number;
  y: number;
}

export interface PlacementOptions {
  count: number;
  /** Minimum centre-to-centre distance, normalised to the arena's shorter side. */
  minDistance: number;
  /** Margin kept clear from every edge, same normalisation. */
  margin: number;
  rng: Rng;
  maxAttempts?: number;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Deterministic fallback slot: an evenly spaced grid within the safe area. */
export function gridFallback(index: number, count: number, margin: number): Point {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const col = index % cols;
  const row = Math.floor(index / cols);
  const usable = 1 - margin * 2;
  const x = cols === 1 ? 0.5 : margin + (col / (cols - 1)) * usable;
  const y = rows === 1 ? 0.5 : margin + (row / (rows - 1)) * usable;
  return { x, y };
}

export function placeButtons({
  count,
  minDistance,
  margin,
  rng,
  maxAttempts = 30,
}: PlacementOptions): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    let placed: Point | null = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidate: Point = {
        x: margin + rng() * (1 - margin * 2),
        y: margin + rng() * (1 - margin * 2),
      };
      if (points.every((p) => distance(p, candidate) >= minDistance)) {
        placed = candidate;
        break;
      }
    }
    points.push(placed ?? gridFallback(i, count, margin));
  }
  return points;
}
