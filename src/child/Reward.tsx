import { useEffect, useRef } from 'react';
import { randomPraise } from '../db';
import { playRewardChime } from '../audio/sfx';
import { Mascot } from './Mascot';
import { fireRewardConfetti } from './confetti';

export interface RewardProps {
  onDone: () => void;
}

const MIN_MS = 2000;
const MAX_MS = 5000;
let lastPraiseId: string | undefined;

/** Mascot cheer + confetti + chime + random parent praise (~2s). */
export function Reward({ onDone }: RewardProps) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let cancelled = false;
    let audio: HTMLAudioElement | undefined;
    let url: string | undefined;
    let praiseDone = true;
    let minPassed = false;
    const timers: number[] = [];

    const finish = () => {
      if (cancelled) return;
      cancelled = true;
      onDoneRef.current();
    };
    const maybeFinish = () => minPassed && praiseDone && finish();

    fireRewardConfetti();
    const chime = playRewardChime();

    timers.push(window.setTimeout(() => ((minPassed = true), maybeFinish()), MIN_MS));
    timers.push(window.setTimeout(finish, MAX_MS));

    randomPraise(lastPraiseId).then((praise) => {
      if (cancelled || !praise) return;
      lastPraiseId = praise.id;
      praiseDone = false;
      url = URL.createObjectURL(praise.blob);
      audio = new Audio(url);
      const end = () => ((praiseDone = true), maybeFinish());
      audio.onended = end;
      audio.onerror = end;
      timers.push(
        window.setTimeout(() => {
          if (cancelled) return;
          audio?.play().catch(end);
        }, chime * 600),
      );
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      audio?.pause();
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  return (
    <div className="reward">
      <Mascot state="cheer" size={220} />
    </div>
  );
}
