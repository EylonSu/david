import { getAudioContext } from './context';

function tone(
  freq: number,
  startAt: number,
  duration: number,
  { type = 'sine' as OscillatorType, gain = 0.25, glideTo }: { type?: OscillatorType; gain?: number; glideTo?: number } = {},
) {
  const ctx = getAudioContext();
  const t0 = ctx.currentTime + startAt;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + duration);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

/** Soft short "pop" for every tap (instant feedback). */
export function playTap(): void {
  tone(520, 0, 0.09, { gain: 0.18, glideTo: 780 });
}

type Chime = () => number;

const CHIMES: Chime[] = [
  // rising major arpeggio
  () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.11, 0.5, { gain: 0.2 }));
    return 0.9;
  },
  // sparkle bells
  () => {
    [1318.5, 1567.98, 2093, 1567.98, 2093].forEach((f, i) =>
      tone(f, i * 0.08, 0.35, { type: 'triangle', gain: 0.12 }),
    );
    return 0.75;
  },
  // happy slide up + chord
  () => {
    tone(392, 0, 0.3, { type: 'triangle', glideTo: 784, gain: 0.18 });
    [523.25, 659.25, 783.99].forEach((f) => tone(f, 0.3, 0.7, { gain: 0.12 }));
    return 1.0;
  },
  // bouncy two-note "ta-da"
  () => {
    tone(587.33, 0, 0.18, { type: 'square', gain: 0.07 });
    tone(880, 0.18, 0.6, { type: 'square', gain: 0.07 });
    tone(1760, 0.18, 0.6, { gain: 0.08 });
    return 0.8;
  },
];

let lastChime = -1;

/** Play a random reward chime (never the same twice in a row). Returns duration in seconds. */
export function playRewardChime(): number {
  let i = Math.floor(Math.random() * CHIMES.length);
  if (i === lastChime) i = (i + 1) % CHIMES.length;
  lastChime = i;
  return CHIMES[i]();
}

/** Bigger fanfare for finishing a lesson. Returns duration in seconds. */
export function playCelebration(): number {
  const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5];
  notes.forEach((f, i) => tone(f, i * 0.12, 0.45, { type: 'triangle', gain: 0.16 }));
  [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(f, notes.length * 0.12, 1.2, { gain: 0.1 }));
  return notes.length * 0.12 + 1.2;
}

/** Unlock audio on first user gesture (call from a tap handler). */
export function unlockAudio(): void {
  getAudioContext();
}
