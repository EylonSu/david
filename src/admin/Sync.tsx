import { useState, useSyncExternalStore } from 'react';
import { chooseLink, getSyncStatus, subscribeSyncStatus, syncNow, type SyncState } from '../sync/engine';
import { signIn, signOut } from '../sync/firebase';
import './admin.css';

const STATE_LABEL: Record<SyncState, string> = {
  disabled: 'לא מוגדר',
  'signed-out': 'לא מחובר',
  idle: 'מסונכרן ✅',
  syncing: 'מסנכרן…',
  offline: 'אין חיבור לאינטרנט',
  error: 'שגיאה',
};

export function Sync() {
  const status = useSyncExternalStore(subscribeSyncStatus, getSyncStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError((e as Error)?.message || 'שגיאה');
    } finally {
      setBusy(false);
    }
  }

  if (status.state === 'disabled') {
    return (
      <div className="admin-section">
        <h2>סנכרון</h2>
        <p className="hint">הסנכרון לענן אינו מוגדר בגרסה זו. כל הנתונים נשמרים במכשיר בלבד.</p>
      </div>
    );
  }

  const signedIn = status.state !== 'signed-out';

  return (
    <div className="admin-section">
      <h2>סנכרון</h2>
      <p className="muted small">
        התחברו עם חשבון Google כדי לשמור את התמונות, השיעורים וההקלטות בענן ולסנכרן בין מכשירים. המשחק ממשיך לעבוד גם
        בלי אינטרנט.
      </p>

      <div className="card editor-block">
        {signedIn ? (
          <>
            <p className="small">
              מחובר כ־<b dir="ltr">{status.email}</b>
            </p>
            <p className="small">
              מצב: <b>{STATE_LABEL[status.state]}</b>
              {status.pending > 0 && ` · ${status.pending} שינויים ממתינים`}
            </p>
            {status.lastSync && (
              <p className="muted small">סנכרון אחרון: {new Date(status.lastSync).toLocaleString('he-IL')}</p>
            )}
            {status.state === 'error' && status.error && <p className="admin-error small">{status.error}</p>}
            <div className="btn-row">
              <button className="btn btn-primary" disabled={busy || status.needsLinkChoice} onClick={syncNow}>
                🔄 סנכרון עכשיו
              </button>
              <button className="btn" disabled={busy} onClick={() => run(signOut)}>
                התנתקות
              </button>
            </div>
          </>
        ) : (
          <div className="btn-row">
            <button className="btn btn-primary" disabled={busy} onClick={() => run(signIn)}>
              התחברות עם Google
            </button>
          </div>
        )}
      </div>

      {error && <p className="admin-error">{error}</p>}

      {status.needsLinkChoice && (
        <div className="modal-backdrop">
          <div className="modal card">
            <h3>יש נתונים גם במכשיר וגם בענן</h3>
            <p className="small">איך להמשיך?</p>
            <div className="btn-row">
              <button
                className="btn btn-primary"
                onClick={() =>
                  confirm('כל הנתונים במכשיר הזה יימחקו ויוחלפו בנתונים מהענן. להמשיך?') && chooseLink('cloud')
                }
              >
                ☁️ שימוש בנתוני הענן (החלפת המכשיר)
              </button>
              <button className="btn" onClick={() => chooseLink('merge')}>
                🔀 מיזוג שניהם
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
