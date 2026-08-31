// Pure game rules for ONE BUTTON TOO MANY. No DOM, no timers, no
// Math.random() — every source of randomness is the injected `rng`, so the
// whole state machine is deterministic and unit-testable in isolation from
// rendering (render.ts owns presentation).
import { placeButtons } from "./placement.ts";

export type Rng = () => number;

export type GameStatus = "idle" | "playing" | "won" | "lost";

/** How convincingly a button reacts to the pointer approaching it. */
export type PointerQuality = "authentic" | "delayed" | "exaggerated" | "mirrored" | "none";

export interface ButtonBehaviour {
  breathing: boolean;
  /** 0..1 phase offset into the shared breathing cycle. */
  breathPhase: number;
  highlight: boolean;
  /** 0..1 phase offset into the shared highlight sweep. */
  highlightPhase: number;
  /** Relative speed of the highlight sweep; 1 is the authentic rhythm. */
  highlightSpeed: number;
  pointerQuality: PointerQuality;
}

export interface ButtonEntity {
  id: string;
  isTarget: boolean;
  /** Normalised position within the arena, 0..1. */
  x: number;
  y: number;
  behaviour: ButtonBehaviour;
}

export interface GameState {
  status: GameStatus;
  stage: number;
  mistakes: number;
  maxMistakes: number;
  targetId: string;
  buttons: ButtonEntity[];
  startedAt: number | null;
  finishedAt: number | null;
}

/** Buttons on screen at each stage, target included. Stage index is 0-based. */
export const STAGE_BUTTON_COUNT = [1, 1, 2, 3, 4, 5, 7, 9, 13] as const;
export const STAGE_COUNT = STAGE_BUTTON_COUNT.length;
export const MAX_MISTAKES = 3;

/** Minimum normalised centre-to-centre distance between buttons per stage. */
const STAGE_MIN_DISTANCE = [0, 0, 0.34, 0.3, 0.27, 0.24, 0.19, 0.16, 0.13];
const ARENA_MARGIN = 0.12;

const TARGET_ID = "target";

const AUTHENTIC_BEHAVIOUR: ButtonBehaviour = {
  breathing: true,
  breathPhase: 0,
  highlight: true,
  highlightPhase: 0,
  highlightSpeed: 1,
  pointerQuality: "authentic",
};

const STATIC_DECOY: ButtonBehaviour = {
  breathing: false,
  breathPhase: 0,
  highlight: false,
  highlightPhase: 0,
  highlightSpeed: 1,
  pointerQuality: "none",
};

/** Decoy behaviour templates, richest deception introduced last. Each stage
 * draws from a growing pool so early decoys stay easy and later ones each
 * imitate exactly one authentic trait, never the full combination. */
const DECOY_POOL: ButtonBehaviour[] = [
  { ...STATIC_DECOY },
  { ...STATIC_DECOY, breathing: true, breathPhase: 0.5 }, // breathes, wrong phase
  { ...STATIC_DECOY, highlight: true, highlightSpeed: 1.7 }, // sweeps too fast
  { ...STATIC_DECOY, pointerQuality: "delayed" },
  { ...STATIC_DECOY, pointerQuality: "exaggerated" },
  { ...STATIC_DECOY, pointerQuality: "mirrored" },
  { ...STATIC_DECOY, breathing: true, breathPhase: 0.25 },
  { ...STATIC_DECOY, highlight: true, highlightPhase: 0.4, highlightSpeed: 1 },
  { ...STATIC_DECOY, breathing: true, breathPhase: 0.5, pointerQuality: "delayed" },
  { ...STATIC_DECOY, highlight: true, highlightSpeed: 0.6, pointerQuality: "exaggerated" },
  { ...STATIC_DECOY, pointerQuality: "mirrored", breathing: true, breathPhase: 0.75 },
  { ...STATIC_DECOY, highlight: true, highlightSpeed: 1.7, pointerQuality: "delayed" },
];

function decoyBehaviourFor(stage: number, index: number): ButtonBehaviour {
  // Stages unlock deeper deception gradually: stage 2 only ever sees the
  // plain static decoy, stage 3 can also draw the phase-wrong breather, etc.
  const unlocked = Math.min(DECOY_POOL.length, Math.max(1, stage));
  return DECOY_POOL[index % unlocked];
}

function buildButtons(stage: number, rng: Rng): ButtonEntity[] {
  const count = STAGE_BUTTON_COUNT[stage];
  const positions = placeButtons({
    count,
    minDistance: STAGE_MIN_DISTANCE[stage],
    margin: ARENA_MARGIN,
    rng,
  });

  // The target's own position is drawn first so its placement stays stable
  // in the random sequence regardless of decoy count, then decoys fan out
  // around it in stable id order (own ids let render.ts track continuity).
  const buttons: ButtonEntity[] = [
    {
      id: TARGET_ID,
      isTarget: true,
      x: positions[0].x,
      y: positions[0].y,
      behaviour: { ...AUTHENTIC_BEHAVIOUR },
    },
  ];

  for (let i = 1; i < count; i++) {
    // Slot-based, not stage-based: a decoy that already existed keeps its id
    // as the stage advances, so it can be smoothly repositioned (the
    // "Shuffle" stage) rather than torn down and rebuilt every round. Decoy
    // counts only ever grow (STAGE_BUTTON_COUNT is non-decreasing), so a slot
    // is never orphaned.
    buttons.push({
      id: `decoy-${i}`,
      isTarget: false,
      x: positions[i].x,
      y: positions[i].y,
      behaviour: decoyBehaviourFor(stage, i - 1),
    });
  }

  return buttons;
}

export interface CreateGameOptions {
  rng?: Rng;
}

export function createGame({ rng = Math.random }: CreateGameOptions = {}): GameState {
  return {
    status: "idle",
    stage: 0,
    mistakes: 0,
    maxMistakes: MAX_MISTAKES,
    targetId: TARGET_ID,
    buttons: buildButtons(0, rng),
    startedAt: null,
    finishedAt: null,
  };
}

/**
 * Apply a press on `buttonId` to `state`, returning a new state. Pure: the
 * only inputs are the current state, the id pressed, an rng for the next
 * stage's layout, and a clock reading for timing. Presses against a finished
 * game are no-ops.
 */
export function pressButton(
  state: GameState,
  buttonId: string,
  rng: Rng,
  now: number,
): GameState {
  if (state.status === "won" || state.status === "lost") return state;

  const startedAt = state.startedAt ?? now;
  const isCorrect = buttonId === state.targetId;

  if (!isCorrect) {
    const mistakes = state.mistakes + 1;
    const lost = mistakes >= state.maxMistakes;
    return {
      ...state,
      status: lost ? "lost" : "playing",
      mistakes,
      startedAt,
      finishedAt: lost ? now : state.finishedAt,
    };
  }

  const nextStage = state.stage + 1;
  if (nextStage >= STAGE_COUNT) {
    return {
      ...state,
      status: "won",
      startedAt,
      finishedAt: now,
    };
  }

  return {
    ...state,
    status: "playing",
    stage: nextStage,
    buttons: buildButtons(nextStage, rng),
    startedAt,
    finishedAt: null,
  };
}

export function resetGame(rng: Rng = Math.random): GameState {
  return createGame({ rng });
}
