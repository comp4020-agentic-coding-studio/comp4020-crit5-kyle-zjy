// The escape. Gameplay stops, the screen bleaches to white, and one line
// remains. Deliberately the simplest module in the codebase — release
// should feel quiet, not busy.
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function playEnding(overlay: HTMLElement, onReplay: () => void): Promise<void> {
  overlay.classList.add("is-visible");
  overlay.innerHTML = "";

  const whiteout = document.createElement("div");
  whiteout.className = "ending-whiteout";
  overlay.appendChild(whiteout);

  const title = document.createElement("p");
  title.className = "ending-title";
  title.textContent = "You have escaped";
  overlay.appendChild(title);

  const epilogue = document.createElement("p");
  epilogue.className = "ending-epilogue";
  epilogue.textContent = "The chaos has opened. The cycle has ended.";
  overlay.appendChild(epilogue);

  const hint = document.createElement("p");
  hint.className = "ending-hint";
  hint.textContent = "Dream it again";
  overlay.appendChild(hint);

  await wait(50);
  whiteout.classList.add("is-visible");
  await wait(1200);
  title.classList.add("is-visible");
  await wait(1800);
  epilogue.classList.add("is-visible");
  await wait(1600);
  hint.classList.add("is-visible");

  hint.addEventListener(
    "pointerdown",
    () => {
      overlay.classList.remove("is-visible");
      overlay.innerHTML = "";
      onReplay();
    },
    { once: true },
  );
}
