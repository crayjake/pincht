import { Icon } from './home/journal-icons';
import { loadViews } from './home/journal-views';
export function PrimaryNav({ active }: { active?: string }) {
  const view = loadViews().find(view => view.tab);
  const tabs = [{ id: 'today', label: 'Today', path: '/today', icon: 'today' }, { id: 'journal', label: 'Journal', path: '/journal', icon: 'book' }, { id: view?.id ?? 'views', label: view?.name ?? 'Views', path: view ? `/view/${view.id}` : '/views', icon: 'climbs' }, { id: 'train', label: 'Train', path: '/train', icon: 'train' }] as const;
  return <nav className="primary-nav" aria-label="Primary">{tabs.map(tab => <a key={tab.id} href={`#${tab.path}`} aria-current={active === tab.id ? 'page' : undefined}><span><Icon name={tab.icon} size={24} /></span>{tab.label}</a>)}</nav>;
}
export function InDevelopment() {
  return <div className="indev-banner" role="note"><strong>In development</strong><span>Awaiting UI/UX pass</span></div>;
}
