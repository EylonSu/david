import { useEffect, useRef, useState } from 'react';
import { updateSettings, useSettings } from '../db';
import { startVoiceDetector, type VoiceDetector } from '../audio/voiceDetector';
import './admin.css';

export function Settings() {
  const settings = useSettings();

  return (
    <div className="admin-section">
      <h2>הגדרות</h2>

      <div className="card editor-block">
        <h3>רגישות המיקרופון</h3>
        <input
          type="range"
          className="range"
          min={1.5}
          max={8}
          step={0.5}
          value={settings.micSensitivity}
          onChange={(e) => updateSettings({ micSensitivity: Number(e.target.value) })}
        />
        <div className="range-labels muted small">
          <span>רגיש מאוד (קול שקט)</span>
          <span>פחות רגיש (חדר רועש)</span>
        </div>
      </div>

      <div className="card editor-block">
        <h3>זמן הקשבה: {settings.listenSeconds} שניות</h3>
        <input
          type="range"
          className="range"
          min={3}
          max={12}
          step={1}
          value={settings.listenSeconds}
          onChange={(e) => updateSettings({ listenSeconds: Number(e.target.value) })}
        />
      </div>

      <MicTest sensitivity={settings.micSensitivity} />

      <div className="card editor-block tips">
        <h3>טיפים</h3>
        <p>
          <strong>התקנה כאפליקציה:</strong> בכרום, תפריט ⋮ ← "הוספה למסך הבית" (או "התקנת אפליקציה"). כך האפליקציה
          נפתחת במסך מלא ועובדת גם בלי אינטרנט.
        </p>
        <p>
          <strong>נעילת מסך (הצמדת אפליקציה):</strong> כדי שדוד לא יצא מהאפליקציה בטעות, הפעילו בהגדרות אנדרואיד ←
          אבטחה ← "הצמדת אפליקציה" (App pinning). אחר כך פתחו את מסך האפליקציות האחרונות, לחצו על סמל האפליקציה ובחרו
          "הצמדה". לביטול: לחיצה ארוכה על "חזרה" ו"סקירה" יחד.
        </p>
        <p>
          <strong>גיבוי:</strong> הנתונים נשמרים רק במכשיר. כדאי לייצא גיבוי מדי פעם (בלשונית "גיבוי").
        </p>
      </div>
    </div>
  );
}

function MicTest({ sensitivity }: { sensitivity: number }) {
  const [on, setOn] = useState(false);
  const [level, setLevel] = useState(0);
  const [threshold, setThreshold] = useState(0);
  const [heard, setHeard] = useState(false);
  const [error, setError] = useState<string>();
  const det = useRef<VoiceDetector>();

  useEffect(() => {
    if (!on) return;
    let cancelled = false;
    setHeard(false);
    let heardTimer: ReturnType<typeof setTimeout>;
    startVoiceDetector({
      sensitivity,
      onLevel: (l, t) => {
        setLevel(l);
        setThreshold(t);
      },
      onVoice: () => {
        setHeard(true);
        clearTimeout(heardTimer);
        heardTimer = setTimeout(() => setHeard(false), 1500);
      },
    }).then(
      (d) => (cancelled ? d.stop() : (det.current = d)),
      () => {
        setError('אין גישה למיקרופון');
        setOn(false);
      },
    );
    return () => {
      cancelled = true;
      clearTimeout(heardTimer);
      det.current?.stop();
      det.current = undefined;
      setLevel(0);
    };
  }, [on, sensitivity]);

  return (
    <div className="card editor-block">
      <h3>בדיקת מיקרופון</h3>
      <p className="muted small">הפעילו, שתקו רגע (מדידת רעש רקע), ואז דברו. הקו האדום הוא הסף לזיהוי קול.</p>
      <div className="meter">
        <div className={`meter-fill ${level > threshold && threshold > 0 ? 'over' : ''}`} style={{ width: `${level * 100}%` }} />
        {threshold > 0 && <div className="meter-threshold" style={{ insetInlineStart: `${threshold * 100}%` }} />}
      </div>
      <p className={`mic-status ${heard ? 'heard' : ''}`}>{on ? (heard ? '✅ זוהה קול!' : 'מקשיב…') : ' '}</p>
      <button
        className={`btn ${on ? 'btn-danger' : 'btn-primary'}`}
        onClick={() => {
          setError(undefined);
          setOn(!on);
        }}
      >
        {on ? 'עצירה' : '🎤 התחלת בדיקה'}
      </button>
      {error && <p className="admin-error">{error}</p>}
    </div>
  );
}
