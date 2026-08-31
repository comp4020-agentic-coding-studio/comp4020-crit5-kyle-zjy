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

// Three wind walls, each cycling windy -> calm on its own explicit period.
// Deterministic (no RNG) so a safe crossing window always exists and is
// testable; desynchronised periods/phases so the three walls' calm windows
// never line up, forcing wait-cross-wait-cross-wait rather than a straight run.
export interface WindWall {
  x0: number;
  x1: number;
  period: number;
  windyFraction: number;
  phase: number;
}
export const WIND_WALLS: readonly WindWall[] = [
  { x0: 0.3, x1: 0.36, period: 3.2, windyFraction: 0.55, phase: 0 },
  { x0: 0.48, x1: 0.54, period: 2.2, windyFraction: 0.5, phase: 1.1 },
  { x0: 0.66, x1: 0.72, period: 1.6, windyFraction: 0.4, phase: 0.4 },
];

export function isWindWallActive(wall: WindWall, t: number): boolean {
  const cycle = ((t + wall.phase) % wall.period + wall.period) % wall.period;
  return cycle < wall.period * wall.windyFraction;
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

// A single charge decides the whole throw: no held-down push, no fail state.
// Too little charge or too much both just mean the stone rolls back to the
// foot to try again — the return type has no "fail" variant, which is a
// structural guarantee this floor can never call ctx.onFail().
export const TARGET_ZONE_MIN = 0.78;
export const TARGET_ZONE_MAX = 1.0;

export function peakPositionForCharge(charge: number): number {
  const v0 = clamp(charge, 0, 1) * STONE_MAX_CLIMB_SPEED;
  return (v0 * v0) / (2 * STONE_GRAVITY);
}

export type ChargeOutcome = "short" | "clear" | "over";

export function chargeOutcome(charge: number): ChargeOutcome {
  const peak = peakPositionForCharge(charge);
  if (peak < TARGET_ZONE_MIN) return "short";
  if (peak > TARGET_ZONE_MAX) return "over";
  return "clear";
}

/** Initial launch speed for a given charge — the same v0 that peakPositionForCharge
 *  assumes, so the instant decision and the animated roll agree with each other. */
export function launchVelocityForCharge(charge: number): number {
  return clamp(charge, 0, 1) * STONE_MAX_CLIMB_SPEED;
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
// "Looking back" is a real gaze/facing check now, not a drag gesture: an
// angle between where the player is looking and forward, held long enough
// to count as a deliberate glance rather than a jittery instant.
export const LOOK_BACK_ANGLE_DEG = 120;
export const LOOK_BACK_DWELL_MS = 260;

/** Angle, in degrees, between the gaze vector and the forward axis (+x). */
export function gazeAngleDeg(gazeDx: number, gazeDy: number): number {
  const len = Math.hypot(gazeDx, gazeDy);
  if (len < 1e-6) return 0;
  return (Math.acos(clamp(gazeDx / len, -1, 1)) * 180) / Math.PI;
}

export function isGazingBackward(angleDeg: number): boolean {
  return angleDeg > LOOK_BACK_ANGLE_DEG;
}

/** Accumulates while gazing backward, resets the instant the gaze turns forward. */
export function stepLookBackTimer(currentMs: number, backward: boolean, dtMs: number): number {
  return backward ? currentMs + dtMs : 0;
}

export function hasLookedBack(timerMs: number): boolean {
  return timerMs >= LOOK_BACK_DWELL_MS;
}

// ---------- Floor 7 — Theseus in the labyrinth ----------
// A small hand-authored maze: 0 is open floor, 1 is wall. Symmetric upper and
// lower routes join the same junctions, so there's real branching, one
// enclosed dead-end spur near the exit, and several forced direction changes
// a player has to memorise rather than one straight corridor.
export const MAZE_COLS = 11;
export const MAZE_ROWS = 7;
export const MAZE: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
  [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
  [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
  [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];
export const MAZE_START = { x: 0, y: 3 };
export const MAZE_EXIT = { x: 10, y: 3 };

export function canEnter(x: number, y: number): boolean {
  if (y < 0 || y >= MAZE_ROWS || x < 0 || x >= MAZE_COLS) return false;
  return MAZE[y]![x] === 0;
}

/** The route Ariadne's thread traces on entry — shown briefly, then never
 *  consulted again by the movement rules. It is not the only valid route
 *  (the maze has a symmetric lower path too), just the one that's shown. */
export const MAZE_SOLUTION: readonly { x: number; y: number }[] = [
  { x: 0, y: 3 },
  { x: 1, y: 3 },
  { x: 1, y: 2 },
  { x: 1, y: 1 },
  { x: 2, y: 1 },
  { x: 3, y: 1 },
  { x: 3, y: 2 },
  { x: 3, y: 3 },
  { x: 4, y: 3 },
  { x: 5, y: 3 },
  { x: 5, y: 2 },
  { x: 5, y: 1 },
  { x: 6, y: 1 },
  { x: 7, y: 1 },
  { x: 7, y: 2 },
  { x: 7, y: 3 },
  { x: 8, y: 3 },
  { x: 9, y: 3 },
  { x: 10, y: 3 },
];

// ---------- Floor 8 / 9 — the true object among decoys ----------
export function pickTrue(clickedId: string, trueId: string): "clear" | "fail" {
  return clickedId === trueId ? "clear" : "fail";
}

// ---------- Floor 8 — five behaviours, one honest ----------
// Kept structurally separate from PointerQuality (shared.ts) to avoid a
// circular import, but every literal here is also a valid PointerQuality.
export type Floor8Quality = "authentic" | "mirrored" | "panic" | "orbit" | "pulse";
export const DECOY_QUALITIES: readonly Floor8Quality[] = ["mirrored", "panic", "orbit", "pulse"];

/** authentic at trueIndex, the four decoy qualities cycled deterministically
 *  across the rest — same shape as the assignment it replaces, new set. */
export function assignFloor8Qualities(trueIndex: number, count: number): Floor8Quality[] {
  const qualities: Floor8Quality[] = [];
  let decoySlot = 0;
  for (let i = 0; i < count; i++) {
    if (i === trueIndex) {
      qualities.push("authentic");
    } else {
      qualities.push(DECOY_QUALITIES[decoySlot % DECOY_QUALITIES.length]!);
      decoySlot++;
    }
  }
  return qualities;
}

// ---------- Floor 9 — Pangu splits heaven and earth ----------
// Three continuous stages inside one floor: break the chaos egg (power +
// timing), drag heaven up and earth down while the two drift back toward
// each other, then hold Pangu steady between them until they lock in place.
export type PanguPhase = "chaos" | "separating" | "supporting" | "complete";

// -- Stage 1: breaking chaos --
// The crack pulses bright/dim on a fixed period; a strike only lands with
// both enough charge AND a release timed to the bright peak. Failure just
// resets the attempt — a run of failures can eventually crack the player's
// patience (isChaosCollapsed), not the egg.
export const CRACK_PULSE_PERIOD = 2.6;
export const CRACK_CHARGE_MIN = 0.45;
export const CRACK_BRIGHTNESS_MIN = 0.82;
export const CHAOS_INSTABILITY_LIMIT = 5;

export function crackBrightnessAt(t: number): number {
  return (Math.sin((t / CRACK_PULSE_PERIOD) * Math.PI * 2) + 1) / 2;
}

export type ChaosStrikeOutcome = "success" | "fail";

export function chaosStrikeOutcome(charge: number, brightnessAtRelease: number): ChaosStrikeOutcome {
  return charge >= CRACK_CHARGE_MIN && brightnessAtRelease >= CRACK_BRIGHTNESS_MIN ? "success" : "fail";
}

export function stepChaosInstability(current: number, outcome: ChaosStrikeOutcome): number {
  return outcome === "success" ? 0 : current + 1;
}

export function isChaosCollapsed(instability: number): boolean {
  return instability >= CHAOS_INSTABILITY_LIMIT;
}

// -- Stage 2: dividing heaven and earth --
// Both halves start close around the centre line and drift back toward it
// whenever the player isn't actively dragging them — only one half can be
// tended at a time, forcing the player to alternate.
export const SKY_HOME_Y = 0.16;
export const EARTH_HOME_Y = 0.84;
// Full reunion from a home position takes ~0.34 / 0.03 ≈ 11s of neglect —
// a slowly building pressure, not an instant-collapse reflex test.
export const HALVES_REUNION_DRIFT = 0.03;
// A half that has already reached its home band pulls back far more weakly,
// so briefly letting go of it to go drag the other half doesn't undo it.
export const HALVES_REUNION_DRIFT_HOME_FACTOR = 0.2;
export const HALVES_COLLISION_GAP = 0.03;

export function isSkyHome(skyY: number): boolean {
  return skyY <= SKY_HOME_Y;
}

export function isEarthHome(earthY: number): boolean {
  return earthY >= EARTH_HOME_Y;
}

export function havePanguHalvesCollided(skyY: number, earthY: number): boolean {
  return earthY - skyY <= HALVES_COLLISION_GAP;
}

/** Drift one half back toward the centre line when it isn't being dragged. */
export function driftHalfTowardCenter(y: number, isSky: boolean, dt: number): number {
  const center = 0.5;
  const home = isSky ? isSkyHome(y) : isEarthHome(y);
  const rate = HALVES_REUNION_DRIFT * (home ? HALVES_REUNION_DRIFT_HOME_FACTOR : 1);
  const step = rate * dt;
  return isSky ? Math.min(center, y + step) : Math.max(center, y - step);
}

export function panguHalvesSettled(skyY: number, earthY: number): boolean {
  return isSkyHome(skyY) && isEarthHome(earthY);
}

// -- Stage 3: supporting heaven and earth --
// A small core drifts sideways under a deterministic "chaos disturbance";
// the player must keep it inside a safe zone around the centre for a
// sustained hold before the pillar locks in.
export const SUPPORT_SAFE_RADIUS = 0.16;
export const SUPPORT_HOLD_SECONDS = 5;

export function supportDisturbanceAt(t: number): number {
  return 0.5 * Math.sin(t * 0.9) + 0.3 * Math.sin(t * 2.3 + 1.7);
}

export function isCoreStable(offsetFromCenter: number): boolean {
  return Math.abs(offsetFromCenter) <= SUPPORT_SAFE_RADIUS;
}

export function stepSupportProgress(progress: number, stable: boolean, dt: number): number {
  if (!stable) return Math.max(0, progress - dt * 0.6);
  return Math.min(SUPPORT_HOLD_SECONDS, progress + dt);
}

export function isSupportComplete(progress: number): boolean {
  return progress >= SUPPORT_HOLD_SECONDS;
}
