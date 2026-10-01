import { useRoute } from './router';
import { Home } from './child/Home';
import { GridMode } from './child/GridMode';
import { SingleMode } from './child/SingleMode';
import { AdminPanel } from './admin/AdminPanel';

export function App() {
  const [head, ...rest] = useRoute();

  if (head === 'admin') return <AdminPanel route={rest} />;
  if (head === 'play' && rest[1]) {
    if (rest[0] === 'grid') return <GridMode lessonId={rest[1]} />;
    if (rest[0] === 'single') return <SingleMode lessonId={rest[1]} />;
  }
  return <Home />;
}
