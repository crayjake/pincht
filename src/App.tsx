import { useEffect, useState } from 'react';
import Home from './components/home/home';
import DoPage from './components/home/do-page';
import Train from './components/train/train';
import LibraryPage from './components/home/library-pages';
import { getDataMode, type DataMode } from './data/mode';
import { selectDataMode } from './data/initialise';
import { RoutinePages } from './routines/routine-pages';
import { ViewPages } from './components/home/view-pages';

export default function App() {
  const [mode, setMode] = useState(getDataMode);
  const [error, setError] = useState('');
  function changeMode(next: DataMode) {
    try { selectDataMode(next); setMode(next); setError(''); window.scrollTo(0, 0); }
    catch { setError('Could not switch data mode. Your stored data has not been cleared.'); }
  }
  return <>{error && <p role="alert">{error}</p>}<AppRoutes key={mode} onDataMode={changeMode} /></>;
}

function AppRoutes({ onDataMode }: { onDataMode: (mode: DataMode) => void }) {
  const [path, setPath] = useState(() => location.hash.slice(1) || '/journal');
  useEffect(() => {
    const update = () => { setPath(location.hash.slice(1) || '/journal'); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  if (path === '/do') return <DoPage />;
  if (path.startsWith('/library')) return <LibraryPage key={path} category={path.split('/')[2]} id={path.split('/')[3] ? decodeURIComponent(path.split('/')[3]) : undefined} onDataMode={onDataMode} />;
  if (path.startsWith('/train')) return <Train key={path} presetId={path.split('/')[2]} />;
  if (path.startsWith('/routines')) return <RoutinePages key={path} id={path.split('/')[2]} />;
  if (path.startsWith('/views')) return <ViewPages key={path} id={path.split('/')[3]} />;
  if (path.startsWith('/view/')) return <Home key={path} viewId={path.split('/')[2]} screen="climbing" />;
  if (path === '/climbs' || path === '/metrics') return <LibraryPage key={path} category={path === '/climbs' ? 'climbs' : 'metrics'} onDataMode={onDataMode} />;
  const entryDate = /^\/journal\/(\d{4}-\d{2}-\d{2})$/.exec(path)?.[1];
  return <Home key={path} entryDate={entryDate} screen={path === '/climbing' ? 'climbing' : path === '/todo' || path === '/today' ? 'today' : 'journal'} onDataMode={onDataMode} />;
}
