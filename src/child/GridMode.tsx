import { useEffect, useState } from 'react';
import type { Picture } from '../db';
import { useLessonPictures } from '../db';
import { navigate } from '../router';
import { useBlobUrl } from '../media/useBlobUrl';
import { Turn } from './Turn';
import { Celebration, CornerHome } from './Celebration';
import { StarIcon } from './icons';
import { tapFeedback, useUnlockAudio } from './feedback';
import './child.css';

function usePortrait(): boolean {
  const q = '(orientation: portrait)';
  const [p, setP] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setP(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return p;
}

/** Columns/rows: 4x2 landscape, 2x4 portrait; fewer pictures => bigger tiles. */
function layout(n: number, portrait: boolean): { cols: number; rows: number } {
  if (portrait) {
    const cols = n <= 2 ? 1 : 2;
    return { cols, rows: Math.ceil(n / cols) };
  }
  const cols = n <= 3 ? n : n === 4 ? 2 : Math.ceil(n / 2);
  return { cols: Math.max(cols, 1), rows: Math.ceil(n / Math.max(cols, 1)) };
}

function Tile({ picture, done, onTap }: { picture: Picture; done: boolean; onTap: () => void }) {
  const url = useBlobUrl(picture.image);
  return (
    <button
      className={`grid-tile ${done ? 'grid-tile--done' : ''}`}
      aria-label={picture.word}
      onPointerDown={tapFeedback}
      onClick={onTap}
    >
      {url && <img src={url} alt="" draggable={false} />}
      {done && (
        <span className="grid-star">
          <StarIcon size={48} />
        </span>
      )}
    </button>
  );
}

/** Grid mode (up to 8 pictures, star badges, completion celebration). */
export function GridMode({ lessonId }: { lessonId: string }) {
  useUnlockAudio();
  const pictures = useLessonPictures(lessonId);
  const portrait = usePortrait();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<Picture | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    if (pictures && pictures.length === 0) navigate('/', true);
  }, [pictures]);

  if (!pictures || pictures.length === 0) return <div className="child-screen" />;

  const { cols, rows } = layout(pictures.length, portrait);

  const finishTurn = (rewarded: boolean) => {
    const pic = active;
    setActive(null);
    if (!rewarded || !pic) return;
    const next = new Set(done).add(pic.id);
    setDone(next);
    if (pictures.every((p) => next.has(p.id))) setTimeout(() => setCelebrate(true), 500);
  };

  return (
    <div className="child-screen play-screen">
      <CornerHome />
      <div
        className="picture-grid"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
      >
        {pictures.map((p) => (
          <Tile key={p.id} picture={p} done={done.has(p.id)} onTap={() => !active && setActive(p)} />
        ))}
      </div>
      {active && <Turn key={active.id} picture={active} onDone={finishTurn} />}
      {celebrate && (
        <Celebration
          onAgain={() => {
            setDone(new Set());
            setCelebrate(false);
          }}
        />
      )}
    </div>
  );
}
