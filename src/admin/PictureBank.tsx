import { usePictures, type Picture } from '../db';
import { useBlobUrl } from '../media/useBlobUrl';
import { href, navigate } from '../router';
import './admin.css';

export function PictureThumb({ picture }: { picture: Picture }) {
  const url = useBlobUrl(picture.image);
  return <img className="thumb-img" src={url} alt={picture.word} />;
}

export function PictureBank() {
  const pictures = usePictures();

  return (
    <div className="admin-section">
      <div className="section-head">
        <h2>בנק תמונות</h2>
        <button className="btn btn-primary" onClick={() => navigate('/admin/pictures/new')}>
          ＋ תמונה חדשה
        </button>
      </div>
      {pictures && pictures.length === 0 && (
        <p className="muted">עדיין אין תמונות. הוסיפו תמונה מהמצלמה, מהגלריה או מהאיורים המוכנים.</p>
      )}
      <div className="thumb-grid">
        {pictures?.map((p) => (
          <a key={p.id} className="thumb card" href={href(`/admin/pictures/${p.id}`)}>
            <PictureThumb picture={p} />
            <span className="thumb-word">{p.word || 'ללא שם'}</span>
            <span className={`thumb-badge ${p.media ? '' : 'missing'}`}>
              {p.media ? (p.media.kind === 'video' ? '🎥' : '🎤') : 'אין הקלטה'}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
