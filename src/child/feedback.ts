import { useEffect } from 'react';
import type { PointerEvent } from 'react';
import { playTap, unlockAudio } from '../audio/sfx';

/** Instant tap feedback: unlock audio, soft pop sound and a bounce on the target. */
export function tapFeedback(e?: PointerEvent<HTMLElement>): void {
  unlockAudio();
  playTap();
  const el = e?.currentTarget;
  if (el) {
    el.classList.remove('tap-pop');
    void el.offsetWidth;
    el.classList.add('tap-pop');
  }
}

/** Unlock the AudioContext on the first touch anywhere. */
export function useUnlockAudio(): void {
  useEffect(() => {
    const on = () => unlockAudio();
    window.addEventListener('pointerdown', on, { once: true, capture: true });
    return () => window.removeEventListener('pointerdown', on, { capture: true });
  }, []);
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
