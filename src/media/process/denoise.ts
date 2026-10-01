type RnnoiseModule = typeof import('@shiguredo/rnnoise-wasm');
type Rnnoise = Awaited<ReturnType<RnnoiseModule['Rnnoise']['load']>>;

const FRAME = 480;
export const DENOISE_RATE = 48000;

let loading: Promise<Rnnoise> | null = null;

/** Lazily loads RNNoise (large inlined wasm) once. */
function loadRnnoise(): Promise<Rnnoise> {
  loading ??= import('@shiguredo/rnnoise-wasm').then(({ Rnnoise }) => Rnnoise.load());
  loading.catch(() => (loading = null));
  return loading;
}

/** Resamples mono samples to a target rate via OfflineAudioContext. */
export async function resample(samples: Float32Array, from: number, to: number): Promise<Float32Array> {
  if (from === to) return samples;
  const length = Math.max(1, Math.round((samples.length * to) / from));
  const off = new OfflineAudioContext(1, length, to);
  const buf = off.createBuffer(1, samples.length, from);
  buf.copyToChannel(samples, 0);
  const src = off.createBufferSource();
  src.buffer = buf;
  src.connect(off.destination);
  src.start();
  return (await off.startRendering()).getChannelData(0);
}

/** Denoises 48kHz mono samples with RNNoise; returns a new array of the same length. */
export async function denoise48k(samples: Float32Array): Promise<Float32Array> {
  const rnnoise = await loadRnnoise();
  const st = rnnoise.createDenoiseState();
  const out = new Float32Array(samples.length);
  const frame = new Float32Array(FRAME);
  try {
    for (let i = 0; i < samples.length; i += FRAME) {
      const n = Math.min(FRAME, samples.length - i);
      frame.fill(0);
      for (let j = 0; j < n; j++) frame[j] = samples[i + j] * 32768;
      st.processFrame(frame);
      for (let j = 0; j < n; j++) out[i + j] = frame[j] / 32768;
    }
  } finally {
    st.destroy();
  }
  return out;
}
