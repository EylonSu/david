import confetti from 'canvas-confetti';

const COLORS = ['#f6c85f', '#f4a261', '#e76f51', '#2a9d8f', '#a8d5e2', '#ffffff'];
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const base = { colors: COLORS, disableForReducedMotion: true, zIndex: 1000 };

const STYLES: Array<() => void> = [
  // center burst
  () => confetti({ ...base, particleCount: 90, spread: 80, startVelocity: 40, origin: { y: 0.6 } }),
  // side cannons
  () => {
    confetti({ ...base, particleCount: 50, angle: 60, spread: 60, origin: { x: 0, y: 0.75 } });
    confetti({ ...base, particleCount: 50, angle: 120, spread: 60, origin: { x: 1, y: 0.75 } });
  },
  // stars
  () =>
    confetti({
      ...base,
      shapes: ['star'],
      colors: ['#f6c85f', '#f4a261', '#fff1b8'],
      particleCount: 45,
      spread: 360,
      startVelocity: 28,
      gravity: 0.6,
      scalar: 1.4,
      origin: { y: 0.45 },
    }),
  // gentle rain from the top
  () =>
    confetti({ ...base, particleCount: 80, angle: 270, spread: 140, startVelocity: 12, gravity: 0.7, origin: { y: -0.1 } }),
  // round bubbles
  () =>
    confetti({ ...base, shapes: ['circle'], particleCount: 60, spread: 100, scalar: 1.6, startVelocity: 32, origin: { y: 0.65 } }),
];

let last = -1;

/** A random confetti style, never the same twice in a row. */
export function fireRewardConfetti(): void {
  if (reduced()) return;
  let i = Math.floor(Math.random() * STYLES.length);
  if (i === last) i = (i + 1) % STYLES.length;
  last = i;
  STYLES[i]();
}

/** Longer fireworks for the end-of-lesson celebration. */
export function fireCelebrationConfetti(durationMs = 2500): () => void {
  if (reduced()) return () => {};
  const end = Date.now() + durationMs;
  const id = window.setInterval(() => {
    if (Date.now() > end) return window.clearInterval(id);
    confetti({
      ...base,
      particleCount: 40,
      spread: 360,
      startVelocity: 30,
      ticks: 70,
      shapes: Math.random() < 0.4 ? ['star'] : ['square', 'circle'],
      origin: { x: 0.15 + Math.random() * 0.7, y: 0.15 + Math.random() * 0.4 },
    });
  }, 300);
  return () => window.clearInterval(id);
}
