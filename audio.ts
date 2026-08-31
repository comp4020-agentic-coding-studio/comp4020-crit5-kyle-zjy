// Lightweight Web Audio synthesis — no audio files. The context is created
// lazily on the first user gesture so autoplay policies are respected, and
// every call is defensive: a browser that refuses audio should never break
// the game. Four narrative cues only, one per moment that matters: waking,
// clearing a floor, the time-reversal, and the final release.
let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

/** Call from inside a user gesture handler to unlock audio on iOS/Safari. */
export function primeAudio(): void {
  const c = context();
  if (c?.state === "suspended") void c.resume();
}

function tone(
  c: AudioContext,
  {
    freq,
    duration,
    type = "sine",
    gain = 0.2,
    delay = 0,
    detune = 0,
    freqEnd,
  }: {
    freq: number;
    duration: number;
    type?: OscillatorType;
    gain?: number;
    delay?: number;
    detune?: number;
    freqEnd?: number;
  },
): void {
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  const start = c.currentTime + delay;
  osc.frequency.setValueAtTime(freq, start);
  if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), start + duration);
  osc.detune.value = detune;
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(gain, start + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp).connect(c.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function noiseBurst(c: AudioContext, { duration, gain = 0.2, delay = 0 }: { duration: number; gain?: number; delay?: number }): void {
  const frames = Math.max(1, Math.floor(c.sampleRate * duration));
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const amp = c.createGain();
  const start = c.currentTime + delay;
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  src.connect(amp).connect(c.destination);
  src.start(start);
}

/** A soft, low swell as the eyes open. */
export function playAwaken(): void {
  const c = context();
  if (!c) return;
  tone(c, { freq: 90, freqEnd: 220, duration: 2.2, type: "sine", gain: 0.1 });
  tone(c, { freq: 180, freqEnd: 330, duration: 2.4, type: "sine", gain: 0.05, delay: 0.3 });
}

/** A short ceremonial tone when a floor is cleared; pitch rises gently with
 *  the floor index so ascending the tower has an audible shape. */
export function playFloorClear(floorIndex: number): void {
  const c = context();
  if (!c) return;
  const base = 392 * 2 ** (floorIndex / 24);
  tone(c, { freq: base, duration: 0.5, type: "sine", gain: 0.16 });
  tone(c, { freq: base * 1.5, duration: 0.7, type: "sine", gain: 0.08, delay: 0.05 });
}

/** A collapsing, reversing swell for death and the rewind that follows it. */
export function playRewind(): void {
  const c = context();
  if (!c) return;
  tone(c, { freq: 260, freqEnd: 70, duration: 0.9, type: "sawtooth", gain: 0.14 });
  noiseBurst(c, { duration: 0.35, gain: 0.1, delay: 0.05 });
}

/** A clean, resolving chord for the ending — release, then silence. */
export function playEndingChord(): void {
  const c = context();
  if (!c) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
    tone(c, { freq, duration: 1.6, type: "sine", gain: 0.1, delay: i * 0.08 }),
  );
}
