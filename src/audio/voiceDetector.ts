import { getAudioContext } from './context';

export interface VoiceDetectorOptions {
  /** Voice when RMS > baseline * sensitivity (Settings.micSensitivity). Default 3. */
  sensitivity?: number;
  /** Noise-baseline measurement window in ms. Default 300. */
  baselineMs?: number;
  /** Loudness must stay above threshold this long (ms). Default 250. */
  sustainMs?: number;
  /** Fired once per start() when voice detected. Detector keeps running until stop(). */
  onVoice?: () => void;
  /**
   * Fired every animation frame. `level` is 0..1 (scaled RMS, for a meter);
   * `threshold` is the same scale (0 during baseline phase).
   */
  onLevel?: (level: number, threshold: number) => void;
  /** Reuse an existing mic stream instead of requesting one. Not stopped by stop(). */
  stream?: MediaStream;
}

export interface VoiceDetector {
  /** Stop listening and release the mic (unless an external stream was passed). */
  stop: () => void;
}

/** Floor so a dead-silent room doesn't make the threshold ~0. */
const MIN_BASELINE = 0.004;
/** RMS -> meter scale (speech RMS rarely exceeds ~0.3). */
const toLevel = (rms: number) => Math.min(1, Math.sqrt(rms / 0.3));

/**
 * Start a loudness-based voice detector.
 * Measures room noise for `baselineMs`, then reports voice when RMS stays above
 * baseline * sensitivity for `sustainMs`.
 */
export async function startVoiceDetector(opts: VoiceDetectorOptions = {}): Promise<VoiceDetector> {
  const { sensitivity = 3, baselineMs = 300, sustainMs = 250, onVoice, onLevel } = opts;
  const ownStream = !opts.stream;
  const stream =
    opts.stream ??
    (await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
    }));

  const ctx = getAudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);

  const start = performance.now();
  const baselineSamples: number[] = [];
  let threshold = 0;
  let aboveSince: number | null = null;
  let fired = false;
  let raf = 0;
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    const now = performance.now();

    if (now - start < baselineMs) {
      baselineSamples.push(rms);
    } else {
      if (!threshold) {
        const avg = baselineSamples.length
          ? baselineSamples.reduce((a, b) => a + b, 0) / baselineSamples.length
          : MIN_BASELINE;
        threshold = Math.max(avg, MIN_BASELINE) * sensitivity;
      }
      if (rms > threshold) {
        aboveSince ??= now;
        if (!fired && now - aboveSince >= sustainMs) {
          fired = true;
          onVoice?.();
        }
      } else {
        aboveSince = null;
      }
    }
    onLevel?.(toLevel(rms), threshold ? toLevel(threshold) : 0);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      source.disconnect();
      if (ownStream) stream.getTracks().forEach((t) => t.stop());
    },
  };
}
