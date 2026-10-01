import { addPraise, deletePraise, usePraises, type Praise } from '../db';
import { useBlobUrl } from '../media/useBlobUrl';
import { RecorderBox } from './RecorderBox';
import './admin.css';

export function Praises() {
  const praises = usePraises();

  return (
    <div className="admin-section">
      <h2>מחמאות</h2>
      <p className="muted small">
        הקליטו כמה משפטי עידוד קצרים ("כל הכבוד דוד!", "יופי!", "איזה יופי אמרת!"). בכל הצלחה יושמע אחד מהם באקראי.
      </p>
      <div className="card editor-block">
        <h3>הקלטה חדשה</h3>
        <RecorderBox kinds={['audio']} maxMs={4000} onRecorded={(r) => addPraise(r.blob, r.mimeType)} />
      </div>
      {praises?.length === 0 && <p className="muted">עדיין אין מחמאות מוקלטות.</p>}
      <ul className="praise-list">
        {praises?.map((p, i) => <PraiseRow key={p.id} praise={p} index={i + 1} />)}
      </ul>
    </div>
  );
}

function PraiseRow({ praise, index }: { praise: Praise; index: number }) {
  const url = useBlobUrl(praise.blob);
  return (
    <li className="card praise-row">
      <span className="praise-num">{index}</span>
      <audio src={url} controls />
      <button
        className="icon-btn danger"
        aria-label="מחיקה"
        onClick={() => confirm('למחוק את ההקלטה?') && deletePraise(praise.id)}
      >
        🗑️
      </button>
    </li>
  );
}
