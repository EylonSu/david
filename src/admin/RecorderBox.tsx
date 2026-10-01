import { useEffect, useRef, useState } from 'react';
import type { MediaKind } from '../db';
import {
  openStream,
  startRecording,
  stopStream,
  type RecordingResult,
  type RecordingSession,
} from '../audio/recorder';
import { useBlobUrl } from '../media/useBlobUrl';

interface Props {
  /** Which kinds the user may choose. */
  kinds: MediaKind[];
  /** Existing recording to show for playback. */
  existing?: { kind: MediaKind; blob: Blob };
  maxMs?: number;
  onRecorded: (r: RecordingResult) => void;
}

/** Record audio or front-camera video with live preview, countdown and playback. */
export function RecorderBox({ kinds, existing, maxMs = 5000, onRecorded }: Props) {
  const [kind, setKind] = useState<MediaKind>(existing?.kind ?? kinds[0]);
  const [session, setSession] = useState<RecordingSession | null>(null);
  const [preview, setPreview] = useState<MediaStream | null>(null);
  const [retake, setRetake] = useState(false);
  const [left, setLeft] = useState(0);
  const [error, setError] = useState<string>();
  const [processing, setProcessing] = useState(false);
  const [raw, setRaw] = useState<RecordingResult>();
  const [note, setNote] = useState<string>();
  const liveRef = useRef<HTMLVideoElement>(null);
  /** Preview stream handed to the recorder, which then owns releasing it. */
  const handedOff = useRef<MediaStream>();
  const url = useBlobUrl(existing?.blob);

  const hasExistingVideo = existing?.kind === 'video';
  const wantPreview = kind === 'video' && !session && (!hasExistingVideo || retake);

  useEffect(() => {
    if (!wantPreview) return;
    let alive = true;
    let stream: MediaStream | undefined;
    openStream('video')
      .then((s) => {
        if (!alive) return stopStream(s);
        stream = s;
        setPreview(s);
      })
      .catch(() => alive && setError('אין גישה למצלמה או למיקרופון'));
    return () => {
      alive = false;
      setPreview(null);
      if (stream && stream !== handedOff.current) stopStream(stream);
    };
  }, [wantPreview]);

  useEffect(() => {
    if (liveRef.current) liveRef.current.srcObject = session?.stream ?? preview;
  }, [session, preview]);

  useEffect(() => () => session?.cancel(), [session]);

  useEffect(() => {
    if (!session) return;
    const end = Date.now() + maxMs;
    const t = setInterval(() => setLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000))), 200);
    return () => clearInterval(t);
  }, [session, maxMs]);

  async function start() {
    setError(undefined);
    const stream = kind === 'video' ? preview ?? undefined : undefined;
    handedOff.current = stream;
    try {
      const s = await startRecording({ kind, maxDurationMs: maxMs, stream });
      setLeft(Math.ceil(maxMs / 1000));
      setRetake(false);
      setSession(s);
      s.result
        .then(async (r) => {
          setSession(null);
          setRaw(undefined);
          setNote(undefined);
          setProcessing(true);
          try {
            const { preprocessRecording } = await import('../media/process');
            onRecorded(await preprocessRecording(r));
            setRaw(r);
          } catch {
            onRecorded(r);
            setNote('העיבוד נכשל, נשמרה ההקלטה המקורית');
          } finally {
            setProcessing(false);
          }
        })
        .catch(() => {})
        .finally(() => setSession(null));
    } catch {
      setError(kind === 'video' ? 'אין גישה למצלמה או למיקרופון' : 'אין גישה למיקרופון');
    }
  }

  const recording = !!session;
  const showLive = kind === 'video' && (recording || wantPreview);
  const showPlayback = !recording && !(hasExistingVideo && retake) && existing && url;

  return (
    <div className="rec-box">
      {kinds.length > 1 && (
        <div className="seg">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              className={k === kind ? 'active' : ''}
              disabled={recording || processing}
              onClick={() => {
                setKind(k);
                setRetake(false);
                setError(undefined);
              }}
            >
              {k === 'audio' ? '🎤 קול' : '🎥 וידאו (פנים)'}
            </button>
          ))}
        </div>
      )}

      {showLive && <video ref={liveRef} className="rec-live" autoPlay muted playsInline />}

      {showPlayback && (
        existing.kind === 'video' ? (
          <video className="rec-live" src={url} controls playsInline />
        ) : (
          <audio src={url} controls />
        )
      )}

      {recording ? (
        <button type="button" className="btn btn-danger rec-btn" onClick={() => session!.stop()}>
          ⏹ עצור ({left})
        </button>
      ) : kind === 'video' && hasExistingVideo && !retake ? (
        <button type="button" className="btn btn-accent rec-btn" disabled={processing} onClick={() => setRetake(true)}>
          🔁 הקלט מחדש
        </button>
      ) : (
        <button type="button" className="btn btn-accent rec-btn" disabled={processing} onClick={start}>
          ⏺ {existing ? 'התחל הקלטה מחדש' : 'הקלט'}
        </button>
      )}
      {retake && !recording && (
        <button type="button" className="btn small-btn" onClick={() => setRetake(false)}>
          ביטול
        </button>
      )}
      {processing && <p className="hint">מעבד את ההקלטה…</p>}
      {note && <p className="hint">{note}</p>}
      {raw && !processing && (
        <button
          type="button"
          className="btn small-btn"
          onClick={() => {
            onRecorded(raw);
            setRaw(undefined);
          }}
        >
          השתמש בהקלטה המקורית
        </button>
      )}
      {error && <p className="admin-error">{error}</p>}
    </div>
  );
}
