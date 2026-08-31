// Lightweight Web Audio synthesis — no audio files. The context is created
// lazily on the first user gesture so autoplay policies are respected, and
// every call is defensive: a browser that refuses audio should never break
// the game.
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
  }: { freq: number; duration: number; type?: OscillatorType; gain?: number; delay?: number; detune?: number },
): void {
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  const start = c.currentTime + delay;
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(gain, start + 0.008);
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

/** A satisfying, tactile mechanical click plus a soft tonal resonance. */
export function playCorrect(): void {
  const c = context();
  if (!c) return;
  noiseBurst(c, { duration: 0.05, gain: 0.15 });
  tone(c, { freq: 440, duration: 0.12, type: "triangle", gain: 0.18, delay: 0.01 });
  tone(c, { freq: 660, duration: 0.18, type: "sine", gain: 0.1, delay: 0.02 });
}

/** A dry, dissonant buzz for a wrong press. */
export function playWrong(): void {
  const c = context();
  if (!c) return;
  tone(c, { freq: 140, duration: 0.14, type: "sawtooth", gain: 0.16 });
  tone(c, { freq: 152, duration: 0.14, type: "sawtooth", gain: 0.12, detune: 8 });
}

/** A short resolving chord for the win. */
export function playWin(): void {
  const c = context();
  if (!c) return;
  [523.25, 659.25, 783.99].forEach((freq, i) =>
    tone(c, { freq, duration: 0.7, type: "sine", gain: 0.14, delay: i * 0.05 }),
  );
}

/** A low, distorted collapse for the loss. */
export function playLose(): void {
  const c = context();
  if (!c) return;
  tone(c, { freq: 110, duration: 0.9, type: "sawtooth", gain: 0.16 });
  tone(c, { freq: 96, duration: 0.9, type: "sawtooth", gain: 0.12, delay: 0.05 });
  noiseBurst(c, { duration: 0.5, gain: 0.12, delay: 0.05 });
}
