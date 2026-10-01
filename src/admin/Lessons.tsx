import { useState } from 'react';
import {
  MAX_LESSON_PICTURES,
  addLesson,
  deleteLesson,
  renameLesson,
  setLessonPictures,
  useLessons,
  usePictures,
  type Lesson,
  type Picture,
} from '../db';
import { PictureThumb } from './PictureBank';
import './admin.css';

export function Lessons() {
  const lessons = useLessons();
  const pictures = usePictures();
  const [openId, setOpenId] = useState<string>();
  const [creating, setCreating] = useState(false);

  async function create(name: string) {
    setCreating(false);
    setOpenId(await addLesson(name));
  }

  return (
    <div className="admin-section">
      <div className="section-head">
        <h2>שיעורים</h2>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          ＋ שיעור חדש
        </button>
      </div>
      {creating && (
        <NameDialog
          title="שיעור חדש"
          initial={`שיעור ${(lessons?.length ?? 0) + 1}`}
          submitLabel="יצירה"
          onSubmit={create}
          onClose={() => setCreating(false)}
        />
      )}
      <p className="muted small">בכל שיעור עד {MAX_LESSON_PICTURES} תמונות. הסדר קובע את הסדר במצב "אחת אחת".</p>
      {lessons?.length === 0 && <p className="muted">עדיין אין שיעורים.</p>}
      {lessons?.map((l) => (
        <LessonCard
          key={l.id}
          lesson={l}
          pictures={pictures ?? []}
          open={openId === l.id}
          onToggle={() => setOpenId(openId === l.id ? undefined : l.id)}
        />
      ))}
    </div>
  );
}

function LessonCard({
  lesson,
  pictures,
  open,
  onToggle,
}: {
  lesson: Lesson;
  pictures: Picture[];
  open: boolean;
  onToggle: () => void;
}) {
  const byId = new Map(pictures.map((p) => [p.id, p]));
  const selected = lesson.pictureIds.map((id) => byId.get(id)).filter((p): p is Picture => !!p);
  const ids = selected.map((p) => p.id);
  const full = ids.length >= MAX_LESSON_PICTURES;

  const set = (next: string[]) => setLessonPictures(lesson.id, next);
  const move = (i: number, d: number) => {
    const next = [...ids];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
  };

  const [renaming, setRenaming] = useState(false);

  async function rename(name: string) {
    setRenaming(false);
    await renameLesson(lesson.id, name);
  }

  async function remove() {
    if (confirm(`למחוק את השיעור "${lesson.name}"? התמונות יישארו בבנק.`)) await deleteLesson(lesson.id);
  }

  return (
    <div className="card admin-lesson-card">
      <button className="admin-lesson-head" onClick={onToggle}>
        <strong>{lesson.name}</strong>
        <span className="muted">
          {ids.length}/{MAX_LESSON_PICTURES} {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <div className="admin-lesson-body">
          <div className="btn-row">
            <button className="btn" onClick={() => setRenaming(true)}>
              ✏️ שינוי שם
            </button>
            <button className="btn btn-danger" onClick={remove}>
              🗑️ מחיקה
            </button>
          </div>
          {renaming && (
            <NameDialog
              title="שינוי שם השיעור"
              initial={lesson.name}
              submitLabel="שמירה"
              onSubmit={rename}
              onClose={() => setRenaming(false)}
            />
          )}

          <h4>בשיעור (לפי הסדר)</h4>
          {selected.length === 0 && <p className="muted small">בחרו תמונות מהרשימה למטה.</p>}
          <ol className="order-list">
            {selected.map((p, i) => (
              <li key={p.id}>
                <PictureThumb picture={p} />
                <span className="order-word">{p.word}</span>
                <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="למעלה">
                  ▲
                </button>
                <button
                  className="icon-btn"
                  disabled={i === selected.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label="למטה"
                >
                  ▼
                </button>
                <button className="icon-btn danger" onClick={() => set(ids.filter((x) => x !== p.id))} aria-label="הסרה">
                  ✕
                </button>
              </li>
            ))}
          </ol>

          <h4>הוספה מהבנק {full && <span className="muted small">(השיעור מלא)</span>}</h4>
          <div className="pick-grid">
            {pictures
              .filter((p) => !ids.includes(p.id))
              .map((p) => (
                <button key={p.id} className="pick-item" disabled={full} onClick={() => set([...ids, p.id])}>
                  <PictureThumb picture={p} />
                  <span>{p.word}</span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NameDialog({
  title,
  initial,
  submitLabel,
  onSubmit,
  onClose,
}: {
  title: string;
  initial: string;
  submitLabel: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const trimmed = name.trim();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal card"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed) onSubmit(trimmed);
        }}
      >
        <h3>{title}</h3>
        <input
          className="text-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          placeholder="שם השיעור"
          autoFocus
        />
        <div className="btn-row">
          <button type="submit" className="btn btn-primary" disabled={!trimmed}>
            {submitLabel}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            ביטול
          </button>
        </div>
      </form>
    </div>
  );
}
