import type { RecordingResult } from '../../audio/recorder';
import { cleanAudio, encodeWav } from './audio';
import { renderVideo } from './video';

/** Denoises/trims audio, and for video also replaces the background. Throws on failure. */
export async function preprocessRecording(r: RecordingResult): Promise<RecordingResult> {
  if (r.kind === 'audio') {
    const { samples, sampleRate } = await cleanAudio(r.blob);
    const blob = encodeWav(samples, sampleRate);
    return { blob, mimeType: 'audio/wav', kind: 'audio', durationMs: Math.round((samples.length / sampleRate) * 1000) };
  }
  const audio = await cleanAudio(r.blob);
  const v = await renderVideo(r.blob, audio.range, audio);
  return { blob: v.blob, mimeType: v.mimeType, kind: 'video', durationMs: v.durationMs };
}
