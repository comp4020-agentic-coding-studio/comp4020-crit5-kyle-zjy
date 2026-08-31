// The nine-orb progress rail: gold while a floor is unclaimed, ash once
// cleared. Persistent during play, resolved/reset with a reverse flicker
// when the tower rewinds. No numeric "3/9" readout — the orbs are the
// entire progress indicator.
import { FLOOR_COUNT } from "./tower.ts";

export function createOrbRail(container: HTMLElement) {
  const orbs: HTMLDivElement[] = [];
  for (let i = 0; i < FLOOR_COUNT; i++) {
    const orb = document.createElement("div");
    orb.className = "orb orb--gold";
    container.appendChild(orb);
    orbs.push(orb);
  }

  return {
    setCleared(cleared: readonly boolean[]): void {
      for (let i = 0; i < orbs.length; i++) {
        orbs[i]!.classList.toggle("orb--ash", Boolean(cleared[i]));
      }
    },
    /** Ash orbs re-light gold in reverse order, echoing time running backward. */
    async playRewind(): Promise<void> {
      const ashIndices = orbs
        .map((orb, i) => (orb.classList.contains("orb--ash") ? i : -1))
        .filter((i) => i >= 0)
        .reverse();
      for (const i of ashIndices) {
        orbs[i]!.classList.add("orb--relight");
        await new Promise((resolve) => window.setTimeout(resolve, 70));
        orbs[i]!.classList.remove("orb--ash", "orb--relight");
      }
    },
    /** Anchor-mode rewind: no full relight, just a brief flicker on the
     *  floor the player is anchored to, so it still reads as "time reset"
     *  without touching the other orbs' progress. */
    pulseCurrent(index: number): void {
      const orb = orbs[index];
      if (!orb) return;
      orb.classList.add("orb--relight");
      window.setTimeout(() => orb.classList.remove("orb--relight"), 260);
    },
    async dissolve(): Promise<void> {
      for (const orb of orbs) orb.classList.add("orb--relight");
      await new Promise((resolve) => window.setTimeout(resolve, 260));
      for (const orb of orbs) orb.classList.remove("orb--relight");
      container.classList.add("orb-rail--fade");
      await new Promise((resolve) => window.setTimeout(resolve, 900));
    },
  };
}

export type OrbRail = ReturnType<typeof createOrbRail>;
