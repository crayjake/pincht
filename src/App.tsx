import { useEffect, useState } from 'react';
import Home from './components/home/home';
import Train from './components/train/train';
import LibraryPage from './components/home/library-pages';

export default function App() {
  const [path, setPath] = useState(() => location.hash.slice(1) || '/today');
  useEffect(() => {
    const update = () => { setPath(location.hash.slice(1) || '/today'); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  if (path.startsWith('/train')) return <Train presetId={path.split('/')[2]} />;
  if (path === '/climbs' || path === '/metrics') return <LibraryPage key={path} kind={path === '/climbs' ? 'climbs' : 'metrics'} />;
  const entryDate = /^\/journal\/(\d{4}-\d{2}-\d{2})$/.exec(path)?.[1];
  return <Home key={entryDate ?? 'main'} entryDate={entryDate} screen={path === '/climbing' ? 'climbing' : path.startsWith('/journal') ? 'journal' : 'today'} />;
}
