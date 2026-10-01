import { useEffect, useRef, useState } from 'react';
import type { MediaKind } from '../db';
import { startRecording, type RecordingResult, type RecordingSession } from '../audio/recorder';
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
  const [left, setLeft] = useState(0);
  const [error, setError] = useState<string>();
  const liveRef = useRef<HTMLVideoElement>(null);
  const url = useBlobUrl(existing?.blob);

  useEffect(() => {
    if (session && liveRef.current) liveRef.current.srcObject = session.stream;
    return () => session?.cancel();
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const end = Date.now() + maxMs;
    const t = setInterval(() => setLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000))), 200);
    return () => clearInterval(t);
  }, [session, maxMs]);

  async function start() {
    setError(undefined);
    try {
      const s = await startRecording({
        kind,
        maxDurationMs: maxMs,
        onStream: (stream) => {
          if (liveRef.current) liveRef.current.srcObject = stream;
        },
      });
      if (liveRef.current) liveRef.current.srcObject = s.stream;
      setLeft(Math.ceil(maxMs / 1000));
      setSession(s);
      s.result
        .then((r) => onRecorded(r))
        .catch(() => {})
        .finally(() => setSession(null));
    } catch {
      setError(kind === 'video' ? 'אין גישה למצלמה או למיקרופון' : 'אין גישה למיקרופון');
    }
  }

  const recording = !!session;

  return (
    <div className="rec-box">
      {kinds.length > 1 && (
        <div className="seg">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              className={k === kind ? 'active' : ''}
              disabled={recording}
              onClick={() => setKind(k)}
            >
              {k === 'audio' ? '🎤 קול' : '🎥 וידאו (פנים)'}
            </button>
          ))}
        </div>
      )}

      {kind === 'video' && recording && (
        <video ref={liveRef} className="rec-live" autoPlay muted playsInline />
      )}

      {!recording && existing && url && (
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
      ) : (
        <button type="button" className="btn btn-accent rec-btn" onClick={start}>
          {existing ? '🔁 הקלט מחדש' : '⏺ הקלט'}
        </button>
      )}
      {error && <p className="admin-error">{error}</p>}
    </div>
  );
}
