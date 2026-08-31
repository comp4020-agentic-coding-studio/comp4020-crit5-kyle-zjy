// The wake-up sequence (first run only) and the brief rewind flash used on
// every later death. Both build their own DOM inside the overlay container
// they're given and clean up after themselves, so main.ts only has to call
// one function and await the promise.
const WAKE_LINES = ["你醒了……", "你被困在了这九层宝塔之中", "逃出这里", "或者", "死"];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** The eyelid-like reveal: a thin bright slit widens into light, then the
 *  screen settles back to black for the wake-up lines. First run only. */
export async function playAwakening(overlay: HTMLElement): Promise<void> {
  overlay.classList.add("is-visible");
  overlay.innerHTML = "";

  const glow = document.createElement("div");
  glow.className = "eye-glow";
  overlay.appendChild(glow);

  const lines = document.createElement("div");
  lines.className = "intro-lines";
  overlay.appendChild(lines);

  await wait(60);
  glow.classList.add("eye-glow--open");
  await wait(1500);
  glow.classList.add("eye-glow--settle");
  await wait(700);

  for (const text of WAKE_LINES) {
    const p = document.createElement("p");
    p.textContent = text;
    lines.replaceChildren(p);
    await wait(30);
    p.classList.add("is-visible");
    await wait(1150);
    p.classList.remove("is-visible");
    await wait(320);
  }

  overlay.classList.remove("is-visible");
  overlay.innerHTML = "";
}

/** Time reversing: a quick white flash and black collapse, optionally with
 *  a whisper of text. No wake-up narrative — the player already knows. */
export async function playRewindFlash(overlay: HTMLElement): Promise<void> {
  overlay.classList.add("is-visible");
  overlay.innerHTML = "";

  const flash = document.createElement("div");
  flash.className = "rewind-flash";
  overlay.appendChild(flash);

  const lines = document.createElement("div");
  lines.className = "intro-lines intro-lines--small";
  overlay.appendChild(lines);

  await wait(30);
  flash.classList.add("rewind-flash--peak");
  const whisper = document.createElement("p");
  whisper.textContent = "你又回来了";
  lines.appendChild(whisper);
  await wait(40);
  whisper.classList.add("is-visible");
  await wait(500);
  flash.classList.add("rewind-flash--collapse");
  whisper.classList.remove("is-visible");
  await wait(520);

  overlay.classList.remove("is-visible");
  overlay.innerHTML = "";
}
