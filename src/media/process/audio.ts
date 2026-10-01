import { getAudioContext } from '../../audio/context';
import { DENOISE_RATE, denoise48k, resample } from './denoise';

export interface TimeRange {
  start: number;
  end: number;
}

export interface CleanAudio {
  samples: Float32Array;
  sampleRate: number;
  /** Kept speech range in the original recording's timeline (seconds). */
  range: TimeRange;
}

/** Decodes a recorded blob into an AudioBuffer. */
export async function decodeAudio(blob: Blob): Promise<AudioBuffer> {
  return getAudioContext().decodeAudioData(await blob.arrayBuffer());
}

/** Mixes all channels of a buffer down to mono. */
export function toMono(buf: AudioBuffer): Float32Array {
  if (buf.numberOfChannels === 1) return buf.getChannelData(0).slice();
  const out = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) out[i] += d[i] / buf.numberOfChannels;
  }
  return out;
}

/** Finds the speech span (seconds) via windowed RMS vs. an adaptive threshold, with padding. */
export function findSpeechRange(samples: Float32Array, sampleRate: number): TimeRange {
  const win = Math.round(sampleRate * 0.02);
  const n = Math.floor(samples.length / win);
  const duration = samples.length / sampleRate;
  if (n === 0) return { start: 0, end: duration };
  const rms = new Float32Array(n);
  for (let w = 0; w < n; w++) {
    let s = 0;
    for (let i = w * win; i < (w + 1) * win; i++) s += samples[i] * samples[i];
    rms[w] = Math.sqrt(s / win);
  }
  const sorted = Array.from(rms).sort((a, b) => a - b);
  const floor = sorted[Math.floor(n * 0.1)];
  const peak = sorted[n - 1];
  const threshold = Math.max(0.01, floor + (peak - floor) * 0.1);
  let first = -1;
  let last = -1;
  for (let w = 0; w < n; w++) {
    if (rms[w] >= threshold) {
      if (first < 0) first = w;
      last = w;
    }
  }
  if (first < 0) return { start: 0, end: duration };
  const t = win / sampleRate;
  return { start: Math.max(0, first * t - 0.15), end: Math.min(duration, (last + 1) * t + 0.25) };
}

/** Scales samples in place so the peak hits `target`, capping gain to avoid boosting noise. */
export function normalize(samples: Float32Array, target = 0.9, maxGain = 8): Float32Array {
  let peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  if (peak === 0) return samples;
  const gain = Math.min(maxGain, target / peak);
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  return samples;
}

/** Applies linear fade-in/out in place. */
export function applyFades(samples: Float32Array, sampleRate: number, fadeIn = 0.03, fadeOut = 0.06): Float32Array {
  const fi = Math.min(samples.length, Math.round(fadeIn * sampleRate));
  const fo = Math.min(samples.length, Math.round(fadeOut * sampleRate));
  for (let i = 0; i < fi; i++) samples[i] *= i / fi;
  for (let i = 0; i < fo; i++) samples[samples.length - 1 - i] *= i / fo;
  return samples;
}

/** Encodes mono samples as a 16-bit PCM WAV blob. */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const str = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return new Blob([view.buffer], { type: 'audio/wav' });
}

/** Decodes, denoises (48kHz mono), trims to speech, normalizes and fades a recording. */
export async function cleanAudio(blob: Blob): Promise<CleanAudio> {
  const buf = await decodeAudio(blob);
  const mono = await resample(toMono(buf), buf.sampleRate, DENOISE_RATE);
  const clean = await denoise48k(mono);
  const range = findSpeechRange(clean, DENOISE_RATE);
  const samples = clean.slice(Math.floor(range.start * DENOISE_RATE), Math.ceil(range.end * DENOISE_RATE));
  applyFades(normalize(samples), DENOISE_RATE);
  return { samples, sampleRate: DENOISE_RATE, range };
}
