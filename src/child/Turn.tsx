import { useCallback, useEffect, useRef, useState } from 'react';
import type { Picture } from '../db';
import { useSettings } from '../db';
import { startVoiceDetector, type VoiceDetector } from '../audio/voiceDetector';
import { useBlobUrl } from '../media/useBlobUrl';
import { Mascot } from './Mascot';
import { Reward } from './Reward';
import { StarIcon } from './icons';
import { sleep, tapFeedback } from './feedback';

export interface TurnProps {
  picture: Picture;
  /** Called when the turn ends; `rewarded` is true if voice/star triggered the reward. */
  onDone: (rewarded: boolean) => void;
  /** 'overlay' zooms over the grid; 'full' fills the screen (one-by-one mode). */
  variant?: 'overlay' | 'full';
}

type Phase = 'zoom' | 'playing' | 'listening' | 'reward' | 'leaving';

const ZOOM_MS = 450;
const LEAVE_MS = 450;
const GAP_MS = 350;

/** Shared turn flow: zoom, play recording, listen, replay once, star button, reward. */
export function Turn({ picture, onDone, variant = 'overlay' }: TurnProps) {
  const settings = useSettings();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const imageUrl = useBlobUrl(picture.image);
  const mediaUrl = useBlobUrl(picture.media?.blob);
  const kind = picture.media?.kind;
  const hasMedia = !!picture.media;
  const ready = !hasMedia || !!mediaUrl;

  const [phase, setPhase] = useState<Phase>('zoom');
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const detectorRef = useRef<VoiceDetector | null>(null);
  const tokenRef = useRef({ cancelled: false });

  const stopAll = useCallback(() => {
    detectorRef.current?.stop();
    detectorRef.current = null;
    const m = mediaRef.current;
    if (m && !m.paused) m.pause();
    glowRef.current?.style.setProperty('--level', '0');
  }, []);

  const rewardNow = useCallback(() => {
    if (tokenRef.current.cancelled) return;
    tokenRef.current.cancelled = true;
    stopAll();
    setPhase('reward');
  }, [stopAll]);

  useEffect(() => {
    if (!ready) return;
    const token = { cancelled: false };
    tokenRef.current = token;

    const playMedia = () =>
      new Promise<void>((resolve) => {
        const m = mediaRef.current;
        if (!m) return resolve();
        const done = () => {
          m.onended = m.onerror = null;
          resolve();
        };
        m.onended = done;
        m.onerror = done;
        m.currentTime = 0;
        m.play().catch(done);
      });

    const listen = () =>
      new Promise<void>((resolve) => {
        let finished = false;
        const end = () => {
          if (finished) return;
          finished = true;
          detectorRef.current?.stop();
          detectorRef.current = null;
          glowRef.current?.style.setProperty('--level', '0');
          resolve();
        };
        window.setTimeout(end, settingsRef.current.listenSeconds * 1000);
        startVoiceDetector({
          sensitivity: settingsRef.current.micSensitivity,
          onVoice: () => !token.cancelled && rewardNow(),
          onLevel: (level) => glowRef.current?.style.setProperty('--level', level.toFixed(3)),
        })
          .then((d) => {
            if (finished || token.cancelled) d.stop();
            else detectorRef.current = d;
          })
          .catch(() => {
            /* mic denied/unavailable: the star button still works */
          });
      });

    (async () => {
      await sleep(ZOOM_MS);
      for (let attempt = 0; attempt < 2; attempt++) {
        if (token.cancelled) return;
        if (hasMedia) {
          setPhase('playing');
          await playMedia();
          if (token.cancelled) return;
          await sleep(GAP_MS);
          if (token.cancelled) return;
        }
        setPhase('listening');
        await listen();
      }
      if (token.cancelled) return;
      token.cancelled = true;
      setPhase('leaving');
      await sleep(LEAVE_MS);
      onDoneRef.current(false);
    })();

    return () => {
      token.cancelled = true;
      stopAll();
    };
  }, [ready, hasMedia, picture.id, rewardNow, stopAll]);

  const showVideo = kind === 'video';

  return (
    <div className={`turn turn--${variant} turn--${phase}`}>
      <div className={`turn-stage ${showVideo ? 'turn-stage--video' : ''}`}>
        <div className="turn-picture-wrap" ref={glowRef}>
          {imageUrl && <img className="turn-picture" src={imageUrl} alt="" draggable={false} />}
        </div>
        {showVideo && mediaUrl && (
          <video
            className="turn-video"
            ref={(el) => (mediaRef.current = el)}
            src={mediaUrl}
            playsInline
            preload="auto"
          />
        )}
        {kind === 'audio' && mediaUrl && (
          <audio ref={(el) => (mediaRef.current = el)} src={mediaUrl} preload="auto" />
        )}
      </div>

      {phase !== 'reward' && (
        <div className="turn-mascot">
          <Mascot state={phase === 'listening' ? 'listening' : 'idle'} size={120} />
        </div>
      )}

      {phase !== 'reward' && phase !== 'leaving' && (
        <button
          className="turn-star"
          aria-label="כוכב"
          onPointerDown={(e) => {
            tapFeedback(e);
            rewardNow();
          }}
        >
          <StarIcon size={36} />
        </button>
      )}

      {phase === 'reward' && <Reward onDone={() => onDoneRef.current(true)} />}
    </div>
  );
}
