// Wiring only: owns the one mutable GameState, calls into game.ts for every
// transition, and hands the result to render.ts / audio.ts. No game rules and
// no animation code live here.
import { createGame, pressButton, STAGE_COUNT, type GameState } from "./game.ts";
import { createRenderer } from "./render.ts";
import { playCorrect, playWrong, playWin, playLose, primeAudio } from "./audio.ts";

const stageEl = document.querySelector<HTMLElement>("#stage");
const endScreen = document.querySelector<HTMLElement>("#end-screen");
const endTitle = document.querySelector<HTMLElement>("#end-title");
const endStats = document.querySelector<HTMLElement>("#end-stats");

if (!stageEl || !endScreen || !endTitle || !endStats) {
  throw new Error("expected game markup is missing from index.html");
}

let state: GameState = createGame();
let ending = false;

const renderer = createRenderer(stageEl, {
  onPress: handlePress,
  onFirstGesture: primeAudio,
});

renderer.render(state, state.stage);

function handlePress(id: string): void {
  if (ending || state.status === "won" || state.status === "lost") return;

  const isCorrect = id === state.targetId;
  const previous = state;
  state = pressButton(state, id, Math.random, performance.now());

  if (isCorrect) {
    renderer.pulseCorrect(id);
    playCorrect();
  } else {
    renderer.pulseInvalid(id);
    renderer.shake();
    renderer.setDamage(state.mistakes);
    playWrong();
  }

  if (state.status === "won" || state.status === "lost") {
    void finish(state);
    return;
  }

  if (state.stage !== previous.stage) renderer.render(state, state.stage);
}

async function finish(finished: GameState): Promise<void> {
  ending = true;
  const status = finished.status === "won" ? "won" : "lost";
  if (status === "won") playWin();
  else playLose();

  await renderer.playEnding(status);
  showEndScreen(finished);
}

function showEndScreen(finished: GameState): void {
  const elapsed = ((finished.finishedAt ?? 0) - (finished.startedAt ?? finished.finishedAt ?? 0)) / 1000;
  const seconds = elapsed.toFixed(1);

  if (finished.status === "won") {
    endTitle!.textContent = "ONE WAS ENOUGH.";
    endStats!.textContent = `${finished.mistakes} mistake${finished.mistakes === 1 ? "" : "s"} · ${seconds}s`;
  } else {
    endTitle!.textContent = "TOO MANY.";
    endStats!.textContent = `${finished.stage} / ${STAGE_COUNT} · ${seconds}s`;
  }

  endScreen!.classList.add("is-visible");
  window.setTimeout(armRestart, 500);
}

function armRestart(): void {
  const restart = (): void => {
    window.removeEventListener("keydown", restart);
    endScreen!.classList.remove("is-visible");
    renderer.reset();
    ending = false;
    state = createGame();
    renderer.render(state, state.stage);
  };
  stageEl!.addEventListener("pointerdown", restart, { once: true });
  window.addEventListener("keydown", restart, { once: true });
}
