import { useEffect, useState } from 'react';
import Home from './components/home/home';
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
  const [path, setPath] = useState(() => location.hash.slice(1) || '/today');
  useEffect(() => {
    const update = () => { setPath(location.hash.slice(1) || '/today'); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  if (path.startsWith('/train')) return <Train presetId={path.split('/')[2]} />;
  if (path.startsWith('/routines')) return <RoutinePages key={path} id={path.split('/')[2]} />;
  if (path.startsWith('/views')) return <ViewPages key={path} id={path.split('/')[3]} />;
  if (path.startsWith('/view/')) return <Home key={path} viewId={path.split('/')[2]} screen="climbing" />;
  if (path === '/climbs' || path === '/metrics') return <LibraryPage key={path} kind={path === '/climbs' ? 'climbs' : 'metrics'} />;
  const entryDate = /^\/journal\/(\d{4}-\d{2}-\d{2})$/.exec(path)?.[1];
  return <Home key={entryDate ?? 'main'} entryDate={entryDate} screen={path === '/climbing' ? 'climbing' : path.startsWith('/journal') ? 'journal' : 'today'} onDataMode={onDataMode} />;
}
