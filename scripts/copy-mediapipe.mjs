// Copies MediaPipe tasks-vision WASM runtime into public/ so it is served locally (offline-capable).
// Usage: node scripts/copy-mediapipe.mjs (runs automatically via predev/prebuild)
import { cpSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url));
const dest = fileURLToPath(new URL('../public/mediapipe/wasm/', import.meta.url));

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`Copied MediaPipe WASM to ${dest}`);
