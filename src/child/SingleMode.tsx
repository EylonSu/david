import { useEffect, useState } from 'react';
import { useLessonPictures } from '../db';
import { navigate } from '../router';
import { Turn } from './Turn';
import { Celebration, CornerHome } from './Celebration';
import { Mirror } from './Mirror';
import { useUnlockAudio } from './feedback';
import './child.css';

const SLIDE_MS = 500;

/** One-by-one mode (auto-play, auto-advance, end celebration). */
export function SingleMode({ lessonId }: { lessonId: string }) {
  useUnlockAudio();
  const pictures = useLessonPictures(lessonId);
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState(0);
  const [sliding, setSliding] = useState(false);

  useEffect(() => {
    if (pictures && pictures.length === 0) navigate('/', true);
  }, [pictures]);

  if (!pictures || pictures.length === 0) return <div className="child-screen" />;

  const finished = index >= pictures.length;
  const picture = pictures[Math.min(index, pictures.length - 1)];

  const next = () => {
    setSliding(true);
    setTimeout(() => {
      setSliding(false);
      setIndex((i) => i + 1);
    }, SLIDE_MS);
  };

  return (
    <div className="child-screen play-screen single-screen">
      <CornerHome />
      {!finished && (
        <div className={`single-slide ${sliding ? 'single-slide--out' : 'single-slide--in'}`} key={`${round}-${index}`}>
          <Turn picture={picture} variant="full" onDone={next} />
        </div>
      )}
      <Mirror />
      {finished && (
        <Celebration
          onAgain={() => {
            setRound((r) => r + 1);
            setIndex(0);
          }}
        />
      )}
    </div>
  );
}
