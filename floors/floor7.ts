// Floor 7 — Theseus in the labyrinth. Ariadne's thread traces the way out
// once, briefly, then fades — after that only memory carries the player from
// start to exit, same as the walls themselves fading a few seconds later.
// Keyboard and the on-screen pad are two doors onto the same movement.
import { MAZE, MAZE_COLS, MAZE_ROWS, MAZE_START, MAZE_EXIT, MAZE_SOLUTION, canEnter } from "./rules.ts";
import { makeSphere, place, raf, rectOf, type FloorContext, type FloorController } from "./shared.ts";
import { showFloorMyth } from "./caption.ts";

const PREVIEW_MS = 3000;
const FADE_MS = 600;
const MOVE_COOLDOWN = 150;
const THREAD_VISIBLE_MS = 2000;
const THREAD_FADE_MS = 800;
const SVG_NS = "http://www.w3.org/2000/svg";

function cellCenter(x: number, y: number): { x: number; y: number } {
  return {
    x: (x + 0.5) / MAZE_COLS,
    y: (y + 0.5) / MAZE_ROWS,
  };
}

export function mount(container: HTMLElement, ctx: FloorContext): FloorController {
  const myth = showFloorMyth(container, {
    title: "Theseus",
    text: "Ariadne gave him a thread, so he would remember the way back through the maze.",
  });

  const maze = document.createElement("div");
  maze.className = "maze";
  const wallEls: HTMLDivElement[] = [];

  for (let y = 0; y < MAZE_ROWS; y++) {
    for (let x = 0; x < MAZE_COLS; x++) {
      if (MAZE[y]![x] !== 1) continue;
      const wall = document.createElement("div");
      wall.className = "maze-wall";
      wall.style.left = `${(x / MAZE_COLS) * 100}%`;
      wall.style.top = `${(y / MAZE_ROWS) * 100}%`;
      wall.style.width = `${(1 / MAZE_COLS) * 100}%`;
      wall.style.height = `${(1 / MAZE_ROWS) * 100}%`;
      maze.appendChild(wall);
      wallEls.push(wall);
    }
  }
  container.appendChild(maze);

  const thread = document.createElementNS(SVG_NS, "svg");
  thread.setAttribute("class", "maze-thread");
  thread.setAttribute("viewBox", "0 0 100 100");
  thread.setAttribute("preserveAspectRatio", "none");
  const threadLine = document.createElementNS(SVG_NS, "polyline");
  threadLine.setAttribute("class", "maze-thread__line");
  threadLine.setAttribute(
    "points",
    MAZE_SOLUTION.map(({ x, y }) => {
      const c = cellCenter(x, y);
      return `${c.x * 100},${c.y * 100}`;
    }).join(" "),
  );
  thread.appendChild(threadLine);
  container.appendChild(thread);

  const exitMarker = makeSphere("ghost");
  exitMarker.classList.add("maze-exit");
  container.appendChild(exitMarker);

  const player = makeSphere("target");
  player.classList.add("sphere--maze-runner");
  container.appendChild(player);

  const dpad = document.createElement("div");
  dpad.className = "dpad";
  dpad.innerHTML = `
    <button type="button" class="dpad__btn dpad__btn--up" aria-label="Move up">&#8593;</button>
    <button type="button" class="dpad__btn dpad__btn--left" aria-label="Move left">&#8592;</button>
    <button type="button" class="dpad__btn dpad__btn--down" aria-label="Move down">&#8595;</button>
    <button type="button" class="dpad__btn dpad__btn--right" aria-label="Move right">&#8594;</button>
  `;
  container.appendChild(dpad);

  let px = MAZE_START.x;
  let py = MAZE_START.y;
  let lastMove = 0;
  let resolved = false;

  const threadFadeTimer = window.setTimeout(() => {
    thread.classList.add("maze-thread--faded");
  }, THREAD_VISIBLE_MS);
  const threadRemoveTimer = window.setTimeout(() => {
    thread.remove();
  }, THREAD_VISIBLE_MS + THREAD_FADE_MS);

  const fadeTimer = window.setTimeout(() => {
    maze.classList.add("maze--hidden");
  }, PREVIEW_MS);
  const fadedTimer = window.setTimeout(() => {
    if (!resolved) maze.classList.add("maze--faded");
  }, PREVIEW_MS + FADE_MS);

  function tryMove(dx: number, dy: number): void {
    if (resolved) return;
    const now = performance.now();
    if (now - lastMove < MOVE_COOLDOWN) return;
    lastMove = now;

    const nx = px + dx;
    const ny = py + dy;
    if (!canEnter(nx, ny)) {
      resolved = true;
      player.classList.add("sphere--extinguish");
      window.setTimeout(() => ctx.onFail(), 300);
      return;
    }
    px = nx;
    py = ny;
    if (px === MAZE_EXIT.x && py === MAZE_EXIT.y) {
      resolved = true;
      player.classList.add("sphere--pressed");
      window.setTimeout(() => ctx.onClear(), 260);
    }
  }

  function onKeyDown(ev: KeyboardEvent): void {
    switch (ev.code) {
      case "ArrowUp":
      case "KeyW":
        tryMove(0, -1);
        break;
      case "ArrowDown":
      case "KeyS":
        tryMove(0, 1);
        break;
      case "ArrowLeft":
      case "KeyA":
        tryMove(-1, 0);
        break;
      case "ArrowRight":
      case "KeyD":
        tryMove(1, 0);
        break;
      default:
        return;
    }
    ev.preventDefault();
  }
  window.addEventListener("keydown", onKeyDown);

  const dpadMoves: Record<string, [number, number]> = {
    "dpad__btn--up": [0, -1],
    "dpad__btn--down": [0, 1],
    "dpad__btn--left": [-1, 0],
    "dpad__btn--right": [1, 0],
  };
  function onDpadPress(ev: PointerEvent): void {
    const target = ev.currentTarget as HTMLButtonElement;
    ev.preventDefault();
    for (const [cls, [dx, dy]] of Object.entries(dpadMoves)) {
      if (target.classList.contains(cls)) tryMove(dx, dy);
    }
  }
  const dpadButtons = Array.from(dpad.querySelectorAll<HTMLButtonElement>(".dpad__btn"));
  for (const button of dpadButtons) {
    button.addEventListener("pointerdown", onDpadPress);
  }

  const stop = raf(() => {
    const rect = rectOf(container);
    const exit = cellCenter(MAZE_EXIT.x, MAZE_EXIT.y);
    place(exitMarker, exit.x, exit.y, rect);
    const here = cellCenter(px, py);
    place(player, here.x, here.y, rect);
  });

  return {
    destroy(): void {
      stop();
      myth.destroy();
      window.clearTimeout(fadeTimer);
      window.clearTimeout(fadedTimer);
      window.clearTimeout(threadFadeTimer);
      window.clearTimeout(threadRemoveTimer);
      window.removeEventListener("keydown", onKeyDown);
      for (const button of dpadButtons) button.removeEventListener("pointerdown", onDpadPress);
      maze.remove();
      thread.remove();
      exitMarker.remove();
      player.remove();
      dpad.remove();
    },
  };
}
