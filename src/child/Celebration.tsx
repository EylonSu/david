import { useEffect } from 'react';
import { playCelebration } from '../audio/sfx';
import { navigate } from '../router';
import { Mascot } from './Mascot';
import { AgainIcon, HomeIcon } from './icons';
import { fireCelebrationConfetti } from './confetti';
import { tapFeedback } from './feedback';

/** End-of-lesson celebration with big "again" and "home" icon buttons. */
export function Celebration({ onAgain }: { onAgain: () => void }) {
  useEffect(() => {
    playCelebration();
    return fireCelebrationConfetti(2800);
  }, []);

  return (
    <div className="celebration">
      <div className="celebration-mascot">
        <Mascot state="cheer" size={260} />
      </div>
      <div className="celebration-actions">
        <button
          className="tap-target big-icon-button big-icon-button--again"
          aria-label="שוב"
          onPointerDown={tapFeedback}
          onClick={onAgain}
        >
          <AgainIcon size={88} />
        </button>
        <button
          className="tap-target big-icon-button"
          aria-label="בית"
          onPointerDown={tapFeedback}
          onClick={() => navigate('/')}
        >
          <HomeIcon size={64} />
        </button>
      </div>
    </div>
  );
}

/** Small corner home button for play screens. */
export function CornerHome() {
  return (
    <button
      className="corner-home"
      aria-label="בית"
      onPointerDown={tapFeedback}
      onClick={() => navigate('/')}
    >
      <HomeIcon size={34} />
    </button>
  );
}
