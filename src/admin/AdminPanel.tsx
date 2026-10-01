import { href, navigate } from '../router';
import { PictureBank } from './PictureBank';
import { PictureEditor } from './PictureEditor';
import { Lessons } from './Lessons';
import { Praises } from './Praises';
import { Settings } from './Settings';
import { Backup } from './Backup';

const SECTIONS = [
  { key: 'pictures', label: 'תמונות' },
  { key: 'lessons', label: 'שיעורים' },
  { key: 'praises', label: 'מחמאות' },
  { key: 'settings', label: 'הגדרות' },
  { key: 'backup', label: 'גיבוי' },
] as const;

/** Admin shell. `route` is the segments after 'admin', e.g. ['pictures', 'new']. */
export function AdminPanel({ route }: { route: string[] }) {
  const section = route[0] ?? 'pictures';
  const sub = route[1];

  let content;
  switch (section) {
    case 'pictures':
      content = sub ? <PictureEditor pictureId={sub === 'new' ? undefined : sub} /> : <PictureBank />;
      break;
    case 'lessons':
      content = <Lessons />;
      break;
    case 'praises':
      content = <Praises />;
      break;
    case 'settings':
      content = <Settings />;
      break;
    case 'backup':
      content = <Backup />;
      break;
    default:
      content = <PictureBank />;
  }

  return (
    <div className="admin">
      <header className="admin-header">
        <h1>ניהול</h1>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          חזרה למשחק
        </button>
      </header>
      <nav className="admin-nav">
        {SECTIONS.map((s) => (
          <a key={s.key} href={href(`/admin/${s.key}`)} className={s.key === section ? 'active' : ''}>
            {s.label}
          </a>
        ))}
      </nav>
      <main className="admin-content">{content}</main>
    </div>
  );
}
