// The Rewind Anchor toggle: a real switch, top-right, that remembers the
// player's choice for this tab only. It never touches game state itself —
// it just reports changes upward (main.ts feeds them into tower.ts) and
// stops its own clicks from ever reaching the floor underneath.
const STORAGE_KEY = "ninefold-tower:anchor";

export function loadAnchorPreference(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveAnchorPreference(enabled: boolean): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Storage unavailable (private mode, etc.) — the toggle still works for
    // this page load, it just won't persist across a restart.
  }
}

export interface AnchorToggle {
  destroy(): void;
}

export function createAnchorToggle(
  container: HTMLElement,
  initial: boolean,
  onChange: (enabled: boolean) => void,
): AnchorToggle {
  let enabled = initial;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "anchor-toggle";
  button.setAttribute("role", "switch");

  const label = document.createElement("span");
  label.className = "anchor-toggle__label";
  label.textContent = "Rebirth Anchor";
  button.appendChild(label);

  const dot = document.createElement("span");
  dot.className = "anchor-toggle__dot";
  dot.setAttribute("aria-hidden", "true");
  button.appendChild(dot);

  function render(): void {
    button.setAttribute("aria-checked", String(enabled));
    button.classList.toggle("anchor-toggle--on", enabled);
    dot.textContent = enabled ? "●" : "○";
  }
  render();

  // A click here must never read as a game action (shoot/drag/gaze/charge)
  // to whichever floor is currently mounted underneath.
  function stop(ev: Event): void {
    ev.stopPropagation();
  }
  button.addEventListener("pointerdown", stop);
  button.addEventListener("pointerup", stop);
  button.addEventListener("click", (ev) => {
    stop(ev);
    enabled = !enabled;
    saveAnchorPreference(enabled);
    render();
    onChange(enabled);
  });

  container.appendChild(button);

  return {
    destroy(): void {
      button.remove();
    },
  };
}
