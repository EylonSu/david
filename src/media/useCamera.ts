import { useEffect, useState } from 'react';

export interface CameraState {
  stream?: MediaStream;
  failed: boolean;
}

/** Front camera (video only) while `enabled`; tracks are stopped on disable/unmount. */
export function useCamera(enabled: boolean): CameraState {
  const [state, setState] = useState<CameraState>({ failed: false });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let stream: MediaStream | undefined;
    (navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: false }) ??
      Promise.reject(new Error('no camera')))
      .then((s) => {
        if (!alive) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        setState({ stream: s, failed: false });
      })
      .catch(() => alive && setState({ failed: true }));
    return () => {
      alive = false;
      stream?.getTracks().forEach((t) => t.stop());
      setState({ failed: false });
    };
  }, [enabled]);
  return state;
}
