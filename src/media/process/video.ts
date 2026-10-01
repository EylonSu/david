import { pickMimeType, stopStream } from '../../audio/recorder';
import { createSegmenter } from './segmenter';

const BG = '#ffffff';
const EDGE_BLUR_PX = 2;

type CleanAudio = Pick<import('./audio').CleanAudio, 'samples' | 'sampleRate'>;

export interface RenderedVideo {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

const once = (el: HTMLMediaElement, ev: string) =>
  new Promise<void>((resolve, reject) => {
    el.addEventListener(ev, () => resolve(), { once: true });
    el.addEventListener('error', () => reject(new Error('video load failed')), { once: true });
  });

const canvas2d = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas 2d unavailable');
  return { c, ctx };
};

export async function renderVideo(
  blob: Blob,
  range: { start: number; end: number },
  audio?: CleanAudio,
): Promise<RenderedVideo> {
  const segmenter = await createSegmenter();
  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;

  let audioCtx: AudioContext | undefined;
  let stream: MediaStream | undefined;
  try {
    await once(video, 'loadeddata');
    video.currentTime = range.start;
    await once(video, 'seeked');

    const w = video.videoWidth;
    const h = video.videoHeight;
    const out = canvas2d(w, h);
    const person = canvas2d(w, h);
    let mask: ReturnType<typeof canvas2d> | undefined;
    let maskData: ImageData | undefined;

    const draw = (nowMs: number) => {
      const res = segmenter.segmentForVideo(video, nowMs);
      const conf = res.confidenceMasks?.[0];
      out.ctx.fillStyle = BG;
      out.ctx.fillRect(0, 0, w, h);
      if (conf) {
        const mw = conf.width;
        const mh = conf.height;
        if (!mask || mask.c.width !== mw || mask.c.height !== mh) {
          mask = canvas2d(mw, mh);
          maskData = mask.ctx.createImageData(mw, mh);
        }
        const px = maskData!.data;
        const f = conf.getAsFloat32Array();
        for (let i = 0; i < f.length; i++) px[i * 4 + 3] = f[i] * 255;
        mask.ctx.putImageData(maskData!, 0, 0);

        person.ctx.globalCompositeOperation = 'source-over';
        person.ctx.filter = 'none';
        person.ctx.clearRect(0, 0, w, h);
        person.ctx.drawImage(video, 0, 0, w, h);
        person.ctx.globalCompositeOperation = 'destination-in';
        person.ctx.filter = `blur(${EDGE_BLUR_PX}px)`;
        person.ctx.drawImage(mask.c, 0, 0, w, h);
        out.ctx.drawImage(person.c, 0, 0);
      }
      res.close();
    };

    draw(performance.now());
    stream = out.c.captureStream(30);

    let source: AudioBufferSourceNode | undefined;
    if (audio) {
      audioCtx = new AudioContext({ sampleRate: audio.sampleRate });
      const buf = audioCtx.createBuffer(1, audio.samples.length, audio.sampleRate);
      buf.copyToChannel(audio.samples, 0);
      source = audioCtx.createBufferSource();
      source.buffer = buf;
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      dest.stream.getAudioTracks().forEach((t) => stream!.addTrack(t));
      await audioCtx.resume();
    }

    const mimeType = pickMimeType('video');
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise<void>((r) => (recorder.onstop = () => r()));

    await new Promise<void>((resolve, reject) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        video.pause();
        resolve();
      };
      const onFrame = (now: number, meta: VideoFrameCallbackMetadata) => {
        if (done) return;
        if (meta.mediaTime >= range.end) return finish();
        try {
          draw(now);
        } catch (e) {
          done = true;
          reject(e);
          return;
        }
        video.requestVideoFrameCallback(onFrame);
      };
      video.addEventListener('ended', finish, { once: true });
      video.requestVideoFrameCallback(onFrame);
      recorder.start();
      source?.start();
      video.play().catch(reject);
    });

    recorder.stop();
    await stopped;
    const durationMs = Math.round((range.end - range.start) * 1000);
    return { blob: new Blob(chunks, { type: recorder.mimeType || mimeType }), mimeType: recorder.mimeType || mimeType, durationMs };
  } finally {
    if (stream) stopStream(stream);
    await audioCtx?.close().catch(() => {});
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
    segmenter.close();
  }
}
