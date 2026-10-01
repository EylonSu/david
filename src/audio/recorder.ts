import type { MediaKind } from '../db';

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  kind: MediaKind;
  durationMs: number;
}

export interface RecorderOptions {
  kind: MediaKind;
  /** Auto-stop after this many ms (default 5000). */
  maxDurationMs?: number;
  /** Called when the stream is ready, e.g. to show a live video preview. */
  onStream?: (stream: MediaStream) => void;
  /** Reuse an already-open stream (e.g. from a preview); it is released when recording ends. */
  stream?: MediaStream;
}

export interface RecordingSession {
  /** Live input stream (attach to <video muted> for preview). */
  stream: MediaStream;
  /** Resolves when recording ends (stop() or max duration). Tracks are released. */
  result: Promise<RecordingResult>;
  /** Stop early; the result promise then resolves. */
  stop: () => void;
  /** Abort: release tracks, result rejects with 'cancelled'. */
  cancel: () => void;
}

const AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
const VIDEO_TYPES = [
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9,opus',
  'video/webm',
  'video/mp4',
];

/** First supported mime type for the kind, or '' (browser default). */
export function pickMimeType(kind: MediaKind): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const list = kind === 'audio' ? AUDIO_TYPES : VIDEO_TYPES;
  return list.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

export const isRecordingSupported = (): boolean =>
  typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

/** Release all tracks of a stream. */
export const stopStream = (s: MediaStream) => s.getTracks().forEach((t) => t.stop());

/** Open the mic, or front camera + mic. Throws if permission is denied / unsupported. */
export const openStream = (kind: MediaKind): Promise<MediaStream> =>
  navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video:
      kind === 'video'
        ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }
        : false,
  });

/**
 * Start recording audio, or front-camera video with audio.
 * Throws if permission is denied / unsupported.
 */
export async function startRecording(opts: RecorderOptions): Promise<RecordingSession> {
  const { kind, maxDurationMs = 5000 } = opts;
  const stream = opts.stream ?? (await openStream(kind));
  opts.onStream?.(stream);

  const mimeType = pickMimeType(kind);
  const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  let cancelled = false;
  const startedAt = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const result = new Promise<RecordingResult>((resolve, reject) => {
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onerror = () => {
      stopStream(stream);
      reject(new Error('recording failed'));
    };
    rec.onstop = () => {
      clearTimeout(timer);
      stopStream(stream);
      if (cancelled) return reject(new Error('cancelled'));
      const type = rec.mimeType || mimeType || (kind === 'audio' ? 'audio/webm' : 'video/webm');
      resolve({
        blob: new Blob(chunks, { type }),
        mimeType: type,
        kind,
        durationMs: performance.now() - startedAt,
      });
    };
  });

  rec.start(250);
  const stop = () => rec.state !== 'inactive' && rec.stop();
  timer = setTimeout(stop, maxDurationMs);

  return {
    stream,
    result,
    stop,
    cancel: () => {
      cancelled = true;
      if (rec.state !== 'inactive') rec.stop();
      else stopStream(stream);
    },
  };
}
