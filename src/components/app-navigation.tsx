import { Icon } from './home/journal-icons';
export function PrimaryNav({ active }: { active?: string }) {
  const tabs = [{ id: 'journal', label: 'Journal', path: '/journal', icon: 'book' }, { id: 'do', label: 'Do', path: '/do', icon: 'bolt' }, { id: 'library', label: 'Library', path: '/library', icon: 'library' }] as const;
  return <nav className="primary-nav" aria-label="Primary">{tabs.map(tab => <a key={tab.id} href={`#${tab.path}`} aria-label={tab.label} title={tab.label} aria-current={active === tab.id ? 'page' : undefined}><span><Icon name={tab.icon} size={24} /></span></a>)}</nav>;
}
export function InDevelopment() {
  return <div className="indev-banner" role="note"><strong>In development</strong><span>Awaiting UI/UX pass</span></div>;
}
