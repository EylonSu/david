import { navigate } from '../router';
import { useLessonPictures, useLessons, type Lesson, type Picture } from '../db';
import { useBlobUrl } from '../media/useBlobUrl';
import { Mascot } from './Mascot';
import { GearIcon, GridIcon, OneIcon } from './icons';
import { tapFeedback, useUnlockAudio } from './feedback';
import './child.css';

function Thumb({ picture }: { picture: Picture }) {
  const url = useBlobUrl(picture.image);
  return <span className="lesson-thumb">{url && <img src={url} alt="" draggable={false} />}</span>;
}

function LessonCard({ lesson }: { lesson: Lesson }) {
  const pictures = useLessonPictures(lesson.id);
  if (!pictures || pictures.length === 0) return null;
  const go = (mode: 'grid' | 'single') => navigate(`/play/${mode}/${lesson.id}`);
  return (
    <div className="lesson-card bounce-in">
      <button className="lesson-thumbs" aria-label={lesson.name} onPointerDown={tapFeedback} onClick={() => go('single')}>
        {pictures.slice(0, 4).map((p) => (
          <Thumb key={p.id} picture={p} />
        ))}
      </button>
      <div className="lesson-name">{lesson.name}</div>
      <div className="lesson-modes">
        <button className="tap-target mode-button mode-button--grid" aria-label="לוח" onPointerDown={tapFeedback} onClick={() => go('grid')}>
          <GridIcon />
        </button>
        <button className="tap-target mode-button mode-button--one" aria-label="אחד אחד" onPointerDown={tapFeedback} onClick={() => go('single')}>
          <OneIcon />
        </button>
      </div>
    </div>
  );
}

/** Child home: big picture buttons per lesson with grid / one-by-one mode buttons. */
export function Home() {
  useUnlockAudio();
  const lessons = useLessons();
  const playable = !!lessons?.some((l) => l.pictureIds.length > 0);

  return (
    <div className="child-screen home">
      <button className="gear-button home-gear" aria-label="ניהול" onClick={() => navigate('/admin')}>
        <GearIcon />
      </button>
      {lessons && (playable ? (
        <div className="lesson-list">
          {lessons.map((l) => (
            <LessonCard key={l.id} lesson={l} />
          ))}
        </div>
      ) : (
        <div className="home-empty bounce-in">
          <Mascot state="idle" size={200} />
          <button className="btn btn-primary home-empty-cta" onClick={() => navigate('/admin')}>
            <GearIcon size={22} />
            <span>הורים: הוסיפו תמונות ושיעור בפאנל הניהול</span>
          </button>
        </div>
      ))}
    </div>
  );
}
