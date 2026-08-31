// Shared myth caption: a short, non-instructional line at the top of every
// floor. It hints at the mechanic through the story, never at the input
// ("click here", "wait for the wind") — that's the whole point of it.
import type { FloorController } from "./shared.ts";

export interface MythCaption {
  title: string;
  /** A single line, or several revealed one after another. */
  text: string | string[];
  /** What stays on screen, faint, once the reveal settles. Defaults to the
   *  last line of `text` — set this only when the permanent trace should
   *  say something none of the reveal lines said outright. */
  residual?: string;
}

const HOLD_MS = 3200;
const LINE_HOLD_MS = 2600;
const LINE_FADE_MS = 260;
const SETTLE_OPACITY = "0.22";

export function showFloorMyth(container: HTMLElement, myth: MythCaption): FloorController {
  const el = document.createElement("div");
  el.className = "myth-caption";

  const title = document.createElement("p");
  title.className = "myth-caption__title";
  title.textContent = myth.title;
  el.appendChild(title);

  const text = document.createElement("p");
  text.className = "myth-caption__text";
  el.appendChild(text);

  container.appendChild(el);

  const lines = Array.isArray(myth.text) ? myth.text : [myth.text];
  const residual = myth.residual ?? lines[lines.length - 1]!;
  text.textContent = lines[0]!;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let timer: number | null = null;

  el.style.setProperty("--myth-settled-opacity", SETTLE_OPACITY);

  function settle(): void {
    text.textContent = residual;
    el.classList.add("myth-caption--settled");
  }

  /** Cross-fades the text to `lines[index]`, then either advances again or
   *  settles once the last line has had its turn. */
  function advance(index: number): void {
    text.classList.add("myth-caption__text--fading");
    timer = window.setTimeout(() => {
      text.textContent = lines[index]!;
      text.classList.remove("myth-caption__text--fading");
      const isLast = index === lines.length - 1;
      timer = window.setTimeout(
        () => (isLast ? settle() : advance(index + 1)),
        isLast ? HOLD_MS : LINE_HOLD_MS,
      );
    }, LINE_FADE_MS);
  }

  if (reducedMotion) {
    el.classList.add("myth-caption--visible", "myth-caption--settled");
    settle();
  } else {
    requestAnimationFrame(() => el.classList.add("myth-caption--visible"));
    timer = window.setTimeout(
      () => (lines.length > 1 ? advance(1) : settle()),
      lines.length > 1 ? LINE_HOLD_MS : HOLD_MS,
    );
  }

  return {
    destroy(): void {
      if (timer !== null) window.clearTimeout(timer);
      el.remove();
    },
  };
}

export interface StaticMythLine {
  text: string;
  /** Slightly smaller, still clearly readable — for a secondary clause that
   *  sits under a more prominent first line. */
  small?: boolean;
}

/** Floor 8 and Floor 9 only. Their rules are complex enough that the player
 *  needs to re-read every line at any moment during play, not just once at
 *  the start — so unlike showFloorMyth, this shows the title and every line
 *  at once, never advances or fades between lines, and never settles to a
 *  dim residual. It only ever disappears when the floor's own destroy() runs
 *  (cleared or restarted), never on its own timer. */
export function showStaticFloorMyth(
  container: HTMLElement,
  myth: { title: string; lines: (string | StaticMythLine)[] },
): FloorController {
  const el = document.createElement("div");
  el.className = "myth-static";

  const title = document.createElement("p");
  title.className = "myth-static__title";
  title.textContent = myth.title;
  el.appendChild(title);

  for (const line of myth.lines) {
    const isSmall = typeof line !== "string" && (line.small ?? false);
    const p = document.createElement("p");
    p.className = isSmall ? "myth-static__line myth-static__line--small" : "myth-static__line";
    p.textContent = typeof line === "string" ? line : line.text;
    el.appendChild(p);
  }

  container.appendChild(el);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) el.classList.add("myth-static--visible");
  else requestAnimationFrame(() => el.classList.add("myth-static--visible"));

  return {
    destroy(): void {
      el.remove();
    },
  };
}
