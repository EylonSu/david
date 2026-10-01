import { useState } from 'react';
import { backupFileName, downloadBlob, exportBackup, importBackup, readBackup, shareOrDownload } from '../backup/backup';
import './admin.css';

export function Backup() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const [error, setError] = useState<string>();
  const [lastZip, setLastZip] = useState<Blob>();

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMsg(undefined);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') setError((e as Error)?.message || 'שגיאה');
    } finally {
      setBusy(false);
    }
  }

  const doExport = () =>
    run(async () => {
      const blob = await exportBackup();
      setLastZip(blob);
      const how = await shareOrDownload(blob, backupFileName());
      setMsg(how === 'shared' ? 'הגיבוי נשלח ✅' : 'הגיבוי הורד לתיקיית ההורדות ✅');
    });

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    run(async () => {
      const { zip, data } = await readBackup(f);
      const ok = confirm(
        `בגיבוי: ${data.pictures.length} תמונות, ${data.lessons.length} שיעורים, ${data.praises.length} מחמאות.\n` +
          'הייבוא ימחק את כל הנתונים הנוכחיים במכשיר ויחליף אותם. להמשיך?',
      );
      if (!ok) return;
      const s = await importBackup(zip, data);
      setMsg(`הייבוא הושלם ✅ (${s.pictures} תמונות, ${s.lessons} שיעורים, ${s.praises} מחמאות)`);
    });
  };

  return (
    <div className="admin-section">
      <h2>גיבוי</h2>
      <p className="muted small">
        כל התמונות וההקלטות נשמרות רק במכשיר הזה. ייצאו קובץ גיבוי ושמרו אותו בדרייב או בוואטסאפ, כדי לשחזר או להעביר
        למכשיר אחר.
      </p>

      <div className="card editor-block">
        <h3>ייצוא</h3>
        <div className="btn-row">
          <button className="btn btn-primary" disabled={busy} onClick={doExport}>
            📤 ייצוא גיבוי
          </button>
          {lastZip && (
            <button className="btn" disabled={busy} onClick={() => downloadBlob(lastZip, backupFileName())}>
              ⬇️ הורדה כקובץ
            </button>
          )}
        </div>
      </div>

      <div className="card editor-block">
        <h3>ייבוא</h3>
        <p className="muted small">שחזור מקובץ גיבוי (‎.zip). פעולה זו מחליפה את כל הנתונים הקיימים.</p>
        <label className={`btn ${busy ? 'disabled' : ''}`}>
          📥 בחירת קובץ גיבוי
          <input type="file" accept=".zip,application/zip" hidden disabled={busy} onChange={onFile} />
        </label>
      </div>

      {busy && <p className="muted">עובד…</p>}
      {msg && <p className="admin-ok">{msg}</p>}
      {error && <p className="admin-error">{error}</p>}
    </div>
  );
}
