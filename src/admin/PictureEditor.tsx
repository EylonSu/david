import { useEffect, useState } from 'react';
import {
  addPicture,
  clearPictureMedia,
  deletePicture,
  usePicture,
  updatePicture,
  type PictureMedia,
} from '../db';
import { resizeImage } from '../media/image';
import { useBlobUrl } from '../media/useBlobUrl';
import { navigate } from '../router';
import { RecorderBox } from './RecorderBox';
import { loadStarterList, rasterizeStarter, starterUrl, type StarterItem } from './starter';
import './admin.css';

/** Picture editor. `pictureId` undefined = new picture. */
export function PictureEditor({ pictureId }: { pictureId?: string }) {
  const existing = usePicture(pictureId);
  const [loaded, setLoaded] = useState(!pictureId);
  const [word, setWord] = useState('');
  const [image, setImage] = useState<Blob>();
  const [builtIn, setBuiltIn] = useState(false);
  const [media, setMedia] = useState<PictureMedia>();
  const [mediaCleared, setMediaCleared] = useState(false);
  const [showStarter, setShowStarter] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const imageUrl = useBlobUrl(image);

  useEffect(() => {
    if (existing && !loaded) {
      setWord(existing.word);
      setImage(existing.image);
      setBuiltIn(existing.builtIn);
      setMedia(existing.media);
      setLoaded(true);
    }
  }, [existing, loaded]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    setError(undefined);
    try {
      setImage(await resizeImage(f));
      setBuiltIn(false);
    } catch {
      setError('לא הצלחנו לקרוא את התמונה');
    } finally {
      setBusy(false);
    }
  }

  async function pickStarter(item: StarterItem) {
    setShowStarter(false);
    setBusy(true);
    try {
      setImage(await rasterizeStarter(item.file));
      setBuiltIn(true);
      if (!word.trim()) setWord(item.word);
    } catch {
      setError('לא הצלחנו לטעון את האיור');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!image || !word.trim()) return;
    setBusy(true);
    try {
      if (pictureId) {
        await updatePicture(pictureId, { word: word.trim(), image, builtIn, ...(media ? { media } : {}) });
        if (!media && mediaCleared) await clearPictureMedia(pictureId);
      } else {
        await addPicture({ word: word.trim(), image, builtIn, media });
      }
      navigate('/admin/pictures');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!pictureId || !confirm('למחוק את התמונה? היא תוסר גם מכל השיעורים.')) return;
    await deletePicture(pictureId);
    navigate('/admin/pictures');
  }

  if (pictureId && existing === undefined && !loaded) return <p className="muted">טוען…</p>;

  return (
    <div className="admin-section editor">
      <div className="section-head">
        <h2>{pictureId ? 'עריכת תמונה' : 'תמונה חדשה'}</h2>
        <button className="btn" onClick={() => navigate('/admin/pictures')}>
          ביטול
        </button>
      </div>

      <div className="card editor-block">
        <h3>1. תמונה</h3>
        <div className="editor-image">
          {imageUrl ? <img src={imageUrl} alt="" /> : <span className="muted">אין תמונה עדיין</span>}
        </div>
        <div className="btn-row">
          <label className="btn btn-primary">
            📷 צלמו
            <input type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
          </label>
          <label className="btn">
            🖼️ מהגלריה
            <input type="file" accept="image/*" hidden onChange={onFile} />
          </label>
          <button type="button" className="btn" onClick={() => setShowStarter(true)}>
            🐶 איור מוכן
          </button>
        </div>
      </div>

      <div className="card editor-block">
        <h3>2. המילה</h3>
        <input
          className="text-input"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="למשל: כדור"
        />
        <p className="hint">
          💡 התחילו במילים פשוטות וקצרות, עם הברה אחת או שתיים: מים, אבא, בובה, מו, בא.
        </p>
      </div>

      <div className="card editor-block">
        <h3>3. הקלטה (עד 5 שניות)</h3>
        <p className="muted small">הקליטו את עצמכם אומרים את המילה. בווידאו דוד יוכל לראות את תנועות הפה.</p>
        <RecorderBox
          kinds={['audio', 'video']}
          existing={media}
          onRecorded={(r) => {
            setMedia({ kind: r.kind, blob: r.blob, mimeType: r.mimeType });
            setMediaCleared(false);
          }}
        />
        {media && (
          <button
            type="button"
            className="btn btn-danger small-btn"
            onClick={() => {
              setMedia(undefined);
              setMediaCleared(true);
            }}
          >
            מחיקת ההקלטה
          </button>
        )}
      </div>

      {error && <p className="admin-error">{error}</p>}

      <div className="btn-row sticky-actions">
        <button className="btn btn-primary" disabled={busy || !image || !word.trim()} onClick={save}>
          שמירה
        </button>
        {pictureId && (
          <button className="btn btn-danger" onClick={remove}>
            מחיקה
          </button>
        )}
      </div>

      {showStarter && <StarterPicker onPick={pickStarter} onClose={() => setShowStarter(false)} />}
    </div>
  );
}

function StarterPicker({ onPick, onClose }: { onPick: (i: StarterItem) => void; onClose: () => void }) {
  const [items, setItems] = useState<StarterItem[]>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    loadStarterList().then(setItems, () => setFailed(true));
  }, []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <div className="section-head">
          <h3>איורים מוכנים</h3>
          <button className="btn" onClick={onClose}>
            סגירה
          </button>
        </div>
        {failed && <p className="admin-error">לא הצלחנו לטעון את האיורים</p>}
        <div className="starter-grid">
          {items?.map((it) => (
            <button key={it.file} className="starter-item" onClick={() => onPick(it)}>
              <img src={starterUrl(it.file)} alt={it.word} />
              <span>{it.word}</span>
            </button>
          ))}
        </div>
        <p className="muted small attribution">
          האיורים מתוך{' '}
          <a href="https://openmoji.org" target="_blank" rel="noreferrer">
            OpenMoji
          </a>{' '}
          ברישיון CC BY-SA 4.0.
        </p>
      </div>
    </div>
  );
}
