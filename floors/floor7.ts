// Floor 7 — Theseus in the labyrinth. The maze is shown lit for a few
// seconds, then the walls fade to invisible; only memory carries the player
// from start to exit. Touching a hidden wall is fatal, same as everywhere
// else in the tower.
import { MAZE, MAZE_COLS, MAZE_ROWS, MAZE_START, MAZE_EXIT, canEnter } from "./rules.ts";
import { makeSphere, place, raf, rectOf, type FloorContext, type FloorController } from "./shared.ts";

const PREVIEW_MS = 3000;
const FADE_MS = 600;
const MOVE_COOLDOWN = 150;

function cellCenter(x: number, y: number): { x: number; y: number } {
  return {
    x: (x + 0.5) / MAZE_COLS,
    y: (y + 0.5) / MAZE_ROWS,
  };
}

export function mount(container: HTMLElement, ctx: FloorContext): FloorController {
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

  const exitMarker = makeSphere("ghost");
  exitMarker.classList.add("maze-exit");
  container.appendChild(exitMarker);

  const player = makeSphere("target");
  player.classList.add("sphere--maze-runner");
  container.appendChild(player);

  let px = MAZE_START.x;
  let py = MAZE_START.y;
  let lastMove = 0;
  let resolved = false;

  const fadeTimer = window.setTimeout(() => {
    maze.classList.add("maze--hidden");
  }, PREVIEW_MS);
  window.setTimeout(() => {
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
      window.clearTimeout(fadeTimer);
      window.removeEventListener("keydown", onKeyDown);
      maze.remove();
      exitMarker.remove();
      player.remove();
    },
  };
}
