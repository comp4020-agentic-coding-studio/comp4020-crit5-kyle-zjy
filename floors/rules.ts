// Pure per-floor rule helpers — the "meaningful logic" each mythic floor is
// built on, kept free of DOM and timers so it is unit-testable the same way
// tower.ts is. Presentation (floor1.ts..floor9.ts) calls into these; it never
// reimplements the rule itself.

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ---------- Floor 2 — Hou Yi shoots the suns ----------
// Ten suns; the myth is "nine shot down, one spared". Shooting is only fair
// when at least one other sun remains besides the one you're aiming at, so
// shooting the last surviving sun is always the failure.
export const SUN_COUNT = 10;
export type SunShotOutcome = "continue" | "clear" | "fail";

export function applySunShot(remainingBefore: number): { outcome: SunShotOutcome; remaining: number } {
  if (remainingBefore <= 1) return { outcome: "fail", remaining: remainingBefore };
  const remaining = remainingBefore - 1;
  return { outcome: remaining === 1 ? "clear" : "continue", remaining };
}

// ---------- Floor 3 — Prometheus carries fire ----------
// Flame strength drains while the ember sits in a wind hazard, and recovers
// slowly once clear of it. Reaching 0 extinguishes the flame.
export function stepFlame(strength: number, inHazard: boolean, dt: number): number {
  const rate = inHazard ? -0.28 : 0.15;
  return clamp(strength + rate * dt, 0, 1);
}

// ---------- Floor 4 — Sisyphus pushes the stone ----------
// Position runs 0 (foot of the slope) to 1 (the crest). Gravity always pulls
// down; holding "push" is the only thing that fights it.
export interface StoneMotion {
  position: number;
  velocity: number;
}

const STONE_GRAVITY = 0.4;
const STONE_PUSH = 1.05;
const STONE_MAX_CLIMB_SPEED = 1.3;
const STONE_MAX_FALL_SPEED = 0.65;
const STONE_GROUND_FRICTION = 1.2;
export const STONE_FAIL_THRESHOLD = -0.45;

function moveToward(value: number, target: number, maxDelta: number): number {
  if (value < target) return Math.min(value + maxDelta, target);
  return Math.max(value - maxDelta, target);
}

export function stepStone(state: StoneMotion, pushing: boolean, dt: number): StoneMotion {
  let velocity: number;
  if (pushing) {
    velocity = clamp(state.velocity + STONE_PUSH * dt, -STONE_MAX_FALL_SPEED, STONE_MAX_CLIMB_SPEED);
  } else if (state.position <= 0) {
    // Below the foot of the slope is flat ground: friction settles the
    // stone instead of gravity dragging it further down forever.
    velocity = moveToward(state.velocity, 0, STONE_GROUND_FRICTION * dt);
  } else {
    velocity = clamp(state.velocity - STONE_GRAVITY * dt, -STONE_MAX_FALL_SPEED, STONE_MAX_CLIMB_SPEED);
  }
  const position = state.position + velocity * dt;
  return { position, velocity };
}

export function stoneOutcome(position: number): "continue" | "clear" | "fail" {
  if (position >= 1) return "clear";
  if (position <= STONE_FAIL_THRESHOLD) return "fail";
  return "continue";
}

// ---------- Floor 5 — Icarus flies too high ----------
// Altitude 0 (danger: too high, the sun) .. 1 (danger: too low, the sea). A
// safe corridor drifts slowly around the middle.
export function bandCenterAt(t: number): number {
  return 0.5 + 0.22 * Math.sin(t * 0.6);
}

export function isWithinBand(altitude: number, center: number, halfWidth: number): boolean {
  return Math.abs(altitude - center) <= halfWidth;
}

// ---------- Floor 6 — Orpheus must not look back ----------
// A deliberate backward drag past the tolerance is "looking back".
export function isLookingBack(deltaX: number, tolerance: number): boolean {
  return deltaX < -tolerance;
}

// ---------- Floor 7 — Theseus in the labyrinth ----------
// A small hand-authored maze: 0 is open floor, 1 is wall. Two symmetric
// routes (over the top, under the bottom) join in the middle, so a single
// memorised path isn't the only way through.
export const MAZE_COLS = 7;
export const MAZE_ROWS = 5;
export const MAZE: readonly (readonly number[])[] = [
  [1, 1, 0, 0, 0, 1, 1],
  [1, 1, 0, 1, 0, 1, 1],
  [0, 0, 0, 1, 0, 0, 0],
  [1, 1, 0, 1, 0, 1, 1],
  [1, 1, 0, 0, 0, 1, 1],
];
export const MAZE_START = { x: 0, y: 2 };
export const MAZE_EXIT = { x: 6, y: 2 };

export function canEnter(x: number, y: number): boolean {
  if (y < 0 || y >= MAZE_ROWS || x < 0 || x >= MAZE_COLS) return false;
  return MAZE[y]![x] === 0;
}

// ---------- Floor 8 / 9 — the true object among decoys ----------
export function pickTrue(clickedId: string, trueId: string): "clear" | "fail" {
  return clickedId === trueId ? "clear" : "fail";
}

// ---------- Floor 9 — final trial (escort leg) ----------
export function isInsideCorridor(y: number, center: number, halfWidth: number): boolean {
  return Math.abs(y - center) <= halfWidth;
}

export function collidesWithObstacle(x: number, y: number, ox: number, oy: number, radius: number): boolean {
  return Math.hypot(x - ox, y - oy) < radius;
}
