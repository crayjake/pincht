import { Icon } from './home/journal-icons';
export function PrimaryNav({ active }: { active: 'today' | 'train' | 'climbs' | 'metrics' }) {
  const tabs = [{ id: 'today', label: 'Today', path: '/journal' }, { id: 'train', label: 'Train', path: '/train' }, { id: 'climbs', label: 'Climbs', path: '/climbs' }, { id: 'metrics', label: 'Metrics', path: '/metrics' }] as const;
  return <nav className="primary-nav" aria-label="Primary">{tabs.map(tab => <a key={tab.id} href={`#${tab.path}`} aria-current={active === tab.id ? 'page' : undefined}><span><Icon name={tab.id} size={24} /></span>{tab.label}</a>)}</nav>;
}
export function InDevelopment() {
  return <div className="indev-banner" role="note"><strong>In development</strong><span>Awaiting UI/UX pass</span></div>;
}
