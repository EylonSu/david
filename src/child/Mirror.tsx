import { useEffect, useRef } from 'react';
import { useSettings } from '../db';
import { useCamera } from '../media/useCamera';

/** Front-camera "mirror" in the corner; grows via CSS while a turn is listening. */
export function Mirror() {
  const { showMirror } = useSettings();
  const { stream } = useCamera(showMirror);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream ?? null;
  }, [stream]);

  if (!showMirror || !stream) return null;
  return <video ref={ref} className="mirror" autoPlay muted playsInline />;
}
