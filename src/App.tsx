import SettingsPage from './settings/settings-page';
import { applyAppearance } from './data/preferences';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { storageError, subscribeStorageErrors } from './data/storage';
import Home from './components/home/home';
import DoPage from './components/home/do-page';
import Train from './components/train/train';
import LibraryPage from './components/home/library-pages';
import { getDataMode, type DataMode } from './data/mode';
import { selectDataMode } from './data/initialise';
import { RoutinePages } from './routines/routine-pages';
import { FirstRun, needsSetup } from './setup/setup';
import { ViewPages } from './components/home/view-pages';
import { lastJournalView } from './components/home/journal-views';
import { NavigationProvider, usePath } from './navigation';

export default function App() {
  useEffect(() => applyAppearance(), []);
  const [mode, setMode] = useState(getDataMode);
  const [error, setError] = useState('');
  const [setup, setSetup] = useState(needsSetup);
  const readError = useSyncExternalStore(subscribeStorageErrors, storageError);
  function changeMode(next: DataMode) {
    try { selectDataMode(next); setMode(next); setSetup(needsSetup()); setError(''); window.scrollTo(0, 0); }
    catch { setError('Could not switch data mode. Your stored data has not been cleared.'); }
  }
  return <><div className="app-status-bar" aria-hidden="true" />{(error || readError) && <p role="alert">{error || readError}</p>}{setup ? <FirstRun onDone={() => setSetup(false)} /> : <AppRoutes key={mode} onDataMode={changeMode} />}</>;
}

function AppRoutes({ onDataMode }: { onDataMode: (mode: DataMode) => void }) {
  return <NavigationProvider><Routes onDataMode={onDataMode} /></NavigationProvider>;
}
function Routes({ onDataMode }: { onDataMode: (mode: DataMode) => void }) {
  const path = usePath();
  if (path === '/settings') return <SettingsPage onDataMode={onDataMode} />;
  if (path === '/do') return <DoPage />;
  if (path.startsWith('/library')) {
    const [route, query] = path.split('?');
    return <LibraryPage key={path} category={route.split('/')[2]} id={route.split('/')[3] ? decodeURIComponent(route.split('/')[3]) : undefined} seriesId={new URLSearchParams(query).get('series') ?? undefined} />;
  }
  if (path.startsWith('/train')) return <Train key={path} presetId={path.split('/')[2]} />;
  if (path.startsWith('/routines')) return <RoutinePages key={path} id={path.split('/')[2]} />;
  if (path.startsWith('/views')) {
    const [route, query] = path.split('?');
    return <ViewPages key={path} id={route.split('/')[3]} returnTo={new URLSearchParams(query).get('returnTo') ?? undefined} />;
  }
  if (path.startsWith('/view/')) return <Home key={path} viewId={path.split('/')[2]} screen="climbing" />;
  if (path === '/climbs' || path === '/metrics') return <LibraryPage key={path} category={path === '/climbs' ? 'climbs' : 'metrics'} />;
  const entryDate = /^\/journal\/(\d{4}-\d{2}-\d{2})$/.exec(path)?.[1];
  return <Home key={path} entryDate={entryDate} viewId={!entryDate && (path === '/journal' || path === '/') ? lastJournalView().id : undefined} screen={path === '/climbing' ? 'climbing' : path === '/todo' || path === '/today' ? 'today' : 'journal'} onDataMode={onDataMode} />;
}
