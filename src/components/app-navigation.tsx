import { Icon } from './home/journal-icons';
export function PrimaryNav({ active }: { active?: 'today' | 'journal' | 'climbing' | 'train' }) {
  const tabs = [{ id: 'today', label: 'Today', path: '/today', icon: 'today' }, { id: 'journal', label: 'Journal', path: '/journal', icon: 'book' }, { id: 'climbing', label: 'Climbing', path: '/climbing', icon: 'climbs' }, { id: 'train', label: 'Train', path: '/train', icon: 'train' }] as const;
  return <nav className="primary-nav" aria-label="Primary">{tabs.map(tab => <a key={tab.id} href={`#${tab.path}`} aria-current={active === tab.id ? 'page' : undefined}><span><Icon name={tab.icon} size={24} /></span>{tab.label}</a>)}</nav>;
}
export function InDevelopment() {
  return <div className="indev-banner" role="note"><strong>In development</strong><span>Awaiting UI/UX pass</span></div>;
}
